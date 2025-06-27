import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { GoogleWorkspaceMCPClient } from '@/lib/ai/mcp/GoogleWorkspaceMCPClient';

export async function GET(request: NextRequest) {
  try {
    console.log('[Test Gmail MCP] Starting test...');

    // Create MCP client for the new workspace-mcp server
    const client = new GoogleWorkspaceMCPClient({
      serverUrl: 'http://127.0.0.1:8000',
      userEmail: 'adam@echotango.co',
    });

    console.log('[Test Gmail MCP] Client created, testing Gmail search...');

    // Test Gmail search
    const result = await client.executeTool('search_gmail_messages', {
      query: 'from:chantel@echotango.co',
      max_results: 5,
    });

    console.log('[Test Gmail MCP] Gmail search result:', result);

    return NextResponse.json({
      success: true,
      message: 'Gmail MCP test completed',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Test Gmail MCP] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
