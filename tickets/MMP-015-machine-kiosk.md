# MMP-015 — Build a machine checkout simulator

- **Status:** Done
- **Priority / size:** P1 / M
- **Outcome:** A browser simulator demonstrates a washer display and safe payment-state transitions without controlling physical equipment.

## Dependencies

MMP-013 and MMP-014.

## Acceptance criteria

- [x] Customer can select a demo machine and cycle and see the exact price.
- [x] Simulator displays the hosted checkout QR and current payment status.
- [x] Simulator shows cycle eligibility only after a paid XRPL Testnet invoice; hardware start remains gated.
- [x] Demo simulation is clearly labeled and cannot be mistaken for an onchain payment.
- [x] Lost network, expired invoice, and duplicate/retry behavior are visible and fail safely.

## Implementation notes

- Added the washer simulator to the merchant console with fixed exact XRP prices for three wash cycles and two demo machines.
- It creates a hosted invoice, displays its QR, and refreshes the same invoice every 10 seconds. Manual retries reuse that invoice; a new invoice requires an explicit new purchase.
- Demo-mode payment is labeled simulated and never displays cycle eligibility. A paid XRPL Testnet invoice displays eligibility while clearly stating physical start remains disabled pending MMP-021 budget controls.
- Offline, API error, and expired invoice states remain visible; the simulator never claims to control equipment.
