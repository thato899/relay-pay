# Agile plan

## Product goal

Build a demoable, QR-first merchant and machine payment flow for a small merchant. A merchant creates an exact XRP invoice; a customer opens the checkout page and pays from their own wallet; the API confirms only a validated XRPL Testnet transaction that matches the destination, tag, and amount. Demo mode provides a clearly labeled local simulation when a test wallet is not available.

## Agile working agreement

- **Method:** lightweight Kanban; the living board and work tickets are in [`tickets/`](tickets/README.md).
- **Cadence:** review the board at each work session; pull the highest-priority unblocked ticket and ship a small working increment before pulling another.
- **WIP limit:** one ticket In Progress; blocked tickets do not count as active work.
- **Ticket size:** aim for one focused outcome with a short acceptance checklist; split a ticket when it spans unrelated outcomes or cannot be reviewed as one change.
- **Status transitions:** Backlog → Ready → In Progress → Done; use Blocked with a written unblock condition when progress depends on something external.
- **Definition of ready:** user problem, track fit, acceptance criteria, and dependencies are clear.
- **Definition of done:** the slice is implemented, typed, lint-clean, documented, and works in the intended demo or Testnet mode; relevant CI gates pass.
- **Review principle:** keep a running demo flow and update the board and `status.md` when a ticket, blocker, milestone, or event checkpoint changes.

## Hackathon constraints and dates

- The BuilderBase guide describes virtual building from **2–11 November 2026**, followed by in-person building in Cape Town **12–14 November**. Work started now is within the allowed build period.
- The submission must be a new project; pre-existing projects are not eligible.
- Every project must align to a track. This project is scoped to **Merchant & Machine Payments**: onchain checkout infrastructure for merchant, e-commerce, or point-of-sale payments.
- The mandatory checkpoint was **9 November at 17:00 SAST**. It requested the project concept, one technical-foundation artifact, and a team update. It is listed as a feedback round, not an elimination round; submit late as soon as BuilderBase allows and ask the organizer if the form is closed.
- Final submission is due **13 November at 23:59 SAST** and requires a project title, public GitHub repository with README, and demo video URL. Judging is **14 November** in Cape Town.
- Team size is 1–4. The event guide lists team finalization on 6 November; verify status with the organizer if a team is not already set.

## Workshop alignment and product gaps

The 6 November Merchant & Machine Payments workshop and its resource guide accept any chain or payment rail. They emphasize a public-testnet payment that completes end to end, automatic order matching, an obvious merchant/operator view, and a human-enforced machine spending cap. The workshop also asks for a named customer, a credible go-to-market path, and an honest cash-out story.

Relay Pay's current XRPL Testnet path is a viable chain-specific route for the required public-testnet payment: the server matches validated payments using destination, exact drops, and a unique destination tag. Keep XRPL as the current prototype rail; do not add Base/USDC or x402/MPP solely because the workshop demonstrates them. Revisit protocol/rail choice only if the machine use case requires payment per request or a stablecoin denomination. Treat sample addresses, token contracts, facilitator URLs, and code snippets in the workshop PDFs as examples to verify before use, never as production credentials or instructions.

Remaining workshop-derived product gaps:

- [ ] Complete a real payer-to-merchant XRPL Testnet transaction and capture a short demo; demo-mode simulation does not satisfy this.
- [ ] Define and enforce a human-owned machine spending limit that device credentials cannot increase, plus an approved payee and a revocation path.
- [ ] Name and validate a target merchant/operator; explain fees against cash/mobile money and the route from received value to rand or the next supplier.
- [ ] Show how wrong-amount, late, and refund cases are surfaced without relying on a block explorer.
- [ ] Keep the hackathon demo at or below three minutes and show the real payment and automatic match.

## MVP scope

### P0 — must ship

- [x] Create a TypeScript workspace with shared API contracts and strict type settings.
- [x] Create invoice API and PostgreSQL schema for pending, paid, and expired checkouts.
- [x] Make the merchant dashboard generate a payment request and a customer QR page.
- [x] Keep amount precision as XRP drops and allocate a unique destination tag per invoice.
- [x] Add a visibly labeled demo payment path for local walkthroughs only.
- [x] Add Testnet reconciliation that accepts only validated, successful, exact-match Payment transactions.
- [x] Add OpenAPI docs, health/readiness endpoints, local containers, and CI quality gates.
- [x] Show the customer network, exact amount, destination tag, and a copyable payment summary; warn that the tag is required for automatic matching.
- [x] Start the fresh product implementation within the active virtual build window.
- [ ] Prepare and submit the checkpoint evidence; the checkpoint date has passed, so check whether late submission is accepted.
- [ ] Configure an XRPL Testnet merchant receiver and demonstrate a real wallet-to-merchant payment.
- [ ] Record and present the confirmed invoice without requiring anyone to inspect a block explorer manually.
- [ ] Confirm the event team record and contact the organizer about the missed checkpoint if needed.
- [ ] Deploy the demo and validate the complete QR → wallet → validated-ledger flow.

### P1 — after the core flow works

- [ ] Add an explicit checkout-session handoff for supported wallets.
- [x] Design a low-connectivity device mode for an unattended washer; implementation tickets MMP-013–MMP-015 are in the Kanban backlog.
- [ ] Add receipt export and merchant reconciliation history.
- [ ] Complete Auth0 OIDC, merchant isolation, audit, and device-identity tickets MMP-016–MMP-020 before any public deployment.
- [ ] Add an operator-owned spending cap and approved-payee policy before enabling device payments (MMP-021).
- [ ] Add automated domain and adapter tests once test-writing is explicitly in scope.

## Stories and acceptance criteria

### Story A — create a checkout

As a merchant, I can enter an amount and optional order reference and receive a payment QR.

- The API rejects invalid or excessive values and returns the amount as an exact decimal string plus drops.
- Each invoice has a UUID, unique destination tag, network, status, creation time, and expiry.
- The QR opens a customer checkout page with the amount, destination, tag, network, and expiry.
- The customer can copy all payment fields together and is warned that the destination tag must be included.

### Story B — reconcile a Testnet payment

As a merchant, I can see payment status move to paid only after the ledger confirms the right transaction.

- The watcher ignores unvalidated or failed transactions.
- The destination, destination tag, and exact native XRP drops must all match.
- A transaction hash is idempotent and can confirm at most one invoice.
- The API never stores or signs with customer or merchant private keys.

### Story C — run a reliable demo

As a builder, I can start the product from a clean checkout and demonstrate the core flow.

- `docker compose up --build` starts PostgreSQL, API, and web containers.
- Demo mode is marked as a simulation in the UI and cannot be confused with a real payment.
- CI runs formatting/lint, typecheck, build, dependency audit, container build, and CodeQL.

## Delivery slices

| Slice             | Goal                                                             | Acceptance                                                       |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1 · Foundation    | Workspace, strict TypeScript, database schema, API contracts, CI | Clean install and all static/build gates pass                    |
| 2 · Merchant flow | Invoice creation, QR view, dashboard and recent activity         | New checkout appears in both merchant and customer screens       |
| 3 · Ledger flow   | XRPL Testnet watcher and demo-mode simulation                    | A validated exact-match payment moves the invoice to paid        |
| 4 · Submission    | Deploy, capture demo, public repo and event submission           | BuilderBase accepts title, repository, and video before deadline |

## Work tracking

The `tickets/board.md` file is the current Kanban view. Individual tickets in that folder hold the outcome, acceptance criteria, dependencies, and unblock conditions. This roadmap defines scope and sequencing; the board tracks day-to-day execution. See [`workshop-alignment.md`](workshop-alignment.md) for requirements distilled from the track workshop resources and the rationale for retaining XRPL as the current prototype rail.
