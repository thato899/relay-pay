CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" text NOT NULL,
	"device_id" text NOT NULL,
	"client_subject" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "devices_client_subject_unique" ON "devices" USING btree ("client_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_merchant_device_unique" ON "devices" USING btree ("merchant_id","device_id");--> statement-breakpoint
CREATE INDEX "devices_merchant_enabled_idx" ON "devices" USING btree ("merchant_id","enabled");