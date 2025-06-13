/**
 * Brain API Route - Day 10: Clean Hybrid Implementation
 *
 * Unified route handler using our complete service architecture:
 * - ValidationService for request validation
 * - ObservabilityService for logging and metrics
 * - BrainOrchestrator for hybrid routing (LangChain + Vercel AI SDK)
 * - ErrorService for structured error responses
 * Target: ~180 lines as per roadmap specifications.
 */

import type { NextRequest } from 'next/server';
import { BrainOrchestrator } from '@/lib/services/brainOrchestrator';
import { getRequestLogger } from '@/lib/services/observabilityService';
import { getClientConfig } from '@/lib/db/queries';
import { brainRequestSchema } from '@/lib/validation/brainValidation';
import { auth } from '@/app/(auth)/auth';
import { MessageService } from '@/lib/services/messageService';

// Removed Edge Runtime - using Node.js runtime for database compatibility
export const dynamic = 'force-dynamic';

/**
 * Main POST handler - Clean hybrid implementation with assistant message saving
 */
export async function POST(req: NextRequest) {
  const logger = getRequestLogger(req);

  try {
    logger.info('Brain API request received');
    const json = await req.json();

    const validationResult = brainRequestSchema.safeParse(json);
    if (!validationResult.success) {
      logger.warn('Invalid request body', {
        error: validationResult.error.flatten(),
      });
      return new Response(
        JSON.stringify({ errors: validationResult.error.flatten() }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const request = validationResult.data;

    const session = await auth();
    const clientConfig = await getClientConfig(
      session?.user?.clientId || 'default',
    );
    const orchestrator = new BrainOrchestrator(logger);
    const messageService = new MessageService(logger);

    // Get the raw stream from our refactored orchestrator
    const rawStreamPromise = orchestrator.stream(request, clientConfig);

    // Create proper data stream format manually for Vercel AI SDK compatibility
    // AND capture assistant response content for saving to database
    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let assistantContent = ''; // Capture the full assistant response

        try {
          const rawStream = await rawStreamPromise;
          for await (const chunk of rawStream) {
            // Convert Uint8Array chunks to text
            const text =
              chunk instanceof Uint8Array
                ? decoder.decode(chunk)
                : String(chunk);

            // Accumulate the assistant response content
            assistantContent += text;

            // Format as data stream part with proper JSON escaping
            const escapedText = JSON.stringify(text).slice(1, -1); // Remove outer quotes from JSON.stringify
            const dataStreamPart = `0:"${escapedText}"\n`;
            controller.enqueue(encoder.encode(dataStreamPart));
          }

          // After streaming completes, save the assistant message to database
          if (
            assistantContent.trim() &&
            request.chatId &&
            session?.user?.clientId
          ) {
            try {
              await messageService.saveAssistantMessage(
                assistantContent.trim(),
                request.chatId,
                session.user.clientId || 'default',
              );
              logger.info(
                'Assistant message saved successfully after streaming',
                {
                  chatId: request.chatId,
                  contentLength: assistantContent.length,
                },
              );
            } catch (error) {
              logger.error('Failed to save assistant message after streaming', {
                chatId: request.chatId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              // Don't throw - we don't want to break the response after successful streaming
            }
          }
        } catch (error) {
          logger.error('Error during stream piping', { error });
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('Unhandled error in Brain API', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return a structured error response
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      implementation: 'hybrid-v2.8.0',
      timestamp: new Date().toISOString(),
      services: {
        validation: 'active',
        orchestration: 'active',
        langchain: 'active',
        vercelAI: 'active',
        observability: 'active',
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Implementation': 'hybrid-v2.8.0',
      },
    },
  );
}
