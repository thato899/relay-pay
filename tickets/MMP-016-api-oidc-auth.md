# MMP-016 — Verify OIDC access tokens in the API

- **Status:** Done
- **Priority / size:** P1 / M
- **Outcome:** Protected API routes receive a trusted subject and merchant organization from a verified access token.

## Dependencies

MMP-012 identity model.

## Acceptance criteria

- [x] Verify JWT signatures against configured issuer JWKS using RS256.
- [x] Validate issuer, audience, expiry, subject, organization claim, and optional route scopes.
- [x] Attach typed authenticated subject and organization to the request context.
- [x] Return stable 401/403 errors and do not log bearer tokens.
- [x] Fail closed when production OIDC configuration is missing; keep production startup disabled until invoice route tenancy is implemented.

## Evidence

The protected `GET /v1/auth/context` route exercises token verification and is described in OpenAPI. API typecheck and production build pass. Tenant ownership filters remain for MMP-017; merchant invoice routes must not be exposed publicly until that ticket is complete.
