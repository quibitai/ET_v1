/**
 * BrainOrchestrator
 *
 * Unified orchestration service that intelligently routes queries between
 * LangChain (complex tool orchestration) and Vercel AI SDK (simple responses).
 * Powers both Quibit (global chat pane) and Chat Bit specialists.
 * Provides fallback mechanisms, response standardization, and comprehensive
 * error handling for the hybrid RAG system.
 *
 * Terminology:
 * - Quibit/Quibit Chat: Global chat pane orchestrator
 * - Chat Bit: Sidebar specialist chat interface
 * - Specialists: Individual AI assistants (Echo Tango, General Chat, etc.)
 * Target: ~180 lines as per roadmap specifications.
 */

import { NextRequest } from 'next/server';
import type { RequestLogger } from './observabilityService';
import {
  QueryClassifier,
  type QueryClassificationResult,
} from './queryClassifier';
import { VercelAIService, type VercelAIResult } from './vercelAIService';
import { MessageService } from './messageService';
import { ContextService, type ProcessedContext } from './contextService';
import {
  createLangChainAgent,
  streamLangChainAgent,
  cleanupLangChainAgent,
  type LangChainBridgeConfig,
  type LangChainAgent,
} from './langchainBridge';
import type { ClientConfig } from '@/lib/db/queries';
import type { BrainRequest } from '@/lib/validation/brainValidation';

// Import database utilities for chat storage
import { saveChat, saveMessages } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { randomUUID } from 'node:crypto';
import type { DBMessage } from '@/lib/db/schema';

// Import date/time and prompt loading utilities
import { DateTime } from 'luxon';
import { loadPrompt } from '@/lib/ai/prompts/loader';

// Import timezone service for proper timezone detection
import { createTimezoneService, type TimezoneInfo } from './timezoneService';

// Import document handlers for image generation support

// Add artifact context imports
import type { Session } from 'next-auth';

/**
 * Configuration for brain orchestration
 */
export interface BrainOrchestratorConfig {
  enableHybridRouting?: boolean;
  fallbackToLangChain?: boolean;
  enableFallbackOnError?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableClassification?: boolean;
  clientConfig?: ClientConfig | null;
  contextId?: string | null;
  // New LangGraph options
  enableLangGraph?: boolean;
  langGraphForComplexQueries?: boolean;
  // Add session for artifact context
  session?: Session | null;
}

/**
 * Interface for artifact context that can be passed to tools
 */
export interface ArtifactContext {
  dataStream?: any;
  session?: Session | null;
  toolInvocationsTracker?: Array<{
    type: 'tool-invocation';
    toolInvocation: {
      toolName: string;
      toolCallId: string;
      state: 'call' | 'result';
      args?: any;
      result?: any;
    };
  }>;
  cleanupTimeout?: NodeJS.Timeout;
}

/**
 * Unified response format for both execution paths
 */
export interface BrainResponse {
  success: boolean;
  content: any;
  executionPath: 'langchain' | 'vercel-ai' | 'fallback';
  classification?: QueryClassificationResult;
  performance: {
    totalTime: number;
    classificationTime?: number;
    executionTime: number;
  };
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    model: string;
    toolsUsed: string[];
    confidence?: number;
    reasoning?: string;
  };
}

/**
 * BrainOrchestrator class
 *
 * Main orchestration service for the hybrid RAG system
 */
export class BrainOrchestrator {
  private logger: RequestLogger;
  private config: BrainOrchestratorConfig;
  private queryClassifier: QueryClassifier;
  private vercelAIService: VercelAIService;
  private messageService: MessageService;
  private contextService: ContextService;
  // Store current classification for use in execution paths
  private currentClassification?: QueryClassificationResult;
  private artifactContext: ArtifactContext | null = null;

  constructor(logger: RequestLogger, config: BrainOrchestratorConfig = {}) {
    this.logger = logger;
    this.config = {
      enableHybridRouting: true,
      fallbackToLangChain: true,
      enableFallbackOnError: true,
      maxRetries: 2,
      timeoutMs: 30000,
      enableClassification: true,
      // LangGraph defaults
      enableLangGraph: true, // Enable LangGraph for tool operations and artifacts
      langGraphForComplexQueries: true,
      ...config,
    };

    // Initialize services
    this.queryClassifier = new QueryClassifier(logger, {
      clientConfig: config.clientConfig,
      contextId: config.contextId,
    });

    this.vercelAIService = new VercelAIService(logger, {
      clientConfig: config.clientConfig,
      contextId: config.contextId,
    });

    this.messageService = new MessageService(logger);
    this.contextService = new ContextService(logger, config.clientConfig);

    this.logger.info('Initializing BrainOrchestrator', {
      enableHybridRouting: this.config.enableHybridRouting,
      enableClassification: this.config.enableClassification,
      enableLangGraph: this.config.enableLangGraph,
      langGraphForComplexQueries: this.config.langGraphForComplexQueries,
      contextId: this.config.contextId,
    });
  }

  /**
   * Process a brain request with automatic orchestration
   */
  public async processRequest(brainRequest: BrainRequest): Promise<Response> {
    const startTime = performance.now();

    console.log('[DEBUG] BrainOrchestrator.processRequest called!', {
      chatId: brainRequest.chatId,
      messageCount: brainRequest.messages?.length,
      enableClassification: this.config.enableClassification,
      enableLangGraph: this.config.enableLangGraph,
    });

    try {
      // Process context and format messages
      const context = await this.contextService.processContext(brainRequest);
      const userInput = this.messageService.extractUserInput(brainRequest);
      const conversationHistory = this.messageService.convertToLangChainFormat(
        brainRequest.messages,
      );

      this.logger.info('Processing brain request', {
        userInput: userInput.substring(0, 100),
        historyCount: conversationHistory.length,
        selectedModel: context.selectedChatModel,
        contextId: context.activeBitContextId,
      });

      // Store chat and user message in database
      await this.storeChatAndUserMessage(brainRequest, userInput);

      // Determine execution path via classification
      let classification: QueryClassificationResult | undefined;
      let classificationTime = 0;

      if (this.config.enableClassification) {
        const classificationStart = performance.now();
        classification = await this.queryClassifier.classifyQuery(userInput);
        classificationTime = performance.now() - classificationStart;

        // Store classification for use in execution paths
        this.currentClassification = classification;

        this.logger.info('Query classification completed', {
          shouldUseLangChain: classification?.shouldUseLangChain,
          confidence: classification?.confidence,
          reasoning: classification?.reasoning,
          patterns: classification?.detectedPatterns,
          forceToolCall: classification?.forceToolCall,
          classificationTime: `${classificationTime.toFixed(2)}ms`,
        });
      }

      const executionStart = performance.now();
      let response: Response;

      // Execute based on classification or config
      const shouldUseLangChain =
        classification?.shouldUseLangChain ||
        (!this.config.enableClassification && this.config.enableHybridRouting);

      if (shouldUseLangChain) {
        this.logger.info('Routing to LangChain path');
        console.log('[DEBUG] About to call executeLangChainStreamingPath');
        response = await this.executeLangChainStreamingPath(
          brainRequest,
          context,
          userInput,
          conversationHistory,
        );
        console.log(
          '[DEBUG] LangChain path returned:',
          !!response,
          response?.status,
        );
      } else {
        this.logger.info('Routing to Vercel AI path');
        console.log('[DEBUG] About to call executeVercelAIStreamingPath');
        response = await this.executeVercelAIStreamingPath(
          userInput,
          conversationHistory,
          brainRequest,
          context,
        );
        console.log(
          '[DEBUG] Vercel AI path returned:',
          !!response,
          response?.status,
        );
      }

      const totalTime = performance.now() - startTime;

      this.logger.info('Brain request processing completed', {
        totalTime: `${totalTime.toFixed(2)}ms`,
        executionPath: shouldUseLangChain ? 'langchain' : 'vercel-ai',
        classification: classification?.reasoning,
      });

      return response;
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.logger.error('Brain request processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime: `${totalTime.toFixed(2)}ms`,
      });

      return this.formatErrorResponse(error, {
        totalTime,
        classificationTime: 0,
        executionTime: 0,
        executionPath: 'error',
      });
    }
  }

  /**
   * Store chat and user message in database
   */
  private async storeChatAndUserMessage(
    brainRequest: BrainRequest,
    userInput: string,
  ): Promise<void> {
    try {
      // Get authentication details
      const session = await auth();
      if (!session?.user?.id) {
        this.logger.warn('No authenticated user for chat storage');
        return;
      }

      const userId = session.user.id;
      const chatId = brainRequest.chatId || randomUUID();

      // Check if chat already exists by trying to get the last message from it
      const messages = brainRequest.messages || [];

      // Always try to create the chat - if it exists, the database will ignore it
      // This fixes the foreign key constraint issue when chats exist in frontend but not DB

      // Generate chat title from user input
      const title =
        userInput.substring(0, 100) + (userInput.length > 100 ? '...' : '');

      // Get context information from the request
      const bitContextId =
        brainRequest.activeBitContextId ||
        brainRequest.currentActiveSpecialistId ||
        null;
      const clientId = this.config.clientConfig?.id || 'default';

      this.logger.info('Ensuring chat exists in database', {
        chatId,
        userId,
        title: title.substring(0, 50),
        bitContextId,
        clientId,
      });

      // Save chat metadata with proper context (will ignore if exists)
      try {
        await saveChat({
          id: chatId,
          userId,
          title,
          bitContextId,
          clientId,
        });
        this.logger.info('Chat created or already exists', {
          chatId,
          bitContextId,
          clientId,
        });
      } catch (chatError) {
        this.logger.error('Failed to ensure chat exists', {
          chatId,
          error:
            chatError instanceof Error ? chatError.message : 'Unknown error',
        });
        // Continue even if chat creation fails
      }

      // Save user message
      const userMessage = messages[messages.length - 1]; // Last message is user input
      if (userMessage) {
        const dbMessage: DBMessage = {
          id: userMessage.id || randomUUID(),
          chatId: chatId,
          role: 'user',
          parts: [{ type: 'text', text: userInput }],
          attachments: [],
          createdAt: new Date(),
          clientId: 'default',
        };

        try {
          await saveMessages({ messages: [dbMessage] });
          this.logger.info('User message saved successfully', {
            messageId: dbMessage.id,
            chatId: dbMessage.chatId,
          });
        } catch (messageError) {
          this.logger.error('Failed to save user message', {
            messageId: dbMessage.id,
            chatId: dbMessage.chatId,
            error:
              messageError instanceof Error
                ? messageError.message
                : 'Unknown error',
          });
          // Continue even if message save fails
        }
      }
    } catch (error) {
      this.logger.error('Chat storage operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId: brainRequest.chatId || 'unknown',
      });
      // Don't throw - storage failure shouldn't break the request
    }
  }

  /**
   * Save assistant message to database
   */
  private async saveAssistantMessage(
    brainRequest: BrainRequest,
    assistantResponse: string,
    toolsUsed: string[] = [],
  ): Promise<void> {
    try {
      // Get authentication details
      const session = await auth();
      if (!session?.user?.id) {
        this.logger.warn('No authenticated user for assistant message storage');
        return;
      }

      const chatId = brainRequest.chatId || randomUUID();

      const assistantMessage: DBMessage = {
        id: randomUUID(),
        chatId: chatId,
        role: 'assistant',
        parts: [{ type: 'text', text: assistantResponse }],
        attachments: [],
        createdAt: new Date(),
        clientId: 'default',
      };

      try {
        await saveMessages({ messages: [assistantMessage] });
        this.logger.info('Assistant message saved successfully', {
          messageId: assistantMessage.id,
          chatId: assistantMessage.chatId,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          responseLength: assistantResponse.length,
        });
      } catch (messageError) {
        this.logger.error('Failed to save assistant message', {
          messageId: assistantMessage.id,
          chatId: assistantMessage.chatId,
          error:
            messageError instanceof Error
              ? messageError.message
              : 'Unknown error',
        });
      }
    } catch (error) {
      this.logger.error('Assistant message storage operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId: brainRequest.chatId || 'unknown',
      });
      // Don't throw - storage failure shouldn't break the request
    }
  }

  /**
   * Trigger chat history refresh by invalidating cache
   */
  private triggerChatHistoryRefresh(): void {
    // Use setTimeout to avoid blocking the main response
    setTimeout(async () => {
      try {
        // Make a cache-busting request to refresh chat history
        const timestamp = Date.now();
        const refreshUrl = `/api/history?type=all-specialists&limit=1&_refresh=${timestamp}`;

        this.logger.info('Triggering chat history refresh', { refreshUrl });

        // Don't await this - it's a fire-and-forget cache refresh
        fetch(refreshUrl, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }).catch((error) => {
          this.logger.warn('Chat history refresh failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      } catch (error) {
        this.logger.warn('Error triggering chat history refresh', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 100);
  }

  /**
   * Enhanced Vercel AI path with artifact context
   */
  private async executeVercelAIStreamingPath(
    userInput: string,
    conversationHistory: any[],
    brainRequest?: BrainRequest,
    context?: ProcessedContext,
  ): Promise<Response> {
    const startTime = performance.now();

    this.logger.info('Executing Vercel AI streaming path', {
      inputLength: userInput.length,
      historyLength: conversationHistory.length,
      contextId: brainRequest?.activeBitContextId,
    });

    try {
      // Set up artifact context before streaming
      const session = this.config.session;

      // Note: DataStream will be set up in the streamQuery method
      // We'll pass the setup/cleanup callbacks to handle artifact context
      this.setupArtifactContext(null, session);

      // Get system prompt based on context
      const { systemPrompt } = await this.setupPromptAndTools(
        brainRequest || ({} as BrainRequest),
        context || ({} as ProcessedContext),
        userInput,
      );

      // Use the new streamQuery method for proper streaming
      const response = await this.vercelAIService.streamQuery(
        systemPrompt,
        userInput,
        conversationHistory,
        brainRequest,
      );

      const executionTime = performance.now() - startTime;

      this.logger.info('Vercel AI streaming path completed', {
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      // Add artifact context header
      response.headers.set('X-Artifact-Context', 'enabled');

      // Clean up artifact context
      this.cleanupArtifactContext();

      return response;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      // Clean up on error
      this.cleanupArtifactContext();

      this.logger.error('Vercel AI streaming path failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      throw error;
    }
  }

  /**
   * Execute the LangChain/LangGraph path with proper streaming and artifact support
   */
  private async executeLangChainStreamingPath(
    brainRequest: BrainRequest,
    context: ProcessedContext,
    userInput: string,
    conversationHistory: any[],
  ): Promise<Response> {
    const startTime = performance.now();

    this.logger.info('Executing LangChain streaming path', {
      inputLength: userInput.length,
      historyLength: conversationHistory.length,
      contextId: brainRequest.activeBitContextId,
    });

    try {
      // Get session for context
      const session = await auth();

      this.logger.info('Setting up LangChain streaming with context', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
      });

      // Detect LangGraph patterns for complex reasoning
      const langGraphPatterns = this.detectComplexityPatterns(userInput);
      const useLangGraph =
        this.config.enableLangGraph && langGraphPatterns.length > 0;

      this.logger.info('LangChain path execution details', {
        useLangGraph,
        langGraphPatterns,
        patternCount: langGraphPatterns.length,
      });

      // Get system prompt and set up agent configuration
      const { systemPrompt } = await this.setupPromptAndTools(
        brainRequest,
        context,
        userInput,
      );

      // Configure LangChain bridge
      const langchainConfig: LangChainBridgeConfig = {
        selectedChatModel: brainRequest.selectedChatModel,
        contextId: brainRequest.activeBitContextId,
        clientConfig: this.config.clientConfig,
        enableToolExecution: true,
        maxIterations: 10,
        verbose: false,
        enableLangGraph: useLangGraph,
        langGraphPatterns,
        forceToolCall: this.currentClassification?.forceToolCall,
      };

      this.logger.info('LangChain config with tool forcing', {
        forceToolCall: this.currentClassification?.forceToolCall,
        useLangGraph,
        langGraphPatterns,
      });

      // Create LangChain agent
      const langchainAgent = await createLangChainAgent(
        systemPrompt,
        langchainConfig,
        this.logger,
      );

      // Import createDataStreamResponse to create proper streaming setup
      const { createDataStreamResponse } = await import('ai');

      const response = createDataStreamResponse({
        execute: async (dataStreamWriter) => {
          try {
            this.logger.info(
              'Setting up artifact context with real dataStreamWriter',
            );

            // Setup artifact context with the real dataStreamWriter
            this.setupArtifactContext(dataStreamWriter, session);

            // Set up safety timeout for cleanup
            const artifactContextCleanupTimeout = setTimeout(() => {
              if (global.CREATE_DOCUMENT_CONTEXT) {
                this.logger.warn(
                  'Artifact context cleanup via timeout (stream may not have completed properly)',
                );
                global.CREATE_DOCUMENT_CONTEXT = undefined;
              }
            }, 60000); // 60 second timeout

            if (this.artifactContext) {
              this.artifactContext.cleanupTimeout =
                artifactContextCleanupTimeout;
            }

            // Create response collector for saving assistant message
            const responseCollector = { fullResponse: '' };

            // Pass real context configuration
            const contextConfig = {
              dataStream: dataStreamWriter, // Real writer from createDataStreamResponse
              session: session,
              responseCollector: responseCollector,
            };

            this.logger.info('Calling streamLangChainAgent with real context', {
              hasDataStream: !!contextConfig.dataStream,
              hasSession: !!contextConfig.session,
              dataStreamMethods: Object.getOwnPropertyNames(
                Object.getPrototypeOf(contextConfig.dataStream),
              ),
            });

            // Stream the agent execution - this will internally handle the LangGraph stream
            // and doesn't return a Response (since we're already inside createDataStreamResponse)
            await streamLangChainAgent(
              langchainAgent,
              userInput,
              conversationHistory,
              langchainConfig,
              this.logger,
              undefined, // callbacks
              contextConfig,
            );

            // Save assistant message if we collected a response
            if (responseCollector.fullResponse && brainRequest.chatId) {
              try {
                await this.saveAssistantMessage(
                  brainRequest,
                  responseCollector.fullResponse,
                  [],
                );
              } catch (error) {
                this.logger.error(
                  'Failed to save LangChain assistant message',
                  {
                    chatId: brainRequest.chatId,
                    error:
                      error instanceof Error ? error.message : 'Unknown error',
                  },
                );
              }
            }

            // Cleanup resources after streaming completes
            cleanupLangChainAgent(langchainAgent, this.logger);
            this.cleanupArtifactContext();
          } catch (error) {
            this.logger.error('Error in LangChain streaming execution:', error);
            this.cleanupArtifactContext();
            throw error;
          }
        },
        onError: (error) => {
          this.logger.error('LangChain streaming path error:', error);
          this.cleanupArtifactContext();
          return error instanceof Error ? error.message : String(error);
        },
        headers: {
          'X-Execution-Path': 'langchain',
          'X-LangGraph-Enabled': String(!!useLangGraph),
          'X-Artifact-Context': 'enabled',
        },
      });

      const executionTime = performance.now() - startTime;

      this.logger.info('LangChain streaming path completed', {
        executionTime: `${executionTime.toFixed(2)}ms`,
        useLangGraph,
        patternCount: langGraphPatterns.length,
      });

      return response;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      // Clean up on error
      this.cleanupArtifactContext();

      this.logger.error('LangChain streaming path failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      throw error;
    }
  }

  /**
   * Detect patterns in user input that suggest complex reasoning needs
   */
  private detectComplexityPatterns(userInput: string): string[] {
    const patterns: string[] = [];
    const input = userInput.toLowerCase();

    // Tool operation patterns
    if (
      /(?:create|make|generate|build).+(?:task|project|document|file)/i.test(
        input,
      )
    ) {
      patterns.push('TOOL_OPERATION');
    }
    if (
      /(?:search|find|look up|retrieve|get|fetch|access).+(?:asana|google|drive|file|document|content|data|knowledge)/i.test(
        input,
      )
    ) {
      patterns.push('TOOL_OPERATION');
    }
    if (
      /(?:update|modify|change|edit).+(?:task|project|status|document|file)/i.test(
        input,
      )
    ) {
      patterns.push('TOOL_OPERATION');
    }

    // Multi-step reasoning patterns
    if (/(?:first|then|next|after|before|finally)/i.test(input)) {
      patterns.push('MULTI_STEP');
    }
    if (/(?:step \d+|phase \d+|\d+\. )/i.test(input)) {
      patterns.push('MULTI_STEP');
    }
    if (/(?:if.+then|when.+do|unless.+)/i.test(input)) {
      patterns.push('REASONING');
    }

    // Complex reasoning patterns
    if (/(?:compare|contrast|analyze|evaluate|assess)/i.test(input)) {
      patterns.push('REASONING');
    }
    if (/(?:pros and cons|advantages|disadvantages)/i.test(input)) {
      patterns.push('REASONING');
    }
    if (/(?:explain why|how does|what if|suppose that)/i.test(input)) {
      patterns.push('REASONING');
    }

    // Knowledge retrieval patterns
    if (
      /(?:complete contents|full content|entire file|all content)/i.test(input)
    ) {
      patterns.push('KNOWLEDGE_RETRIEVAL');
    }
    if (
      /(?:knowledge base|internal docs|company files|core values|policies|procedures)/i.test(
        input,
      )
    ) {
      patterns.push('KNOWLEDGE_RETRIEVAL');
    }

    return patterns;
  }

  /**
   * Format error response
   */
  private formatErrorResponse(
    error: unknown,
    performance: {
      totalTime: number;
      classificationTime?: number;
      executionTime: number;
      executionPath: string;
    },
  ): Response {
    const errorResponse: BrainResponse = {
      success: false,
      content: {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'execution_error',
      },
      executionPath: performance.executionPath as any,
      classification: undefined,
      performance: {
        totalTime: performance.totalTime,
        classificationTime: performance.classificationTime,
        executionTime: performance.executionTime,
      },
      metadata: {
        model: 'unknown',
        toolsUsed: [],
        confidence: undefined,
        reasoning: undefined,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Execution-Path': performance.executionPath,
        'X-Error': 'true',
      },
    });
  }

  /**
   * Get orchestrator metrics and status
   */
  public getStatus(): {
    hybridRouting: boolean;
    classification: boolean;
    services: {
      queryClassifier: any;
      vercelAI: any;
    };
  } {
    return {
      hybridRouting: this.config.enableHybridRouting || false,
      classification: this.config.enableClassification || false,
      services: {
        queryClassifier: this.queryClassifier.getMetrics(),
        vercelAI: this.vercelAIService.getMetrics(),
      },
    };
  }

  /**
   * Update orchestrator configuration
   */
  public updateConfig(newConfig: Partial<BrainOrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.logger.info('BrainOrchestrator configuration updated', {
      hybridRouting: this.config.enableHybridRouting,
      classification: this.config.enableClassification,
    });
  }

  /**
   * Generate enhanced date and time context with proper timezone handling
   */
  private async generateEnhancedDateTimeContext(brainRequest: any): Promise<{
    currentDateTime: string;
    userTimezone: string;
    iso: string;
    detectionMethod: string;
  }> {
    try {
      // Use timezone service for proper detection
      const timezoneService = createTimezoneService(this.logger, {
        userPreference: brainRequest.userTimezone, // Use user preference if available
        fallbackTimezone: 'UTC',
      });

      let timezoneInfo: TimezoneInfo;
      try {
        timezoneInfo = await timezoneService.detectTimezone();
      } catch (error) {
        this.logger.warn('Timezone detection failed, using UTC', { error });
        timezoneInfo = {
          timezone: 'UTC',
          offset: 0,
          isDST: false,
          displayName: 'Coordinated Universal Time',
          abbreviation: 'UTC',
          detectionMethod: 'fallback',
          confidence: 0.5,
        };
      }

      // Create date with detected timezone
      const now = DateTime.now().setZone(timezoneInfo.timezone);
      const currentDateTime = now.toFormat('MMMM d, yyyy h:mm a (ZZZZ)');
      const iso = now.toISO();

      this.logger.info('Generated current date/time context', {
        currentDateTime,
        userTimezone: timezoneInfo.timezone,
        timezoneDisplayName: timezoneInfo.displayName,
        detectionMethod: timezoneInfo.detectionMethod,
        confidence: timezoneInfo.confidence,
        iso,
      });

      return {
        currentDateTime,
        userTimezone: timezoneInfo.timezone,
        iso: iso || new Date().toISOString(),
        detectionMethod: timezoneInfo.detectionMethod,
      };
    } catch (error) {
      this.logger.error('Failed to generate date/time context', error);

      // Fallback to UTC if everything fails
      const now = DateTime.utc();
      const currentDateTime = now.toFormat('MMMM d, yyyy h:mm a (ZZZZ)');
      const iso = now.toISO();

      return {
        currentDateTime,
        userTimezone: 'UTC',
        iso: iso || new Date().toISOString(),
        detectionMethod: 'fallback',
      };
    }
  }

  /**
   * Setup system prompt and tools for execution
   */
  private async setupPromptAndTools(
    brainRequest: BrainRequest,
    context: ProcessedContext,
    userInput: string,
  ): Promise<{ systemPrompt: string }> {
    // Generate enhanced date/time context
    const dateTimeContext =
      await this.generateEnhancedDateTimeContext(brainRequest);

    // Load system prompt with date/time context
    let systemPrompt = loadPrompt({
      modelId: context.selectedChatModel || 'global-orchestrator',
      contextId: context.activeBitContextId || null,
      clientConfig: this.config.clientConfig,
      currentDateTime: dateTimeContext.currentDateTime,
    });

    // Add file context to the prompt if available
    if (brainRequest.fileContext?.extractedText) {
      const fileContextPrompt = `

UPLOADED FILE CONTENT:
====================
Filename: ${brainRequest.fileContext.filename}
Content Type: ${brainRequest.fileContext.contentType}
File URL: ${brainRequest.fileContext.url}

File Content:
${brainRequest.fileContext.extractedText}
====================

The user has uploaded the above file. You can reference this content in your response. When the user asks to "summarize this file" or similar, they are referring to this uploaded content.`;

      systemPrompt += fileContextPrompt;

      this.logger.info('Added file context to system prompt', {
        filename: brainRequest.fileContext.filename,
        contentType: brainRequest.fileContext.contentType,
        extractedTextLength: brainRequest.fileContext.extractedText.length,
      });
    }

    this.logger.info('Loaded system prompt with enhanced date/time context', {
      promptLength: systemPrompt.length,
      contextId: context.activeBitContextId,
      selectedModel: context.selectedChatModel,
      hasDateTime: systemPrompt.includes('Current date and time:'),
      hasFileContext: !!brainRequest.fileContext,
      chatInterface: context.activeBitContextId
        ? 'Chat Bit Specialist'
        : 'Quibit',
    });

    return { systemPrompt };
  }

  /**
   * Set up artifact context for tools that need streaming and session access
   */
  private setupArtifactContext(
    dataStream?: any,
    session?: Session | null,
  ): void {
    this.artifactContext = {
      dataStream,
      session,
      toolInvocationsTracker: [],
    };

    // Set global context for backward compatibility with existing tools
    global.CREATE_DOCUMENT_CONTEXT = this.artifactContext;

    this.logger.info('Artifact context initialized', {
      hasDataStream: !!dataStream,
      hasSession: !!session,
    });
  }

  /**
   * Clean up artifact context
   */
  private cleanupArtifactContext(): void {
    this.artifactContext = null;
    global.CREATE_DOCUMENT_CONTEXT = undefined;
    this.logger.info('Artifact context cleaned up');
  }
}

/**
 * Convenience functions for brain orchestration
 */

/**
 * Create a BrainOrchestrator instance with default configuration
 */
export function createBrainOrchestrator(
  logger: RequestLogger,
  config?: BrainOrchestratorConfig,
): BrainOrchestrator {
  return new BrainOrchestrator(logger, config);
}

/**
 * Process a brain request with automatic orchestration
 */
export async function processBrainRequest(
  brainRequest: BrainRequest,
  logger: RequestLogger,
  config?: BrainOrchestratorConfig,
): Promise<Response> {
  const orchestrator = createBrainOrchestrator(logger, config);
  return orchestrator.processRequest(brainRequest);
}
