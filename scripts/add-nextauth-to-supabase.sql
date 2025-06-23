-- Add NextAuth tables to Supabase for Google OAuth integration
-- Run this in your Supabase SQL Editor

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

-- Verification tokens table for email verification
CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- Add role column to User table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role') THEN
    ALTER TABLE "User" ADD COLUMN "role" varchar DEFAULT 'user' NOT NULL;
  END IF;
END $$;

-- Add Google Workspace MCP server to your existing mcp_servers table
INSERT INTO "mcp_servers" (
  "id",
  "name", 
  "description",
  "url",
  "status",
  "config",
  "created_at",
  "updated_at"
) VALUES (
  'google-workspace-mcp',
  'Google Workspace MCP',
  'Google Workspace integration providing access to Gmail, Drive, Calendar, Docs, Sheets, Forms, Chat, and Slides',
  'http://localhost:8000/mcp/',
  'active',
  jsonb_build_object(
    'transport', 'http',
    'credentials_type', 'oauth_injection',
    'scopes', array[
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/chat.messages.readonly',
      'https://www.googleapis.com/auth/chat.spaces.readonly',
      'https://www.googleapis.com/auth/chat.memberships.readonly',
      'https://www.googleapis.com/auth/chat.messages',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/forms.body',
      'https://www.googleapis.com/auth/forms.body.readonly',
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/presentations.readonly',
      'https://www.googleapis.com/auth/presentations'
    ],
    'tools_count', 40
  ),
  NOW(),
  NOW()
) ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "url" = EXCLUDED."url",
  "status" = EXCLUDED."status",
  "config" = EXCLUDED."config",
  "updated_at" = NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "idx_account_provider" ON "account"("provider");

-- Grant necessary permissions
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verificationToken" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for NextAuth tables
CREATE POLICY "Users can view own accounts" ON "account"
  FOR ALL USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can view own sessions" ON "session"
  FOR ALL USING (auth.uid()::text = "userId"::text);

-- Verification tokens don't need user-specific policies
CREATE POLICY "Allow verification token operations" ON "verificationToken"
  FOR ALL USING (true); 