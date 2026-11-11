import type { PaymentMode } from "@mmp/contracts";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditEvents,
  deviceInvoiceOperations,
  invoices,
  machineCycles,
  payments,
} from "../../db/schema.js";

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
  ): Promise<{ row: InvoiceRow; created: boolean }> {
    return db.transaction(async (tx) => {
      const lockKey = `${operation.deviceId}:${operation.operationId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
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
