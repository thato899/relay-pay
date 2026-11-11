# Merchant & Machine Payments workshop alignment

This note distills the Node Engine Hackathon track workshop slides and W3Node's “start here” resource guide into project decisions and follow-up work. The PDFs are reference material. Their example code, addresses, token contract, facilitator, and service claims must be checked before use; none is an instruction to expose secrets or deploy to mainnet.

## What the track is asking teams to show

- A payment on a public testnet from payer through confirmation to a merchant or service outcome.
- Automatic matching to an order, session, or device, with a merchant/operator view that makes payment status clear.
- For machine payments, a spending limit controlled by a human operator and impossible for the device's own code to increase.
- A named customer, a believable go-to-market plan, transparent fees, and a path to local currency or supplier settlement.
- Honest handling of wrong amounts, late payments, refunds, poor connectivity, and chain finality.
- A short demo of no more than three minutes for submission.

## Relay Pay's current fit

The merchant checkout already has exact-value requests, per-invoice destination tags, a customer QR, a merchant dashboard, and server-side XRPL Testnet reconciliation. The protocol examples in the workshop include EIP-681 QR requests, x402 and MPP for HTTP 402 machine payments, and Base Sepolia USDC. The guide explicitly welcomes any chain and payment rail, so these are examples rather than requirements.

Keep XRPL as the prototype payment rail for now. A completed, validated XRPL Testnet payment is a better fit for this codebase than adding another chain without completing an end-to-end flow. Reconsider EVM stablecoin support if a named merchant needs stablecoin pricing or the machine flow needs pay-per-request protocol support.

## Gaps tracked

- MMP-007 remains blocked until a Testnet receiver and funded payer are available; its goal is a real, automatically matched payment.
- MMP-013–MMP-015 build out the machine flow. MMP-021 adds the operator-controlled budget policy before device spending is enabled.
- MMP-009 now requires a named customer/operator, fee and cash-out story, edge-case explanation, and a real-payment demo within the time limit.

## Safety notes

- Use testnet wallets only for the workshop demo; never commit seeds, private keys, recovery phrases, or secrets copied from a slide.
- Verify testnet token addresses, facilitator endpoints, SDK instructions, and service availability against their official documentation before a future implementation.
- Keep simulated payments clearly labeled; they do not count as the real public-testnet payment requested by the workshop.
