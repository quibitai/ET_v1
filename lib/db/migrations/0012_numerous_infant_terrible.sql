CREATE TABLE IF NOT EXISTS "specialists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"persona_prompt" text NOT NULL,
	"default_tools" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
