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
- [x] Machine payments are gated by a human-owned spending cap and approved-payee policy; device credentials cannot raise the cap. Device cycle start remains disabled until MMP-021 implements and enforces that policy.

## Implementation notes

- Added a persisted machine-cycle state machine and migration `0005_machine_cycles`.
- Added authenticated status, start-request, and acknowledgement routes. State changes and invoice expiry are audited.
- Polling has a 10-second minimum interval and 180-poll limit per operation.
- Cycle start is disabled by default. Production rejects enabling it before MMP-021 is complete.
- Migration is generated but has not been applied to a running database.
