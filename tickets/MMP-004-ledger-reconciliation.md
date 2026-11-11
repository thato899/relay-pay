# MMP-004 — Reconcile validated XRPL Testnet payments

- **Status:** Done
- **Priority / size:** P0 / M
- **Outcome:** The backend marks an invoice paid only for a validated successful native XRP payment matching merchant, tag, and exact amount.

## Acceptance criteria

- [x] Demo mode is explicit and cannot activate outside demo configuration.
- [x] Testnet monitor only accepts validated `tesSUCCESS` Payment transactions.
- [x] Destination address, destination tag, and exact drops amount must match.
- [x] Transaction hash uniqueness prevents duplicate confirmation.
- [x] Backend never stores or signs with merchant or customer private keys.

## Evidence

API typecheck and production build pass. A live wallet-to-ledger walkthrough is tracked separately in MMP-007.
