# MMP-002 — Create and persist exact-value invoices

- **Status:** Done
- **Priority / size:** P0 / M
- **Outcome:** A merchant can create a checkout invoice that stores exact XRP value and a unique payment tag.

## Acceptance criteria

- [x] API validates amount and optional reference through shared request schemas.
- [x] XRP amount is represented without floating-point arithmetic and converted to drops.
- [x] PostgreSQL stores invoice status, destination, tag, network, expiry, and transaction hash.
- [x] Invoice DTOs are shared between the API and web app.
- [x] OpenAPI documentation and health/readiness endpoints are available.

## Evidence

API and shared contracts pass the project typecheck and production build. Drizzle migration generation reports no schema changes.
