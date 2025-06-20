import { NextResponse } from 'next/server';
import { createMCPClient } from '@/lib/ai/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Create MCP client with auto-discovery
    const mcpClient = await createMCPClient({
      autoDiscovery: true,
      healthCheckInterval: 30000, // 30 seconds for testing
    });

    // Get service status
    const serviceStatus = mcpClient.getServiceStatus();

    // Get available tools
    const availableTools = mcpClient.getAvailableTools();

    // Get specific service (Asana)
    const asanaClient = mcpClient.getService('asana');
    const asanaAvailable = asanaClient
      ? await asanaClient.isAvailable()
      : false;

    // Test a simple tool if Asana is available
    let testResult = null;
    if (asanaAvailable && asanaClient) {
      try {
        testResult = await mcpClient.executeTool('asana_list_workspaces');
      } catch (error) {
        testResult = {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Get cache stats
    const cacheStats = mcpClient.getCacheStats();

    // Clean up
    mcpClient.destroy();

    return NextResponse.json({
      success: true,
      architecture: {
        type: 'Multi-MCP Client',
        version: '2.0',
        features: [
          'BaseMCPClient abstraction',
          'Service-specific implementations',
          'Multi-service management',
          'Health monitoring',
          'Tool routing',
          'Caching support',
          'Auto-discovery',
        ],
      },
      services: serviceStatus,
      tools: {
        total: availableTools.length,
        available: availableTools.filter((t) => t.available).length,
        byService: availableTools.reduce(
          (acc, tool) => {
            tool.services.forEach((service) => {
              if (!acc[service]) acc[service] = 0;
              acc[service]++;
            });
            return acc;
          },
          {} as Record<string, number>,
        ),
        sample: availableTools.slice(0, 5),
      },
      asana: {
        available: asanaAvailable,
        testResult,
      },
      cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('MCP Architecture test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 },
    );
  }
}
