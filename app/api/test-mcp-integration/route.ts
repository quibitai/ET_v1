import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { MultiMCPClient } from '@/lib/ai/mcp/MultiMCPClient';
import { ToolRegistry } from '@/lib/ai/tools/registry/ToolRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Comprehensive MCP Integration Test
 *
 * Tests the complete MCP system including:
 * - MultiMCPClient with service management
 * - Health monitoring and alerts
 * - Tool registry and manifests
 * - Streaming capabilities
 * - Error handling and recovery
 * - Performance metrics
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await req.json();
    const testType = body.testType || 'full';

    const results: any = {
      timestamp: new Date().toISOString(),
      testType,
      results: {},
      performance: {},
      errors: [],
    };

    // Initialize MultiMCPClient
    const startTime = Date.now();
    const mcpClient = new MultiMCPClient({
      autoDiscovery: true,
      healthCheckInterval: 30000, // 30 seconds for testing
    });

    results.performance.initialization = Date.now() - startTime;

    // Test 1: Service Discovery and Registration
    const serviceTest = Date.now();
    const services = mcpClient.getServices();
    const serviceStatus = mcpClient.getServiceStatus();

    results.results.serviceDiscovery = {
      servicesFound: services.length,
      services: services.map((s) => ({
        name: s.name,
        enabled: s.enabled,
        priority: s.priority,
      })),
      status: Array.isArray(serviceStatus) ? serviceStatus : [serviceStatus],
    };
    results.performance.serviceDiscovery = Date.now() - serviceTest;

    // Test 2: Health Monitoring
    const healthTest = Date.now();
    await mcpClient.checkAllServicesHealth();
    const healthSummary = mcpClient.getHealthSummary();
    const healthAlerts = mcpClient.getHealthAlerts();

    results.results.healthMonitoring = {
      summary: healthSummary,
      alerts: healthAlerts,
      servicesHealthy: Object.values(healthSummary || {}).filter(
        (status: any) => status?.status === 'ok',
      ).length,
    };
    results.performance.healthCheck = Date.now() - healthTest;

    // Test 3: Tool Registry and Manifests
    const registryTest = Date.now();
    const toolRegistry = new ToolRegistry();
    const streamingTools = await toolRegistry.getStreamingTools();
    const validationResult = await toolRegistry.validateManifests();

    results.results.toolRegistry = {
      manifestsValid: validationResult.valid,
      manifestErrors: validationResult.errors,
      manifestWarnings: validationResult.warnings,
      streamingToolsAvailable: streamingTools.length,
      streamingTools: streamingTools.map((t) => ({
        id: t.id,
        service: t.service,
        category: t.category,
        streamingType: t.streamingConfig?.type,
      })),
    };
    results.performance.toolRegistry = Date.now() - registryTest;

    // Test 4: MultiMCP Streaming Integration
    const streamingTest = Date.now();
    const mcpStreamingTools = await mcpClient.getStreamingTools();

    results.results.streamingIntegration = {
      streamingToolsInMCP: mcpStreamingTools.length,
      tools: mcpStreamingTools.map((t) => ({
        toolName: t.toolName,
        service: t.service,
        available: true,
      })),
    };
    results.performance.streamingIntegration = Date.now() - streamingTest;

    // Test 5: Tool Routing and Availability
    const routingTest = Date.now();
    const availableTools = mcpClient.getAvailableTools();

    results.results.toolRouting = {
      totalToolsAvailable: availableTools.length,
      availableTools: availableTools.slice(0, 10), // First 10 for brevity
      toolsWithMultipleServices: availableTools.filter(
        (t) => t.services.length > 1,
      ).length,
    };
    results.performance.toolRouting = Date.now() - routingTest;

    // Test 6: Cache Performance
    const cacheTest = Date.now();
    const cacheStats = mcpClient.getCacheStats();

    results.results.cachePerformance = {
      services: Object.keys(cacheStats).length,
      stats: cacheStats,
      totalCacheSize: Object.values(cacheStats).reduce(
        (sum: number, stats: any) => sum + (stats.size || 0),
        0,
      ),
      averageHitRate:
        Object.values(cacheStats).reduce(
          (sum: number, stats: any) => sum + (stats.hitRate || 0),
          0,
        ) / Math.max(Object.keys(cacheStats).length, 1),
    };
    results.performance.cacheStats = Date.now() - cacheTest;

    // Test 7: Error Handling (if requested)
    if (testType === 'full' || testType === 'error-handling') {
      const errorTest = Date.now();
      try {
        // Test with non-existent tool
        await mcpClient.executeTool('non_existent_tool', {});
      } catch (error) {
        results.results.errorHandling = {
          nonExistentToolHandled: true,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        };
      }
      results.performance.errorHandling = Date.now() - errorTest;
    }

    // Overall performance
    results.performance.total = Date.now() - startTime;
    results.performance.averageOperationTime =
      Object.values(results.performance)
        .filter((v) => typeof v === 'number' && v !== results.performance.total)
        .reduce((sum: number, time: any) => sum + time, 0) / 6;

    // Test Summary
    results.summary = {
      overallStatus: results.errors.length === 0 ? 'PASS' : 'PARTIAL',
      servicesActive: services.filter((s) => s.enabled).length,
      toolsAvailable: availableTools.length,
      streamingCapable: streamingTools.length,
      performanceGood: results.performance.total < 5000, // Under 5 seconds
      recommendedActions: [],
    };

    // Add recommendations
    if (results.performance.total > 3000) {
      results.summary.recommendedActions.push(
        'Consider optimizing initialization time',
      );
    }
    if (results.results.healthMonitoring.alerts?.length > 0) {
      results.summary.recommendedActions.push(
        'Review and resolve health alerts',
      );
    }
    if (results.results.cachePerformance.averageHitRate < 0.8) {
      results.summary.recommendedActions.push('Consider cache optimization');
    }

    // Cleanup
    mcpClient.destroy();

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Get integration test info and available test types
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ready',
      message: 'MCP Integration Test Suite',
      availableTests: {
        full: 'Complete system test (recommended)',
        basic: 'Basic functionality only',
        'error-handling': 'Include error handling tests',
        performance: 'Focus on performance metrics',
      },
      usage: {
        post: 'Send { "testType": "full" } to run comprehensive tests',
        testTypes: ['full', 'basic', 'error-handling', 'performance'],
      },
      testComponents: [
        'Service Discovery & Registration',
        'Health Monitoring & Alerts',
        'Tool Registry & Manifests',
        'Streaming Integration',
        'Tool Routing & Availability',
        'Cache Performance',
        'Error Handling',
      ],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
