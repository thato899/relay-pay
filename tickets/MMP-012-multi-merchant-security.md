# MMP-012 — Choose identity and tenant model

- **Status:** Done
- **Priority / size:** P1 / S
- **Outcome:** Set an identity boundary and split auth implementation into reviewable tickets.

## Decision

- Use **Auth0 Organizations over OpenID Connect** as the first managed identity provider. Each merchant is one Auth0 Organization.
- The merchant dashboard uses Authorization Code with PKCE as a public SPA client. It keeps access tokens in memory and sends them to the API as bearer tokens over HTTPS. No SPA client secret.
- The API verifies access-token signature from the issuer's JWKS and checks issuer, audience, expiry, subject, and Auth0 `org_id`. It derives tenant identity only from the verified `org_id` claim; never trust a caller-supplied merchant ID.
- The API uses `org_id` as merchant tenant ID for invoice ownership and audit attribution. Machine identities use a separate machine-to-machine client and a server-side client-to-organization/device registration or explicit provider-issued claim; do not assume a user `org_id` claim is automatically issued for a machine token.
- Public checkout reads remain available by high-entropy invoice UUID. Merchant listing, creation, configuration changes, and audit history require the verified merchant organization. Pooled XRPL receiver behavior remains an explicit prototype limitation until a tenant receiver registry is implemented.
- Production must use HTTPS, a configured issuer/audience, short-lived access tokens, and server-side secret storage. Demo payment simulation is disabled in production.

## Acceptance criteria

- [x] Choose identity provider and tenant model.
- [x] Define token verification claims and tenant source.
- [x] Define public checkout versus merchant-only API boundaries.
- [x] Split implementation into bounded follow-up tickets.

## Follow-up tickets

- MMP-016 — API token verification and request identity.
- MMP-017 — Merchant-scoped invoice and receiver configuration.
- MMP-018 — Dashboard login and bearer-token forwarding.
- MMP-019 — Audit events and production demo-mutation safeguards.
- MMP-020 — Register machine-to-merchant identity for device tokens.

See [`security-model.md`](../security-model.md) for the longer rationale and boundaries.
