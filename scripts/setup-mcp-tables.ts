#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Manual MCP Database Setup Script
 * Creates MCP tables and seeds Asana server configuration
 */

async function setupMcpTables() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL is required');
    process.exit(1);
  }

  const client = postgres(connectionString);

  try {
    console.log('🚀 Setting up MCP database tables...');

    // Create MCP Servers table
    await client`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(256) NOT NULL UNIQUE,
        description TEXT,
        url VARCHAR(2048) NOT NULL,
        protocol VARCHAR(50) NOT NULL DEFAULT 'sse',
        is_enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      )
    `;

    console.log('✅ Created mcp_servers table');

    // Create User MCP Integrations table
    await client`
      CREATE TABLE IF NOT EXISTS user_mcp_integrations (
        user_id UUID NOT NULL,
        mcp_server_id UUID NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        scope TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        last_used_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (user_id, mcp_server_id)
      )
    `;

    console.log('✅ Created user_mcp_integrations table');

    // Create indexes
    await client`
      CREATE INDEX IF NOT EXISTS user_mcp_integrations_user_idx 
      ON user_mcp_integrations(user_id)
    `;

    await client`
      CREATE INDEX IF NOT EXISTS user_mcp_integrations_server_idx 
      ON user_mcp_integrations(mcp_server_id)
    `;

    await client`
      CREATE INDEX IF NOT EXISTS user_mcp_integrations_active_idx 
      ON user_mcp_integrations(is_active)
    `;

    console.log('✅ Created indexes');

    // Insert Asana MCP Server
    const asanaUrl =
      process.env.ASANA_MCP_SERVER_URL || 'https://mcp.asana.com/sse';

    await client`
      INSERT INTO mcp_servers (name, description, url, protocol, is_enabled)
      VALUES (
        'Asana',
        'Asana MCP server for task and project management',
        ${asanaUrl},
        'sse',
        true
      )
      ON CONFLICT (name) 
      DO UPDATE SET
        description = EXCLUDED.description,
        url = EXCLUDED.url,
        protocol = EXCLUDED.protocol,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = now()
    `;

    console.log('✅ Inserted/updated Asana MCP server');

    // Verify the setup
    const asanaServer = await client`
      SELECT id, name, description, url, protocol, is_enabled, created_at
      FROM mcp_servers 
      WHERE name = 'Asana'
    `;

    if (asanaServer.length > 0) {
      const server = asanaServer[0];
      console.log('📋 Asana MCP Server Details:');
      console.log(`   ID: ${server.id}`);
      console.log(`   Name: ${server.name}`);
      console.log(`   Description: ${server.description}`);
      console.log(`   URL: ${server.url}`);
      console.log(`   Protocol: ${server.protocol}`);
      console.log(`   Enabled: ${server.is_enabled}`);
      console.log(`   Created: ${server.created_at}`);
    }

    console.log('');
    console.log('🎉 MCP database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test OAuth flow: Visit /api/integrations/asana/connect');
    console.log('2. Check server logs for any environment variable issues');
    console.log('3. Complete OAuth flow to store encrypted tokens');
  } catch (error) {
    console.error('❌ Error setting up MCP tables:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup script
if (require.main === module) {
  setupMcpTables().catch(console.error);
}

export { setupMcpTables };
