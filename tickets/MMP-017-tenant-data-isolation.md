# MMP-017 — Scope invoices by merchant and disclose the shared receiver

- **Status:** Done — application changes compile; migration is generated but not applied locally
- **Priority / size:** P1 / M
- **Outcome:** Merchant invoice operations are restricted to the authenticated organization, while customer checkout exposes only its public payment fields.

## Dependencies

MMP-016.

## Acceptance criteria

- [x] Add merchant ownership to invoice persistence and create a migration with a local-data backfill.
- [x] Require merchant ID on repository create, list, lookup, and expiry methods.
- [x] Return not found for another tenant's invoice through merchant routes.
- [x] Keep public checkout lookup separate and return a reduced checkout DTO.
- [x] Define the shared XRPL Testnet receiver limitation in API docs and merchant UI copy.

## Evidence and limits

API/web typecheck and production builds pass; Drizzle reports no schema changes after migration generation. The migration was not applied to a live database because Docker's local database service is unavailable. XRPL receiving address configuration remains a shared prototype setting; this ticket does not implement tenant-specific settlement.
