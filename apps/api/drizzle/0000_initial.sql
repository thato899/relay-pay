CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_network" AS ENUM('demo', 'xrpl-testnet');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount_xrp" text NOT NULL,
	"amount_drops" text NOT NULL,
	"reference" text,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"destination_address" text NOT NULL,
	"destination_tag" integer NOT NULL,
	"network" "payment_network" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"transaction_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"transaction_hash" text NOT NULL,
	"amount_drops" text NOT NULL,
	"ledger_index" integer,
	"network" "payment_network" NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_destination_tag_unique" ON "invoices" USING btree ("destination_tag");--> statement-breakpoint
CREATE INDEX "invoices_status_created_at_idx" ON "invoices" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_transaction_hash_unique" ON "payments" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");