import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { auditEvents, devices } from "../../db/schema.js";
import type { AuditContext } from "../invoices/repository.js";

export type DeviceRow = typeof devices.$inferSelect;

export interface NewDevice {
  merchantId: string;
  deviceId: string;
  clientSubject: string;
  name: string;
}

export class DeviceRepository {
  async register(input: NewDevice, actor: AuditContext): Promise<DeviceRow> {
    return db.transaction(async (tx) => {
      const [device] = await tx.insert(devices).values(input).returning();
      if (!device) throw new Error("Device registration returned no row");
      await tx.insert(auditEvents).values({
        ...actor,
        action: "device.registered",
        resourceType: "device",
        resourceId: device.id,
        metadata: { deviceId: device.deviceId, clientSubject: device.clientSubject },
      });
      return device;
    });
  }

  async findActiveBySubject(clientSubject: string): Promise<DeviceRow | undefined> {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.clientSubject, clientSubject), eq(devices.enabled, true)))
      .limit(1);
    return device;
  }

  async listForMerchant(merchantId: string): Promise<DeviceRow[]> {
    return db
      .select()
      .from(devices)
      .where(eq(devices.merchantId, merchantId))
      .orderBy(devices.createdAt);
  }

  async disable(
    id: string,
    merchantId: string,
    actor: AuditContext,
  ): Promise<DeviceRow | undefined> {
    return db.transaction(async (tx) => {
      const [device] = await tx
        .update(devices)
        .set({ enabled: false, updatedAt: new Date() })
        .where(
          and(eq(devices.id, id), eq(devices.merchantId, merchantId), eq(devices.enabled, true)),
        )
        .returning();
      if (device)
        await tx.insert(auditEvents).values({
          ...actor,
          action: "device.disabled",
          resourceType: "device",
          resourceId: device.id,
          metadata: { deviceId: device.deviceId, clientSubject: device.clientSubject },
        });
      return device;
    });
  }
}
