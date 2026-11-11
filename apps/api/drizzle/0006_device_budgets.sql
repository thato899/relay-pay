CREATE TABLE "device_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"max_cycle_drops" text NOT NULL,
	"window_budget_drops" text NOT NULL,
	"window_seconds" integer NOT NULL,
	"approved_payee_address" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_budgets" ADD CONSTRAINT "device_budgets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_budgets_device_unique" ON "device_budgets" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_budgets_enabled_idx" ON "device_budgets" USING btree ("enabled","updated_at");