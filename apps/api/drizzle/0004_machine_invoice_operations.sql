CREATE TABLE "device_invoice_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"cycle_code" text NOT NULL,
	"request_hash" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_invoice_operations" ADD CONSTRAINT "device_invoice_operations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_invoice_operations" ADD CONSTRAINT "device_invoice_operations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_invoice_operations_device_op_unique" ON "device_invoice_operations" USING btree ("device_id","operation_id");--> statement-breakpoint
CREATE INDEX "device_invoice_operations_invoice_idx" ON "device_invoice_operations" USING btree ("invoice_id");