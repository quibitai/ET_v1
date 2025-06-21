import type { NextRequest } from 'next/server';
import { StreamingMCPWrapper } from '@/lib/ai/mcp/streaming/StreamingMCPWrapper';
import { BaseMCPClient } from '@/lib/ai/mcp/BaseMCPClient';
import type { ToolManifest } from '@/lib/ai/tools/registry/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mock MCP Client for testing streaming
 */
class MockMCPClient extends BaseMCPClient {
  readonly serviceName = 'test';
  readonly defaultServerUrl = 'mock://test-server';
  readonly supportedTools = ['test_tool', 'test_progress', 'test_batch'];

  constructor() {
    super({ serverUrl: 'mock://test-server' });
  }

  protected detectServerUrl(): string {
    return 'mock://test-server';
  }

  protected async validateServiceSpecific(): Promise<{
    errors: string[];
    warnings?: string[];
  }> {
    return { errors: [] };
  }

  async executeTool(toolName: string, args: any = {}) {
    // Simulate tool execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
      tool: toolName,
      result: {
        message: `Mock result for ${toolName}`,
        data: Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Test MCP Streaming
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const toolName = body.toolName || 'test_tool';

    // Create mock manifest with streaming support
    const manifest: ToolManifest = {
      id: toolName,
      service: 'test',
      streamingSupported: true,
      category: 'project_management',
      priority: 'high',
      description: 'Test streaming tool',
      estimatedDuration: 3000,
      streamingConfig: {
        type: 'progress',
        progressSteps: [
          'Initializing test',
          'Processing data',
          'Validating results',
          'Completing operation',
        ],
        supportsPartialResults: true,
      },
    };

    // Create mock client and streaming wrapper
    const mockClient = new MockMCPClient();
    const streamingWrapper = new StreamingMCPWrapper(mockClient, manifest);

    // Execute streaming
    const response = await streamingWrapper.executeStreaming({
      toolName,
      arguments: body.arguments || {},
      streamingOptions: {
        enableProgress: true,
        enableStatusUpdates: true,
      },
    });

    // Create Server-Sent Events stream
    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const event of response.stream) {
            const eventData = JSON.stringify(event, null, 2);
            const sseData = `data: ${eventData}\n\n`;

            controller.enqueue(encoder.encode(sseData));

            // Small delay for visible streaming
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (error) {
          const errorEvent = {
            type: 'error',
            timestamp: new Date(),
            toolName,
            requestId: response.requestId,
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              recoverable: false,
            },
          };

          const eventData = JSON.stringify(errorEvent);
          const sseData = `data: ${eventData}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * Get test info
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ready',
      message: 'MCP Streaming test endpoint',
      usage: {
        post: 'Send { "toolName": "test_tool", "arguments": {} } to test streaming',
        response: 'Server-Sent Events with streaming progress',
      },
      example: {
        curl: 'curl -X POST http://localhost:3000/api/test-mcp-streaming -H "Content-Type: application/json" -d \'{"toolName":"test_progress"}\' --no-buffer',
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
