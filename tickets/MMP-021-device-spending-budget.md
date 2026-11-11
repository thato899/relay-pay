# MMP-021 — Enforce operator-controlled device spending budgets

- **Status:** Ready
- **Priority / size:** P1 / M
- **Outcome:** A registered machine can spend only within a human-owned budget and approved-payee policy.

## Dependencies

MMP-014 machine payment/cycle state and MMP-020 device identity.

## Acceptance criteria

- [ ] An authenticated merchant operator sets a maximum per-cycle amount and a cumulative budget/window for a device.
- [ ] The API rejects a machine operation that exceeds either limit or uses an unapproved payee.
- [ ] The device credential cannot create, raise, or disable its own limits.
- [ ] Limit changes are scoped to the merchant, attributable in the audit trail, and have an explicit revocation path.
- [ ] Concurrent/retried requests cannot overspend the remaining budget; reservation and settlement behavior is documented.
- [ ] The dashboard makes the current limit, spend, and denied requests visible.
- [ ] Tests cover boundary amounts, concurrent requests, retries, and revoked devices.
