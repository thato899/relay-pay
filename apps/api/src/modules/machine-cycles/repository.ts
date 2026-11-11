import type { MachineCycleAcknowledgement } from "@mmp/contracts";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { auditEvents, invoices, machineCycles, payments } from "../../db/schema.js";
import type { AuditContext } from "../invoices/repository.js";

export const MACHINE_CYCLE_POLL_INTERVAL_SECONDS = 10;
export const MACHINE_CYCLE_MAX_POLLS = 180;

export type MachineCycleRow = typeof machineCycles.$inferSelect;
export type MachineInvoiceRow = typeof invoices.$inferSelect;

export type CycleReadResult =
  | { kind: "ok"; cycle: MachineCycleRow; invoice: MachineInvoiceRow }
  | { kind: "not_found" }
  | { kind: "too_soon"; retryAfterSeconds: number }
  | { kind: "poll_limit" };

export type CycleMutationResult =
  | { kind: "ok"; cycle: MachineCycleRow; invoice: MachineInvoiceRow; changed: boolean }
  | { kind: "not_found" }
  | { kind: "payment_required"; cycle: MachineCycleRow; invoice: MachineInvoiceRow }
  | { kind: "payment_not_validated"; cycle: MachineCycleRow; invoice: MachineInvoiceRow }
  | { kind: "invalid_transition"; state: MachineCycleRow["state"] };

export class MachineCycleRepository {
  private async lockCycle(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    deviceId: string,
    operationId: string,
  ): Promise<MachineCycleRow | undefined> {
    const [cycle] = await tx
      .select()
      .from(machineCycles)
      .where(and(eq(machineCycles.deviceId, deviceId), eq(machineCycles.operationId, operationId)))
      .for("update")
      .limit(1);
    return cycle;
  }

  private async findInvoice(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    invoiceId: string,
  ): Promise<MachineInvoiceRow | undefined> {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    return invoice;
  }

  private async syncInvoiceAndCycle(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    cycle: MachineCycleRow,
    invoice: MachineInvoiceRow,
    audit: AuditContext,
  ): Promise<{ cycle: MachineCycleRow; invoice: MachineInvoiceRow }> {
    let currentInvoice = invoice;
    if (currentInvoice.status === "pending" && currentInvoice.expiresAt.getTime() <= Date.now()) {
      const [expired] = await tx
        .update(invoices)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(invoices.id, currentInvoice.id), eq(invoices.status, "pending")))
        .returning();
      if (expired) {
        currentInvoice = expired;
        await tx.insert(auditEvents).values({
          ...audit,
          action: "invoice.expired",
          resourceType: "invoice",
          resourceId: expired.id,
          metadata: { source: "machine-cycle-poll" },
        });
      }
    }

    let nextState: MachineCycleRow["state"] | null = null;
    if (cycle.state === "awaiting_payment" && currentInvoice.status === "paid") nextState = "paid";
    if (cycle.state === "awaiting_payment" && currentInvoice.status === "expired")
      nextState = "expired";
    if (!nextState) return { cycle, invoice: currentInvoice };

    const [updated] = await tx
      .update(machineCycles)
      .set({ state: nextState, updatedAt: new Date() })
      .where(eq(machineCycles.id, cycle.id))
      .returning();
    if (!updated) throw new Error("Machine cycle state update returned no row");
    await tx.insert(auditEvents).values({
      ...audit,
      action: `machine_cycle.${nextState}`,
      resourceType: "machine_cycle",
      resourceId: updated.id,
      metadata: { invoiceId: currentInvoice.id, operationId: cycle.operationId },
    });
    return { cycle: updated, invoice: currentInvoice };
  }

  async readForDevice(
    deviceId: string,
    operationId: string,
    audit: AuditContext,
    recordPoll: boolean,
  ): Promise<CycleReadResult> {
    return db.transaction(async (tx) => {
      const cycle = await this.lockCycle(tx, deviceId, operationId);
      if (!cycle) return { kind: "not_found" };
      const invoice = await this.findInvoice(tx, cycle.invoiceId);
      if (!invoice) throw new Error("Machine cycle references a missing invoice");
      const synced = await this.syncInvoiceAndCycle(tx, cycle, invoice, audit);
      let currentCycle = synced.cycle;

      if (recordPoll && currentCycle.state !== "started" && currentCycle.state !== "expired") {
        if (currentCycle.pollCount >= MACHINE_CYCLE_MAX_POLLS) return { kind: "poll_limit" };
        const intervalMs = MACHINE_CYCLE_POLL_INTERVAL_SECONDS * 1_000;
        if (currentCycle.lastPolledAt) {
          const remainingMs = currentCycle.lastPolledAt.getTime() + intervalMs - Date.now();
          if (remainingMs > 0)
            return { kind: "too_soon", retryAfterSeconds: Math.ceil(remainingMs / 1_000) };
        }
        const [updated] = await tx
          .update(machineCycles)
          .set({
            lastPolledAt: new Date(),
            pollCount: currentCycle.pollCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(machineCycles.id, currentCycle.id))
          .returning();
        if (!updated) throw new Error("Machine cycle poll update returned no row");
        currentCycle = updated;
      }
      return { kind: "ok", cycle: currentCycle, invoice: synced.invoice };
    });
  }

  async requestStart(
    deviceId: string,
    operationId: string,
    audit: AuditContext,
  ): Promise<CycleMutationResult> {
    return db.transaction(async (tx) => {
      const cycle = await this.lockCycle(tx, deviceId, operationId);
      if (!cycle) return { kind: "not_found" };
      const invoice = await this.findInvoice(tx, cycle.invoiceId);
      if (!invoice) throw new Error("Machine cycle references a missing invoice");
      const synced = await this.syncInvoiceAndCycle(tx, cycle, invoice, audit);
      if (synced.cycle.state !== "paid" && synced.cycle.state !== "start_requested") {
        return { kind: "payment_required", cycle: synced.cycle, invoice: synced.invoice };
      }
      if (synced.cycle.state === "start_requested")
        return { kind: "ok", cycle: synced.cycle, invoice: synced.invoice, changed: false };

      const [validatedPayment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.invoiceId, synced.invoice.id), eq(payments.network, "xrpl-testnet")))
        .limit(1);
      if (!validatedPayment)
        return { kind: "payment_not_validated", cycle: synced.cycle, invoice: synced.invoice };

      const [updated] = await tx
        .update(machineCycles)
        .set({ state: "start_requested", updatedAt: new Date() })
        .where(eq(machineCycles.id, synced.cycle.id))
        .returning();
      if (!updated) throw new Error("Machine cycle start request returned no row");
      await tx.insert(auditEvents).values({
        ...audit,
        action: "machine_cycle.start_requested",
        resourceType: "machine_cycle",
        resourceId: updated.id,
        metadata: { invoiceId: synced.invoice.id, operationId },
      });
      return { kind: "ok", cycle: updated, invoice: synced.invoice, changed: true };
    });
  }

  async acknowledge(
    deviceId: string,
    operationId: string,
    acknowledgement: MachineCycleAcknowledgement,
    audit: AuditContext,
  ): Promise<CycleMutationResult> {
    return db.transaction(async (tx) => {
      const cycle = await this.lockCycle(tx, deviceId, operationId);
      if (!cycle) return { kind: "not_found" };
      const invoice = await this.findInvoice(tx, cycle.invoiceId);
      if (!invoice) throw new Error("Machine cycle references a missing invoice");

      if (cycle.state === "started" && acknowledgement.outcome === "started")
        return { kind: "ok", cycle, invoice, changed: false };
      if (cycle.state === "start_unknown" && acknowledgement.outcome === "unknown")
        return { kind: "ok", cycle, invoice, changed: false };
      if (
        cycle.state !== "start_requested" &&
        !(cycle.state === "start_unknown" && acknowledgement.outcome === "started")
      )
        return { kind: "invalid_transition", state: cycle.state };

      const nextState = acknowledgement.outcome === "started" ? "started" : "start_unknown";
      const [updated] = await tx
        .update(machineCycles)
        .set({
          state: nextState,
          ...(nextState === "started" ? { startedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(machineCycles.id, cycle.id))
        .returning();
      if (!updated) throw new Error("Machine cycle acknowledgement returned no row");
      await tx.insert(auditEvents).values({
        ...audit,
        action: `machine_cycle.${nextState}`,
        resourceType: "machine_cycle",
        resourceId: updated.id,
        metadata: { invoiceId: invoice.id, operationId },
      });
      return { kind: "ok", cycle: updated, invoice, changed: true };
    });
  }
}
