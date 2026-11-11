# MMP-007 — Walk through a real Testnet payment

- **Status:** Blocked (wallet prerequisites provisioned; local app unavailable)
- **Priority / size:** P0 / M
- **Outcome:** Demonstrate that a customer wallet payment is reconciled after ledger validation.

## Dependencies and unblock condition

A valid merchant XRPL Testnet receiver and a separate funded Testnet sender wallet are now available. Relay Pay receives addresses only; the sender seed is encrypted with Windows DPAPI outside the repository and must never be entered into the app or committed. The walkthrough is blocked until Docker Desktop's Linux engine is available so a fresh invoice and destination tag can be generated.

## Acceptance criteria

- [x] Configure the receiver address and Testnet websocket endpoint outside source control (`.env`, ignored by Git).
- [ ] Create a checkout in Testnet mode and pay the exact amount with the displayed destination tag.
- [ ] Confirm the invoice stays pending until validation, then becomes paid with the transaction hash.
- [ ] Confirm a wrong tag or wrong amount does not mark the invoice paid.
- [ ] Record the successful transaction link for the demo.

## Next action

Start Docker Desktop's Linux engine from a Windows session permitted to start `com.docker.service`; then bring up the stack, create a fresh invoice, pay its exact amount and displayed tag from the funded sender, and verify validated reconciliation. Both wallets were confirmed funded with 100 Testnet XRP on ledger 22,233,753 on 11 November 2026. Sender seed is stored encrypted in `%LOCALAPPDATA%\Codex\relay-pay-testnet\sender.seed.dpapi`; it is not in the app or repository.
