-- Manual MCP Database Setup Script
-- Run this directly in your PostgreSQL database to create the MCP tables

-- Create MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(256) NOT NULL UNIQUE,
    description TEXT,
    url VARCHAR(2048) NOT NULL,
    protocol VARCHAR(50) NOT NULL DEFAULT 'sse',
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create User MCP Integrations table
CREATE TABLE IF NOT EXISTS user_mcp_integrations (
    user_id UUID NOT NULL,
    mcp_server_id UUID NOT NULL,
    access_token TEXT NOT NULL, -- This will be encrypted
    refresh_token TEXT, -- This will be encrypted
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT, -- OAuth scopes granted
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, mcp_server_id)
);

-- Add foreign key constraints
ALTER TABLE user_mcp_integrations 
ADD CONSTRAINT fk_user_mcp_integrations_user_id 
FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE user_mcp_integrations 
ADD CONSTRAINT fk_user_mcp_integrations_mcp_server_id 
FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_mcp_integrations_user_idx ON user_mcp_integrations(user_id);
CREATE INDEX IF NOT EXISTS user_mcp_integrations_server_idx ON user_mcp_integrations(mcp_server_id);
CREATE INDEX IF NOT EXISTS user_mcp_integrations_active_idx ON user_mcp_integrations(is_active);

-- Insert Asana MCP Server
INSERT INTO mcp_servers (
    name, 
    description, 
    url, 
    protocol, 
    is_enabled
) VALUES (
    'Asana',
    'Asana MCP server for task and project management',
    'https://mcp.asana.com/sse',
    'sse',
    true
) ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    protocol = EXCLUDED.protocol,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

-- Verify the setup
SELECT 
    id,
    name,
    description,
    url,
    protocol,
    is_enabled,
    created_at
FROM mcp_servers 
WHERE name = 'Asana';

-- Show table structure
\d mcp_servers;
\d user_mcp_integrations; 