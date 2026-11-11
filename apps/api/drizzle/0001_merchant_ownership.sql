ALTER TABLE "invoices" ADD COLUMN "merchant_id" text DEFAULT 'local-development' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "merchant_id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "invoices_merchant_created_at_idx" ON "invoices" USING btree ("merchant_id","created_at");
