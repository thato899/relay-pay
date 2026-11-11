# MMP-014 — Add safe machine payment and cycle state tracking

- **Status:** Done
- **Priority / size:** P1 / M
- **Outcome:** The API exposes an authenticated, auditable device state and supports one cycle start per paid invoice.

## Dependencies

MMP-013 machine invoice and operation records.

## Acceptance criteria

- [x] Define typed transitions for awaiting payment, paid, start requested, started, expired, and start unknown.
- [x] Machine status reads are scoped to its merchant and device.
- [x] Only a validated paid invoice can enter start requested.
- [x] A repeated acknowledgement cannot start or record the same cycle twice.
- [x] Polling limits, retry interval, and expiry behavior are documented and enforced.
- [x] Machine payments are gated by a human-owned spending cap and approved-payee policy; device credentials cannot raise the cap. A configured, enabled budget is checked both before invoice creation and before cycle start.

## Implementation notes

- Added a persisted machine-cycle state machine and migration `0005_machine_cycles`.
- Added authenticated status, start-request, and acknowledgement routes. State changes and invoice expiry are audited.
- Polling has a 10-second minimum interval and 180-poll limit per operation.
- Cycle start is disabled by default. When enabled by an operator, every start request still checks the device's current budget and approved payee.
- Migration is generated but has not been applied to a running database.
