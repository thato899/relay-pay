# MMP-019 — Add audit events and production demo safeguards

- **Status:** In Progress — audit trail and production demo guard implemented; device-action audit integration waits for MMP-020.
- **Priority / size:** P1 / S
- **Outcome:** Sensitive merchant actions are attributable, and demo mutation cannot run in production.

## Dependencies

MMP-016 and MMP-017.

## Acceptance criteria

- [x] Persist audit events for invoice creation and payment state changes; device actions will use the same event table after device routes exist.
- [x] Attribute events to subject, organization, request ID, and resource without recording tokens or secrets.
- [x] Production startup rejects demo-payment enablement.
- [x] Demo mutation stays rate-limited and requires an active invoice checkout capability.
- [x] Review log redaction, trusted proxy, CORS, and secret configuration.

## Implementation notes

- Migration `0002_audit_events.sql` creates indexed audit storage. Creation, expiry, demo confirmation, and XRPL reconciliation insert events in the same transaction as the resource change.
- `DEMO_PAYMENTS_ENABLED` defaults on only outside production and production startup rejects an explicit `true`; the demo mutation routes also require both demo mode and the flag.
- Request logs redact authorization and cookie headers. `TRUST_PROXY` is disabled unless explicitly set to a known proxy address/CIDR or hop count. CORS remains limited to `WEB_ORIGIN` without credentials. Provider identifiers and SPA settings are not secrets; server-side credentials stay outside the Vite config.
- Device action events are not yet applicable because device APIs do not exist. Complete that integration with MMP-020.
