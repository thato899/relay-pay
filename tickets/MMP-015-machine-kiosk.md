# MMP-015 — Build a machine checkout simulator

- **Status:** Backlog
- **Priority / size:** P1 / M
- **Outcome:** A browser simulator demonstrates a washer display and safe payment-state transitions without controlling physical equipment.

## Dependencies

MMP-013 and MMP-014.

## Acceptance criteria

- [ ] Customer can select a demo machine and cycle and see the exact price.
- [ ] Simulator displays the hosted checkout QR and current payment status.
- [ ] Simulator shows a cycle-start state only after validated payment status.
- [ ] Demo simulation is clearly labeled and cannot be mistaken for an onchain payment.
- [ ] Lost network, expired invoice, and duplicate/retry behavior are visible and fail safely.
