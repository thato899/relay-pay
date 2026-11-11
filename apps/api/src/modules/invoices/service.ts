import { createHash, randomInt, randomUUID } from "node:crypto";
import type {
  CreateInvoiceBody,
  CreateMachineInvoiceBody,
  InvoiceDto,
  PaymentMode,
  PublicCheckoutDto,
} from "@mmp/contracts";
import { xrpToDrops } from "xrpl";
import { config } from "../../config.js";
import type { DeviceIdentity } from "../auth/oidc.js";
import {
  type AuditContext,
  DeviceOperationConflictError,
  type InvoiceRepository,
  type InvoiceRow,
} from "./repository.js";

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("Invoice not found");
    this.name = "InvoiceNotFoundError";
  }
}

export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceValidationError";
  }
}

export class InvoiceClosedError extends Error {
  constructor(status: "paid" | "expired") {
    super(`Invoice is already ${status}.`);
    this.name = "InvoiceClosedError";
  }
}

export class DeviceBudgetDeniedError extends Error {
  constructor(readonly reason: string) {
    super("The device operation is outside its configured spending policy.");
    this.name = "DeviceBudgetDeniedError";
  }
}

function isDestinationTagConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "invoices_destination_tag_unique"
  );
}

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository,
    private readonly mode: PaymentMode,
  ) {}

  async create(
    merchantId: string,
    input: CreateInvoiceBody,
    audit: AuditContext,
  ): Promise<InvoiceDto> {
    let amountDrops: string;
    try {
      amountDrops = xrpToDrops(input.amountXrp);
    } catch {
      throw new InvoiceValidationError(
        "Enter a positive XRP amount with up to six decimal places.",
      );
    }

    const amount = BigInt(amountDrops);
    if (amount < 1n || amount > 1_000_000_000_000n) {
      throw new InvoiceValidationError("Amount must be between 0.000001 and 1,000,000 XRP.");
    }

    const expiresInMinutes = input.expiresInMinutes ?? 30;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
    let row: InvoiceRow | undefined;

    for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
      try {
        row = await this.repository.create(
          {
            id: randomUUID(),
            merchantId,
            amountXrp: input.amountXrp,
            amountDrops,
            reference: input.reference?.trim() || null,
            destinationAddress: config.merchantAddress,
            destinationTag: randomInt(1, 0xffff_ffff),
            network: this.mode,
            expiresAt,
          },
          audit,
        );
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }

    if (!row) throw new Error("Could not allocate a unique destination tag");
    return this.toDto(row);
  }

  async createForDevice(
    identity: DeviceIdentity,
    input: CreateMachineInvoiceBody,
    audit: AuditContext,
  ): Promise<{ invoice: InvoiceDto; created: boolean }> {
    let amountDrops: string;
    try {
      amountDrops = xrpToDrops(input.amountXrp);
    } catch {
      throw new InvoiceValidationError(
        "Enter a positive XRP amount with up to six decimal places.",
      );
    }
    const amount = BigInt(amountDrops);
    if (amount < 1n || amount > 1_000_000_000_000n) {
      throw new InvoiceValidationError("Amount must be between 0.000001 and 1,000,000 XRP.");
    }

    const requestHash = createHash("sha256")
      .update(JSON.stringify([input.cycleCode, input.amountXrp, input.reference?.trim() || null]))
      .digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60_000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.repository.createForDeviceOperation(
          {
            id: randomUUID(),
            merchantId: identity.organizationId,
            amountXrp: input.amountXrp,
            amountDrops,
            reference: input.reference?.trim() || null,
            destinationAddress: config.merchantAddress,
            destinationTag: randomInt(1, 0xffff_ffff),
            network: this.mode,
            expiresAt,
          },
          {
            deviceId: identity.deviceId,
            operationId: input.operationId,
            cycleCode: input.cycleCode,
            requestHash,
          },
          audit,
        );
        if ("denied" in result) throw new DeviceBudgetDeniedError(result.denied);
        return {
          invoice: await this.getForMerchant(result.row.id, identity.organizationId, audit),
          created: result.created,
        };
      } catch (error) {
        if (error instanceof DeviceOperationConflictError) throw error;
        if (attempt === 2 || !isDestinationTagConflict(error)) throw error;
      }
    }
    throw new Error("Could not allocate a unique destination tag");
  }

  async getForMerchant(id: string, merchantId: string, audit?: AuditContext): Promise<InvoiceDto> {
    let row = await this.repository.findById(id, merchantId);
    if (!row) throw new InvoiceNotFoundError();

    if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) {
      await this.repository.expireIfDue(id, merchantId, audit);
      row = await this.repository.findById(id, merchantId);
      if (!row) throw new InvoiceNotFoundError();
    }

    return this.toDto(row);
  }

  async getPublicCheckout(id: string, requestId?: string): Promise<PublicCheckoutDto> {
    let row = await this.repository.findPublicById(id);
    if (!row) throw new InvoiceNotFoundError();

    if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) {
      await this.repository.expirePublicIfDue(id, requestId);
      row = await this.repository.findPublicById(id);
      if (!row) throw new InvoiceNotFoundError();
    }

    return this.toPublicDto(row);
  }

  async simulatePublicDemoPayment(
    id: string,
    transactionHash: string,
    requestId: string,
  ): Promise<PublicCheckoutDto> {
    if (this.mode !== "demo" || !config.demoPaymentsEnabled)
      throw new InvoiceValidationError("Demo payments are disabled.");

    let row = await this.repository.findPublicById(id);
    if (!row) throw new InvoiceNotFoundError();
    if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) {
      await this.repository.expirePublicIfDue(id, requestId);
      row = await this.repository.findPublicById(id);
      if (!row) throw new InvoiceNotFoundError();
    }
    if (row.status !== "pending") throw new InvoiceClosedError(row.status);

    await this.repository.confirmPayment({
      invoiceId: row.id,
      transactionHash,
      amountDrops: row.amountDrops,
      network: "demo",
      ledgerIndex: null,
      actorSubject: "anonymous:checkout-capability",
      organizationId: null,
      requestId,
    });
    return this.getPublicCheckout(id, requestId);
  }

  async list(merchantId: string): Promise<InvoiceDto[]> {
    return (await this.repository.listRecent(merchantId)).map((row) => this.toDto(row));
  }

  private toPublicDto(row: InvoiceRow): PublicCheckoutDto {
    return {
      id: row.id,
      amountXrp: row.amountXrp,
      reference: row.reference,
      status: row.status,
      destinationAddress: row.destinationAddress,
      destinationTag: row.destinationTag,
      checkoutUrl: `${config.publicWebUrl}/checkout/${row.id}`,
      network: row.network,
      expiresAt: row.expiresAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      transactionHash: row.transactionHash,
    };
  }

  private toDto(row: InvoiceRow): InvoiceDto {
    return {
      id: row.id,
      amountXrp: row.amountXrp,
      amountDrops: row.amountDrops,
      reference: row.reference,
      status: row.status,
      destinationAddress: row.destinationAddress,
      destinationTag: row.destinationTag,
      checkoutUrl: `${config.publicWebUrl}/checkout/${row.id}`,
      network: row.network,
      expiresAt: row.expiresAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      transactionHash: row.transactionHash,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
