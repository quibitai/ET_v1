import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const tests = [];

  try {
    // Test 1: Direct fetch to MCP server health endpoint
    tests.push({
      name: 'Direct MCP Health Check',
      test: async () => {
        const response = await fetch('http://localhost:8080/health', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data,
        };
      },
    });

    // Test 2: Test MCP tools endpoint
    tests.push({
      name: 'MCP Tools Endpoint',
      test: async () => {
        const response = await fetch('http://localhost:8080/tools', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data,
        };
      },
    });

    // Test 3: Test AsanaMCPClient direct health check
    tests.push({
      name: 'AsanaMCPClient Health Check',
      test: async () => {
        const { AsanaMCPClient } = await import('@/lib/ai/mcp/AsanaMCPClient');
        const client = new AsanaMCPClient({
          serverUrl: 'http://localhost:8080',
          autoDetect: false,
        });
        const health = await client.healthCheck();
        return {
          success: health.status === 'ok',
          data: health,
        };
      },
    });

    // Test 4: Test BaseMCPClient makeRequest method
    tests.push({
      name: 'BaseMCPClient makeRequest',
      test: async () => {
        const { AsanaMCPClient } = await import('@/lib/ai/mcp/AsanaMCPClient');
        const client = new AsanaMCPClient({
          serverUrl: 'http://localhost:8080',
          autoDetect: false,
        });

        // Call the makeRequest method directly
        const response = await (client as any).makeRequest('/health', {
          method: 'GET',
        });
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data,
        };
      },
    });

    // Run all tests
    const results = [];
    for (const testCase of tests) {
      try {
        const result = await testCase.test();
        results.push({
          name: testCase.name,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          name: testCase.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    return NextResponse.json({
      success: true,
      environment: {
        ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
          ? 'Set ✅'
          : 'Missing ❌',
        ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'Not set ❌',
        NODE_ENV: process.env.NODE_ENV,
      },
      tests: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
