import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createMCPClient } from '@/lib/ai/mcp';
import { StreamingMCPWrapper } from '@/lib/ai/mcp/streaming/StreamingMCPWrapper';
import { ToolRegistry } from '@/lib/ai/tools/registry/ToolRegistry';
import type { StreamingToolRequest } from '@/lib/ai/mcp/streaming/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StreamingRequestSchema = z.object({
  toolName: z.string(),
  arguments: z.record(z.any()).optional(),
  streamingOptions: z
    .object({
      enableProgress: z.boolean().optional(),
      enableIncrementalData: z.boolean().optional(),
      enableStatusUpdates: z.boolean().optional(),
      chunkSize: z.number().optional(),
    })
    .optional(),
});

/**
 * MCP Tool Streaming Endpoint
 *
 * Provides Server-Sent Events streaming for MCP tools that support it.
 * This is separate from the main chat streaming to avoid conflicts.
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

    // Parse and validate request
    const body = await req.json();
    const validationResult = StreamingRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: validationResult.error.flatten(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const request: StreamingToolRequest = validationResult.data;

    // Get MCP client and tool registry
    const mcpClient = await createMCPClient({
      autoDiscovery: true,
    });

    const toolRegistry = new ToolRegistry();
    const manifest = await toolRegistry.getToolManifest(request.toolName);

    // Check if tool supports streaming
    if (!manifest?.streamingSupported) {
      return new Response(
        JSON.stringify({
          error: 'Tool does not support streaming',
          toolName: request.toolName,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Get the appropriate service client
    const serviceName = manifest.service;
    const serviceClient = mcpClient.getService(serviceName);

    if (!serviceClient) {
      return new Response(
        JSON.stringify({
          error: 'Service not available',
          service: serviceName,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Create streaming wrapper
    const streamingWrapper = new StreamingMCPWrapper(serviceClient, manifest);

    // Execute streaming tool
    const streamingResponse = await streamingWrapper.executeStreaming(request);

    // Create Server-Sent Events stream
    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const event of streamingResponse.stream) {
            // Format as Server-Sent Event
            const eventData = JSON.stringify(event);
            const sseData = `data: ${eventData}\n\n`;

            controller.enqueue(encoder.encode(sseData));

            // Small delay to ensure proper streaming
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          // Send error event
          const errorEvent = {
            type: 'error',
            timestamp: new Date(),
            toolName: request.toolName,
            requestId: streamingResponse.requestId,
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
 * Get available streaming tools
 */
export async function GET() {
  try {
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

    const toolRegistry = new ToolRegistry();
    const streamingTools = await toolRegistry.getStreamingTools();

    return new Response(
      JSON.stringify({
        streamingTools,
        count: streamingTools.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
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
