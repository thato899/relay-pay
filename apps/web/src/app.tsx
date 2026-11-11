import type { InvoiceDto, PublicCheckoutDto, PublicConfigDto } from "@mmp/contracts";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  WalletCards,
  WifiOff,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { LogoutButton, MerchantAuthGate } from "./auth.js";

const routeInvoiceId = window.location.pathname.startsWith("/checkout/")
  ? (window.location.pathname.split("/").at(-1) ?? null)
  : null;

function formatAmount(amount: string): string {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 6 }).format(Number(amount));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function clipId(value: string | null): string {
  if (!value) return "—";
  return value.length > 15 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}

function getStatusLabel(status: InvoiceDto["status"]): string {
  return status === "paid" ? "Paid" : status === "expired" ? "Expired" : "Awaiting payment";
}

function StatusBadge({ status }: { status: InvoiceDto["status"] }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {getStatusLabel(status)}
    </span>
  );
}

export function App() {
  return routeInvoiceId ? (
    <CustomerCheckout invoiceId={routeInvoiceId} />
  ) : (
    <MerchantAuthGate>
      <MerchantDashboard />
    </MerchantAuthGate>
  );
}

function MerchantDashboard() {
  const [config, setConfig] = useState<PublicConfigDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [selected, setSelected] = useState<InvoiceDto | null>(null);
  const [amount, setAmount] = useState("12.50");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextConfig, nextInvoices] = await Promise.all([api.config(), api.listInvoices()]);
      setConfig(nextConfig);
      setInvoices(nextInvoices);
      setSelected((current) => {
        if (!current) return nextInvoices[0] ?? null;
        return nextInvoices.find((item) => item.id === current.id) ?? current;
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the payment API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selected || selected.status !== "pending") return;
    const timer = window.setInterval(async () => {
      try {
        const updated = await api.getInvoice(selected.id);
        setSelected(updated);
        setInvoices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        // The next dashboard refresh will surface API or network errors.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [selected]);

  const summary = useMemo(() => {
    const paid = invoices.filter((invoice) => invoice.status === "paid");
    const volume = paid.reduce((total, invoice) => total + Number(invoice.amountXrp), 0);
    return {
      paidCount: paid.length,
      volume: volume.toFixed(2),
      awaiting: invoices.filter((invoice) => invoice.status === "pending").length,
    };
  }, [invoices]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const invoice = await api.createInvoice({
        amountXrp: amount,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setSelected(invoice);
      setInvoices((current) => [invoice, ...current.filter((item) => item.id !== invoice.id)]);
      setNotice("Payment request ready to share.");
      setReference("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create payment request.");
    } finally {
      setBusy(false);
    }
  }

  async function simulatePayment() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const paid = await api.simulatePayment(selected.id);
      setSelected(paid);
      setInvoices((current) => current.map((item) => (item.id === paid.id ? paid : item)));
      setNotice("Demo payment confirmed on the local demo ledger.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not simulate payment.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="/" aria-label="Relay Pay home">
          <span className="brand-mark">
            <Activity size={19} strokeWidth={2.5} />
          </span>
          <span className="brand-name">
            relay<span>pay</span>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <button className="merchant-selector" type="button">
          <span className="merchant-avatar">M</span>
          <span className="merchant-selector-copy">
            <strong>Mountain Market</strong>
            <small>Merchant account</small>
          </span>
          <ChevronDown size={15} />
        </button>

        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview">
            <Activity size={17} />
            Overview
          </a>
          <a className="nav-item" href="#payments">
            <ArrowDownLeft size={17} />
            Payments<span className="nav-count">{invoices.length}</span>
          </a>
          <a className="nav-item" href="#checkout">
            <QrCode size={17} />
            Checkout links
          </a>
          <a className="nav-item" href="#machine-simulator">
            <Smartphone size={17} />
            Washer simulator
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="network-panel">
            <span
              className={`network-pulse ${config?.mode === "xrpl-testnet" ? "online" : "demo"}`}
            />
            <div>
              <span>{config?.network ?? "Connecting…"}</span>
              <small>{config?.mode === "demo" ? "Simulation only" : "Validated payments"}</small>
            </div>
          </div>
          <a
            className="docs-link"
            href="http://localhost:4000/documentation"
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={16} /> API reference <ExternalLink size={13} />
          </a>
          <div className="profile-row">
            <span className="profile-avatar">MM</span>
            <span>
              <strong>Mountain Market</strong>
              <small>Owner account</small>
            </span>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-divider">/</span>
            <strong>Overview</strong>
          </div>
          <div className="topbar-actions">
            <LogoutButton />
            <span className="live-indicator">
              <span />
              {config?.network ?? "Connecting"}
            </span>
            <button
              className="button button-dark button-small"
              type="button"
              onClick={() => document.getElementById("amount-xrp")?.focus()}
            >
              <Plus size={16} />
              New checkout
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                MERCHANT CONSOLE <span className="mono-eyebrow">/ 01</span>
              </div>
              <h1>
                Good morning, <span>Market.</span>
              </h1>
              <p>Track your money in motion and create a checkout in seconds.</p>
            </div>
            <button
              className="button button-dark"
              type="button"
              onClick={() => document.getElementById("amount-xrp")?.focus()}
            >
              <Plus size={17} />
              Create payment
            </button>
          </div>

          {error && (
            <div className="notice notice-error" role="alert">
              <X size={17} />
              {error}
              <button type="button" aria-label="Dismiss" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice notice-success" role="status">
              <CheckCircle2 size={17} />
              {notice}
              <button type="button" aria-label="Dismiss" onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}

          {config?.mode === "demo" && (
            <div className="demo-banner">
              <ShieldCheck size={17} />
              <span>
                <strong>Demo mode is on.</strong> Payments are simulated locally and do not move
                real assets.
              </span>
              <span className="demo-banner-tail">SWITCH TO TESTNET IN .ENV</span>
            </div>
          )}

          {config?.mode === "xrpl-testnet" && (
            <div className="shared-ledger-banner" role="note">
              <ShieldCheck size={16} />
              <span>
                <strong>Shared Testnet receiver.</strong> Merchant invoices use destination tags to
                separate orders. This prototype does not provide merchant-specific settlement.
              </span>
            </div>
          )}

          <section className="stats-grid" aria-label="Payment summary">
            <article className="stat-card stat-card-highlight">
              <div className="stat-top">
                <span>
                  SETTLED VOLUME <span className="period-chip">ALL TIME</span>
                </span>
                <span className="stat-icon mint">
                  <CircleDollarSign size={19} />
                </span>
              </div>
              <div className="stat-value">
                {summary.volume}
                <span className="stat-unit">XRP</span>
              </div>
              <div className="stat-bottom">
                <span className="trend-pill">
                  <ArrowUpRight size={13} /> Testnet asset
                </span>
                <span className="stat-note">No fiat conversion applied</span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>COMPLETED CHECKOUTS</span>
                <span className="stat-icon blue">
                  <BadgeCheck size={18} />
                </span>
              </div>
              <div className="stat-value">{summary.paidCount.toString().padStart(2, "0")}</div>
              <div className="stat-bottom">
                <span className="stat-note">Validated and reconciled</span>
                <span className="stat-sparkline">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>AWAITING PAYMENT</span>
                <span className="stat-icon amber">
                  <Clock3 size={18} />
                </span>
              </div>
              <div className="stat-value">{summary.awaiting.toString().padStart(2, "0")}</div>
              <div className="stat-bottom">
                <span className="stat-note">
                  {summary.awaiting ? "Customer checkout is open" : "You’re all caught up"}
                </span>
                <span className="stat-sparkline calm">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </article>
          </section>

          <section className="workbench-grid">
            <article className="panel create-panel" id="checkout">
              <div className="panel-heading">
                <div>
                  <span className="section-number">01</span>
                  <h2>Create a checkout</h2>
                </div>
                <span className="panel-icon">
                  <ScanLine size={18} />
                </span>
              </div>
              <p className="panel-description">
                Set an amount, add an optional reference, and share a ready-to-pay QR.
              </p>

              <form className="checkout-form" onSubmit={createInvoice}>
                <label htmlFor="amount-xrp">Amount</label>
                <div className="amount-input-wrap">
                  <span className="amount-currency">XRP</span>
                  <input
                    id="amount-xrp"
                    name="amountXrp"
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,6})?"
                    minLength={1}
                    maxLength={18}
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-describedby="amount-help"
                  />
                  <span className="amount-suffix">XRP</span>
                </div>
                <div className="input-help" id="amount-help">
                  Up to 6 decimal places · Exact amount checked on ledger
                </div>

                <label htmlFor="reference" className="reference-label">
                  Order or table reference <span>OPTIONAL</span>
                </label>
                <div className="reference-input-wrap">
                  <FileText size={16} />
                  <input
                    id="reference"
                    name="reference"
                    maxLength={80}
                    placeholder="e.g. Table 04 · Order #183"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>

                <div className="expiry-row">
                  <span>
                    <Clock3 size={15} />
                    Checkout expires in
                  </span>
                  <strong>
                    30 min <ChevronDown size={13} />
                  </strong>
                </div>
                <button className="button button-dark create-button" type="submit" disabled={busy}>
                  {busy ? <span className="spinner" /> : <QrCode size={17} />}
                  {busy ? "Preparing checkout…" : "Generate payment QR"}
                  <ArrowUpRight size={16} />
                </button>
                <div className="form-trust">
                  <ShieldCheck size={14} />
                  Customer signs with their own wallet. Keys stay off the server.
                </div>
              </form>
            </article>

            <article className="panel request-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-number">02</span>
                  <h2>Payment request</h2>
                </div>
                {selected ? (
                  <StatusBadge status={selected.status} />
                ) : (
                  <span className="empty-request-label">LIVE PREVIEW</span>
                )}
              </div>
              {selected ? (
                <div className="request-body">
                  <div className="request-meta">
                    <span>REQUEST ID</span>
                    <strong className="mono">{clipId(selected.id)}</strong>
                    <span className="request-created">
                      Created {formatDate(selected.createdAt)}
                    </span>
                  </div>
                  <div className="request-main">
                    <div className="request-amount">
                      <small>AMOUNT DUE</small>
                      <strong>
                        {formatAmount(selected.amountXrp)} <em>XRP</em>
                      </strong>
                      {selected.reference && (
                        <span className="order-ref">{selected.reference}</span>
                      )}
                    </div>
                    <div className="qr-frame">
                      <QRCodeSVG
                        value={selected.checkoutUrl}
                        size={146}
                        bgColor="#ffffff"
                        fgColor="#152427"
                        level="M"
                        includeMargin={false}
                      />
                      <span className="qr-center">
                        <span>R</span>
                      </span>
                    </div>
                  </div>
                  <div className="qr-caption">
                    <span className="qr-caption-icon">
                      <QrCode size={14} />
                    </span>
                    <span>
                      Scan to open this checkout<small>QR opens the customer payment page</small>
                    </span>
                    <a
                      href={selected.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open customer checkout"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                  <div className="payment-details">
                    <div>
                      <span>DESTINATION</span>
                      <strong className="mono address-value">
                        {selected.destinationAddress || "Add merchant XRPL address to .env"}
                      </strong>
                      <button
                        type="button"
                        aria-label="Copy destination"
                        disabled={!selected.destinationAddress}
                        onClick={() =>
                          void copy(selected.destinationAddress, "Destination address")
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div>
                      <span>DESTINATION TAG</span>
                      <strong className="mono">{selected.destinationTag}</strong>
                      <button
                        type="button"
                        aria-label="Copy destination tag"
                        onClick={() =>
                          void copy(String(selected.destinationTag), "Destination tag")
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div>
                      <span>EXPIRES</span>
                      <strong>{formatDate(selected.expiresAt)}</strong>
                      <span className="no-action" />
                    </div>
                  </div>
                  {selected.status === "paid" ? (
                    <div className="paid-confirmation">
                      <span>
                        <Check size={16} />
                      </span>
                      <div>
                        <strong>Payment confirmed</strong>
                        <small className="mono">{clipId(selected.transactionHash)}</small>
                      </div>
                      <a
                        href={
                          selected.network === "xrpl-testnet" && selected.transactionHash
                            ? `https://testnet.xrpl.org/transactions/${selected.transactionHash}`
                            : undefined
                        }
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </div>
                  ) : selected.status === "expired" ? (
                    <div className="expired-confirmation">
                      <Clock3 size={16} />
                      <span>
                        This request has expired. Create a new checkout to accept payment.
                      </span>
                    </div>
                  ) : config?.mode === "demo" ? (
                    <button
                      className="demo-pay-button"
                      type="button"
                      onClick={() => void simulatePayment()}
                      disabled={busy}
                    >
                      <CheckCircle2 size={16} />
                      Simulate customer payment <span>DEMO</span>
                    </button>
                  ) : (
                    <div className="testnet-instructions">
                      <WalletCards size={16} />
                      <span>
                        Send the exact XRP amount from a Testnet wallet using the destination tag
                        above. The request marks paid only after a validated ledger match.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-request">
                  <div className="empty-qr">
                    <QrCode size={36} strokeWidth={1.35} />
                  </div>
                  <strong>Your next payment starts here</strong>
                  <span>
                    Generate a checkout to preview the customer QR and ledger instructions.
                  </span>
                  <div className="empty-checklist">
                    <span>
                      <i>
                        <Check size={12} />
                      </i>
                      Exact amount validation
                    </span>
                    <span>
                      <i>
                        <Check size={12} />
                      </i>
                      One-time destination tag
                    </span>
                    <span>
                      <i>
                        <Check size={12} />
                      </i>
                      Automatic payment matching
                    </span>
                  </div>
                </div>
              )}
            </article>
          </section>

          <section className="panel payments-panel" id="payments">
            <div className="table-heading">
              <div>
                <span className="section-number">03</span>
                <h2>Recent activity</h2>
                <span className="table-count">{invoices.length}</span>
              </div>
              <button type="button" className="text-button" onClick={() => void refresh()}>
                Refresh <Activity size={14} />
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CHECKOUT</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th>DESTINATION TAG</th>
                    <th>CREATED</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && !loading ? (
                    <tr>
                      <td className="table-empty" colSpan={6}>
                        No checkouts yet. Create one above to start receiving payments.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className={selected?.id === invoice.id ? "selected-row" : ""}
                        onClick={() => setSelected(invoice)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setSelected(invoice);
                        }}
                      >
                        <td>
                          <span className="row-icon">
                            <QrCode size={15} />
                          </span>
                          <span>
                            <strong>{invoice.reference || "Counter checkout"}</strong>
                            <small className="mono">{clipId(invoice.id)}</small>
                          </span>
                        </td>
                        <td>
                          <strong>{formatAmount(invoice.amountXrp)} XRP</strong>
                          <small>
                            {invoice.network === "demo" ? "Demo ledger" : "XRPL Testnet"}
                          </small>
                        </td>
                        <td>
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="mono tag-cell">{invoice.destinationTag}</td>
                        <td>{formatDate(invoice.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="row-open"
                            aria-label={`Open ${invoice.reference || "checkout"}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(invoice);
                            }}
                          >
                            <ArrowUpRight size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>
                <span className="table-foot-dot" />
                Showing the latest {Math.min(invoices.length, 25)} checkouts
              </span>
              <span>Auto-refreshes every 8 seconds</span>
            </div>
          </section>

          <MachineSimulator config={config} />

          <footer className="page-footer">
            <span>
              RELAY PAY <span>·</span> MERCHANT & MACHINE PAYMENTS PROTOTYPE
            </span>
            <span>
              BUILT ON XRPL TESTNET <span className="footer-xrp">◉</span>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

const WASH_CYCLES = [
  { id: "quick", name: "Quick wash", duration: "25 min", amountXrp: "0.800000" },
  { id: "standard", name: "Standard wash", duration: "40 min", amountXrp: "1.250000" },
  { id: "heavy", name: "Heavy wash", duration: "55 min", amountXrp: "1.750000" },
] as const;

function MachineSimulator({ config }: { config: PublicConfigDto | null }) {
  const [machineId, setMachineId] = useState("washer-01");
  const [cycleId, setCycleId] = useState<(typeof WASH_CYCLES)[number]["id"]>("standard");
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState("");

  const cycle = WASH_CYCLES.find((item) => item.id === cycleId) ?? WASH_CYCLES[1];
  const cycleStartEligible = invoice?.status === "paid" && invoice.network === "xrpl-testnet";

  useEffect(() => {
    const updateNetwork = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!invoice || invoice.status !== "pending") return;
    try {
      setInvoice(await api.getInvoice(invoice.id));
      setOffline(false);
      setError("");
    } catch (cause) {
      setOffline(!navigator.onLine);
      setError(cause instanceof Error ? cause.message : "Could not refresh cycle payment status.");
    }
  }, [invoice]);

  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [invoice, refresh]);

  async function prepareCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invoice) return;
    setBusy(true);
    setError("");
    try {
      const operationId = crypto.randomUUID();
      const nextInvoice = await api.createInvoice({
        amountXrp: cycle.amountXrp,
        reference: `${machineId} ${cycle.name} ${operationId.slice(0, 8)}`,
      });
      setInvoice(nextInvoice);
      setOffline(false);
    } catch (cause) {
      setOffline(!navigator.onLine);
      setError(cause instanceof Error ? cause.message : "Could not prepare this washer checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function simulatePayment() {
    if (!invoice || invoice.status !== "pending") return;
    setBusy(true);
    setError("");
    try {
      setInvoice(await api.simulatePayment(invoice.id));
      setOffline(false);
    } catch (cause) {
      setOffline(!navigator.onLine);
      setError(cause instanceof Error ? cause.message : "Could not simulate this payment.");
    } finally {
      setBusy(false);
    }
  }

  function resetCycle() {
    setInvoice(null);
    setError("");
  }

  return (
    <section className="panel machine-simulator" id="machine-simulator">
      <div className="table-heading machine-heading">
        <div>
          <span className="section-number">04</span>
          <h2>Washer checkout simulator</h2>
        </div>
        <span className="simulator-label">SIMULATOR · NO HARDWARE CONTROL</span>
      </div>
      <div className="machine-simulator-grid">
        <form className="machine-controls" onSubmit={(event) => void prepareCycle(event)}>
          <p>
            Choose a machine and wash cycle. The checkout uses the same invoice and payment-status
            flow.
          </p>
          <label htmlFor="machine-select">Machine</label>
          <select
            id="machine-select"
            value={machineId}
            onChange={(event) => setMachineId(event.target.value)}
            disabled={Boolean(invoice)}
          >
            <option value="washer-01">Washer 01 · Front load</option>
            <option value="washer-02">Washer 02 · Large drum</option>
          </select>
          <label htmlFor="cycle-select">Wash cycle</label>
          <select
            id="cycle-select"
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value as typeof cycleId)}
            disabled={Boolean(invoice)}
          >
            {WASH_CYCLES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.duration} · {option.amountXrp} XRP
              </option>
            ))}
          </select>
          <div className="machine-price">
            <span>EXACT PRICE</span>
            <strong>
              {cycle.amountXrp} <small>XRP</small>
            </strong>
            <span>
              {cycle.name} · {cycle.duration}
            </span>
          </div>
          {!invoice ? (
            <button
              className="button button-dark create-button"
              type="submit"
              disabled={busy || !config}
            >
              {busy ? <span className="spinner" /> : <QrCode size={17} />}
              {busy ? "Preparing checkout…" : "Prepare washer checkout"}
            </button>
          ) : (
            <button className="text-button machine-reset" type="button" onClick={resetCycle}>
              <RotateCcw size={14} /> Start a new simulated purchase
            </button>
          )}
          <div className="machine-safety-note">
            <ShieldCheck size={15} /> No physical washer is connected. Cycle start remains disabled.
          </div>
        </form>

        <div className="machine-checkout">
          {offline && (
            <div className="machine-connectivity offline">
              <WifiOff size={15} /> Offline · payment status cannot be refreshed. The existing
              invoice is kept.
            </div>
          )}
          {!offline && (
            <div className="machine-connectivity">
              <span className="table-foot-dot" /> Connected · retrying the same checkout is safe.
            </div>
          )}
          {error && (
            <div className="notice notice-error machine-error" role="alert">
              {error}
            </div>
          )}
          {invoice ? (
            <>
              <div className="machine-checkout-top">
                <div>
                  <span className="machine-kicker">
                    {machineId.toUpperCase()} · {cycle.name.toUpperCase()}
                  </span>
                  <strong>{invoice.amountXrp} XRP</strong>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="machine-checkout-body">
                {invoice.status === "pending" ? (
                  <QRCodeSVG
                    value={invoice.checkoutUrl}
                    size={152}
                    bgColor="#fff"
                    fgColor="#152427"
                    level="M"
                  />
                ) : invoice.status === "paid" ? (
                  <span
                    className={`machine-state-icon ${cycleStartEligible ? "ready" : "simulated"}`}
                  >
                    {cycleStartEligible ? <Play size={29} /> : <CheckCircle2 size={29} />}
                  </span>
                ) : (
                  <span className="machine-state-icon expired">
                    <Clock3 size={29} />
                  </span>
                )}
                <div className="machine-payment-copy">
                  <strong>
                    {invoice.status === "paid"
                      ? cycleStartEligible
                        ? "Payment validated"
                        : "Demo payment simulated"
                      : invoice.status === "expired"
                        ? "Checkout expired"
                        : "Scan to pay"}
                  </strong>
                  <span>
                    {invoice.status === "paid"
                      ? cycleStartEligible
                        ? "A validated Testnet payment makes this cycle eligible. Hardware remains disabled until operator budgets are enforced."
                        : "This is a local simulation only. It does not validate an onchain payment and cannot start a cycle."
                      : invoice.status === "expired"
                        ? "This invoice expired. Create a new purchase to try again."
                        : "Scan the QR to open the hosted checkout. The simulator keeps this invoice for retries."}
                  </span>
                </div>
              </div>
              <div className="machine-state-row">
                <span>SIMULATED CYCLE STATE</span>
                <strong className={cycleStartEligible ? "state-ready" : ""}>
                  {cycleStartEligible
                    ? "Ready · hardware start gated"
                    : invoice.status === "paid"
                      ? "Paid in demo · no start"
                      : invoice.status === "expired"
                        ? "Expired · stopped"
                        : "Awaiting payment · stopped"}
                </strong>
              </div>
              <div className="machine-actions">
                <a
                  className="text-button"
                  href={invoice.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open hosted checkout <ExternalLink size={14} />
                </a>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void refresh()}
                  disabled={busy}
                >
                  <RefreshCw size={14} /> Retry status
                </button>
              </div>
              {config?.mode === "demo" && invoice.status === "pending" && (
                <button
                  className="demo-pay-button machine-demo-pay"
                  type="button"
                  onClick={() => void simulatePayment()}
                  disabled={busy}
                >
                  <CheckCircle2 size={16} /> Simulate payment <span>DEMO ONLY</span>
                </button>
              )}
              <small className="machine-invoice-id">
                Invoice {clipId(invoice.id)} · retries reuse this invoice
              </small>
            </>
          ) : (
            <div className="machine-empty">
              <span className="empty-qr">
                <Smartphone size={34} />
              </span>
              <strong>Washer is waiting</strong>
              <span>Prepare a checkout to display the customer QR and payment state.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CustomerCheckout({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<PublicCheckoutDto | null>(null);
  const [config, setConfig] = useState<PublicConfigDto | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextInvoice, nextConfig] = await Promise.all([
        api.getCheckout(invoiceId),
        api.config(),
      ]);
      setInvoice(nextInvoice);
      setConfig(nextConfig);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This checkout could not be opened.");
    }
  }, [invoiceId]);

  async function copyPaymentDetails() {
    if (!invoice) return;
    const details = [
      `Amount: ${invoice.amountXrp} XRP`,
      `Network: ${config?.network ?? "XRPL Testnet"}`,
      `Address: ${invoice.destinationAddress}`,
      `Destination tag: ${invoice.destinationTag}`,
      ...(invoice.reference ? [`Reference: ${invoice.reference}`] : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(details);
      setNotice("Payment details copied. Confirm the network and tag in your wallet.");
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Please copy the payment fields manually.");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function simulatePayment() {
    setBusy(true);
    try {
      setInvoice(await api.simulateCheckoutPayment(invoiceId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm demo payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="customer-page">
      <div className="customer-topline">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">
            <Activity size={19} strokeWidth={2.5} />
          </span>
          <span className="brand-name">
            relay<span>pay</span>
          </span>
        </a>
        <span className="secure-label">
          <ShieldCheck size={15} />
          SECURE CHECKOUT
        </span>
      </div>
      <section className="customer-card">
        <div className="customer-card-head">
          <span className="customer-merchant-mark">M</span>
          <div>
            <small>PAYING</small>
            <strong>Mountain Market</strong>
          </div>
          <StatusBadge status={invoice?.status ?? "pending"} />
        </div>
        {error ? (
          <div className="customer-error" role="alert">
            {error}
          </div>
        ) : invoice ? (
          <>
            <div className="customer-amount-label">AMOUNT DUE</div>
            <div className="customer-amount">
              {formatAmount(invoice.amountXrp)} <span>XRP</span>
            </div>
            {invoice.reference && <div className="customer-reference">{invoice.reference}</div>}
            <div className="customer-divider" />
            {invoice.status === "paid" ? (
              <div className="customer-paid">
                <span>
                  <Check size={20} />
                </span>
                <strong>Payment confirmed</strong>
                <small>Your payment has been validated on the ledger.</small>
              </div>
            ) : invoice.status === "expired" ? (
              <div className="customer-expired">
                <Clock3 size={20} />
                <strong>This checkout has expired</strong>
                <small>Please ask the merchant for a new payment request.</small>
              </div>
            ) : (
              <>
                <div className="customer-qr">
                  <QRCodeSVG
                    value={invoice.checkoutUrl}
                    size={168}
                    bgColor="#ffffff"
                    fgColor="#152427"
                    level="M"
                  />
                </div>
                <div className="customer-instructions">
                  <strong>Pay with your XRPL wallet</strong>
                  <span>
                    Send the exact amount to the merchant address with this destination tag. The
                    merchant will see confirmation after the payment is validated. A missing or
                    incorrect tag can prevent automatic matching.
                  </span>
                </div>
                {notice && (
                  <div className="customer-copy-notice" role="status">
                    {notice}
                  </div>
                )}
                <button
                  type="button"
                  className="customer-copy-button"
                  onClick={() => void copyPaymentDetails()}
                >
                  <Copy size={15} />
                  Copy payment details
                </button>
                <div className="customer-ledger-info">
                  <div>
                    <span>NETWORK</span>
                    <strong>{config?.network ?? "XRPL Testnet"}</strong>
                  </div>
                  <div>
                    <span>DESTINATION TAG</span>
                    <strong className="mono">{invoice.destinationTag}</strong>
                  </div>
                </div>
                {invoice.destinationAddress && (
                  <div className="customer-address">
                    <span>MERCHANT ADDRESS</span>
                    <code>{invoice.destinationAddress}</code>
                  </div>
                )}
                {config?.mode === "demo" && (
                  <button
                    type="button"
                    className="button button-dark customer-pay-button"
                    onClick={() => void simulatePayment()}
                    disabled={busy}
                  >
                    {busy ? "Confirming…" : "Simulate payment"}
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </>
            )}
            <div className="customer-expiry">
              <Clock3 size={13} />
              Checkout expires {formatDate(invoice.expiresAt)}
            </div>
          </>
        ) : (
          <div className="customer-loading">
            <span className="spinner dark-spinner" />
            Loading checkout…
          </div>
        )}
      </section>
      <div className="customer-privacy">
        <ShieldCheck size={14} />
        <span>
          Your wallet signs payments. Relay Pay never asks for your recovery phrase or private key.
        </span>
      </div>
      <footer className="customer-footer">
        POWERED BY <strong>RELAY PAY</strong>
        <span>·</span> XRP LEDGER
      </footer>
    </main>
  );
}
