-- Add Google Workspace MCP Server Configuration
-- Run this script to add Google Workspace MCP server to the database

-- Insert Google Workspace MCP Server
INSERT INTO mcp_servers (
    name, 
    description, 
    url, 
    protocol, 
    is_enabled
) VALUES (
    'Google Workspace',
    'Google Workspace MCP Server providing access to Gmail, Drive, Calendar, Docs, Sheets, and more',
    'http://localhost:8001',
    'streamable_http',
    true
) ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    protocol = EXCLUDED.protocol,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

-- Verify the server was added
SELECT 
    id,
    name,
    description,
    url,
    protocol,
    is_enabled,
    created_at
FROM mcp_servers 
WHERE name = 'Google Workspace'; 