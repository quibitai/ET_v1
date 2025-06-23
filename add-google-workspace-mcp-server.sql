-- Add Google Workspace MCP server to your existing mcp_servers table
-- Run this in Supabase SQL Editor after the NextAuth tables are created

INSERT INTO "mcp_servers" (
  "name",
  "description", 
  "url",
  "protocol",
  "is_enabled",
  "created_at",
  "updated_at"
) VALUES (
  'Google Workspace MCP',
  'Google Workspace integration providing access to Gmail, Drive, Calendar, Docs, Sheets, Forms, Chat, and Slides with OAuth credential injection',
  'http://localhost:8000/mcp/',
  'streamable_http',
  true,
  NOW(),
  NOW()
) ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "url" = EXCLUDED."url", 
  "protocol" = EXCLUDED."protocol",
  "is_enabled" = EXCLUDED."is_enabled",
  "updated_at" = NOW();

-- Verify the server was added
SELECT * FROM "mcp_servers" WHERE "name" = 'Google Workspace MCP'; 