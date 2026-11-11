import type { PaymentMode } from "@mmp/contracts";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditEvents,
  deviceInvoiceOperations,
  devices,
  invoices,
  machineCycles,
  payments,
} from "../../db/schema.js";
import { type BudgetDenial, DeviceBudgetRepository } from "../devices/budget-repository.js";

export type InvoiceRow = typeof invoices.$inferSelect;

export interface NewInvoice {
  id: string;
  merchantId: string;
  amountXrp: string;
  amountDrops: string;
  reference: string | null;
  destinationAddress: string;
  destinationTag: number;
  network: PaymentMode;
  expiresAt: Date;
}

export interface PaymentConfirmation {
  invoiceId: string;
  transactionHash: string;
  amountDrops: string;
  network: PaymentMode;
  ledgerIndex: number | null;
  actorSubject?: string;
  organizationId?: string | null;
  requestId?: string | null;
}

export interface AuditContext {
  actorSubject: string;
  organizationId: string | null;
  requestId: string | null;
}

export interface MachineOperation {
  deviceId: string;
  operationId: string;
  cycleCode: string;
  requestHash: string;
}

export class DeviceOperationConflictError extends Error {
  constructor() {
    super("This operation ID was already used with different request details.");
    this.name = "DeviceOperationConflictError";
  }
}

export class InvoiceRepository {
  private readonly budgets = new DeviceBudgetRepository();

  async create(input: NewInvoice, audit: AuditContext): Promise<InvoiceRow> {
    const [row] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(invoices).values(input).returning();
      if (created)
        await tx.insert(auditEvents).values({
          ...audit,
          action: "invoice.created",
          resourceType: "invoice",
          resourceId: created.id,
          metadata: { network: created.network },
        });
      return [created];
    });
    if (!row) throw new Error("Invoice insert returned no row");
    return row;
  }

  async createForDeviceOperation(
    input: NewInvoice,
    operation: MachineOperation,
    audit: AuditContext,
  ): Promise<{ row: InvoiceRow; created: boolean } | { denied: BudgetDenial }> {
    return db.transaction(async (tx) => {
      const lockKey = `${operation.deviceId}:${operation.operationId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const [registeredDevice] = await tx
        .select()
        .from(devices)
        .where(eq(devices.id, operation.deviceId))
        .for("update")
        .limit(1);
      if (!registeredDevice?.enabled || registeredDevice.merchantId !== input.merchantId) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "device_revoked",
          audit,
          input.amountDrops,
        );
        return { denied: "device_revoked" };
      }
      const [existing] = await tx
        .select()
        .from(deviceInvoiceOperations)
        .where(
          and(
            eq(deviceInvoiceOperations.deviceId, operation.deviceId),
            eq(deviceInvoiceOperations.operationId, operation.operationId),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.requestHash !== operation.requestHash)
          throw new DeviceOperationConflictError();
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, existing.invoiceId))
          .limit(1);
        if (!invoice) throw new Error("Device operation references a missing invoice");
        return { row: invoice, created: false };
      }

      const budget = await this.budgets.findForUpdate(tx, operation.deviceId);
      if (!budget) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "budget_not_configured",
          audit,
          input.amountDrops,
        );
        return { denied: "budget_not_configured" };
      }
      if (!budget.enabled) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "budget_disabled",
          audit,
          input.amountDrops,
        );
        return { denied: "budget_disabled" };
      }
      const expectedPayee = input.network === "demo" ? "demo" : input.destinationAddress;
      if (expectedPayee !== budget.approvedPayeeAddress) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "payee_not_approved",
          audit,
          input.amountDrops,
        );
        return { denied: "payee_not_approved" };
      }
      const amountDrops = BigInt(input.amountDrops);
      if (amountDrops > BigInt(budget.maxCycleDrops)) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "cycle_limit_exceeded",
          audit,
          input.amountDrops,
        );
        return { denied: "cycle_limit_exceeded" };
      }
      const usage = await this.budgets.usageForWindow(tx, operation.deviceId, budget.windowSeconds);
      if (usage.spentDrops + usage.reservedDrops + amountDrops > BigInt(budget.windowBudgetDrops)) {
        await this.budgets.recordDenied(
          tx,
          operation.deviceId,
          "window_limit_exceeded",
          audit,
          input.amountDrops,
        );
        return { denied: "window_limit_exceeded" };
      }

      const [invoice] = await tx.insert(invoices).values(input).returning();
      if (!invoice) throw new Error("Invoice insert returned no row");
      await tx.insert(auditEvents).values({
        ...audit,
        action: "invoice.created_by_device",
        resourceType: "invoice",
        resourceId: invoice.id,
        metadata: {
          network: invoice.network,
          deviceId: operation.deviceId,
          cycleCode: operation.cycleCode,
        },
      });
      await tx.insert(deviceInvoiceOperations).values({
        deviceId: operation.deviceId,
        operationId: operation.operationId,
        cycleCode: operation.cycleCode,
        requestHash: operation.requestHash,
        invoiceId: invoice.id,
      });
      await tx.insert(machineCycles).values({
        deviceId: operation.deviceId,
        operationId: operation.operationId,
        invoiceId: invoice.id,
        state: "awaiting_payment",
      });
      return { row: invoice, created: true };
    });
  }

  async findById(id: string, merchantId: string): Promise<InvoiceRow | undefined> {
    const [row] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.merchantId, merchantId)))
      .limit(1);
    return row;
  }

  async findPublicById(id: string): Promise<InvoiceRow | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return row;
  }

  async findByTag(tag: number): Promise<InvoiceRow | undefined> {
    const [row] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.destinationTag, tag), eq(invoices.status, "pending")))
      .limit(1);
    return row;
  }

  async listRecent(merchantId: string, limit = 25): Promise<InvoiceRow[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.merchantId, merchantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
  }

  async listPendingForReconciliation(limit = 200): Promise<InvoiceRow[]> {
    return db
      .select()
      .from(invoices)
      .where(and(eq(invoices.status, "pending"), gt(invoices.expiresAt, new Date())))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
  }

  async confirmPayment(input: PaymentConfirmation): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.status, "pending")))
        .limit(1);
      if (!invoice) return false;

      const inserted = await tx
        .insert(payments)
        .values({
          invoiceId: input.invoiceId,
          transactionHash: input.transactionHash,
          amountDrops: input.amountDrops,
          network: input.network,
          ledgerIndex: input.ledgerIndex,
        })
        .onConflictDoNothing({ target: payments.transactionHash })
        .returning({ id: payments.id });
      if (inserted.length === 0) return false;

      await tx
        .update(invoices)
        .set({
          status: "paid",
          paidAt: new Date(),
          transactionHash: input.transactionHash,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId));
      await tx.insert(auditEvents).values({
        actorSubject: input.actorSubject ?? "system:xrpl-reconciliation",
        organizationId: input.organizationId ?? invoice.merchantId,
        requestId: input.requestId ?? null,
        action: "invoice.payment_confirmed",
        resourceType: "invoice",
        resourceId: invoice.id,
        metadata: { network: input.network, transactionHash: input.transactionHash },
      });
      return true;
    });
  }

  async expireIfDue(id: string, merchantId: string, audit?: AuditContext): Promise<void> {
    await db.transaction(async (tx) => {
      const [expired] = await tx
        .update(invoices)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.merchantId, merchantId),
            eq(invoices.status, "pending"),
            sql`${invoices.expiresAt} <= now()`,
          ),
        )
        .returning();
      if (expired)
        await tx.insert(auditEvents).values({
          actorSubject: audit?.actorSubject ?? "system:checkout-expiry",
          organizationId: audit?.organizationId ?? expired.merchantId,
          requestId: audit?.requestId ?? null,
          action: "invoice.expired",
          resourceType: "invoice",
          resourceId: id,
          metadata: {},
        });
    });
  }

  async expirePublicIfDue(id: string, requestId?: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [expired] = await tx
        .update(invoices)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.status, "pending"),
            sql`${invoices.expiresAt} <= now()`,
          ),
        )
        .returning();
      if (expired)
        await tx.insert(auditEvents).values({
          actorSubject: "system:checkout-expiry",
          organizationId: expired.merchantId,
          requestId: requestId ?? null,
          action: "invoice.expired",
          resourceType: "invoice",
          resourceId: id,
          metadata: {},
        });
    });
  }
}
