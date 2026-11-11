import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { CreateInvoiceBody } from "@mmp/contracts";
import {
  createInvoiceBodySchema,
  errorResponseSchema,
  invoiceListSchema,
  invoiceSchema,
  publicCheckoutSchema,
  publicConfigSchema,
} from "@mmp/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { Type } from "typebox";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { requireMerchantIdentity } from "./modules/auth/oidc.js";
import { InvoiceRepository } from "./modules/invoices/repository.js";
import {
  InvoiceClosedError,
  InvoiceNotFoundError,
  InvoiceService,
  InvoiceValidationError,
} from "./modules/invoices/service.js";
import { XrplPaymentMonitor } from "./modules/payments/xrpl-payment-monitor.js";

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
  const service = new InvoiceService(repository, config.paymentMode);
  const monitor = new XrplPaymentMonitor(repository, app.log);
  app.decorateRequest("merchantIdentity", null);

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
