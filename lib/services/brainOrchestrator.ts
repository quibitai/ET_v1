import type { BrainRequest } from '@/lib/validation/brainValidation';
import type { ClientConfig } from '@/lib/db/queries';
import type { RequestLogger } from './observabilityService';
import { QueryClassifier } from './queryClassifier';
import { MessageService } from './messageService';
import { ContextService } from './contextService';
import {
  createLangChainAgent,
  streamLangChainAgent,
  type LangChainBridgeConfig,
  type LangChainAgent,
} from './langchainBridge';
import { loadPrompt } from '@/lib/ai/prompts/loader';
import { ChatRepository } from '@/lib/db/repositories/chatRepository';
import { auth } from '@/app/(auth)/auth';
import type { ProcessedContext } from './contextService';
import type { DBMessage } from '@/lib/db/schema';
import type { ConversationalMemorySnippet } from '@/lib/contextUtils';
import type { BaseMessage } from '@langchain/core/messages';

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
   * New, simplified entry point for processing a request.
   * It determines the execution path and returns the raw, ready-to-use stream
   * from the underlying service. All manual stream plumbing is removed.
   */
  public async stream(
    request: BrainRequest,
    config: ClientConfig | null,
  ): Promise<AsyncGenerator<Uint8Array>> {
    this.logger.info('Brain orchestrator processing starting...');

    // 1. Ensure chat and user messages are saved before processing
    await this.prepareChatHistory(request);

    // 2. Classify the query to determine the execution path
    const userInput = this.messageService.extractUserInput(request);
    const classification = await this.queryClassifier.classifyQuery(userInput);

    this.logger.info('Query classification completed', {
      ...classification,
    });

    // For now, we always route to LangGraph as it's our primary execution engine.
    // This can be expanded later to support different routing decisions.
    if (classification.shouldUseLangChain) {
      this.logger.info('Routing to LangChain/LangGraph path');

      const context = await this.contextService.processContext(request);
      this.logger.info('Context processed', {
        hasFileContext: !!context.fileContext,
        fileContextFilename: context.fileContext?.filename,
      });

      const conversationHistory = await this.buildLangChainConversationHistory(
        context,
        request,
      );
      const baseSystemPrompt = await loadPrompt({
        modelId: request.selectedChatModel || 'gpt-4o',
        contextId: request.activeBitContextId || null,
        clientConfig: config,
      });

      // Enhance system prompt with context (including file context)
      const contextAdditions =
        this.contextService.createContextPromptAdditions(context);
      const systemPrompt = baseSystemPrompt + contextAdditions;

      this.logger.info('System prompt enhanced', {
        basePromptLength: baseSystemPrompt.length,
        contextAdditionsLength: contextAdditions.length,
        hasContextAdditions: contextAdditions.length > 0,
      });

      const langChainConfig: LangChainBridgeConfig = {
        contextId: request.activeBitContextId,
        clientConfig: config,
        forceToolCall: classification.forceToolCall,
        maxIterations: 10,
        verbose: true,
      };

      // Get session for MCP tool loading
      const session = await auth();

      const agent = await createLangChainAgent(
        systemPrompt,
        langChainConfig,
        this.logger,
        session, // Pass session for MCP tool loading
      );

      return streamLangChainAgent(
        agent,
        userInput,
        conversationHistory,
        this.logger,
        request,
        classification,
      );
    }

    // Fallback for non-LangChain routes if ever needed in the future
    this.logger.warn(
      'No suitable execution path found. Returning empty stream.',
    );

    // Return an empty async generator
    return this.createEmptyStream();
  }

  /**
   * Creates an empty async generator stream
   */
  private async *createEmptyStream(): AsyncGenerator<Uint8Array> {
    // This generator completes immediately without yielding anything
    // The empty body satisfies the generator requirement
    for (const _ of []) {
      yield new Uint8Array();
    }
  }

  /**
   * Ensures the chat exists and user messages are saved.
   */
  private async prepareChatHistory(request: BrainRequest): Promise<void> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error('User session or ID not found. Cannot process request.');
    }

    const chatId = request.chatId;
    if (!chatId) {
      throw new Error('Chat ID is required but was not provided.');
    }

    const existingChat = await this.chatRepository.findById(chatId);
    if (!existingChat) {
      this.logger.info(`Chat ${chatId} not found. Creating.`);
      await this.chatRepository.createChat(
        {
          id: chatId,
          userId: userId,
          title:
            this.messageService.extractUserInput(request).substring(0, 100) ||
            'New Chat',
          bitContextId: request.activeBitContextId,
          clientId: session.user.clientId || 'default',
          createdAt: new Date(),
        },
        [],
      );

      // Note: Cache invalidation is now handled client-side when new chats are created
      // Server-side cache invalidation has been removed as it was incorrectly
      // attempting to call client-side functions from the server
    }

    // Save user messages with memory
    if (request.messages && request.messages.length > 0) {
      const userMessages = request.messages.filter(
        (msg) => msg.role === 'user',
      );
      const clientId = session?.user?.clientId || 'default';

      // Save the most recent user message with memory storage
      const latestUserMessage = userMessages[userMessages.length - 1];
      if (latestUserMessage && request.chatId) {
        await this.messageService.saveUserMessage(
          latestUserMessage.content,
          request.chatId,
          clientId,
        );
      }
    }
  }

  private async buildLangChainConversationHistory(
    processedContext: ProcessedContext,
    brainRequest: BrainRequest,
  ): Promise<any[]> {
    // MEMORY INTEGRATION: Use processed history from ContextService if available
    if (
      processedContext.processedHistory &&
      processedContext.processedHistory.length > 0
    ) {
      this.logger.info('Using processed history with integrated memory', {
        historyLength: processedContext.processedHistory.length,
      });

      // Convert LangChain messages back to conversation format for consistency
      return processedContext.processedHistory.map((message) => {
        if (message._getType() === 'human') {
          return { role: 'user', content: message.content };
        } else if (message._getType() === 'ai') {
          return { role: 'assistant', content: message.content };
        } else {
          return { role: 'system', content: message.content };
        }
      });
    }

    // Fallback to original message processing if no processed history available
    if (!brainRequest.messages || brainRequest.messages.length === 0) {
      return [];
    }

    this.logger.info(
      'Using fallback message processing (no processed history)',
      {
        originalMessageCount: brainRequest.messages.length,
      },
    );

    return this.messageService.convertToLangChainFormat(brainRequest.messages);
  }
}
