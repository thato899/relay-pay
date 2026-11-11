import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { CreateInvoiceBody, CreateMachineInvoiceBody } from "@mmp/contracts";
import {
  createInvoiceBodySchema,
  createMachineInvoiceBodySchema,
  deviceIdentitySchema,
  deviceListSchema,
  deviceSchema,
  errorResponseSchema,
  invoiceListSchema,
  invoiceSchema,
  machineCycleAcknowledgementSchema,
  machineCycleSchema,
  publicCheckoutSchema,
  publicConfigSchema,
  registerDeviceBodySchema,
} from "@mmp/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { Type } from "typebox";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { requireDeviceIdentity } from "./modules/auth/device.js";
import { requireMerchantIdentity } from "./modules/auth/oidc.js";
import type { DeviceRow } from "./modules/devices/repository.js";
import { DeviceRepository } from "./modules/devices/repository.js";
import { DeviceOperationConflictError, InvoiceRepository } from "./modules/invoices/repository.js";
import {
  InvoiceClosedError,
  InvoiceNotFoundError,
  InvoiceService,
  InvoiceValidationError,
} from "./modules/invoices/service.js";
import {
  MACHINE_CYCLE_POLL_INTERVAL_SECONDS,
  MachineCycleRepository,
  type MachineCycleRow,
  type MachineInvoiceRow,
} from "./modules/machine-cycles/repository.js";
import { XrplPaymentMonitor } from "./modules/payments/xrpl-payment-monitor.js";

function toDeviceDto(device: DeviceRow) {
  return {
    id: device.id,
    deviceId: device.deviceId,
    clientSubject: device.clientSubject,
    name: device.name,
    enabled: device.enabled,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function toMachineCycleDto(cycle: MachineCycleRow, invoice: MachineInvoiceRow) {
  return {
    deviceId: cycle.deviceId,
    operationId: cycle.operationId,
    invoiceId: invoice.id,
    state: cycle.state,
    invoiceStatus: invoice.status,
    amountXrp: invoice.amountXrp,
    network: invoice.network,
    expiresAt: invoice.expiresAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    transactionHash: invoice.transactionHash,
    pollIntervalSeconds: MACHINE_CYCLE_POLL_INTERVAL_SECONDS,
  };
}

export interface ApplicationContext {
  app: FastifyInstance;
  monitor: XrplPaymentMonitor;
}

export async function buildApplication(): Promise<ApplicationContext> {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ["req.headers.authorization", "req.headers.cookie"] },
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
  });
  const repository = new InvoiceRepository();
  const deviceRepository = new DeviceRepository();
  const machineCycleRepository = new MachineCycleRepository();
  const service = new InvoiceService(repository, config.paymentMode);
  const monitor = new XrplPaymentMonitor(repository, app.log);
  app.decorateRequest("merchantIdentity", null);
  app.decorateRequest("deviceIdentity", null);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.webOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment and try again.",
    }),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Merchant & Machine Payments API",
        description:
          "Invoice and payment-status API for an XRPL Testnet merchant checkout prototype.",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:4000", description: "Local development" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      tags: [
        { name: "health", description: "Service and dependency health" },
        { name: "invoices", description: "Merchant checkout invoices" },
        { name: "auth", description: "Authenticated merchant identity" },
        { name: "devices", description: "Merchant registration and machine identity" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/documentation" });

  app.get(
    "/healthz",
    {
      schema: {
        tags: ["health"],
        response: { 200: Type.Object({ status: Type.Literal("ok") }) },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/readyz",
    {
      schema: {
        tags: ["health"],
        response: {
          200: Type.Object({
            status: Type.Literal("ready"),
            database: Type.Literal("up"),
            paymentLedger: Type.Union([Type.Literal("up"), Type.Literal("demo")]),
          }),
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await pool.query("select 1");
        if (!monitor.isReady()) {
          return reply
            .code(503)
            .send({ error: "NOT_READY", message: "XRPL Testnet is not connected." });
        }
        return {
          status: "ready" as const,
          database: "up" as const,
          paymentLedger: config.paymentMode === "demo" ? ("demo" as const) : ("up" as const),
        };
      } catch (error) {
        request.log.error({ err: error }, "Readiness check failed");
        return reply.code(503).send({ error: "NOT_READY", message: "Database is unavailable." });
      }
    },
  );

  app.get(
    "/v1/config",
    { schema: { tags: ["invoices"], response: { 200: publicConfigSchema } } },
    async () => ({
      mode: config.paymentMode,
      network: config.paymentMode === "demo" ? "Demo ledger" : "XRPL Testnet",
      merchantAddress: config.merchantAddress,
    }),
  );

  app.get(
    "/v1/auth/context",
    {
      preHandler: requireMerchantIdentity(),
      schema: {
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            subject: Type.String(),
            organizationId: Type.String(),
            scopes: Type.Array(Type.String()),
          }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!request.merchantIdentity) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A valid bearer access token is required.",
        });
      }
      return request.merchantIdentity;
    },
  );

  app.get(
    "/v1/devices",
    {
      preHandler: requireMerchantIdentity(["devices:admin"]),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        response: { 200: deviceListSchema, 401: errorResponseSchema, 403: errorResponseSchema },
      },
    },
    async (request) => ({
      items: (await deviceRepository.listForMerchant(request.merchantIdentity!.organizationId)).map(
        toDeviceDto,
      ),
    }),
  );

  app.post<{ Body: import("@mmp/contracts").RegisterDeviceBody }>(
    "/v1/devices",
    {
      preHandler: requireMerchantIdentity(["devices:admin"]),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        body: registerDeviceBodySchema,
        response: {
          201: deviceSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const identity = request.merchantIdentity!;
      try {
        const device = await deviceRepository.register(
          {
            ...request.body,
            merchantId: identity.organizationId,
            clientSubject: request.body.clientSubject.trim(),
            deviceId: request.body.deviceId.trim(),
            name: request.body.name.trim(),
          },
          {
            actorSubject: identity.subject,
            organizationId: identity.organizationId,
            requestId: request.id,
          },
        );
        return reply.code(201).send(toDeviceDto(device));
      } catch (error) {
        if (isUniqueViolation(error))
          return reply.code(409).send({
            error: "DEVICE_ALREADY_REGISTERED",
            message: "That device ID or machine client subject is already registered.",
          });
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/devices/:id/disable",
    {
      preHandler: requireMerchantIdentity(["devices:admin"]),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        response: {
          200: deviceSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = request.merchantIdentity!;
      const device = await deviceRepository.disable(request.params.id, identity.organizationId, {
        actorSubject: identity.subject,
        organizationId: identity.organizationId,
        requestId: request.id,
      });
      if (!device)
        return reply
          .code(404)
          .send({ error: "DEVICE_NOT_FOUND", message: "Device not found or already disabled." });
      return toDeviceDto(device);
    },
  );

  app.get(
    "/v1/device/context",
    {
      preHandler: requireDeviceIdentity(deviceRepository),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        response: {
          200: deviceIdentitySchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceIdentity)
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered machine identity is required.",
        });
      return request.deviceIdentity;
    },
  );

  app.post<{ Body: CreateMachineInvoiceBody }>(
    "/v1/device/invoices",
    {
      preHandler: requireDeviceIdentity(deviceRepository),
      schema: {
        tags: ["devices", "invoices"],
        security: [{ bearerAuth: [] }],
        body: createMachineInvoiceBodySchema,
        response: {
          200: invoiceSchema,
          201: invoiceSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const identity = request.deviceIdentity;
      if (!identity)
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered machine identity is required.",
        });
      try {
        const result = await service.createForDevice(identity, request.body, {
          actorSubject: identity.subject,
          organizationId: identity.organizationId,
          requestId: request.id,
        });
        return reply.code(result.created ? 201 : 200).send(result.invoice);
      } catch (error) {
        if (error instanceof InvoiceValidationError)
          return reply.code(400).send({ error: "INVALID_AMOUNT", message: error.message });
        if (error instanceof DeviceOperationConflictError)
          return reply.code(409).send({ error: "OPERATION_ID_REUSED", message: error.message });
        throw error;
      }
    },
  );

  app.get<{ Params: { operationId: string } }>(
    "/v1/device/cycles/:operationId",
    {
      preHandler: requireDeviceIdentity(deviceRepository),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ operationId: Type.String({ minLength: 1, maxLength: 120 }) }),
        response: {
          200: machineCycleSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const identity = request.deviceIdentity;
      if (!identity)
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered machine identity is required.",
        });
      const result = await machineCycleRepository.readForDevice(
        identity.deviceId,
        request.params.operationId,
        {
          actorSubject: identity.subject,
          organizationId: identity.organizationId,
          requestId: request.id,
        },
        true,
      );
      if (result.kind === "not_found")
        return reply
          .code(404)
          .send({ error: "CYCLE_NOT_FOUND", message: "Machine cycle not found." });
      if (result.kind === "too_soon")
        return reply
          .header("retry-after", result.retryAfterSeconds)
          .code(429)
          .send({
            error: "POLL_TOO_SOON",
            message: `Poll again in ${result.retryAfterSeconds} seconds.`,
          });
      if (result.kind === "poll_limit")
        return reply
          .code(429)
          .send({ error: "POLL_LIMIT", message: "Polling limit reached for this cycle." });
      return toMachineCycleDto(result.cycle, result.invoice);
    },
  );

  app.post<{ Params: { operationId: string } }>(
    "/v1/device/cycles/:operationId/start",
    {
      preHandler: requireDeviceIdentity(deviceRepository),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ operationId: Type.String({ minLength: 1, maxLength: 120 }) }),
        response: {
          200: machineCycleSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!config.deviceCycleStartEnabled)
        return reply.code(409).send({
          error: "CYCLE_START_DISABLED",
          message: "Machine starts remain disabled until operator spending budgets are enforced.",
        });
      const identity = request.deviceIdentity;
      if (!identity)
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered machine identity is required.",
        });
      const result = await machineCycleRepository.requestStart(
        identity.deviceId,
        request.params.operationId,
        {
          actorSubject: identity.subject,
          organizationId: identity.organizationId,
          requestId: request.id,
        },
      );
      if (result.kind === "not_found")
        return reply
          .code(404)
          .send({ error: "CYCLE_NOT_FOUND", message: "Machine cycle not found." });
      if (result.kind === "payment_required")
        return reply.code(409).send({
          error: "PAYMENT_REQUIRED",
          message: "A paid invoice is required before requesting a cycle start.",
        });
      if (result.kind === "payment_not_validated")
        return reply.code(409).send({
          error: "VALIDATED_PAYMENT_REQUIRED",
          message: "Only a validated XRPL Testnet payment can authorize a cycle start.",
        });
      if (result.kind === "invalid_transition")
        return reply.code(409).send({
          error: "INVALID_CYCLE_STATE",
          message: `Cannot request a start from ${result.state}.`,
        });
      return toMachineCycleDto(result.cycle, result.invoice);
    },
  );

  app.post<{
    Params: { operationId: string };
    Body: import("@mmp/contracts").MachineCycleAcknowledgement;
  }>(
    "/v1/device/cycles/:operationId/ack",
    {
      preHandler: requireDeviceIdentity(deviceRepository),
      schema: {
        tags: ["devices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ operationId: Type.String({ minLength: 1, maxLength: 120 }) }),
        body: machineCycleAcknowledgementSchema,
        response: {
          200: machineCycleSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const identity = request.deviceIdentity;
      if (!identity)
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered machine identity is required.",
        });
      const result = await machineCycleRepository.acknowledge(
        identity.deviceId,
        request.params.operationId,
        request.body,
        {
          actorSubject: identity.subject,
          organizationId: identity.organizationId,
          requestId: request.id,
        },
      );
      if (result.kind === "not_found")
        return reply
          .code(404)
          .send({ error: "CYCLE_NOT_FOUND", message: "Machine cycle not found." });
      if (result.kind === "invalid_transition")
        return reply.code(409).send({
          error: "INVALID_CYCLE_STATE",
          message: `Cannot acknowledge from ${result.state}.`,
        });
      return toMachineCycleDto(result.cycle, result.invoice);
    },
  );

  app.get(
    "/v1/invoices",
    {
      preHandler: requireMerchantIdentity(["invoices:read"]),
      schema: {
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        response: { 200: invoiceListSchema, 401: errorResponseSchema, 403: errorResponseSchema },
      },
    },
    async (request) => ({ items: await service.list(request.merchantIdentity!.organizationId) }),
  );

  app.post<{ Body: CreateInvoiceBody }>(
    "/v1/invoices",
    {
      preHandler: requireMerchantIdentity(["invoices:write"]),
      schema: {
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        body: createInvoiceBodySchema,
        response: {
          201: invoiceSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      try {
        const invoice = await service.create(
          request.merchantIdentity!.organizationId,
          request.body,
          {
            actorSubject: request.merchantIdentity!.subject,
            organizationId: request.merchantIdentity!.organizationId,
            requestId: request.id,
          },
        );
        return reply.code(201).send(invoice);
      } catch (error) {
        if (error instanceof InvoiceValidationError) {
          return reply.code(400).send({ error: "INVALID_AMOUNT", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { invoiceId: string } }>(
    "/v1/invoices/:invoiceId",
    {
      preHandler: requireMerchantIdentity(["invoices:read"]),
      schema: {
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ invoiceId: Type.String({ format: "uuid" }) }),
        response: {
          200: invoiceSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return await service.getForMerchant(
          request.params.invoiceId,
          request.merchantIdentity!.organizationId,
          {
            actorSubject: request.merchantIdentity!.subject,
            organizationId: request.merchantIdentity!.organizationId,
            requestId: request.id,
          },
        );
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return reply.code(404).send({ error: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { invoiceId: string } }>(
    "/v1/checkouts/:invoiceId",
    {
      schema: {
        tags: ["invoices"],
        params: Type.Object({ invoiceId: Type.String({ format: "uuid" }) }),
        response: { 200: publicCheckoutSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        return await service.getPublicCheckout(request.params.invoiceId, request.id);
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return reply.code(404).send({ error: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/invoices/:invoiceId/demo-payment",
    {
      preHandler: requireMerchantIdentity(["invoices:write"]),
      schema: {
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ invoiceId: Type.String({ format: "uuid" }) }),
        response: {
          200: invoiceSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (config.paymentMode !== "demo" || !config.demoPaymentsEnabled) {
        return reply.code(409).send({
          error: "DEMO_DISABLED",
          message: "Demo payments are disabled outside demo mode.",
        });
      }

      try {
        const merchantId = request.merchantIdentity!.organizationId;
        const invoice = await service.getForMerchant(request.params.invoiceId, merchantId, {
          actorSubject: request.merchantIdentity!.subject,
          organizationId: merchantId,
          requestId: request.id,
        });
        if (invoice.status !== "pending") {
          return reply
            .code(409)
            .send({ error: "INVOICE_CLOSED", message: `Invoice is already ${invoice.status}.` });
        }

        const { randomUUID } = await import("node:crypto");
        const transactionHash = `demo_${randomUUID().replaceAll("-", "")}`;
        await repository.confirmPayment({
          invoiceId: invoice.id,
          transactionHash,
          amountDrops: invoice.amountDrops,
          network: "demo",
          ledgerIndex: null,
          actorSubject: request.merchantIdentity!.subject,
          organizationId: merchantId,
          requestId: request.id,
        });
        return await service.getForMerchant(invoice.id, merchantId, {
          actorSubject: request.merchantIdentity!.subject,
          organizationId: merchantId,
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return reply.code(404).send({ error: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/checkouts/:invoiceId/demo-payment",
    {
      schema: {
        tags: ["invoices"],
        params: Type.Object({ invoiceId: Type.String({ format: "uuid" }) }),
        response: { 200: publicCheckoutSchema, 404: errorResponseSchema, 409: errorResponseSchema },
      },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (config.paymentMode !== "demo" || !config.demoPaymentsEnabled) {
        return reply.code(409).send({
          error: "DEMO_DISABLED",
          message: "Demo payments are disabled outside demo mode.",
        });
      }

      try {
        const { randomUUID } = await import("node:crypto");
        return await service.simulatePublicDemoPayment(
          request.params.invoiceId,
          `demo_${randomUUID().replaceAll("-", "")}`,
          request.id,
        );
      } catch (error) {
        if (error instanceof InvoiceNotFoundError) {
          return reply.code(404).send({ error: "NOT_FOUND", message: error.message });
        }
        if (error instanceof InvoiceClosedError) {
          return reply.code(409).send({ error: "INVOICE_CLOSED", message: error.message });
        }
        throw error;
      }
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && "validation" in error && error.validation) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "Check the request fields and try again.",
      });
    }
    request.log.error({ err: error }, "Unhandled request error");
    return reply
      .code(500)
      .send({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
  });

  return { app, monitor };
}
