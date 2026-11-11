# MMP-018 — Add dashboard OIDC login

- **Status:** Done — Auth0 PKCE dashboard login implemented; configuration remains environment-specific.
- **Priority / size:** P1 / M
- **Outcome:** Merchant dashboard authenticates with Auth0 Organizations without exposing a client secret.

## Dependencies

MMP-016 and MMP-017.

## Acceptance criteria

- [x] Use Authorization Code with PKCE and configured organization selection.
- [x] Keep tokens in memory; attach access tokens only to API requests.
- [x] Add login, logout, session-expiry, and unauthorized states.
- [x] Preserve public customer checkout access without requiring merchant login.
- [x] Never include a confidential client secret in `VITE_*` variables or generated assets.

## Implementation notes

- Uses the Auth0 SPA SDK directly with in-memory token caching; no client secret is part of the browser configuration.
- Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` together; optional `VITE_AUTH0_ORGANIZATION` preselects the organization. Without those variables, local demo sign-in remains available.
- Dashboard requests under `/v1/invoices` receive access tokens; public checkout and config requests do not. A 401 returns the dashboard to sign-in.
