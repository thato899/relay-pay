# MMP-011 — Design a low-connectivity machine checkout

- **Status:** Done
- **Priority / size:** P1 / L
- **Outcome:** Define a focused unattended/device payment flow that fits the Merchant & Machine track.

## Acceptance criteria

- [x] Pick one device use case and document its connectivity and recovery constraints.
- [x] Define device identity, invoice creation, QR/display, and payment-confirmation states.
- [x] Specify safe behavior for duplicate requests, timeouts, and offline recovery.
- [x] Break implementation into separate API, state, and interface tickets before work begins.

## Evidence and limits

The design is in [`machine-mode.md`](../machine-mode.md). It is a source-level design slice; no physical device or live payment was available for runtime validation. Implementation is split into MMP-013, MMP-014, and MMP-015.
