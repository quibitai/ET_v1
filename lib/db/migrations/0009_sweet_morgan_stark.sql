-- Add updatedAt column to Chat table if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "Chat" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;

-- Add bitContextId column to Chat table if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "Chat" ADD COLUMN "bitContextId" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;

-- Add client_display_name column to Clients table if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "Clients" ADD COLUMN "client_display_name" text NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;

-- Add client_core_mission column to Clients table if it doesn't exist  
DO $$ BEGIN
 ALTER TABLE "Clients" ADD COLUMN "client_core_mission" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;

-- Drop enabledBits column if it exists
ALTER TABLE "Clients" DROP COLUMN IF EXISTS "enabledBits";