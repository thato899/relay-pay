# Machine checkout: laundromat washer

## Goal

Let a customer pay for one washer cycle at an unattended laundromat. The washer starts only after Relay Pay reports that the exact native XRP payment has been validated on XRPL Testnet. The device never holds a wallet seed or signs a transaction.

## Actors and trust boundaries

- **Washer controller:** identifies the washer and selected cycle; it is not trusted to confirm payment.
- **Relay Pay API:** creates invoices, reconciles validated ledger payments, and reports invoice state.
- **Customer wallet:** prepares and signs a payment after the customer checks its destination, amount, network, and tag.
- **XRPL Testnet:** the final authority for whether a payment succeeded.

Device identity must be authenticated to the API. The machine credential is stored in the device's protected storage and never placed in a QR, checkout URL, or browser-visible customer payload. Registered device identity and merchant scoping are implemented through the server-side device registry (MMP-020).

## Normal payment flow

1. Customer selects an available washer and cycle on the machine display.
2. The controller creates a request with a stable operation ID, merchant ID, device ID, machine ID, cycle code, and exact price.
3. API authenticates the device and creates one invoice for that operation. Retries with the same operation ID return the same invoice rather than creating a second charge.
4. Machine displays the hosted checkout QR and a short checkout reference. The API assigns a unique destination tag and exact XRP drops amount.
5. Customer scans the QR, confirms the Testnet network and payment fields in their wallet, and signs there.
6. Relay Pay keeps the invoice pending until the XRPL monitor finds a validated `tesSUCCESS` Payment with the exact merchant address, destination tag, and XRP amount.
7. Machine polls `GET /v1/device/cycles/:operationId` with its authenticated device identity. The API enforces a 10-second minimum interval and a maximum of 180 recorded polls per operation, and expires overdue pending invoices.
8. A validated XRPL Testnet payment moves the cycle to `paid`. The device requests a start through `POST /v1/device/cycles/:operationId/start`; the API moves it to `start_requested` only when a matching validated payment exists.
9. The device reports `started` or `unknown` through `POST /v1/device/cycles/:operationId/ack`. Repeated acknowledgements are idempotent; an unknown result can later reconcile to started.

Cycle start is disabled by default (`DEVICE_CYCLE_START_ENABLED=false`). When an operator enables it, invoice creation and cycle start both check the active operator-owned spending cap and approved-payee policy. Do not connect this prototype to physical equipment.

```mermaid
sequenceDiagram
    participant C as Customer
    participant M as Washer controller
    participant A as Relay Pay API
    participant L as XRPL Testnet
    C->>M: Select washer and cycle
    M->>A: Create invoice (stable operation ID)
    A-->>M: Invoice ID, amount, tag, hosted checkout URL
    M-->>C: Display checkout QR
    C->>L: Sign payment in customer wallet
    A->>L: Reconcile validated account payment
    L-->>A: Validated exact-match Payment
    M->>A: Poll device cycle state (10s minimum, 180 max)
    A-->>M: paid
    M->>A: Request start (feature gate + validated payment)
    A-->>M: start_requested
    M->>M: Issue one hardware start command
    M->>A: Acknowledge started or unknown
```

## Connectivity and failure behavior

- **API unavailable before invoice creation:** do not display a payable QR and do not start the washer. Show “Payment service unavailable; please try again.”
- **Network lost after QR display:** keep the operation pending locally and continue showing the same checkout URL. Do not issue a replacement invoice during retries.
- **Payment made while the machine is offline:** the API may reconcile it when connectivity returns. The washer remains stopped until it successfully fetches `paid` for the active invoice.
- **Payment not seen before expiry:** keep the washer stopped. The customer must request staff support or start a new purchase after the old invoice expires.
- **Duplicate paid response or controller restart:** persist a one-time cycle-start marker keyed by invoice ID before sending the hardware start command. Never start a second cycle for the same invoice.
- **Uncertain hardware response:** report `start-unknown`, retain the invoice and operation IDs, and require device recovery/reconciliation; do not create a second charge automatically.
- **Wrong amount, destination, or tag:** invoice remains pending; support staff can investigate the transaction separately. The machine does not start.

## API and data requirements

MMP-013 and MMP-014 implement the authenticated device identity, idempotent operation IDs, persisted cycle state, bounded polling, and audit trail. MMP-021 adds an operator-owned spending cap and approved-payee policy. Automated boundary, concurrency, replay, and revocation coverage remains outstanding before the budget slice is complete.

## Simulator

The merchant console includes a browser-only washer checkout simulator and an operator budget panel. The simulator creates a hosted invoice at the selected fixed cycle price, shows the checkout QR, and polls invoice status. A demo-mode confirmation is labeled simulated and does not indicate a cycle can start. A paid XRPL Testnet invoice shows cycle eligibility, while physical start remains disabled in the simulator. The budget panel manages per-cycle caps, rolling window totals, approved receiver addresses, and active policy state. The simulator uses no device credential and controls no physical equipment.

## Prototype boundaries

- Testnet only; do not use real funds or attach physical equipment.
- No offline payment verification. A locally displayed receipt, wallet screenshot, or unvalidated transaction must never unlock a machine.
- One operation can start at most one cycle. Refunds, partial payments, multiple assets, and remote machine control are out of scope for this design.
- Before any public deployment, complete merchant/device authorization and security review.
