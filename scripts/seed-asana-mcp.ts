#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { mcpServers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Asana MCP Server Seeding Script
 *
 * Seeds the database with the Asana MCP server configuration
 * using environment variables from .env.local
 *
 * Usage: tsx scripts/seed-asana-mcp.ts
 */

async function seedAsanaMcpServer() {
  // Environment validation
  const requiredEnvVars = [
    'DATABASE_URL',
    'ASANA_MCP_SERVER_URL',
    'ASANA_WORKSPACE_GID',
    'ASANA_DEFAULT_TEAM_GID',
  ];

  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  }

  // Database connection
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('🚀 Starting Asana MCP server seeding...');

    // Asana MCP server configuration matching the actual schema
    const asanaServerConfig = {
      name: 'Asana',
      url: process.env.ASANA_MCP_SERVER_URL || '',
      description: 'Asana MCP server for task and project management',
      protocol: 'sse' as const,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Check if Asana server already exists
    const existingServer = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.name, 'Asana'))
      .limit(1);

    if (existingServer.length > 0) {
      // Update existing server
      await db
        .update(mcpServers)
        .set({
          url: asanaServerConfig.url,
          description: asanaServerConfig.description,
          protocol: asanaServerConfig.protocol,
          isEnabled: asanaServerConfig.isEnabled,
          updatedAt: asanaServerConfig.updatedAt,
        })
        .where(eq(mcpServers.name, 'Asana'));

      console.log('✅ Updated existing Asana MCP server configuration');
    } else {
      // Insert new server
      await db.insert(mcpServers).values(asanaServerConfig);
      console.log('✅ Created new Asana MCP server configuration');
    }

    // Verify the insertion/update
    const verifyServer = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.name, 'Asana'))
      .limit(1);

    if (verifyServer.length > 0) {
      const server = verifyServer[0];
      console.log('📋 Asana MCP Server Details:');
      console.log(`   ID: ${server.id}`);
      console.log(`   Name: ${server.name}`);
      console.log(`   URL: ${server.url}`);
      console.log(`   Protocol: ${server.protocol}`);
      console.log(`   Enabled: ${server.isEnabled}`);
      console.log(`   Created: ${server.createdAt}`);
      console.log(`   Updated: ${server.updatedAt}`);
    }

    console.log('');
    console.log('Environment Variables Used:');
    console.log(`   ASANA_MCP_SERVER_URL: ${process.env.ASANA_MCP_SERVER_URL}`);
    console.log(`   ASANA_WORKSPACE_GID: ${process.env.ASANA_WORKSPACE_GID}`);
    console.log(
      `   ASANA_DEFAULT_TEAM_GID: ${process.env.ASANA_DEFAULT_TEAM_GID}`,
    );

    console.log('');
    console.log('🎉 Asana MCP server seeding completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the database migration: pnpm db:push');
    console.log(
      '2. Test OAuth flow: http://localhost:3000/api/integrations/asana/connect',
    );
    console.log('3. Check integration status in your application');
  } catch (error) {
    console.error('❌ Error seeding Asana MCP server:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the seeding script
if (require.main === module) {
  seedAsanaMcpServer().catch(console.error);
}

export { seedAsanaMcpServer };
