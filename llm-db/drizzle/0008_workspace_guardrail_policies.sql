CREATE TABLE "workspace_guardrail_policies" (
	"workspace_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspace_guardrail_policies_workspace_id_pk" PRIMARY KEY("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_guardrail_policies" ADD CONSTRAINT "workspace_guardrail_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;