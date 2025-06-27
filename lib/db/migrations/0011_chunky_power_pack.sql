-- Add config_json column to Clients table if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "Clients" ADD COLUMN "config_json" json;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;