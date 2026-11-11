# Project status

**Last updated:** 11 November 2026 (SAST)  
**Product:** Relay Pay — QR-first Merchant & Machine Payments  
**Track:** Merchant & Machine Payments  
**Current event phase:** Virtual build phase, 2–11 November; in-person build in Cape Town, 12–14 November.

## Snapshot

- **Workspace:** New project scaffold created in `work/merchant-machine-payments`.
- **Product direction:** Create a small-merchant QR checkout that reconciles native XRP Testnet payments by destination, exact amount, and unique destination tag.
- **Current implementation:** Monorepo, shared contracts, PostgreSQL/Drizzle persistence, Fastify API, invoice workflow, periodic XRPL reconciliation, React merchant/customer screens, Docker Compose, CI, and project docs. Customer checkout now provides a copyable payment summary and makes the destination-tag requirement explicit.
- **Latest completed slice:** MMP-021 operator-controlled device budgets. Merchant admins configure per-cycle and rolling-window caps plus the approved receiver; pending invoices reserve funds, and the API enforces policy during invoice creation and cycle start. PostgreSQL coverage includes boundaries, concurrency, retries, and revocation.
- **Current ticket:** MMP-009 final submission is In Progress. A submission brief is drafted in [`submission-draft.md`](submission-draft.md), with current official fee/source notes and explicit unvalidated assumptions. The real Testnet walkthrough, video, and BuilderBase receipt remain open; MMP-006 and MMP-007 are blocked by the unavailable Docker Linux engine.
- **Testnet setup:** A dedicated receiver and separate sender were funded by the XRPL Testnet faucet and confirmed at 100 test XRP each on validated ledger 22,233,753. Their addresses and the Testnet endpoint are in ignored local `.env`; the sender seed is DPAPI-encrypted under `%LOCALAPPDATA%\Codex\relay-pay-testnet\sender.seed.dpapi`. No seed is in source control. MMP-007 still needs a fresh invoice/payment walkthrough.
- **Workshop review:** Track slides and the resource guide have been distilled into [`workshop-alignment.md`](workshop-alignment.md). XRPL remains the current prototype rail. Remaining product gaps are a real public-Testnet demo, a named customer/operator and cash-out story, and final submission evidence.
- **Work tracking:** Local Kanban board and ticket files are in [`tickets/board.md`](tickets/board.md). MMP-013 through MMP-015 and MMP-021 are complete. Cycle start remains disabled by default. Local demo and Testnet validation remain blocked on environment setup.
- **Payment mode:** Local demo by default outside production. Demo mutation requires both demo mode and `DEMO_PAYMENTS_ENABLED`; production startup rejects demo enablement. XRPL mode requires a merchant Testnet address and never signs transactions.
- **Verification:** Local typecheck, build, and Biome lint pass; lint reports 65 non-blocking warnings. GitHub CI passed lint, typecheck, build, PostgreSQL budget tests, dependency audit, and both container-image builds. Device identity, machine-invoice, machine-cycle, and device-budget migrations are generated but not applied locally; local Compose runtime and live app reconciliation remain unverified because Docker Desktop's Linux engine is unavailable. Wallets are now provisioned.

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
- **Machine identity configuration:** Auth0 must grant `devices:admin` to merchant administrators and `devices:connect` to registered M2M clients. Device spends require a configured active cap and approved receiver; cycle start remains off by default.
- **Container verification:** Docker Desktop's Linux engine was not running, so local image builds are unverified. GitHub Actions is configured to build both images after the quality gates pass.
- **Wallet handoff:** No wallet URI is enabled because official wallet documentation does not explicitly establish the current Testnet payment flow; see MMP-010 for the decision and sources.
