# Relay Pay

Relay Pay is a new QR-first merchant checkout prototype for the **Merchant & Machine Payments** track at the Node Engine Hackathon. It lets a small merchant create an exact XRP checkout, show a customer QR, and reconcile a payment only after a matching XRPL Testnet transaction is validated.

The team's interpretation of the track workshop and its resulting product gaps are recorded in [workshop alignment](workshop-alignment.md). The project keeps XRPL as its current testnet rail; workshop examples such as Base Sepolia USDC, x402, and MPP are options rather than required stack choices.

## Why this fits the track

The event track is for onchain infrastructure that supports merchant, e-commerce, and point-of-sale payments. This MVP focuses on a merchant countertop flow: amount and order reference → QR checkout → customer wallet payment → automatic ledger confirmation. The BuilderBase event guide says eligible submissions must be new projects; this repository is being built from scratch during the published virtual build phase.

## Stack

- **TypeScript** across the API, web UI, and shared contracts.
- **Fastify 5** for a schema-validated, OpenAPI-documented HTTP API.
- **React 19 + Vite 6** for the merchant and customer checkout interfaces.
- **PostgreSQL + Drizzle ORM** for invoices, destination tags, and confirmed transaction records.
- **Auth0 SPA SDK + OIDC** for optional merchant dashboard login using Authorization Code with PKCE; tokens are kept in memory.
- **`xrpl.js`** official JavaScript/TypeScript SDK to read XRPL Testnet account transactions.
- **TypeBox** for reusable JSON Schemas and shared API contracts.
- **Docker Compose** for repeatable local services.
- **GitHub Actions** for lint, strict typecheck, build, production dependency audit, container builds, CodeQL, and dependency review.

## Start locally

Prerequisites: Node.js 20.11+, pnpm 12.3.4, and Docker with Compose.

1. Copy `.env.example` to `.env` if you want to customize settings.
2. Install dependencies and create the lockfile:

   ```powershell
   pnpm install
   ```

3. Run the whole local stack in demo mode:

   ```powershell
   docker compose up --build
   ```

4. Open [http://localhost:8080](http://localhost:8080). API docs are at [http://localhost:8080/documentation](http://localhost:8080/documentation).

Demo mode is explicitly marked in the interface. Its “Simulate payment” button only changes the local demo ledger; it does not submit a transaction or move XRP.

### Auth0 merchant sign-in

For an Auth0 tenant, configure the API's `AUTH_MODE=oidc`, `OIDC_ISSUER`, and `OIDC_AUDIENCE`, then set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` for the web build. Add the web origin to the Auth0 SPA application's Allowed Callback, Logout, and Web Origins. An optional `VITE_AUTH0_ORGANIZATION` preselects the organization; otherwise the dashboard asks for its Auth0 organization ID. Configure the custom API permissions `invoices:read`, `invoices:write`, and `devices:admin`; an Auth0 machine-to-machine application used by a registered device needs `devices:connect`. The SPA client ID is public; do not add a client secret to browser or `VITE_*` configuration. Public customer checkout remains accessible without merchant login.

### Machine identity registration

An organization admin registers a device through `POST /v1/devices` with its stable device code, display name, and machine-to-machine token subject. The API stores the subject-to-organization mapping and audits registration. A device presents an access token for the API audience with `devices:connect`; `GET /v1/device/context` resolves the verified subject to its active server-side registration. The token's organization claim is not trusted for machine tenancy. Disable a device using `POST /v1/devices/{id}/disable`; this revokes API access on the next request. Rotate credentials by registering the new machine subject and disabling the old registration. Never put a machine secret in a browser bundle or checkout URL.

Registered devices create washer-cycle invoices with `POST /v1/device/invoices`. The body includes a stable `operationId`, `cycleCode`, exact `amountXrp`, and optional reference. An identical retry returns the original invoice; reusing an operation ID with changed details returns `409`. The operation record, invoice, audit entry, and initial `awaiting_payment` cycle state commit together. Devices poll `GET /v1/device/cycles/{operationId}` every 10 seconds; polling is capped at 180 attempts per cycle and returns `429` with `Retry-After` when called too soon. After a validated XRPL Testnet payment, the device may request a single cycle start and acknowledge it as `started` or `unknown`. Repeated acknowledgements are idempotent. Cycle starts are disabled by default and production rejects enabling them until MMP-021 implements operator spending caps.

### Run web and API without container builds

Start PostgreSQL in a terminal with `docker compose up -d db`, then run:

```powershell
pnpm install
pnpm db:migrate
pnpm dev
```

The Vite app runs at [http://localhost:5173](http://localhost:5173) and proxies `/v1` to the API on port 4000.

## XRPL Testnet mode

Create or select a **Testnet-only** merchant receiver, then set these values in `.env`:

```dotenv
PAYMENT_MODE=xrpl-testnet
MERCHANT_XRPL_ADDRESS=rYourClassicTestnetAddress
XRPL_WS_URL=wss://s.altnet.rippletest.net:51233
```

Restart the API or Compose stack. Create a checkout, then send the exact amount from a Testnet wallet to the configured address using the displayed destination tag. The API checks validated account transactions every few seconds. A request becomes paid only when the ledger reports `tesSUCCESS` and the address, tag, and exact drops amount match.

The backend never generates a customer wallet, holds a seed, or signs a payment. Never enter a recovery phrase into Relay Pay. This prototype is Testnet-only; there is no mainnet mode or real-funds support.

## Project structure

```text
apps/
  api/       Fastify routes, invoice module, Postgres persistence, XRPL monitor
  web/       React merchant dashboard and customer checkout page
packages/
  contracts/ Shared API schemas and DTOs
.github/
  workflows/ CI, CodeQL, dependency review
```

See [architecture.md](architecture.md), [machine-mode.md](machine-mode.md), [security-model.md](security-model.md), [planning.md](planning.md), [status.md](status.md), [tickets/board.md](tickets/board.md), and [agent.md](agent.md) for the system and security designs, machine checkout concept, Agile roadmap and tickets, current state, and contributor/agent rules.

## Quality pipeline

The pull-request and main-branch pipeline runs:

1. Biome formatting and lint checks.
2. TypeScript typechecks for all workspace packages.
3. Production builds for API and web.
4. Production dependency advisory scan (`pnpm audit`).
5. Container builds for API and web.
6. CodeQL security analysis and dependency review on pull requests.

No deployment environment or credentials are assumed. Add a deploy job only after selecting a host and defining protected environment secrets.

## Current prototype limits

- One demo merchant; no authentication or multi-tenant authorization yet.
- Native XRP on XRPL Testnet only; no issued tokens, fiat conversion, refunds, or partial payments.
- Customer QR opens Relay Pay's checkout page. The customer then pays from their own wallet with the shown address and tag.
- Payment reconciliation scans the recent account transaction window; this is a hackathon MVP, not a high-volume payment processor.
- Invoices use UUID links but there is no login gate. Do not expose sensitive customer information.
- Auth0 Organizations/OIDC is the selected identity model; merchant invoice routes and machine identity resolution are tenant-scoped. Production startup remains intentionally disabled until the remaining production-readiness tickets are complete.

## API quick reference

| Method | Path                                    | Purpose                                             |
| ------ | --------------------------------------- | --------------------------------------------------- |
| `GET`  | `/healthz`                              | Process health                                      |
| `GET`  | `/readyz`                               | Database and ledger readiness                       |
| `GET`  | `/v1/config`                            | Public network mode                                 |
| `GET`  | `/v1/invoices`                          | Recent checkout requests                            |
| `POST` | `/v1/invoices`                          | Create checkout (`amountXrp`, optional `reference`) |
| `GET`  | `/v1/invoices/{invoiceId}`              | Read status                                         |
| `POST` | `/v1/invoices/{invoiceId}/demo-payment` | Local-only payment simulation                       |
