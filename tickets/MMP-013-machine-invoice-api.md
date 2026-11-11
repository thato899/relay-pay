# MMP-013 — Add authenticated, idempotent machine invoice creation

- **Status:** Backlog
- **Priority / size:** P1 / M
- **Outcome:** A registered machine can create exactly one invoice for a washer operation, including when it retries after a timeout.

## Dependencies

MMP-017 and MMP-020 must provide authenticated tenant-scoped device identity. Use the existing invoice service and shared contracts; keep device-specific persistence in its own module.

## Acceptance criteria

- [ ] Authenticated device requests include machine ID, cycle code, stable operation ID, and exact price.
- [ ] Repeating the same operation ID for the same merchant/device returns the existing invoice.
- [ ] Reusing the operation ID with different request details is rejected.
- [ ] Machine credentials are never returned to the browser or placed in a checkout URL/QR.
- [ ] Merchant API behavior and customer checkout remain backward-compatible.
