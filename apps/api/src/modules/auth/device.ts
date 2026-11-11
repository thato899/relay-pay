import type { preHandlerHookHandler } from "fastify";
import { config } from "../../config.js";
import type { DeviceRepository } from "../devices/repository.js";
import { oidcIsConfigured, tokenScopes, verifyAccessToken } from "./oidc.js";

export function requireDeviceIdentity(repository: DeviceRepository): preHandlerHookHandler {
  return async (request, reply) => {
    if (config.authMode === "off" && config.nodeEnv !== "production") {
      const localSubject = request.headers["x-local-device-subject"];
      if (typeof localSubject !== "string" || !localSubject.trim()) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A registered local device subject is required.",
        });
      }
      const device = await repository.findActiveBySubject(localSubject.trim());
      if (!device) {
        return reply.code(403).send({
          error: "DEVICE_NOT_REGISTERED",
          message: "This device is unknown or disabled.",
        });
      }
      request.deviceIdentity = {
        subject: localSubject.trim(),
        organizationId: device.merchantId,
        deviceId: device.id,
        deviceCode: device.deviceId,
      };
      return;
    }

    if (!oidcIsConfigured()) {
      return reply.code(503).send({
        error: "AUTH_UNAVAILABLE",
        message: "Machine authentication is not configured.",
      });
    }

    try {
      const payload = await verifyAccessToken(request.headers.authorization);
      if (typeof payload?.sub !== "string") {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "A valid bearer access token is required.",
        });
      }
      const scopes = tokenScopes(payload.scope, payload.permissions);
      if (!scopes.includes("devices:connect")) {
        return reply.code(403).send({
          error: "INSUFFICIENT_SCOPE",
          message: "This access token does not allow machine access.",
        });
      }
      const device = await repository.findActiveBySubject(payload.sub);
      if (!device) {
        return reply.code(403).send({
          error: "DEVICE_NOT_REGISTERED",
          message: "This device is unknown or disabled.",
        });
      }
      request.deviceIdentity = {
        subject: payload.sub,
        organizationId: device.merchantId,
        deviceId: device.id,
        deviceCode: device.deviceId,
      };
    } catch {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "A valid bearer access token is required.",
      });
    }
  };
}
