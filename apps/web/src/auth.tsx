import { type Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js";
import { LogIn, LogOut } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setAccessTokenProvider } from "./api.js";

const domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim();
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim();
const audience = import.meta.env.VITE_AUTH0_AUDIENCE?.trim();
const defaultOrganization = import.meta.env.VITE_AUTH0_ORGANIZATION?.trim();
const configured = Boolean(domain && clientId && audience);
const partiallyConfigured = Boolean(domain || clientId || audience) && !configured;
const scopes = "openid profile email invoices:read invoices:write";

interface AuthContextValue {
  client: Auth0Client | null;
  ready: boolean;
  authenticated: boolean;
  email: string;
  organizationId: string;
  error: string;
  login: (organizationId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Auth0Client | null>(null);
  const [ready, setReady] = useState(!configured);
  const [authenticated, setAuthenticated] = useState(!configured);
  const [email, setEmail] = useState("Local demo");
  const [organizationId, setOrganizationId] = useState("local-development");
  const [error, setError] = useState(
    partiallyConfigured
      ? "Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE together."
      : "",
  );

  useEffect(() => {
    if (!configured || !domain || !clientId || !audience) return;
    let active = true;
    void (async () => {
      try {
        const authClient = await createAuth0Client({
          domain,
          clientId,
          authorizationParams: {
            redirect_uri: window.location.origin,
            audience,
            scope: scopes,
          },
          cacheLocation: "memory",
          useRefreshTokens: false,
        });
        if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
          await authClient.handleRedirectCallback();
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        const isAuthenticated = await authClient.isAuthenticated();
        const user = isAuthenticated ? await authClient.getUser() : undefined;
        if (!active) return;
        setClient(authClient);
        setAuthenticated(isAuthenticated);
        setEmail(user?.email ?? "Merchant account");
        setOrganizationId(defaultOrganization ?? "");
        setAccessTokenProvider(async () => {
          try {
            const token = await authClient.getTokenSilently({
              authorizationParams: { audience, scope: scopes },
            });
            if (!token) throw new Error("Your sign-in expired. Please sign in again.");
            return token;
          } catch (cause) {
            window.dispatchEvent(new Event("mmp:unauthorized"));
            throw cause;
          }
        });
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not initialize merchant sign-in.",
          );
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      setAccessTokenProvider(null);
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setAuthenticated(false);
    window.addEventListener("mmp:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("mmp:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(
    async (orgId: string) => {
      if (!client) return;
      const normalized = orgId.trim();
      if (!normalized) throw new Error("Enter your Auth0 organization ID.");
      await client.loginWithRedirect({
        authorizationParams: { organization: normalized, audience, scope: scopes },
      });
    },
    [client],
  );

  const logout = useCallback(() => {
    if (client) void client.logout({ logoutParams: { returnTo: window.location.origin } });
  }, [client]);

  return (
    <AuthContext.Provider
      value={{ client, ready, authenticated, email, organizationId, error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

export function MerchantAuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [organization, setOrganization] = useState(auth.organizationId);
  const [loginError, setLoginError] = useState("");
  useEffect(() => setOrganization(auth.organizationId), [auth.organizationId]);
  if (!auth.ready) return <div className="auth-screen">Preparing secure sign-in…</div>;
  if (auth.error)
    return (
      <div className="auth-screen" role="alert">
        {auth.error}
      </div>
    );
  if (!configured) return <>{children}</>;
  if (auth.authenticated) return <>{children}</>;
  return (
    <main className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          setLoginError("");
          void auth
            .login(organization)
            .catch((cause: unknown) =>
              setLoginError(cause instanceof Error ? cause.message : "Sign-in failed."),
            );
        }}
      >
        <div className="brand-mark">
          <LogIn size={19} />
        </div>
        <h1>Sign in to Relay Pay</h1>
        <p>Use your merchant account to open the dashboard.</p>
        <label htmlFor="organization-id">Auth0 organization ID</label>
        <input
          id="organization-id"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          required
          autoComplete="organization"
        />
        {loginError && <p role="alert">{loginError}</p>}
        <button className="button button-dark" type="submit">
          Continue securely <LogIn size={16} />
        </button>
      </form>
    </main>
  );
}

export function LogoutButton() {
  const auth = useAuth();
  if (!configured || !auth.authenticated) return null;
  return (
    <button
      type="button"
      className="auth-logout"
      onClick={auth.logout}
      title={`Signed in as ${auth.email}`}
    >
      <LogOut size={15} /> Sign out
    </button>
  );
}
