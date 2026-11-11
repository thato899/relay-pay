# Kanban board

**Updated:** 11 November 2026 (SAST)  
**WIP limit:** 1 In Progress ticket  
**Current WIP:** 1

## In Progress

| ID                                          | Ticket                                          | Priority | Size |
| ------------------------------------------- | ----------------------------------------------- | -------- | ---- |
| [MMP-019](MMP-019-audit-demo-safeguards.md) | Add audit events and production demo safeguards | P1       | S    |

## Ready

| ID                                    | Ticket                                | Priority | Size |
| ------------------------------------- | ------------------------------------- | -------- | ---- |
| [MMP-020](MMP-020-device-identity.md) | Register machine-to-merchant identity | P1       | S    |
## Blocked

| ID                                                | Ticket                              | Priority | Size | Waiting on                                                                         |
| ------------------------------------------------- | ----------------------------------- | -------- | ---- | ---------------------------------------------------------------------------------- |
| [MMP-006](MMP-006-local-demo-stack.md)            | Build and run the local demo stack  | P0       | S    | Docker Desktop Linux engine must be running.                                       |
| [MMP-007](MMP-007-testnet-payment-walkthrough.md) | Walk through a real Testnet payment | P0       | M    | A Testnet merchant receiver and funded sender wallet must be available.            |
| [MMP-008](MMP-008-checkpoint-follow-up.md)        | Resolve late checkpoint submission  | P0       | XS   | BuilderBase must allow a late update, or organizers must advise the recovery path. |

## Backlog

| ID                                        | Ticket                                                 | Priority | Size | Depends on                                        |
| ----------------------------------------- | ------------------------------------------------------ | -------- | ---- | ------------------------------------------------- |
| [MMP-009](MMP-009-final-submission.md)    | Prepare the final hackathon submission                 | P0       | M    | Demo walkthrough and public repository readiness. |
| [MMP-013](MMP-013-machine-invoice-api.md) | Add authenticated, idempotent machine invoice creation | P1       | M    | MMP-017 and MMP-020.                              |
| [MMP-014](MMP-014-machine-state.md)       | Add safe machine payment and cycle state tracking      | P1       | M    | MMP-013.                                          |
| [MMP-015](MMP-015-machine-kiosk.md)       | Build a machine checkout simulator                     | P1       | M    | MMP-013 and MMP-014.                              |
| [MMP-020](MMP-020-device-identity.md)     | Register machine-to-merchant identity                  | P1       | S    | MMP-016.                                          |

## Done

| ID                                            | Ticket                                                  | Priority | Size |
| --------------------------------------------- | ------------------------------------------------------- | -------- | ---- |
| [MMP-001](MMP-001-foundation-pipeline.md)     | Create workspace foundation and quality pipeline        | P0       | M    |
| [MMP-002](MMP-002-invoice-api.md)             | Create and persist exact-value invoices                 | P0       | M    |
| [MMP-003](MMP-003-merchant-checkout.md)       | Build the merchant dashboard and hosted checkout        | P0       | M    |
| [MMP-004](MMP-004-ledger-reconciliation.md)   | Reconcile validated XRPL Testnet payments               | P0       | M    |
| [MMP-005](MMP-005-payment-instructions.md)    | Make customer payment instructions copyable and clear   | P0       | XS   |
| [MMP-010](MMP-010-wallet-handoff.md)          | Evaluate a supported wallet handoff                     | P1       | M    |
| [MMP-011](MMP-011-machine-mode.md)            | Design a low-connectivity machine checkout              | P1       | L    |
| [MMP-012](MMP-012-multi-merchant-security.md) | Choose identity and tenant model                        | P1       | S    |
| [MMP-016](MMP-016-api-oidc-auth.md)           | Verify OIDC access tokens in the API                    | P1       | M    |
| [MMP-017](MMP-017-tenant-data-isolation.md)   | Scope invoices by merchant and disclose shared receiver | P1       | M    |
| [MMP-018](MMP-018-dashboard-oidc-login.md)    | Add dashboard OIDC login                                | P1       | M    |
