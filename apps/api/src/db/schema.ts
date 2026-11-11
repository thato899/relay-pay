import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid", "expired"] as const);
export const networkEnum = pgEnum("payment_network", ["demo", "xrpl-testnet"] as const);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: text("merchant_id").notNull(),
    amountXrp: text("amount_xrp").notNull(),
    amountDrops: text("amount_drops").notNull(),
    reference: text("reference"),
    status: invoiceStatusEnum("status").notNull().default("pending"),
    destinationAddress: text("destination_address").notNull(),
    destinationTag: integer("destination_tag").notNull(),
    network: networkEnum("network").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    transactionHash: text("transaction_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_destination_tag_unique").on(table.destinationTag),
    index("invoices_merchant_created_at_idx").on(table.merchantId, table.createdAt),
    index("invoices_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    transactionHash: text("transaction_hash").notNull(),
    amountDrops: text("amount_drops").notNull(),
    ledgerIndex: integer("ledger_index"),
    network: networkEnum("network").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_transaction_hash_unique").on(table.transactionHash),
    index("payments_invoice_id_idx").on(table.invoiceId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorSubject: text("actor_subject").notNull(),
    organizationId: text("organization_id"),
    requestId: text("request_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: text("merchant_id").notNull(),
    deviceId: text("device_id").notNull(),
    clientSubject: text("client_subject").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("devices_client_subject_unique").on(table.clientSubject),
    uniqueIndex("devices_merchant_device_unique").on(table.merchantId, table.deviceId),
    index("devices_merchant_enabled_idx").on(table.merchantId, table.enabled),
  ],
);

export const deviceInvoiceOperations = pgTable(
  "device_invoice_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    operationId: text("operation_id").notNull(),
    cycleCode: text("cycle_code").notNull(),
    requestHash: text("request_hash").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("device_invoice_operations_device_op_unique").on(table.deviceId, table.operationId),
    index("device_invoice_operations_invoice_idx").on(table.invoiceId),
  ],
);

export const invoicesRelations = relations(invoices, ({ many }) => ({
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));
