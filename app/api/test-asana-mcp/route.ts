import { NextResponse } from 'next/server';
import { McpToolFactory } from '@/lib/ai/tools/mcp/core/factory';

export const runtime = 'nodejs';

/**
 * Test endpoint for Asana MCP integration
 *
 * Tests both environment variable (PAT) and database (OAuth) approaches
 * Now bypasses authentication in development mode
 */
export async function GET() {
  try {
    // DEVELOPMENT MODE: If using environment variables, skip auth entirely
    const envToken = process.env.ASANA_ACCESS_TOKEN;
    const isDevMode = !!envToken;

    console.log('[TestAsanaMCP] Development mode:', isDevMode);
    console.log('[TestAsanaMCP] Testing Asana MCP availability...');

    // Use a test user ID in development mode, real user in production
    const userId = isDevMode ? 'dev-user-test' : 'authenticated-user';

    // Test server availability
    const isAvailable = await McpToolFactory.isServerAvailable('Asana', userId);

    console.log('[TestAsanaMCP] Server available:', isAvailable);

    // Determine auth method
    const authMethod = envToken ? 'environment_variable' : 'database_oauth';

    // Get environment token status
    const envTokenPreview = envToken ? `${envToken.substring(0, 8)}...` : null;

    // Get available MCP servers from database
    let availableServers: any[] = [];
    try {
      const { McpIntegrationRepository } = await import(
        '@/lib/db/repositories/mcpIntegrations'
      );
      availableServers = await McpIntegrationRepository.getEnabledMcpServers();
    } catch (error) {
      console.warn('[TestAsanaMCP] Could not fetch MCP servers:', error);
    }

    // Recommendation based on setup
    const recommendation = envToken
      ? 'Using environment variables (development mode) ✅'
      : 'Using database OAuth approach (for official Asana MCP)';

    const response = {
      status: 'success',
      asanaIntegration: {
        isAvailable,
        authMethod,
        environmentToken: {
          present: !!envToken,
          preview: envTokenPreview,
        },
        databaseIntegration: {
          userId,
          availableServers: availableServers.map((s: any) => ({
            name: s.name,
            url: s.url,
            isEnabled: s.isEnabled,
          })),
        },
      },
      recommendation,
      environmentVariables: {
        ASANA_ACCESS_TOKEN: envToken ? 'SET ✅' : 'NOT_SET',
        ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'NOT_SET',
        DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'NOT_SET',
      },
    };

    console.log('[TestAsanaMCP] Response:', JSON.stringify(response, null, 2));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[TestAsanaMCP] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
