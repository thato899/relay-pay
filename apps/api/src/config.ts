import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
  DATABASE_URL: z.string().url().default("postgres://mmp:mmp@localhost:5432/mmp"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:5173"),
  PAYMENT_MODE: z.enum(["demo", "xrpl-testnet"]).default("demo"),
  AUTH_MODE: z.enum(["off", "oidc"]).default("off"),
  DEMO_PAYMENTS_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  OIDC_ISSUER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  OIDC_AUDIENCE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  OIDC_ORGANIZATION_CLAIM: z.string().min(1).default("org_id"),
  MERCHANT_XRPL_ADDRESS: z.string().default(""),
  XRPL_WS_URL: z.string().url().default("wss://s.altnet.rippletest.net:51233"),
});

const parsed = envSchema.parse(process.env);

if (parsed.PAYMENT_MODE === "xrpl-testnet" && !parsed.MERCHANT_XRPL_ADDRESS) {
  throw new Error("MERCHANT_XRPL_ADDRESS is required when PAYMENT_MODE=xrpl-testnet");
}

if (parsed.NODE_ENV === "production" && parsed.AUTH_MODE !== "oidc") {
  throw new Error("AUTH_MODE=oidc is required in production");
}

if (parsed.NODE_ENV === "production" && process.env.DEMO_PAYMENTS_ENABLED === "true") {
  throw new Error("DEMO_PAYMENTS_ENABLED must be false in production");
}

if (parsed.AUTH_MODE === "oidc" && (!parsed.OIDC_ISSUER || !parsed.OIDC_AUDIENCE)) {
  throw new Error("OIDC_ISSUER and OIDC_AUDIENCE are required when AUTH_MODE=oidc");
}

function blockUnreadyProduction(): void {
  if (parsed.NODE_ENV === "production") {
    throw new Error(
      "Production API startup is disabled until all merchant routes enforce tenant authorization.",
    );
  }
}

blockUnreadyProduction();

export const config = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  trustProxy: parsed.TRUST_PROXY ?? false,
  databaseUrl: parsed.DATABASE_URL,
  webOrigin: parsed.WEB_ORIGIN,
  publicWebUrl: parsed.PUBLIC_WEB_URL.replace(/\/$/, ""),
  paymentMode: parsed.PAYMENT_MODE,
  authMode: parsed.AUTH_MODE,
  demoPaymentsEnabled: parsed.DEMO_PAYMENTS_ENABLED ?? parsed.NODE_ENV !== "production",
  oidcIssuer: parsed.OIDC_ISSUER,
  oidcAudience: parsed.OIDC_AUDIENCE,
  oidcOrganizationClaim: parsed.OIDC_ORGANIZATION_CLAIM,
  merchantAddress: parsed.MERCHANT_XRPL_ADDRESS,
  xrplWsUrl: parsed.XRPL_WS_URL,
  isProduction: parsed.NODE_ENV === "production",
} as const;
