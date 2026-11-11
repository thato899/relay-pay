# MMP-014 — Add safe machine payment and cycle state tracking

- **Status:** Backlog
- **Priority / size:** P1 / M
- **Outcome:** The API exposes an authenticated, auditable device state and supports one cycle start per paid invoice.

## Dependencies

MMP-013 machine invoice and operation records.

## Acceptance criteria

- [ ] Define typed transitions for awaiting payment, paid, start requested, started, expired, and start unknown.
- [ ] Machine status reads are scoped to its merchant and device.
- [ ] Only a validated paid invoice can enter start requested.
- [ ] A repeated acknowledgement cannot start or record the same cycle twice.
- [ ] Polling limits, retry interval, and expiry behavior are documented and enforced.
