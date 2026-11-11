# Relay Pay — submission draft

**State:** Draft for review; not submitted  
**Prepared:** 11 November 2026 (SAST)  
**Track:** Merchant & Machine Payments  
**Repository:** https://github.com/thato899/relay-pay  
**Demo video:** Not recorded  
**BuilderBase receipt:** Not confirmed

## Short pitch

Relay Pay is a QR checkout and payment-control prototype for small merchants and unattended machines. A merchant creates an exact-value XRP Testnet invoice; the customer pays from their own wallet. Relay Pay marks it paid only after the XRPL validates a successful payment to the configured receiver with the exact amount and unique destination tag. For a washer, an authenticated device can request a cycle invoice, while the merchant controls the approved receiver, per-cycle and rolling spend caps, and device revocation.

The current implementation is a prototype on XRPL Testnet. It does not sign for customers, custody customer keys, or move real money. The machine UI is a simulator; no physical machine is connected.

## Target user and problem

**Target-market hypothesis:** independent laundromat operators in South Africa who want to reconcile unattended washer payments and limit what a connected machine can spend.

This is a hypothesis, not a validated customer segment. No operator has yet been interviewed or named as a pilot partner. Before claiming product-market fit, validate willingness to accept crypto, the connectivity and service workflow, customer demand, and the operator's preferred cash-out route.

## What the demo should show

1. Merchant creates an invoice and the customer page displays its network, exact amount, receiver, and required destination tag.
2. A payer sends the matching amount from a separate XRPL Testnet wallet.
3. After ledger validation, the backend matches the destination, amount, and tag and the merchant view shows the paid state.
4. The operator configures a machine spend cap and approved receiver; the simulator requests a cycle invoice. Show an over-cap request being denied and the device revocation path.
5. Explain that a wrong-amount or late payment does not silently mark the invoice paid; refunds require a separate operator action and are not automated by this prototype.

**Evidence status:** steps 1 and the machine simulator can be shown locally once the Docker demo stack runs. The real Testnet payment and end-to-end walkthrough have not been verified or recorded. Do not represent a simulated payment as a ledger payment.

## Honest costs and settlement

- **Card benchmark:** Yoco's published Core pricing lists a R0 monthly software fee and a transaction table with debit and credit rates varying by plan and monthly volume; for the “up to R50k” band the table lists 2.30% for debit and credit and 3.20% for international cards. Pricing can change and the merchant's actual plan, hardware, and payout terms need checking. Source: [Yoco pricing](https://www.yoco.com/za/pricing/) (checked 11 November 2026).
- **Instant-payment benchmark:** Standard Bank currently says PayShap registration is free, the payer is charged R7.50 per payment, and payments are irrevocable. That is a payer-side fee on this bank's product, not a merchant acquiring fee, so it is not directly comparable to Yoco's merchant fee. Source: [Standard Bank PayShap for business](https://www.standardbank.co.za/southafrica/business/products-and-services/ways-to-bank/innovative-payment-solution/payshap-for-business) (checked 11 November 2026).
- **Cash:** no electronic transaction fee is charged at the point of payment, but staff time, cash handling, security, and reconciliation costs have not been measured. Relay Pay has no field data to claim it is cheaper than cash or existing payment methods.
- **XRPL costs:** standard transactions currently have a minimum 10-drop network cost, which can rise with network load; accounts can also require XRP reserves. These network costs are not a complete merchant cost comparison and XRP's rand value can fluctuate. Sources: [XRPL transaction cost](https://xrpl.org/docs/concepts/transactions/transaction-cost) and [XRPL reserves](https://xrpl.org/docs/concepts/accounts/reserves) (checked 11 November 2026).
- **Cash-out:** Testnet XRP is test value and has no real rand redemption. A production service would need a suitable exchange/off-ramp and a compliant business arrangement, plus KYC, liquidity, spread, network, and payout-cost analysis. No provider or settlement path has been selected. Therefore no production cash-out promise or savings claim is made.

## Safety and operational limits

Merchant administrators set each registered machine's cycle and rolling-window budgets and approved receiver. Device credentials cannot raise those limits; an administrator can revoke a device. These controls are implemented and covered by PostgreSQL tests, but the migration is not applied to a local database and the runtime demo has not yet been exercised. Cycle starts remain disabled by default. The API does not hold signing keys. Do not use real funds or connect production machinery.

## Submission fields to complete

- **Title:** Relay Pay — QR Checkout for Merchants and Machines
- **Track:** Merchant & Machine Payments
- **Repository:** https://github.com/thato899/relay-pay
- **Video URL:** Pending a verified real Testnet payment recording (maximum three minutes)
- **Customer/operator:** Independent South African laundromat operators (unvalidated target hypothesis; no named pilot)
- **Submission receipt:** Pending BuilderBase submission and confirmation

## Remaining work before this can be submitted as complete

- [ ] Run the local demo stack and walkthrough (MMP-006; currently blocked because Docker Desktop's Linux engine is unavailable).
- [ ] Complete and verify a real payer-to-merchant Testnet payment (MMP-007; needs a Testnet receiver and funded sender).
- [ ] Record and review the ≤3-minute video; link it above.
- [ ] Validate the target user and cash-out assumptions; keep unvalidated statements labeled as hypotheses.
- [ ] Submit in BuilderBase and confirm receipt before 13 November 2026, 23:59 SAST.

