import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { AuditContext, MachineOperation, NewInvoice } from "../invoices/repository.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let dbHandle: typeof import("../../db/client.js").db;
let poolHandle: typeof import("../../db/client.js").pool;
let devicesRepository: import("./repository.js").DeviceRepository;
let budgetsRepository: import("./budget-repository.js").DeviceBudgetRepository;
let invoicesRepository: import("../invoices/repository.js").InvoiceRepository;

describe("device spending budgets", () => {
  before(async () => {
    if (!testDatabaseUrl)
      throw new Error("Set TEST_DATABASE_URL to run device-budget integration tests.");
    process.env.NODE_ENV = "test";
    process.env.AUTH_MODE = "off";
    process.env.PAYMENT_MODE = "demo";
    process.env.DATABASE_URL = testDatabaseUrl;
    const database = await import("../../db/client.js");
    dbHandle = database.db;
    poolHandle = database.pool;
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(dbHandle, { migrationsFolder: "drizzle" });
    const [{ DeviceRepository }, { DeviceBudgetRepository }, { InvoiceRepository }] =
      await Promise.all([
        import("./repository.js"),
        import("./budget-repository.js"),
        import("../invoices/repository.js"),
      ]);
    devicesRepository = new DeviceRepository();
    budgetsRepository = new DeviceBudgetRepository();
    invoicesRepository = new InvoiceRepository();
  });

  after(async () => {
    if (poolHandle) await poolHandle.end();
  });

  async function createFixture(options: { maxCycleDrops: string; windowBudgetDrops: string }) {
    const merchantId = `org_${randomUUID()}`;
    const device = await devicesRepository.register(
      {
        merchantId,
        deviceId: `washer_${randomUUID()}`,
        clientSubject: `client_${randomUUID()}`,
        name: "Budget integration washer",
      },
      audit(merchantId),
    );
    await budgetsRepository.update(
      merchantId,
      device.id,
      {
        maxCycleDrops: options.maxCycleDrops,
        windowBudgetDrops: options.windowBudgetDrops,
        windowSeconds: 86_400,
        approvedPayeeAddress: "demo",
        enabled: true,
      },
      audit(merchantId),
    );
    return { merchantId, device };
  }

  function newOperation(deviceId: string, amountDrops: string, operationId: string = randomUUID()) {
    const input: NewInvoice = {
      id: randomUUID(),
      merchantId: "placeholder",
      amountXrp: String(Number(amountDrops) / 1_000_000),
      amountDrops,
      reference: null,
      destinationAddress: "",
      destinationTag: randomInt(1, 0xffff_ffff),
      network: "demo",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const operation: MachineOperation = {
      deviceId,
      operationId,
      cycleCode: "standard",
      requestHash: `hash:${operationId}`,
    };
    return { input, operation };
  }

  async function reserve(
    merchantId: string,
    deviceId: string,
    amountDrops: string,
    operationId?: string,
  ) {
    const { input, operation } = newOperation(deviceId, amountDrops, operationId);
    input.merchantId = merchantId;
    return invoicesRepository.createForDeviceOperation(input, operation, audit(merchantId));
  }

  it("accepts the exact per-cycle and rolling-window boundary, then denies one drop over", async () => {
    const { merchantId, device } = await createFixture({
      maxCycleDrops: "1000000",
      windowBudgetDrops: "1000000",
    });
    const allowed = await reserve(merchantId, device.id, "1000000");
    assert.ok("row" in allowed);

    const denied = await reserve(merchantId, device.id, "1");
    assert.deepEqual(denied, { denied: "cycle_limit_exceeded" });

    const overview = await budgetsRepository.read(merchantId, device.id);
    assert.equal(overview?.reservedDrops, "1000000");
    assert.equal(overview?.deniedCount, 1);
  });

  it("serializes concurrent reservations so their sum cannot exceed the window", async () => {
    const { merchantId, device } = await createFixture({
      maxCycleDrops: "1000000",
      windowBudgetDrops: "1000000",
    });
    const results = await Promise.all([
      reserve(merchantId, device.id, "600000"),
      reserve(merchantId, device.id, "600000"),
    ]);
    assert.equal(results.filter((result) => "row" in result).length, 1);
    assert.equal(results.filter((result) => "denied" in result).length, 1);
    const overview = await budgetsRepository.read(merchantId, device.id);
    assert.equal(overview?.reservedDrops, "600000");
  });

  it("returns the same invoice for a replay without reserving twice", async () => {
    const { merchantId, device } = await createFixture({
      maxCycleDrops: "1000000",
      windowBudgetDrops: "1000000",
    });
    const operationId = randomUUID();
    const first = await reserve(merchantId, device.id, "700000", operationId);
    const retry = await reserve(merchantId, device.id, "700000", operationId);
    assert.ok("row" in first);
    assert.ok("row" in retry);
    assert.equal(first.row.id, retry.row.id);
    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    const overview = await budgetsRepository.read(merchantId, device.id);
    assert.equal(overview?.reservedDrops, "700000");
  });

  it("denies a revoked device and records the denial", async () => {
    const { merchantId, device } = await createFixture({
      maxCycleDrops: "1000000",
      windowBudgetDrops: "1000000",
    });
    assert.ok(await devicesRepository.disable(device.id, merchantId, audit(merchantId)));
    const result = await reserve(merchantId, device.id, "100000");
    assert.deepEqual(result, { denied: "device_revoked" });
    const overview = await budgetsRepository.read(merchantId, device.id);
    assert.equal(overview?.deniedCount, 1);
  });
});

function audit(merchantId: string): AuditContext {
  return { actorSubject: "test:operator", organizationId: merchantId, requestId: null };
}
