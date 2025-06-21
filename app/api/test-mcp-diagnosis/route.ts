import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';

export async function GET(request: NextRequest) {
  try {
    console.log('=== MCP DIAGNOSIS START ===');

    // Check environment variables
    const envVars = {
      ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
        ? 'Set ✅'
        : 'Missing ❌',
      ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'Not set ❌',
      NODE_ENV: process.env.NODE_ENV,
    };

    console.log('Environment Variables:', envVars);

    // Test direct server connection
    let directServerTest = 'Unknown';
    try {
      const response = await fetch('http://localhost:8080/health');
      if (response.ok) {
        const health = await response.json();
        directServerTest = `✅ Server healthy: ${JSON.stringify(health)}`;
      } else {
        directServerTest = `❌ Server unhealthy: ${response.status}`;
      }
    } catch (error) {
      directServerTest = `❌ Server unreachable: ${error instanceof Error ? error.message : String(error)}`;
    }

    console.log('Direct server test:', directServerTest);

    // Test AsanaMCPClient creation and configuration
    let mcpClientDiagnosis = 'Unknown';
    let mcpClientConfig = null;
    let validationResult = null;

    try {
      console.log('Creating AsanaMCPClient...');
      const client = await AsanaMCPClient.create();

      console.log('Getting client configuration...');
      mcpClientConfig = client.configuration;

      console.log('Client config serverUrl:', mcpClientConfig.serverUrl);

      console.log('Running validation...');
      validationResult = await client.validateConfiguration();

      mcpClientDiagnosis = `✅ Client created successfully`;
    } catch (error) {
      mcpClientDiagnosis = `❌ Client creation failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('MCP Client creation error:', error);
    }

    // Test tool loading - simplified for now
    const toolLoadingTest = 'Skipped for diagnosis';

    // Test the createAsanaTools function directly
    let directAsanaToolTest = 'Unknown';
    try {
      console.log('Testing direct Asana tool creation...');
      const { createAsanaTools } = await import('@/lib/ai/tools/mcp/asana');
      const asanaTools = await createAsanaTools('test-user', 'test-session');
      directAsanaToolTest = `✅ Created ${asanaTools.length} Asana tools directly`;
      console.log(
        'Direct Asana tools:',
        asanaTools.map((t: any) => t.name),
      );
    } catch (error) {
      directAsanaToolTest = `❌ Direct Asana tool creation failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Direct Asana tool creation error:', error);
    }

    const diagnosis = {
      timestamp: new Date().toISOString(),
      environment: envVars,
      directServerTest,
      mcpClient: {
        diagnosis: mcpClientDiagnosis,
        config: mcpClientConfig,
        validation: validationResult,
      },
      toolLoading: toolLoadingTest,
      directAsanaTest: directAsanaToolTest,
      summary: {
        serverRunning: directServerTest.includes('✅'),
        environmentCorrect:
          envVars.ASANA_MCP_SERVER_URL === 'http://localhost:8080',
        clientWorking: mcpClientDiagnosis.includes('✅'),
        toolsLoaded: toolLoadingTest.includes('✅'),
      },
    };

    console.log('=== MCP DIAGNOSIS COMPLETE ===');

    return NextResponse.json({
      success: true,
      diagnosis,
    });
  } catch (error) {
    console.error('Diagnosis failed:', error);
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
