# Project status

**Last updated:** 11 November 2026 (SAST)  
**Product:** Relay Pay — QR-first Merchant & Machine Payments  
**Track:** Merchant & Machine Payments  
**Current event phase:** Virtual build phase, 2–11 November; in-person build in Cape Town, 12–14 November.

## Snapshot

- **Workspace:** New project scaffold created in `work/merchant-machine-payments`.
- **Product direction:** Create a small-merchant QR checkout that reconciles native XRP Testnet payments by destination, exact amount, and unique destination tag.
- **Current implementation:** Monorepo, shared contracts, PostgreSQL/Drizzle persistence, Fastify API, invoice workflow, periodic XRPL reconciliation, React merchant/customer screens, Docker Compose, CI, and project docs. Customer checkout now provides a copyable payment summary and makes the destination-tag requirement explicit.
- **Latest completed slice:** MMP-015 washer checkout simulator. It offers two demo machines and three fixed-price cycles, displays hosted checkout QR/payment status, and handles offline, retry, expiry, and simulation states. MMP-014 provides the authenticated cycle state API; hardware start stays gated until MMP-021.
- **Workshop review:** Track slides and the resource guide have been distilled into [`workshop-alignment.md`](workshop-alignment.md). XRPL remains the current prototype rail because the workshop accepts any chain; the real-payment demo, named customer/cash-out story, and human-enforced device spending cap are explicit gaps. MMP-021 tracks the cap.
- **Work tracking:** Local Kanban board and ticket files are in [`tickets/board.md`](tickets/board.md). MMP-013 through MMP-015 are complete. MMP-021 spend-budget enforcement remains in the backlog; cycle start stays disabled until then. Local demo and Testnet validation remain blocked on environment setup.
- **Payment mode:** Local demo by default outside production. Demo mutation requires both demo mode and `DEMO_PAYMENTS_ENABLED`; production startup rejects demo enablement. XRPL mode requires a merchant Testnet address and never signs transactions.
- **Verification:** Typecheck, build, and Biome lint pass; lint reports 58 non-blocking warnings, mainly existing non-null assertions and CSS selector specificity/complexity. The dependency audit reports no known vulnerabilities. Device identity, machine-invoice, and machine-cycle migrations are generated but not applied; Docker image builds and live ledger reconciliation remain unverified because the Docker Desktop Linux engine is unavailable.

## Immediate next actions

1. Start Docker Desktop, build the images, and bring up the local demo stack.
2. Walk through invoice creation, QR checkout, copied payment instructions, and demo confirmation.
3. Set up a fresh XRPL Testnet receiver and validate a real wallet payment against the matching logic.
4. Submit the overdue 9 November checkpoint materials in BuilderBase if still possible. The published guide calls this a mandatory feedback checkpoint, not an elimination round.
5. Confirm team formation status; event guide lists a 6 November team-finalization deadline.
6. Deploy and prepare the public repository plus a ≤3-minute demo video for the 13 November, 23:59 SAST submission cutoff.

## Risks and decisions

- **Missed checkpoint:** the 9 November checkpoint has passed. Its consequences are not stated as disqualification; submit late and contact Percy/organizers if submission is blocked.
- **Merchant receiver required:** Testnet payment detection cannot be demonstrated until a valid XRPL Testnet destination address is configured.
- **Wallet flow:** QR currently opens the checkout page. Customers manually send the exact amount/tag from their wallet; wallet-specific deep links are not in the first slice.
- **Machine flow:** The laundromat washer design is in [`machine-mode.md`](machine-mode.md); authenticated invoice and cycle state APIs plus the checkout simulator are implemented in MMP-013–MMP-015.
- **Identity model:** Auth0 Organizations over OIDC is the chosen model; see [`security-model.md`](security-model.md) before extending authentication or tenant scoping.
- **Demo security boundary:** production API startup remains blocked pending completion of all merchant, audit, and device safeguards. Do not expose the prototype or use real funds.
- **Machine identity configuration:** Auth0 must grant `devices:admin` to merchant administrators and `devices:connect` to registered M2M clients. Cycle start is disabled until MMP-021 adds enforceable spend caps and approved payees.
- **Container verification:** Docker Desktop's Linux engine was not running, so local image builds are unverified. GitHub Actions is configured to build both images after the quality gates pass.
- **Wallet handoff:** No wallet URI is enabled because official wallet documentation does not explicitly establish the current Testnet payment flow; see MMP-010 for the decision and sources.
