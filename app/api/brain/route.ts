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
import { brainRequestSchema } from '@/lib/validation/brainValidation';
import { BrainOrchestrator } from '@/lib/services/brainOrchestrator';
import { getRequestLogger } from '@/lib/services/observabilityService';
import { getClientConfig } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { MessageService } from '@/lib/services/messageService';
import { randomUUID } from 'node:crypto';
import type { DBMessage } from '@/lib/db/schema';

// Force Node.js runtime for this route to avoid Edge Runtime issues with auth
export const runtime = 'nodejs';

/**
 * Main POST handler - Clean hybrid implementation with assistant message saving
 */
export async function POST(req: NextRequest) {
  const logger = getRequestLogger(req);

  try {
    console.log('[BRAIN API] Request received');

    // Validate request body
    const body = await req.json();
    console.log('[BRAIN API] Body parsed, validating...');

    const validationResult = brainRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('[BRAIN API] Validation failed:', validationResult.error);
      return new Response(
        JSON.stringify({
          error: 'Invalid request format',
          details: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('[BRAIN API] Validation passed, extracting request data...');
    const request = validationResult.data;

    // DEBUG: Log fileContext information
    console.log('[BRAIN API] Request analysis:', {
      hasFileContext: !!request.fileContext,
      fileContextKeys: request.fileContext
        ? Object.keys(request.fileContext)
        : [],
      fileContextPreview: request.fileContext
        ? {
            filename: request.fileContext.filename,
            contentType: request.fileContext.contentType,
            hasExtractedText: !!request.fileContext.extractedText,
            extractedTextLength: request.fileContext.extractedText?.length || 0,
          }
        : null,
      messageCount: request.messages?.length || 0,
      chatId: request.chatId || request.id,
    });

    console.log('[BRAIN API] Getting session...');
    const session = await auth();
    console.log('[BRAIN API] Session obtained:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      clientId: session?.user?.clientId || 'none',
    });

    console.log('[BRAIN API] Getting client config...');
    const clientConfig = await getClientConfig(
      session?.user?.clientId || 'default',
    );
    console.log('[BRAIN API] Client config obtained:', {
      hasConfig: !!clientConfig,
    });

    console.log('[BRAIN API] Creating orchestrator...');
    const orchestrator = new BrainOrchestrator(logger);
    console.log('[BRAIN API] Creating message service...');
    const messageService = new MessageService(logger);

    // Get the raw stream from our refactored orchestrator
    console.log('[BRAIN API] Starting orchestrator stream...');
    const rawStreamPromise = orchestrator.stream(request, session);

    // Create optimized streaming response for real-time character streaming
    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let assistantContent = ''; // Capture ONLY the actual AI response content
        let chunkIndex = 0;

        try {
          console.log('[BRAIN API] Awaiting orchestrator stream...');
          const rawStream = await rawStreamPromise;
          console.log(
            '[BRAIN API] Orchestrator stream obtained, starting iteration...',
          );

          for await (const chunk of rawStream) {
            chunkIndex++;

            // Our orchestrator returns strings directly
            const text = String(chunk);

            // FIXED: Separate progress indicators from actual content
            const isProgressIndicator =
              text.includes('📚') ||
              text.includes('📄') ||
              text.includes('🔍') ||
              text.includes('Retrieving documents') ||
              text.includes('Loading document content') ||
              text.includes('Searching');

            // REDUCED LOGGING: Only log significant chunks or errors
            if (chunkIndex % 50 === 0 || text.length > 200) {
              console.log(
                `[BRAIN API] Stream progress: chunk ${chunkIndex}, ${text.length} chars`,
              );
            }

            // Only accumulate actual AI response content (NOT progress indicators)
            if (!isProgressIndicator) {
              assistantContent += text;
            }

            // Format as data stream part with proper JSON escaping (RESTORED ORIGINAL)
            const escapedText = JSON.stringify(text).slice(1, -1); // Remove outer quotes from JSON.stringify
            const dataStreamPart = `0:"${escapedText}"\n`;
            controller.enqueue(encoder.encode(dataStreamPart));

            // CRITICAL: Add small delay to ensure visible streaming
            // This prevents chunks from being batched together
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          console.log(
            `[BRAIN API] Stream completed: ${chunkIndex} chunks, ${assistantContent.length} chars`,
          );

          // PERFORMANCE FIX: Make database operations asynchronous to avoid blocking response
          // This allows the frontend to become responsive immediately after streaming completes
          if (
            assistantContent.trim() &&
            request.chatId &&
            session?.user?.clientId
          ) {
            // Fire and forget - don't await these operations
            setImmediate(async () => {
              try {
                console.log('[BRAIN API] Starting async message save...');

                // Type guard to ensure required values are available
                const chatId = request.chatId;
                const userId = session?.user?.id;
                const clientId = session?.user?.clientId;

                if (!chatId || !userId || !clientId) {
                  console.log(
                    '[BRAIN API] Skipping message save - missing required IDs',
                  );
                  return;
                }

                // Ensure the chat exists before saving messages
                const { ensureChatExists, saveMessagesWithMemory } =
                  await import('@/lib/db/queries');

                // Extract user's first message for intelligent title generation
                let firstUserMessage = '';
                if (request.messages?.length) {
                  const userMessage = request.messages.find(
                    (msg) => msg.role === 'user',
                  );
                  if (userMessage?.content) {
                    firstUserMessage = userMessage.content.trim();
                  }
                }

                // Create chat if it doesn't exist with intelligent title
                await ensureChatExists({
                  chatId: chatId,
                  userId: userId,
                  bitContextId: request.activeBitContextId || null,
                  clientId: clientId,
                  userMessage: firstUserMessage,
                });

                // Save all user messages first
                const userMessages: DBMessage[] = [];
                if (request.messages?.length) {
                  for (const msg of request.messages) {
                    if (msg.role === 'user') {
                      userMessages.push({
                        id: randomUUID(),
                        chatId: chatId,
                        role: 'user',
                        parts: [{ type: 'text', text: msg.content }],
                        attachments: [],
                        createdAt: new Date(),
                        clientId: clientId,
                      });
                    }
                  }
                }

                // Save user messages with memory storage
                if (userMessages.length > 0) {
                  await saveMessagesWithMemory({
                    messages: userMessages,
                    enableMemoryStorage: true,
                  });

                  console.log(
                    `[BRAIN API] Saved ${userMessages.length} user messages`,
                  );
                }

                // Apply hyperlink formatting to the final assistant content
                const { StandardizedResponseFormatter } = await import(
                  '@/lib/ai/services/StandardizedResponseFormatter'
                );
                const formattedContent =
                  StandardizedResponseFormatter.convertToHyperlinks(
                    assistantContent.trim(),
                  );

                console.log('[BRAIN API] Applied hyperlink formatting:', {
                  originalLength: assistantContent.trim().length,
                  formattedLength: formattedContent.length,
                  hasHyperlinks:
                    formattedContent.includes('[spaces/') ||
                    formattedContent.includes('[http') ||
                    formattedContent.includes('mailto:'),
                });

                // MEMORY FIX: Use saveMessagesWithMemory for memory storage
                const assistantMessage: DBMessage = {
                  id: randomUUID(),
                  chatId: chatId,
                  role: 'assistant',
                  parts: [{ type: 'text', text: formattedContent }],
                  attachments: [],
                  createdAt: new Date(),
                  clientId: clientId,
                };

                await saveMessagesWithMemory({
                  messages: [assistantMessage],
                  enableMemoryStorage: true,
                });

                console.log(
                  `[BRAIN API] Assistant message saved (${assistantContent.length} chars)`,
                );
              } catch (error) {
                console.error(
                  '[BRAIN API] Failed to save message:',
                  error instanceof Error ? error.message : 'Unknown error',
                );
                // Don't throw - this is fire-and-forget
              }
            });
          } else {
            console.log(
              '[BRAIN API] Skipping message save - missing required data',
            );
          }
        } catch (error) {
          console.error('[BRAIN API] Agent error:', error);
          controller.error(error);
        } finally {
          console.log('[BRAIN API] Stream closed');
          controller.close();
        }
      },
    });

    // OPTIMIZED HEADERS: Prevent all forms of buffering for real-time streaming
    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        Pragma: 'no-cache',
        Expires: '0',
        // Additional headers for aggressive anti-buffering
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Robots-Tag': 'noindex, nofollow',
        Vary: 'Accept-Encoding',
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
