CREATE TYPE "public"."machine_cycle_state" AS ENUM('awaiting_payment', 'paid', 'start_requested', 'started', 'expired', 'start_unknown');--> statement-breakpoint
CREATE TABLE "machine_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"state" "machine_cycle_state" DEFAULT 'awaiting_payment' NOT NULL,
	"last_polled_at" timestamp with time zone,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machine_cycles" ADD CONSTRAINT "machine_cycles_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_cycles" ADD CONSTRAINT "machine_cycles_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "machine_cycles_device_operation_unique" ON "machine_cycles" USING btree ("device_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_cycles_invoice_unique" ON "machine_cycles" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "machine_cycles_device_updated_idx" ON "machine_cycles" USING btree ("device_id","updated_at");