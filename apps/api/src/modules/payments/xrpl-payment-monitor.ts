import type { FastifyBaseLogger } from "fastify";
import { Client, isValidClassicAddress } from "xrpl";
import { config } from "../../config.js";
import type { InvoiceRepository } from "../invoices/repository.js";

interface AccountTransaction {
  hash?: string;
  ledger_index?: number;
  validated?: boolean;
  tx?: Record<string, unknown>;
  tx_json?: Record<string, unknown>;
  meta?: unknown;
}

interface AccountTxResponse {
  result: {
    transactions: AccountTransaction[];
  };
}

interface TransactionMetadata {
  TransactionResult?: string;
}

export class XrplPaymentMonitor {
  private client: Client | undefined;
  private timer: NodeJS.Timeout | undefined;
  private connected = false;
  private working = false;

  constructor(
    private readonly repository: InvoiceRepository,
    private readonly logger: FastifyBaseLogger,
  ) {}

  start(): void {
    if (config.paymentMode !== "xrpl-testnet") return;
    if (!isValidClassicAddress(config.merchantAddress)) {
      throw new Error("MERCHANT_XRPL_ADDRESS must be a valid classic XRPL address");
    }

    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  isReady(): boolean {
    return config.paymentMode === "demo" || this.connected;
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.client?.isConnected()) await this.client.disconnect();
    this.connected = false;
    this.client = undefined;
  }

  private async tick(): Promise<void> {
    if (this.working) return;
    this.working = true;

    try {
      if (!this.client || !this.client.isConnected()) {
        this.client = new Client(config.xrplWsUrl);
        await this.client.connect();
        this.connected = true;
        this.logger.info({ network: "XRPL Testnet" }, "Connected to payment ledger");
      }

      await this.reconcileRecentPayments();
    } catch (error) {
      this.connected = false;
      this.logger.warn({ err: error }, "XRPL reconciliation failed; will retry");
      try {
        if (this.client?.isConnected()) await this.client.disconnect();
      } catch (disconnectError) {
        this.logger.debug({ err: disconnectError }, "XRPL disconnect cleanup failed");
      }
      this.client = undefined;
    } finally {
      this.working = false;
    }
  }

  private async reconcileRecentPayments(): Promise<void> {
    if (!this.client) return;

    const pending = await this.repository.listPendingForReconciliation();
    if (pending.length === 0) return;

    const pendingByTag = new Map(pending.map((invoice) => [invoice.destinationTag, invoice]));
    const response = (await this.client.request({
      command: "account_tx",
      account: config.merchantAddress,
      limit: 200,
      forward: false,
      ledger_index_min: -1,
      ledger_index_max: -1,
    })) as unknown as AccountTxResponse;

    for (const item of response.result.transactions) {
      if (!item.validated) continue;

      const transaction = item.tx_json ?? item.tx;
      const metadata = item.meta as TransactionMetadata | undefined;
      if (
        !transaction ||
        transaction.TransactionType !== "Payment" ||
        transaction.Destination !== config.merchantAddress ||
        metadata?.TransactionResult !== "tesSUCCESS" ||
        typeof transaction.DestinationTag !== "number" ||
        typeof transaction.Amount !== "string"
      ) {
        continue;
      }

      const invoice = pendingByTag.get(transaction.DestinationTag);
      const hash =
        item.hash ?? (typeof transaction.hash === "string" ? transaction.hash : undefined);
      if (!invoice || !hash || transaction.Amount !== invoice.amountDrops) continue;

      const confirmed = await this.repository.confirmPayment({
        invoiceId: invoice.id,
        transactionHash: hash,
        amountDrops: invoice.amountDrops,
        network: "xrpl-testnet",
        ledgerIndex: typeof item.ledger_index === "number" ? item.ledger_index : null,
      });

      if (confirmed) {
        pendingByTag.delete(invoice.destinationTag);
        this.logger.info(
          { invoiceId: invoice.id, transactionHash: hash, ledgerIndex: item.ledger_index },
          "Validated XRPL payment matched an invoice",
        );
      }
    }
  }
}
