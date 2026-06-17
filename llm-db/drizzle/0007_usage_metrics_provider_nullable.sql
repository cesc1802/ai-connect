ALTER TABLE "usage_metrics" DROP CONSTRAINT "usage_metrics_provider_id_providers_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_metrics" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;