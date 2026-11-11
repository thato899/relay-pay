# MMP-013 — Add authenticated, idempotent machine invoice creation

- **Status:** Done — device invoice endpoint and transactional idempotency implemented.
- **Priority / size:** P1 / M
- **Outcome:** A registered machine can create exactly one invoice for a washer operation, including when it retries after a timeout.

## Dependencies

MMP-017 and MMP-020 must provide authenticated tenant-scoped device identity. Use the existing invoice service and shared contracts; keep device-specific persistence in its own module.

## Acceptance criteria

- [x] Authenticated device requests include machine identity, cycle code, stable operation ID, and exact price.
- [x] Repeating the same operation ID for the same merchant/device returns the existing invoice.
- [x] Reusing the operation ID with different request details is rejected.
- [x] Machine credentials are never returned to the browser or placed in a checkout URL/QR.
- [x] Merchant API behavior and customer checkout remain backward-compatible.

## Implementation notes

- `POST /v1/device/invoices` requires a registered machine token with `devices:connect`; the API derives the merchant and device from the verified token subject.
- A PostgreSQL transaction-scoped advisory lock serializes requests for the same device/operation ID. The invoice, operation record, and audit event commit together. Identical retries return HTTP 200 with the original invoice; a changed cycle, amount, or reference returns HTTP 409.
- Amounts retain exact XRP decimal/drop validation and the standard invoice expiry. No credential is returned in the invoice or checkout data.
- Migration `0004_machine_invoice_operations.sql` adds the idempotency record table. It is generated but not applied locally because Docker/PostgreSQL is unavailable.
