import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== HEALTH CHECK DEBUG START ===');

    // Check environment first
    const envUrl = process.env.ASANA_MCP_SERVER_URL;
    console.log('Environment ASANA_MCP_SERVER_URL:', envUrl);

    // Test 1: Direct fetch like health check does
    try {
      console.log('Test 1: Direct fetch to /health');
      const response = await fetch('http://localhost:8080/health', {
        method: 'GET',
      });
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        console.log('✅ Direct health check succeeded');
      } else {
        console.log(
          '❌ Direct health check failed with status:',
          response.status,
        );
      }
    } catch (error) {
      console.error('❌ Direct health check threw error:', error);
    }

    // Test 2: Create AsanaMCPClient and test health check
    try {
      console.log('Test 2: AsanaMCPClient health check');
      const { AsanaMCPClient } = await import('@/lib/ai/mcp/AsanaMCPClient');

      // Create client with explicit config
      const client = new AsanaMCPClient({
        serverUrl: 'http://localhost:8080',
        autoDetect: false,
        timeout: 10000,
        retries: 0, // No retries for debugging
      });

      console.log('Client config:', client.configuration);

      const health = await client.healthCheck();
      console.log('Health check result:', health);

      if (health.status === 'ok') {
        console.log('✅ AsanaMCPClient health check succeeded');
      } else {
        console.log('❌ AsanaMCPClient health check failed:', health.error);
      }
    } catch (error) {
      console.error('❌ AsanaMCPClient health check threw error:', error);
      console.error('Error stack:', (error as Error).stack);
    }

    // Test 3: Test makeRequest directly
    try {
      console.log('Test 3: Direct makeRequest call');
      const { AsanaMCPClient } = await import('@/lib/ai/mcp/AsanaMCPClient');

      const client = new AsanaMCPClient({
        serverUrl: 'http://localhost:8080',
        autoDetect: false,
        timeout: 10000,
        retries: 0,
      });

      const response = await (client as any).makeRequest('/health', {
        method: 'GET',
      });

      console.log('makeRequest response status:', response.status);
      console.log('makeRequest response ok:', response.ok);

      const data = await response.json();
      console.log('makeRequest response data:', data);
    } catch (error) {
      console.error('❌ makeRequest threw error:', error);
      console.error('Error stack:', (error as Error).stack);
    }

    console.log('=== HEALTH CHECK DEBUG END ===');

    return NextResponse.json({
      success: true,
      message: 'Debug completed, check server console for details',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug endpoint failed:', error);
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
