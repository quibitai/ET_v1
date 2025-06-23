-- Add NextAuth tables to Supabase
-- Copy and paste this into your Supabase SQL Editor

-- Accounts table for OAuth provider information
CREATE TABLE IF NOT EXISTS "account" (
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  PRIMARY KEY ("provider", "providerAccountId")
);

-- Sessions table for user sessions
CREATE TABLE IF NOT EXISTS "session" (
  "sessionToken" text NOT NULL PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" timestamp NOT NULL
);

-- Verification tokens table
CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- Add role column to User table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role') THEN
    ALTER TABLE "User" ADD COLUMN "role" varchar DEFAULT 'user' NOT NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");

-- Enable RLS
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verificationToken" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own accounts" ON "account"
  FOR ALL USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can manage own sessions" ON "session"
  FOR ALL USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Allow verification operations" ON "verificationToken"
  FOR ALL USING (true); 