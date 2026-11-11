# MMP-007 — Walk through a real Testnet payment

- **Status:** Blocked
- **Priority / size:** P0 / M
- **Outcome:** Demonstrate that a customer wallet payment is reconciled after ledger validation.

## Dependencies and unblock condition

A valid merchant XRPL Testnet receiver and a separate funded Testnet sender wallet must be available. Relay Pay must receive addresses only; wallet secrets must never be entered into the app or repository.

## Acceptance criteria

- [ ] Configure the receiver address and Testnet websocket endpoint outside source control.
- [ ] Create a checkout in Testnet mode and pay the exact amount with the displayed destination tag.
- [ ] Confirm the invoice stays pending until validation, then becomes paid with the transaction hash.
- [ ] Confirm a wrong tag or wrong amount does not mark the invoice paid.
- [ ] Record the successful transaction link for the demo.

## Next action

Obtain Testnet wallet funding and configure a receiver, then run the focused payment walkthrough.
