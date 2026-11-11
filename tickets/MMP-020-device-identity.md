# MMP-020 — Register machine-to-merchant identity

- **Status:** Backlog
- **Priority / size:** P1 / S
- **Outcome:** Machine-to-machine access resolves to a registered merchant and device without trusting an unverified organization claim.

## Dependencies

MMP-016 API token verification.

## Acceptance criteria

- [ ] Register each machine client subject to exactly one merchant organization and device ID.
- [ ] Resolve machine tenant from the server-side registration after verifying issuer, audience, and token subject.
- [ ] Reject disabled, unknown, or cross-organization machine identities.
- [ ] Never embed client secrets in the kiosk/browser bundle or checkout QR.
- [ ] Document credential rotation and revocation.
