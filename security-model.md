# Identity, tenant, and API security model

## Identity provider and tenant model

Relay Pay will use Auth0 Organizations through OpenID Connect. Each merchant is represented by one Auth0 Organization, and a verified Auth0 `org_id` claim is the tenant ID. Users can belong to one or more merchant organizations; the selected organization must be reflected in the signed access token. API authorization always derives the tenant from the verified token, never from a request body, query string, or unverified header.

The browser dashboard is a public OAuth client using Authorization Code with PKCE. Its access token stays in memory and is sent as `Authorization: Bearer …` over HTTPS. No client secret belongs in the browser bundle. The API validates the JWT signature against the issuer's published JWKS and verifies issuer, API audience, expiry, subject, organization claim, and required scopes. Auth0 issues an `org_id` claim when the user authenticates in the context of an organization; login must select or establish that organization context.

The API is designed provider-aware but protocol-standard: issuer, audience, and tenant claim name are configuration. The first deployment target is Auth0 because Organizations provide the tenant membership claim needed by the MVP; moving provider requires an explicit claim mapping and token review. For machine-to-machine grants, do not assume the user-oriented `org_id` is automatically present: map the registered device client to its organization on the server or add and validate an explicit provider-issued organization/device claim.

## Route access

| Resource                                                       | Access                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /healthz`, `GET /readyz`                                  | Public operational health only; no secrets or tenant data.                                                                                                            |
| `GET /v1/config`                                               | Public checkout-safe network label and public receiver address only.                                                                                                  |
| `GET /v1/checkouts/:invoiceId`                                 | Public checkout capability; UUID must be unguessable and response must omit internal merchant data.                                                                   |
| `GET /v1/invoices/:invoiceId`                                  | Authenticated and scoped to the verified organization.                                                                                                                |
| `POST /v1/device/invoices`                                     | Requires `devices:connect`; tenant/device identity comes from the verified subject's active server-side registration.                                                 |
| `GET /v1/device/cycles/:operationId`                           | Requires `devices:connect`; cycle lookup is scoped to the registered device, with enforced polling bounds.                                                            |
| `POST /v1/device/cycles/:operationId/start`                    | Requires `devices:connect`; disabled by default and gated on a validated XRPL Testnet payment. Production cannot enable it before MMP-021 budget controls exist.      |
| `POST /v1/device/cycles/:operationId/ack`                      | Requires `devices:connect`; only allows valid state transitions and treats repeated acknowledgements idempotently.                                                    |
| Merchant invoice list/create, receiver settings, audit history | Authenticated; scope every query and mutation to the verified organization.                                                                                           |
| Demo payment mutation                                          | Local demo only, explicitly enabled, rate-limited, and restricted to a valid open invoice capability. Must be disabled in production.                                 |
| `GET /v1/device/context` and machine endpoints                 | Require the API audience and `devices:connect`; verify issuer/signature and map the token subject through the server-side device registry. Never use SPA credentials. |

Merchant admins manage registrations with `devices:admin`. The registry enforces one merchant per machine token subject. Disabling a registration is the revocation mechanism and is checked from the database for each machine request. Credential rotation registers a new subject before disabling the prior one. Local development may use `x-local-device-subject` only when OIDC is off and `NODE_ENV` is not production; production ignores this development path.

## Payment receiver limitation

The current prototype has one configured XRPL receiver shared by all invoices. Merchant tenancy must be carried in the invoice row and every merchant query, but this is not merchant settlement isolation: all accepted Testnet payments arrive at the same configured receiver and are distinguished by destination tag. Do not claim this is a production multi-merchant processor. Per-merchant receiver registration, reconciliation, and withdrawal policy require a separate reviewed design before public exposure or real funds.

## Audit and data handling

Audit events record event ID, event type, timestamp, request/correlation ID, authenticated subject or explicit system actor, organization ID, resource type/ID, and safe metadata. Invoice creation, expiry, payment confirmation, device registration, and device disablement are recorded in the same database transaction as the state change. Never record bearer tokens, client secrets, private keys, recovery phrases, or full authorization headers. Do not store unnecessary customer identity data in invoices.

## Deployment controls

- Require TLS at the edge; proxy headers are not trusted unless `TRUST_PROXY` is set to the known proxy address/CIDR or hop count.
- Keep Auth0 secrets and signing/provider credentials in the host's secret manager. The SPA client ID, issuer URL, and API audience are identifiers, not secrets.
- Production startup must reject missing OIDC settings and reject demo-payment enablement.
- Keep rate limits on authentication-protected mutation routes and public invoice reads.
- CORS is restricted to `WEB_ORIGIN` with credentials disabled. Authorization and cookie headers are redacted from request logs. Before public launch, review CORS origins, token handling, issuer/audience settings, log redaction, database backups, and tenant-isolation behavior.

## Provider documentation

- [Auth0 Organizations and tokens](https://auth0.com/docs/manage-users/organizations/using-tokens)
- [Auth0 Authorization Code Flow with PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce)
- [Auth0 access-token validation](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)
- [Auth0 JWKS location](https://auth0.com/docs/secure/tokens/json-web-tokens/locate-json-web-key-sets)
