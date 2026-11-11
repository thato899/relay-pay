# MMP-010 — Evaluate a supported wallet handoff

- **Status:** Done — research complete; no wallet handoff added
- **Priority / size:** P1 / M
- **Outcome:** Decide whether a documented wallet can safely open a prefilled XRPL Testnet payment request.

## Acceptance criteria

- [x] Verify documented wallet URL/QR syntax and whether it explicitly supports Testnet.
- [x] Keep the hosted checkout and manual copy flow as fallback when a safe handoff cannot be verified.
- [x] Clearly label network and never present a mainnet request as a Testnet payment.

## Decision

Do not add a wallet deep link in the current Testnet-only MVP. Xaman's documented request links list `XRPL` and `XAHAU` network values but do not document a Testnet value; its `xrpl://` variant also has no browser fallback. The XLS-0032 XRPL request URI proposal is marked stagnant and its account URI carries an address and optional tag, not a payment amount or network. A mainnet-capable link could send a user to the wrong network, so the hosted checkout and copyable instructions remain the safe path until a wallet explicitly documents Testnet support.

## Sources

- [Xaman payment request link documentation](https://docs.xaman.dev/simple-link-qr/payment-request-link)
- [XLS-0032 Request URI Structure](https://xls.xrpl.org/xls/XLS-0032-tx-request-uri.html)
