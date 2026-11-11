# MMP-020 — Register machine-to-merchant identity

- **Status:** Done — merchant-managed device registry, verified subject resolution, and revocation implemented.
- **Priority / size:** P1 / S
- **Outcome:** Machine-to-machine access resolves to a registered merchant and device without trusting an unverified organization claim.

## Dependencies

MMP-016 API token verification.

## Acceptance criteria

- [x] Register each machine client subject to exactly one merchant organization and device ID.
- [x] Resolve machine tenant from the server-side registration after verifying issuer, audience, and token subject.
- [x] Reject disabled, unknown, or cross-organization machine identities.
- [x] Never embed client secrets in the kiosk/browser bundle or checkout QR.
- [x] Document credential rotation and revocation.

## Implementation notes

- `POST /v1/devices` and `GET /v1/devices` require `devices:admin` and scope all registrations to the verified merchant organization.
- `GET /v1/device/context` requires a valid API-audience token with `devices:connect`; the verified subject is mapped to an enabled device in the database. Organization claims from machine tokens are not used to select the tenant.
- `POST /v1/devices/{id}/disable` revokes access on the next request. Registration and disable operations create audit records in the same transaction.
- Auth0 SPA configuration needs `devices:admin` for device administration. Each machine application needs the `devices:connect` API permission. In local OIDC-off mode, `x-local-device-subject` can exercise only an already registered subject; it is ignored in production.
- Migration `0003_device_identity.sql` creates the indexed registry. It is generated but not applied locally because Docker/PostgreSQL is unavailable.
