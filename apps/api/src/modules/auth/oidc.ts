import type { preHandlerHookHandler } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../../config.js";

export interface MerchantIdentity {
  subject: string;
  organizationId: string;
  scopes: string[];
}

export interface DeviceIdentity {
  subject: string;
  organizationId: string;
  deviceId: string;
  deviceCode: string;
}

declare module "fastify" {
  interface FastifyRequest {
    merchantIdentity: MerchantIdentity | null;
    deviceIdentity: DeviceIdentity | null;
  }
}

const remoteJwks =
  config.authMode === "oidc" && config.oidcIssuer
    ? createRemoteJWKSet(new URL(".well-known/jwks.json", config.oidcIssuer))
    : null;

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function tokenScopes(scope: unknown, permissions: unknown): string[] {
  const fromScope = typeof scope === "string" ? scope.split(/\s+/).filter(Boolean) : [];
  const fromPermissions = Array.isArray(permissions)
    ? permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
  return [...new Set([...fromScope, ...fromPermissions])];
}

export function oidcIsConfigured(): boolean {
  return Boolean(remoteJwks && config.oidcIssuer && config.oidcAudience);
}

export async function verifyAccessToken(header: string | undefined) {
  const token = bearerToken(header);
  if (!token || !remoteJwks || !config.oidcIssuer || !config.oidcAudience) return null;
  const { payload } = await jwtVerify(token, remoteJwks, {
    issuer: config.oidcIssuer,
    audience: config.oidcAudience,
    algorithms: ["RS256"],
  });
  return payload;
}

export function requireMerchantIdentity(requiredScopes: string[] = []): preHandlerHookHandler {
  return async (request, reply) => {
    if (config.authMode === "off" && config.nodeEnv !== "production") {
      request.merchantIdentity = {
        subject: "local-development",
        organizationId: "local-development",
        scopes: ["invoices:read", "invoices:write", "devices:admin"],
      };
      return;
    }

    if (!remoteJwks || !config.oidcIssuer || !config.oidcAudience) {
      return reply.code(503).send({
        error: "AUTH_UNAVAILABLE",
        message: "Merchant authentication is not configured.",
      });
    }

    const token = bearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "A valid bearer access token is required.",
      });
    }

    try {
      const payload = await verifyAccessToken(request.headers.authorization);
      if (!payload) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A valid bearer access token is required.",
        });
      }
      const organizationId = payload[config.oidcOrganizationClaim];
      if (typeof payload.sub !== "string" || typeof organizationId !== "string") {
        return reply.code(403).send({
          error: "MERCHANT_CONTEXT_REQUIRED",
          message: "This access token is not associated with a merchant organization.",
        });
      }

      const scopes = tokenScopes(payload.scope, payload.permissions);
      if (requiredScopes.some((scope) => !scopes.includes(scope))) {
        return reply.code(403).send({
          error: "INSUFFICIENT_SCOPE",
          message: "This access token does not allow the requested action.",
        });
      }

      request.merchantIdentity = {
        subject: payload.sub,
        organizationId,
        scopes,
      };
    } catch {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "A valid bearer access token is required.",
      });
    }
  };
}
