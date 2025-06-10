-- Add customInstructions column to Clients table if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "Clients" ADD COLUMN "customInstructions" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;

-- Add enabledBits column to Clients table if it doesn't exist  
DO $$ BEGIN
 ALTER TABLE "Clients" ADD COLUMN "enabledBits" json;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;