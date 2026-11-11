# MMP-021 — Enforce operator-controlled device spending budgets

- **Status:** In Progress
- **Priority / size:** P1 / M
- **Outcome:** A registered machine can spend only within a human-owned budget and approved-payee policy.

## Dependencies

MMP-014 machine payment/cycle state and MMP-020 device identity.

## Acceptance criteria

- [x] An authenticated merchant operator sets a maximum per-cycle amount and a cumulative budget/window for a device.
- [x] The API rejects a machine operation that exceeds either limit or uses an unapproved payee.
- [x] The device credential cannot create, raise, or disable its own limits.
- [x] Limit changes are scoped to the merchant, attributable in the audit trail, and have an explicit revocation path.
- [x] Concurrent/retried requests cannot overspend the remaining budget; reservation and settlement behavior is documented.
- [x] The dashboard makes the current limit, spend, and denied requests visible.
- [x] Tests cover boundary amounts, concurrent requests, retries, and revoked devices.

## Implementation notes

- Added merchant-admin `GET`/`PUT /v1/devices/:id/budget` endpoints, device-scoped policy storage, exact XRP-to-drops validation, audit records, and dashboard controls.
- New machine invoices require an active policy, approved configured receiver, per-cycle cap, and remaining rolling budget. The device row is locked during reservation, so concurrent operations serialize per device; a replay returns its original invoice without reserving twice.
- Pending unexpired invoices reserve funds. Paid invoices count toward spend for the configured rolling window. Expired pending invoices stop reserving automatically. Budget disablement and device revocation deny future operation/start requests.
- A paid cycle start rechecks the current policy. The global `DEVICE_CYCLE_START_ENABLED` switch remains off by default.
- Migration `0006_device_budgets` is generated but has not been applied to a running database.
- `budget-repository.test.ts` exercises exact caps, concurrent reservations, same-operation replay, and revoked-device denial against PostgreSQL. CI runs it with a disposable PostgreSQL 16 service. Local runs require `TEST_DATABASE_URL` to point to an empty test database.
