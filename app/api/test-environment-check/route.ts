import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check all relevant environment variables
    const envVars = {
      ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
        ? '✅ Set'
        : '❌ Missing',
      ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || '❌ Not set',
      NODE_ENV: process.env.NODE_ENV,
      DOCKER_COMPOSE: process.env.DOCKER_COMPOSE || '❌ Not set',
    };

    // Test the MCP server connection
    let mcpServerStatus = '❌ Unknown';
    try {
      const response = await fetch('http://localhost:8080/health', {
        method: 'GET',
      });
      if (response.ok) {
        const health = await response.json();
        mcpServerStatus = `✅ Healthy (${health.status})`;
      } else {
        mcpServerStatus = `❌ Unhealthy (${response.status})`;
      }
    } catch (error) {
      mcpServerStatus = `❌ Unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test what URL the AsanaMCPClient would detect
    const serviceName = 'asana';
    const envKey = `${serviceName.toUpperCase()}_MCP_SERVER_URL`;
    let detectedUrl = process.env[envKey];

    if (!detectedUrl) {
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.DOCKER_COMPOSE
      ) {
        detectedUrl = `http://${serviceName.toLowerCase()}-mcp:8080`;
      } else {
        detectedUrl = 'http://localhost:8080'; // default
      }
    }

    return NextResponse.json({
      success: true,
      environment: envVars,
      mcpServer: {
        expectedUrl: 'http://localhost:8080',
        detectedUrl,
        status: mcpServerStatus,
        urlMatch:
          detectedUrl === 'http://localhost:8080'
            ? '✅ Correct'
            : '❌ Mismatch',
      },
      diagnosis: {
        problem:
          detectedUrl !== 'http://localhost:8080'
            ? 'ASANA_MCP_SERVER_URL is set incorrectly'
            : mcpServerStatus.includes('❌')
              ? 'MCP server is not accessible'
              : 'Configuration looks correct',
        solution:
          detectedUrl !== 'http://localhost:8080'
            ? 'Update ASANA_MCP_SERVER_URL=http://localhost:8080 in .env.local and restart dev server'
            : mcpServerStatus.includes('❌')
              ? 'Ensure MCP server is running: cd mcp-server-asana && docker-compose -f docker-compose.dev.yml up'
              : 'Configuration is correct, check for other issues',
      },
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
