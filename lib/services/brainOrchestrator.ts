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

    // We define the async work but start it without awaiting
    const runAsync = async () => {
      try {
        this.logger.info('Brain orchestrator async process starting...');

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

          // Pipe the response to our writer
          if (response.body) {
            const reader = response.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
              }
            } finally {
              reader.releaseLock();
            }
          }
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

          // Pipe the response to our writer
          if (response.body) {
            const reader = response.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
              }
            } finally {
              reader.releaseLock();
            }
          }
        }

        this.logger.info('Async processing completed successfully.');
      } catch (error) {
        this.logger.error('Error during async brain processing', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Write error to stream
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        const errorChunk = `0:${JSON.stringify(`Error: ${errorMessage}`)}\n`;
        await writer.write(new TextEncoder().encode(errorChunk));
      } finally {
        this.logger.info('Closing stream writer.');
        if (!writer.closed) {
          await writer.close();
        }
      }
    };

    // Start the process
    runAsync();

    // Return the readable stream immediately
    return stream.readable;
  }
}
