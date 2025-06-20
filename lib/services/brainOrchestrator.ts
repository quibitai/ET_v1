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
import {
  PlannerService,
  type ExecutionPlan,
} from '@/lib/ai/graphs/services/PlannerService';
import { ChatOpenAI } from '@langchain/openai';
import { WorkflowSystem } from '@/lib/ai/workflows';

export class BrainOrchestrator {
  private logger: RequestLogger;
  private queryClassifier: QueryClassifier;
  private messageService: MessageService;
  private contextService: ContextService;
  private chatRepository: ChatRepository;
  private plannerService: PlannerService;
  private workflowSystem: WorkflowSystem;

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.queryClassifier = new QueryClassifier(logger);
    this.messageService = new MessageService(logger);
    this.contextService = new ContextService(logger);
    this.chatRepository = new ChatRepository();

    const planningLLM = this.getLowLatencyLLM();
    this.plannerService = new PlannerService(logger, planningLLM);
    this.workflowSystem = new WorkflowSystem((update) => {
      this.logger.info('Workflow progress update', update);
    });
  }

  /**
   * Creates a fast, low-latency LLM optimized for planning tasks
   */
  private getLowLatencyLLM(): ChatOpenAI {
    return new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0,
      maxTokens: 500,
      maxRetries: 2,
      verbose: false,
      streaming: false,
    });
  }

  /**
   * New, simplified entry point for processing a request.
   * It determines the execution path and returns the raw, ready-to-use stream
   * from the underlying service. All manual stream plumbing is removed.
   *
   * NOW ENHANCED WITH STRATEGIC PLANNING:
   * - Creates execution plan before agent execution
   * - Provides strategic context to guide agent decisions
   * - Improves tool usage efficiency and research completeness
   */
  public async stream(
    request: BrainRequest,
    config: ClientConfig | null,
  ): Promise<AsyncGenerator<Uint8Array>> {
    this.logger.info('Brain orchestrator processing starting...');

    const userInput = this.messageService.extractUserInput(request);

    const executionPlan = await this.createExecutionPlan(userInput, request);

    await this.prepareChatHistory(request);

    this.logger.info('Strategic execution plan created', {
      taskType: executionPlan.task_type,
      internalDocs: executionPlan.required_internal_documents.length,
      externalTopics: executionPlan.external_research_topics.length,
      outputFormat: executionPlan.final_output_format,
    });

    const classification = await this.queryClassifier.classifyQuery(userInput, {
      executionPlan: executionPlan,
    });

    this.logger.info('Query classification completed', {
      ...classification,
      planGuidance: `${executionPlan.task_type} task with ${executionPlan.external_research_topics.length} external topics`,
    });

    // NEW: Check for multi-step workflows
    if (
      classification.workflowDetection?.isWorkflow &&
      classification.workflowDetection.confidence >= 0.6
    ) {
      this.logger.info(
        'Multi-step workflow detected, processing via WorkflowSystem',
        {
          complexity: classification.workflowDetection.complexity,
          estimatedSteps: classification.workflowDetection.estimatedSteps,
          confidence: classification.workflowDetection.confidence,
        },
      );

      // TODO: Implement workflow streaming
      // For now, we'll fall through to LangChain which can handle multi-step operations
      // In Phase 3, we'll implement proper workflow streaming
      this.logger.info(
        'Workflow streaming not yet implemented, routing to LangChain for multi-step handling',
      );
    }

    if (classification.shouldUseLangChain) {
      this.logger.info(
        'Routing to LangChain/LangGraph path with execution plan',
      );

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
        modelId: request.selectedChatModel || 'gpt-4.1',
        contextId: request.activeBitContextId || null,
        clientConfig: config,
      });

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
        executionPlan: executionPlan,
      };

      const session = await auth();

      const agent = await createLangChainAgent(
        systemPrompt,
        langChainConfig,
        this.logger,
        session,
      );

      return streamLangChainAgent(
        agent,
        userInput,
        conversationHistory,
        this.logger,
        request,
        classification,
        executionPlan,
      );
    }

    this.logger.warn(
      'No suitable execution path found. Returning empty stream.',
    );

    return this.createEmptyStream();
  }

  private async *createEmptyStream(): AsyncGenerator<Uint8Array> {
    for (const _ of []) {
      yield new Uint8Array();
    }
  }

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
    }

    if (request.messages && request.messages.length > 0) {
      const userMessages = request.messages.filter(
        (msg) => msg.role === 'user',
      );
      const clientId = session?.user?.clientId || 'default';

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
    if (
      processedContext.processedHistory &&
      processedContext.processedHistory.length > 0
    ) {
      this.logger.info('Using processed history with integrated memory', {
        historyLength: processedContext.processedHistory.length,
      });

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

  private async createExecutionPlan(
    userInput: string,
    request: BrainRequest,
  ): Promise<ExecutionPlan> {
    try {
      const context = {
        conversationHistory:
          request.messages?.map((msg) => `${msg.role}: ${msg.content}`) || [],
        availableDocuments: await this.getAvailableDocuments(request),
      };

      const plan = await this.plannerService.createPlan(userInput, context);

      this.logger.info('Execution plan created successfully', {
        plannerMetrics: this.plannerService.getPerformanceMetrics(),
      });

      return plan;
    } catch (error) {
      this.logger.error('Failed to create execution plan, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        task_type: 'simple_qa',
        required_internal_documents: [],
        external_research_topics: [],
        final_output_format: 'direct answer',
      };
    }
  }

  private async getAvailableDocuments(
    request: BrainRequest,
  ): Promise<string[]> {
    return [
      'ideal client profile',
      'client research example',
      'proposal template',
      'brand guidelines',
      'company overview',
      'service offerings',
    ];
  }
}
