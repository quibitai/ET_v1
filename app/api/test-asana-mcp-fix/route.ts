import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';
import { createAsanaTools } from '@/lib/ai/tools/mcp/asana';

export const runtime = 'nodejs';

export async function POST() {
  const testResults: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { total: 0, passed: 0, failed: 0 },
  };

  console.log('🧪 Testing Asana MCP Fix Implementation...');

  // Test 1: Constructor Inheritance Fix
  try {
    console.log('Test 1: AsanaMCPClient Constructor...');
    const client = new AsanaMCPClient();
    testResults.tests.constructor = {
      status: 'PASSED',
      message: 'AsanaMCPClient constructor works without serviceName error',
      serviceName: client.serviceName,
    };
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.constructor = {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    testResults.summary.failed++;
  }
  testResults.summary.total++;

  // Test 2: Static Create Method
  try {
    console.log('Test 2: AsanaMCPClient.create()...');
    const client = await AsanaMCPClient.create();
    testResults.tests.staticCreate = {
      status: 'PASSED',
      message: 'AsanaMCPClient.create() works without errors',
      serverUrl: client.configuration.serverUrl,
      autoDetect: client.configuration.autoDetect,
    };
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.staticCreate = {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    testResults.summary.failed++;
  }
  testResults.summary.total++;

  // Test 3: Tool Creation
  try {
    console.log('Test 3: createAsanaTools()...');
    const tools = await createAsanaTools('test-user-123', 'test-session');
    testResults.tests.toolCreation = {
      status: 'PASSED',
      message: `Successfully created ${tools.length} Asana tools`,
      toolCount: tools.length,
      toolNames: tools.slice(0, 5).map((t) => t.name), // First 5 tool names
    };
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.toolCreation = {
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    testResults.summary.failed++;
  }
  testResults.summary.total++;

  // Test 4: Environment Variable Check
  const hasAsanaToken = !!process.env.ASANA_ACCESS_TOKEN;
  testResults.tests.environment = {
    status: hasAsanaToken ? 'PASSED' : 'WARNING',
    message: hasAsanaToken
      ? 'ASANA_ACCESS_TOKEN environment variable is set'
      : 'ASANA_ACCESS_TOKEN not set - may fall back to database lookup',
    hasToken: hasAsanaToken,
  };
  if (hasAsanaToken) {
    testResults.summary.passed++;
  }
  testResults.summary.total++;

  // Test 5: Server Connection (if token available)
  if (hasAsanaToken) {
    try {
      console.log('Test 5: Server Health Check...');
      const client = await AsanaMCPClient.create();
      const isAvailable = await client.isAvailable();
      testResults.tests.serverHealth = {
        status: isAvailable ? 'PASSED' : 'WARNING',
        message: isAvailable
          ? 'MCP server is healthy and responding'
          : 'MCP server is not responding (may be normal if not running)',
        isAvailable,
      };
      if (isAvailable) {
        testResults.summary.passed++;
      }
    } catch (error) {
      testResults.tests.serverHealth = {
        status: 'WARNING',
        message:
          'Server health check failed (may be normal if server not running)',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    testResults.summary.total++;
  }

  // Overall Assessment
  const successRate =
    (testResults.summary.passed / testResults.summary.total) * 100;
  testResults.assessment = {
    successRate: Math.round(successRate),
    overallStatus:
      successRate >= 80
        ? 'EXCELLENT'
        : successRate >= 60
          ? 'GOOD'
          : 'NEEDS_WORK',
    recommendation:
      successRate >= 80
        ? '✅ Asana MCP integration is working correctly!'
        : successRate >= 60
          ? '⚠️ Some issues detected - check warnings above'
          : '❌ Critical issues found - review failed tests',
  };

  console.log('🧪 Test Summary:', {
    passed: testResults.summary.passed,
    failed: testResults.summary.failed,
    total: testResults.summary.total,
    successRate: `${testResults.assessment.successRate}%`,
  });

  return Response.json(testResults, { status: 200 });
}

export async function GET() {
  return Response.json(
    {
      message: 'Asana MCP Fix Validation Test',
      usage: 'POST to run tests',
      description: 'Tests the fixes for Asana MCP integration issues',
    },
    { status: 200 },
  );
}
