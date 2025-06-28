/**
 * Add Google Workspace MCP Server Configuration
 *
 * This script adds the Google Workspace MCP server to the database
 * so it can be discovered and used by the application.
 */

import { McpIntegrationRepository } from '@/lib/db/repositories/mcpIntegrations';

async function addGoogleWorkspaceMCP() {
  try {
    console.log('🔧 Adding Google Workspace MCP server configuration...');

    // Check if Google Workspace MCP server already exists
    const existingServer =
      await McpIntegrationRepository.getMcpServerByName('Google Workspace');

    if (existingServer) {
      console.log('✅ Google Workspace MCP server already exists in database');
      console.log(`   Server ID: ${existingServer.id}`);
      console.log(`   URL: ${existingServer.url}`);
      console.log(`   Enabled: ${existingServer.isEnabled}`);
      return;
    }

    // Create Google Workspace MCP server configuration
    const serverData = {
      name: 'Google Workspace',
      description:
        'Google Workspace MCP Server providing access to Gmail, Drive, Calendar, Docs, Sheets, and more',
      url:
        process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL || 'http://localhost:8001',
      protocol: 'streamable_http' as const,
      isEnabled: true,
    };

    const server = await McpIntegrationRepository.createMcpServer(serverData);

    console.log('✅ Successfully added Google Workspace MCP server:');
    console.log(`   Server ID: ${server.id}`);
    console.log(`   Name: ${server.name}`);
    console.log(`   URL: ${server.url}`);
    console.log(`   Protocol: ${server.protocol}`);
    console.log(`   Enabled: ${server.isEnabled}`);

    console.log('\n🔑 Next Steps:');
    console.log(
      '1. Ensure your Google Workspace MCP server is running on the configured URL',
    );
    console.log(
      '2. Place your client_secret.json file in mcp-server-google-workspace/ directory',
    );
    console.log(
      '3. Users will complete OAuth authentication when first using Google Workspace tools',
    );
  } catch (error) {
    console.error('❌ Failed to add Google Workspace MCP server:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addGoogleWorkspaceMCP()
    .then(() => {
      console.log('\n🎉 Google Workspace MCP setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { addGoogleWorkspaceMCP };
