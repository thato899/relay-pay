import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditEvents,
  deviceBudgets,
  deviceInvoiceOperations,
  devices,
  invoices,
} from "../../db/schema.js";
import type { AuditContext } from "../invoices/repository.js";

export type DeviceBudgetRow = typeof deviceBudgets.$inferSelect;
export type BudgetDenial =
  | "budget_not_configured"
  | "budget_disabled"
  | "payee_not_approved"
  | "cycle_limit_exceeded"
  | "window_limit_exceeded"
  | "device_revoked";

export interface BudgetOverview {
  deviceId: string;
  budget: DeviceBudgetRow | null;
  spentDrops: string;
  reservedDrops: string;
  deniedCount: number;
}

export class DeviceBudgetRepository {
  async read(merchantId: string, deviceId: string): Promise<BudgetOverview | undefined> {
    const [device] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.merchantId, merchantId)))
      .limit(1);
    if (!device) return undefined;
    const [budget] = await db
      .select()
      .from(deviceBudgets)
      .where(eq(deviceBudgets.deviceId, deviceId))
      .limit(1);
    const windowStart = new Date(Date.now() - (budget?.windowSeconds ?? 86_400) * 1_000);
    const [totals] = await db
      .select({
        spentDrops: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' AND ${invoices.paidAt} >= ${windowStart} THEN ${invoices.amountDrops}::numeric ELSE 0 END), 0)::text`,
        reservedDrops: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'pending' AND ${invoices.expiresAt} > now() THEN ${invoices.amountDrops}::numeric ELSE 0 END), 0)::text`,
      })
      .from(deviceInvoiceOperations)
      .innerJoin(invoices, eq(invoices.id, deviceInvoiceOperations.invoiceId))
      .where(eq(deviceInvoiceOperations.deviceId, deviceId));
    const [denials] = await db
      .select({ value: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.resourceType, "device"),
          eq(auditEvents.resourceId, deviceId),
          eq(auditEvents.action, "device_budget.denied"),
          gt(auditEvents.occurredAt, windowStart),
        ),
      );
    return {
      deviceId,
      budget: budget ?? null,
      spentDrops: totals?.spentDrops ?? "0",
      reservedDrops: totals?.reservedDrops ?? "0",
      deniedCount: denials?.value ?? 0,
    };
  }

  async update(
    merchantId: string,
    deviceId: string,
    input: Omit<typeof deviceBudgets.$inferInsert, "id" | "deviceId" | "createdAt" | "updatedAt">,
    audit: AuditContext,
  ): Promise<DeviceBudgetRow | "not_found"> {
    return db.transaction(async (tx) => {
      const [device] = await tx
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.merchantId, merchantId)))
        .for("update")
        .limit(1);
      if (!device) return "not_found";
      const [budget] = await tx
        .insert(deviceBudgets)
        .values({ deviceId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: deviceBudgets.deviceId,
          set: { ...input, updatedAt: new Date() },
        })
        .returning();
      if (!budget) throw new Error("Device budget update returned no row");
      await tx.insert(auditEvents).values({
        ...audit,
        action: "device_budget.updated",
        resourceType: "device",
        resourceId: deviceId,
        metadata: {
          enabled: budget.enabled,
          maxCycleDrops: budget.maxCycleDrops,
          windowBudgetDrops: budget.windowBudgetDrops,
          windowSeconds: budget.windowSeconds,
          approvedPayeeAddress: budget.approvedPayeeAddress,
        },
      });
      return budget;
    });
  }

  async findForUpdate(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], deviceId: string) {
    const [budget] = await tx
      .select()
      .from(deviceBudgets)
      .where(eq(deviceBudgets.deviceId, deviceId))
      .for("update")
      .limit(1);
    return budget;
  }

  async usageForWindow(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    deviceId: string,
    windowSeconds: number,
  ): Promise<{ spentDrops: bigint; reservedDrops: bigint }> {
    const windowStart = new Date(Date.now() - windowSeconds * 1_000);
    const [totals] = await tx
      .select({
        spentDrops: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' AND ${invoices.paidAt} >= ${windowStart} THEN ${invoices.amountDrops}::numeric ELSE 0 END), 0)::text`,
        reservedDrops: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'pending' AND ${invoices.expiresAt} > now() THEN ${invoices.amountDrops}::numeric ELSE 0 END), 0)::text`,
      })
      .from(deviceInvoiceOperations)
      .innerJoin(invoices, eq(invoices.id, deviceInvoiceOperations.invoiceId))
      .where(eq(deviceInvoiceOperations.deviceId, deviceId));
    return {
      spentDrops: BigInt(totals?.spentDrops ?? "0"),
      reservedDrops: BigInt(totals?.reservedDrops ?? "0"),
    };
  }

  async verifyPaidCycle(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    deviceId: string,
    amountDrops: string,
    payeeAddress: string,
    audit: AuditContext,
  ): Promise<BudgetDenial | null> {
    const budget = await this.findForUpdate(tx, deviceId);
    let denial: BudgetDenial | null = null;
    if (!budget) denial = "budget_not_configured";
    else if (!budget.enabled) denial = "budget_disabled";
    else if (budget.approvedPayeeAddress !== payeeAddress) denial = "payee_not_approved";
    else if (BigInt(amountDrops) > BigInt(budget.maxCycleDrops)) denial = "cycle_limit_exceeded";
    else {
      const usage = await this.usageForWindow(tx, deviceId, budget.windowSeconds);
      if (usage.spentDrops + usage.reservedDrops > BigInt(budget.windowBudgetDrops))
        denial = "window_limit_exceeded";
    }
    if (denial) await this.recordDenied(tx, deviceId, denial, audit, amountDrops);
    return denial;
  }

  async recordDenied(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    deviceId: string,
    reason: BudgetDenial,
    audit: AuditContext,
    amountDrops?: string,
  ) {
    await tx.insert(auditEvents).values({
      ...audit,
      action: "device_budget.denied",
      resourceType: "device",
      resourceId: deviceId,
      metadata: { reason, ...(amountDrops ? { requestedAmountDrops: amountDrops } : {}) },
    });
  }
}
