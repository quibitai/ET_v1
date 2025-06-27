import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Test OAuth Flow] Starting OAuth flow test...');

    // Simulate the MCP call to start_google_auth
    const authRequest = {
      jsonrpc: '2.0',
      id: 'start-auth',
      method: 'tools/call',
      params: {
        name: 'start_google_auth',
        arguments: {
          user_google_email: 'adam@echotango.co',
          service_name: 'gmail',
        },
      },
    };

    console.log('[Test OAuth Flow] Making auth request to MCP server...');

    const response = await fetch('http://127.0.0.1:8000/mcp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(authRequest),
    });

    console.log('[Test OAuth Flow] Response status:', response.status);
    const responseText = await response.text();
    console.log('[Test OAuth Flow] Response:', responseText);

    if (response.ok) {
      // Parse the Server-Sent Events response
      const lines = responseText.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data: '));

      if (dataLine) {
        const data = JSON.parse(dataLine.substring(6));

        return NextResponse.json({
          success: true,
          message: 'OAuth flow initiated',
          authData: data,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to initiate OAuth flow',
      responseStatus: response.status,
      responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Test OAuth Flow] Error:', error);
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
