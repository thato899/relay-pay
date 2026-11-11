# Agent working agreement

This project is Relay Pay, a QR-first merchant checkout prototype for the Node Engine Hackathon's Merchant & Machine Payments track.

## Source of truth

- Read `planning.md` before changing scope and `status.md` before continuing active work.
- Read `architecture.md` before changing API boundaries, payment reconciliation, or data ownership.
- The event's BuilderBase guide is authoritative for eligibility, dates, and submission requirements. The project must be new; never reuse a pre-existing project as the hackathon submission.

## Engineering rules

- TypeScript is strict across the API, web application, and shared contracts. Preserve exact string handling for XRP amounts; never use floating-point arithmetic to decide whether a payment matches an invoice.
- Keep the API modular: route and schema concerns belong in `apps/api/src/app.ts`, business rules in module services, persistence in repositories, and XRPL interaction in the payment adapter.
- Keep UI code free of signing keys. Customer wallets sign transactions; the server only issues payment instructions and reconciles validated Testnet payments.
- Do not add mainnet support or handle real funds without a separately reviewed security design.
- Every externally reachable API route must validate input, return a stable error shape, and be documented in OpenAPI.
- Keep secrets out of source control, logs, API responses, and browser bundles. Add new variables to `.env.example` with safe, non-secret defaults.
- Prefer small changes that preserve workspace package boundaries and can be deployed as separate API and web containers.

## Delivery workflow

1. Update the relevant item in `planning.md` and `status.md` as work changes.
2. Implement one vertical slice at a time: contract → API/domain → persistence → UI → documentation.
3. Keep CI gates green: Biome, TypeScript checks, production build, dependency audit, container builds, and CodeQL.
4. Do not mark an item done unless its acceptance criteria are visible and the status file reflects the evidence.
5. Keep demo mode conspicuously labeled. The demo-payment route must remain disabled outside `PAYMENT_MODE=demo`.

## Current product boundaries

- One merchant workspace; authentication and multi-tenant access control are future work.
- Native XRP on XRPL Testnet only in ledger mode. No token swaps, fiat pricing, custody, or payment signing by the API.
- QR codes open this app's checkout page. Customers use their own wallet to pay the address and exact destination tag shown.
- The API recognizes a payment only after a validated `tesSUCCESS` Payment transaction matches the invoice's destination, destination tag, and exact drops amount.
