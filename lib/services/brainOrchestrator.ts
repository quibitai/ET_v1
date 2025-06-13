import type { BrainRequest } from '@/lib/validation/brainValidation';
import type { ClientConfig } from '@/lib/db/queries';
import type { RequestLogger } from './observabilityService';
import { QueryClassifier } from './queryClassifier';
import { VercelAIService } from './vercelAIService';
import { MessageService } from './messageService';
import { ContextService } from './contextService';
import {
  createLangChainAgent,
  streamLangChainAgent,
  type LangChainBridgeConfig,
} from './langchainBridge';
import { loadPrompt } from '@/lib/ai/prompts/loader';
import { ChatRepository } from '@/lib/db/repositories/chatRepository';
import { auth } from '@/app/(auth)/auth';

export class BrainOrchestrator {
  private logger: RequestLogger;
  private queryClassifier: QueryClassifier;
  private messageService: MessageService;
  private contextService: ContextService;
  private chatRepository: ChatRepository;

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.queryClassifier = new QueryClassifier(logger);
    this.messageService = new MessageService(logger);
    this.contextService = new ContextService(logger);
    this.chatRepository = new ChatRepository();
  }

  /**
   * This is the single entry point for processing and streaming a request.
   * It creates a stream, starts the processing in the background,
   * and immediately returns the readable part of the stream.
   */
  public stream(
    request: BrainRequest,
    config: ClientConfig | null,
    headers: Headers,
  ): ReadableStream {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    let streamClosed = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Helper to safely close the stream
    const safeCloseStream = async (reason?: string) => {
      if (streamClosed) return;
      streamClosed = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      try {
        this.logger.info('Closing stream writer', { reason });

        // Ensure any pending writes are flushed before closing
        if (!writer.closed) {
          // Add a small delay to ensure all data is flushed
          await new Promise((resolve) => setTimeout(resolve, 10));
          await writer.close();
          this.logger.info('Stream writer closed successfully');
        }
      } catch (error) {
        this.logger.warn('Error closing stream writer', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    // Helper to safely write to stream
    const safeWrite = async (chunk: Uint8Array): Promise<boolean> => {
      if (streamClosed) return false;
      try {
        await writer.write(chunk);
        return true;
      } catch (error) {
        this.logger.error('Error writing to stream', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await safeCloseStream('write error');
        return false;
      }
    };

    // Helper to safely pipe a response stream
    const safePipeResponse = async (response: Response): Promise<void> => {
      if (!response.body) {
        this.logger.warn('Response has no body to pipe');
        return;
      }

      try {
        const reader = response.body.getReader();
        // *** NEW: Add a timeout mechanism ***
        let pipeTimeoutId: NodeJS.Timeout | null = null;
        const streamTimeout = new Promise<void>((_, reject) => {
          pipeTimeoutId = setTimeout(() => {
            this.logger.warn(
              'Stream piping timed out after 5 seconds of inactivity.',
            );
            reject(new Error('Stream pipe timeout'));
          }, 5000); // 5-second timeout
        });

        const readLoop = async () => {
          while (!streamClosed) {
            const { done, value } = await reader.read();

            // NEW: Clear timeout on activity
            if (pipeTimeoutId) clearTimeout(pipeTimeoutId);

            if (done) {
              this.logger.info('Source stream completed');
              break;
            }

            if (value) {
              const success = await safeWrite(value);
              if (!success) {
                this.logger.warn('Failed to write chunk, stopping pipe');
                break;
              }
              // NEW: Reset timeout after successful write
              pipeTimeoutId = setTimeout(() => {
                this.logger.warn(
                  'Stream piping timed out after 5 seconds of inactivity.',
                );
                // Don't reject here, just break the loop
                if (reader) reader.releaseLock();
              }, 5000);
            }
          }
        };

        // This will now either complete or time out.
        await Promise.race([readLoop(), streamTimeout]);

        // NEW: Final cleanup of timeout
        if (pipeTimeoutId) {
          clearTimeout(pipeTimeoutId);
        }

        reader.releaseLock();
      } catch (error) {
        this.logger.error('Error during stream piping', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Do not re-throw, allow the finally block to run
      }
    };

    // Set up timeout protection (30 seconds)
    timeoutId = setTimeout(() => {
      this.logger.warn('Stream processing timeout reached');
      safeCloseStream('timeout');
    }, 30000);

    // We define the async work but start it without awaiting
    const runAsync = async () => {
      try {
        this.logger.info('Brain orchestrator async process starting...');

        // Validate required fields
        if (!request.chatId) {
          throw new Error('Chat ID is required but was not provided.');
        }

        // Ensure the chat record exists before processing messages
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error(
            'User session or user ID not found. Cannot process request.',
          );
        }
        const clientId = session?.user?.clientId || 'default';

        const existingChat = await this.chatRepository.findById(request.chatId);

        if (!existingChat) {
          this.logger.info(
            `Chat with ID ${request.chatId} not found. Creating new chat.`,
          );
          const firstUserMessage = request.messages.find(
            (m) => m.role === 'user',
          )?.content;

          await this.chatRepository.createChat(
            {
              id: request.chatId,
              userId: userId,
              title:
                typeof firstUserMessage === 'string'
                  ? firstUserMessage.substring(0, 100)
                  : 'New Chat',
              createdAt: new Date(),
              bitContextId: request.activeBitContextId,
              clientId: clientId,
            },
            [], // Start with no messages; they will be saved later
          );
          this.logger.info(`Successfully created chat ${request.chatId}`);
        }

        // Save user messages before processing
        const userMessages = request.messages.filter((m) => m.role === 'user');
        if (userMessages.length > 0) {
          try {
            await this.messageService.saveUserMessages(
              userMessages,
              request.chatId,
              clientId,
            );
            this.logger.info('User messages saved successfully', {
              messageCount: userMessages.length,
              chatId: request.chatId,
            });
          } catch (error) {
            this.logger.error('Failed to save user messages', {
              error: error instanceof Error ? error.message : 'Unknown error',
              chatId: request.chatId,
            });
            // Continue processing even if message saving fails
          }
        }

        // Extract user input for classification
        const userInput = this.messageService.extractUserInput(request);

        // Classify the query
        const classification =
          await this.queryClassifier.classifyQuery(userInput);

        this.logger.info('Query classification completed', {
          shouldUseLangChain: classification.shouldUseLangChain,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        });

        if (classification.shouldUseLangChain) {
          this.logger.info('Routing to LangChain path');

          // Process context for LangChain
          const context = await this.contextService.processContext(request);
          const conversationHistory =
            this.messageService.convertToLangChainFormat(request.messages);

          // Set up LangChain configuration
          const langchainConfig: LangChainBridgeConfig = {
            selectedChatModel: request.selectedChatModel || 'gpt-4.1',
            contextId: request.activeBitContextId,
            clientConfig: config,
            enableToolExecution: true,
            maxIterations: 10,
            verbose: false,
            enableLangGraph: true,
            forceToolCall: classification.forceToolCall || null,
          };

          // Get system prompt
          const systemPrompt = await loadPrompt({
            modelId: request.selectedChatModel || 'gpt-4.1',
            contextId: request.activeBitContextId || null,
            clientConfig: config,
          });

          // Create LangChain agent
          const langchainAgent = await createLangChainAgent(
            systemPrompt,
            langchainConfig,
            this.logger,
          );

          // Stream the agent execution
          const response = await streamLangChainAgent(
            langchainAgent,
            userInput,
            conversationHistory,
            langchainConfig,
            this.logger,
            null, // artifact context
            request, // brainRequest for message saving
          );

          // Pipe the response using our safe piping method
          await safePipeResponse(response);
        } else {
          this.logger.info('Routing to simple Vercel AI path');

          const vercelAIService = new VercelAIService(this.logger, {
            clientConfig: config,
            contextId: request.activeBitContextId,
          });

          // Process context for Vercel AI
          const context = await this.contextService.processContext(request);
          const conversationHistory =
            this.messageService.convertToLangChainFormat(request.messages);

          // Get system prompt for Vercel AI
          const systemPrompt = await loadPrompt({
            modelId: request.selectedChatModel || 'gpt-4.1',
            contextId: request.activeBitContextId || null,
            clientConfig: config,
          });

          // Stream the Vercel AI response
          const response = await vercelAIService.streamQuery(
            systemPrompt,
            userInput,
            conversationHistory,
            request,
          );

          // Pipe the response using our safe piping method
          await safePipeResponse(response);
        }

        this.logger.info('Async processing completed successfully.');
      } catch (error) {
        this.logger.error('Error during async brain processing', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Write error to stream if still open
        if (!streamClosed) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred';
          const errorChunk = `0:${JSON.stringify(`Error: ${errorMessage}`)}\n`;
          await safeWrite(new TextEncoder().encode(errorChunk));
        }
      } finally {
        // Stream termination is handled by the underlying services
        this.logger.info('Stream processing completed, closing stream');

        await safeCloseStream('processing complete');
      }
    };

    // Start the process
    runAsync().catch((error) => {
      this.logger.error('Unhandled error in async processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      safeCloseStream('unhandled error');
    });

    // Return the readable stream immediately
    return stream.readable;
  }
}
