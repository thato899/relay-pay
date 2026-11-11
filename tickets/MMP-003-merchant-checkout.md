# MMP-003 — Build the merchant dashboard and hosted checkout

- **Status:** Done
- **Priority / size:** P0 / M
- **Outcome:** A merchant can create a payment request, share its QR, and see its state on the customer page.

## Acceptance criteria

- [x] Merchant can enter an amount and optional order reference.
- [x] New invoice appears in recent activity and the payment request panel.
- [x] Merchant QR opens a hosted customer checkout page.
- [x] Customer page shows amount, network, destination tag, merchant address, and expiry.
- [x] Paid and expired states are visible.

## Evidence

Frontend typecheck and production bundle build pass. End-to-end runtime walkthrough is tracked by MMP-006 and MMP-007.
