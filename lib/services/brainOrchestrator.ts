import type { RequestLogger } from '@/lib/services/observabilityService';
import type {
  MessageData,
  BrainRequest,
} from '@/lib/validation/brainValidation';
import { MessageService } from '@/lib/services/messageService';
import { ChatRepository } from '@/lib/db/repositories/chatRepository';
import { ContextService } from '@/lib/services/contextService';
import { ToolLoader } from '@/lib/ai/tools/registry/ToolLoader';
import type { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import { createToolRouterGraph } from '@/lib/ai/graphs/ToolRouterGraph';
import { createMCPClient } from '@/lib/ai/mcp';
import { auth } from '@/app/(auth)/auth';
import { ContextWindowManager } from '@/lib/ai/core/contextWindowManager';

export class BrainOrchestrator {
  private logger: RequestLogger;
  private messageService: MessageService;
  private chatRepository: ChatRepository;
  private contextService: ContextService;
  private mcpClient: any = null; // Will be initialized on first use

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.messageService = new MessageService(logger);
    this.chatRepository = new ChatRepository();
    this.contextService = new ContextService(
      logger,
      null, // clientConfig will be set when processing
      { enableMemory: true, maxMemoryDepth: 10 },
    );
  }

  /**
   * Initialize MCP client for dynamic tool discovery
   */
  private async initializeMCPClient(): Promise<void> {
    if (this.mcpClient) return; // Already initialized

    try {
      this.logger.info(
        '[BrainOrchestrator] Initializing MCP client for dynamic tool discovery...',
      );

      // Create MCP client with auto-discovery enabled
      this.mcpClient = await createMCPClient({
        autoDiscovery: true,
        healthCheckInterval: 60000,
      });

      this.logger.info(
        '[BrainOrchestrator] MCP client initialized successfully',
        {
          availableServices: this.mcpClient
            .getServiceStatus()
            .map((s: any) => ({
              name: s.name,
              available: s.available,
              toolCount: s.supportedTools?.length || 0,
            })),
        },
      );
    } catch (error) {
      this.logger.error('[BrainOrchestrator] Failed to initialize MCP client', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without MCP - system will work with standard tools only
      this.mcpClient = null;
    }
  }

  /**
   * CRITICAL: Analyze query intent to prevent tool selection confusion
   * This determines whether a query is for internal knowledge base or external content
   */
  private analyzeQueryIntent(
    userQuery: string,
  ): 'INTERNAL_KNOWLEDGE_BASE' | 'EXTERNAL_RESEARCH' | 'MIXED' {
    const queryLower = userQuery.toLowerCase();

    // Internal knowledge base indicators (highest priority)
    const internalIndicators = [
      'echo tango',
      'core values',
      'our company',
      'our values',
      'company values',
      'internal',
      'knowledge base',
      'document',
      'file contents',
      'complete contents',
      'full content',
    ];

    // External research indicators
    const externalIndicators = [
      'research',
      'current',
      'latest',
      'news',
      'market',
      'competitor',
      'industry',
      'external',
      'public',
    ];

    const hasInternal = internalIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );

    const hasExternal = externalIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );

    if (hasInternal && !hasExternal) {
      return 'INTERNAL_KNOWLEDGE_BASE';
    } else if (hasExternal && !hasInternal) {
      return 'EXTERNAL_RESEARCH';
    } else if (hasInternal && hasExternal) {
      return 'MIXED';
    } else {
      // Default to internal for document-related queries
      if (
        queryLower.includes('document') ||
        queryLower.includes('file') ||
        queryLower.includes('content')
      ) {
        return 'INTERNAL_KNOWLEDGE_BASE';
      }
      return 'MIXED';
    }
  }

  /**
   * CRITICAL: Apply contextual tool filtering to prevent Google Workspace vs Knowledge Base confusion
   * This is the core fix for the tool selection issue
   */
  private applyContextualToolFiltering(userQuery: string, tools: any[]): any[] {
    const queryIntent = this.analyzeQueryIntent(userQuery);

    this.logger.info('🎯 CONTEXTUAL TOOL FILTERING APPLIED', {
      queryType: queryIntent,
      originalToolCount: tools.length,
      userQuery: userQuery.substring(0, 100),
    });

    // For internal knowledge base queries, exclude conflicting Google Workspace document tools
    if (queryIntent === 'INTERNAL_KNOWLEDGE_BASE') {
      const conflictingGoogleTools = [
        'get_docs_content',
        'search_docs',
        'list_docs',
        'get_drive_file_content',
        'search_drive_files',
        'list_drive_items',
      ];

      const filteredTools = tools.filter(
        (tool) => !conflictingGoogleTools.includes(tool.name),
      );

      const removedTools = tools.filter((tool) =>
        conflictingGoogleTools.includes(tool.name),
      );

      this.logger.info('🚫 FILTERED CONFLICTING GOOGLE WORKSPACE TOOLS', {
        queryType: queryIntent,
        originalToolCount: tools.length,
        filteredToolCount: filteredTools.length,
        removedToolCount: removedTools.length,
        removedToolNames: removedTools.map((t) => t.name),
        retainedKnowledgeBaseTools: filteredTools
          .filter((t) =>
            [
              'listDocuments',
              'getDocumentContents',
              'searchInternalKnowledgeBase',
            ].includes(t.name),
          )
          .map((t) => t.name),
      });

      return filteredTools;
    }

    // For external research queries, keep all tools
    if (queryIntent === 'EXTERNAL_RESEARCH') {
      this.logger.info('🌐 EXTERNAL RESEARCH QUERY - KEEPING ALL TOOLS', {
        queryType: queryIntent,
        toolCount: tools.length,
      });
      return tools;
    }

    // For mixed queries, keep all tools but log the decision
    this.logger.info('🔄 MIXED QUERY - KEEPING ALL TOOLS', {
      queryType: queryIntent,
      toolCount: tools.length,
    });
    return tools;
  }

  /**
   * Extract the current user query from messages
   */
  private extractUserQuery(messages: any[]): string {
    // Find the last human message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message._getType && message._getType() === 'human') {
        return message.content || '';
      }
      if (message.role === 'user') {
        return message.content || '';
      }
      if (message.constructor.name === 'HumanMessage') {
        return message.content || '';
      }
    }
    return '';
  }

  /**
   * Get tools using unified registry with proper schema conversion
   */
  private async getToolsForSession(session: any): Promise<any[]> {
    try {
      this.logger.info(
        '[BrainOrchestrator] Attempting to load unified tool registry',
      );

      // Use the unified tool registry that works correctly
      const toolLoader = ToolLoader.getInstance();
      await toolLoader.initialize();

      this.logger.info(
        '[BrainOrchestrator] ToolLoader initialized, getting tools for context',
      );

      const registryTools = await toolLoader.getToolsForContext({
        user: session?.user
          ? {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
            }
          : undefined,
      });

      this.logger.info('[BrainOrchestrator] Registry tools loaded', {
        toolCount: registryTools.length,
        toolNames: registryTools.map((t) => t.name),
      });

      // Convert all tools with proper schema handling
      this.logger.info(
        '[BrainOrchestrator] Converting all tools with OpenAI-compatible schemas',
        {
          toolCount: registryTools.length,
          toolNames: registryTools.map((t) => t.name),
        },
      );

      // Convert unified tools to DynamicStructuredTool format with OpenAI-compatible schemas
      const { DynamicStructuredTool } = await import('@langchain/core/tools');
      const { z } = await import('zod');

      // Use all tools with proper OpenAI-compatible schema conversion
      this.logger.info(
        '[BrainOrchestrator] Converting all tools with OpenAI-compatible schemas',
        {
          toolCount: registryTools.length,
          toolNames: registryTools.map((t) => t.name),
        },
      );

      const convertedTools = registryTools.map((tool) => {
        // Build OpenAI-compatible schema with proper parameter handling
        const schemaFields: Record<string, any> = {};

        // Convert all parameters using OpenAI-compatible patterns
        if (tool.parameters && tool.parameters.length > 0) {
          for (const param of tool.parameters) {
            let fieldSchema: any;

            // Use proper OpenAI-compatible patterns based on parameter type and requirements
            switch (param.type) {
              case 'number':
                fieldSchema = param.required
                  ? z.number()
                  : z.number().nullable().optional();
                break;
              case 'boolean':
                fieldSchema = param.required
                  ? z.boolean()
                  : z.boolean().nullable().optional();
                break;
              case 'array':
                fieldSchema = param.required
                  ? z.array(z.string())
                  : z.array(z.string()).nullable().optional();
                break;
              default: // string and others
                fieldSchema = param.required
                  ? z.string()
                  : z.string().nullable().optional();
                break;
            }

            // Add description
            if (param.description) {
              fieldSchema = fieldSchema.describe(param.description);
            }

            schemaFields[param.name] = fieldSchema;
          }
        }

        const schema = z.object(schemaFields);

        return new DynamicStructuredTool({
          name: tool.name,
          description: tool.description,
          schema,
          func: async (params: Record<string, any>) => {
            try {
              const result = await tool.execute(params, {
                user: session?.user
                  ? {
                      id: session.user.id,
                      email: session.user.email,
                      name: session.user.name,
                    }
                  : undefined,
              });

              if (result.success) {
                return typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data);
              } else {
                throw new Error(result.error || 'Tool execution failed');
              }
            } catch (error) {
              throw error instanceof Error ? error : new Error(String(error));
            }
          },
        });
      });

      this.logger.info('[BrainOrchestrator] Using unified tool registry', {
        toolCount: convertedTools.length,
        toolNames: convertedTools.map((t) => t.name),
        hasListDocuments: convertedTools.some(
          (t) => t.name === 'listDocuments',
        ),
        listDocumentsTool: convertedTools.find(
          (t) => t.name === 'listDocuments',
        )
          ? 'found'
          : 'missing',
      });

      // Import enhanced tools
      const {
        enhancedListDocumentsTool,
        enhancedGetDocumentContentsTool,
        enhancedSearchKnowledgeBaseTool,
      } = await import('../ai/tools/enhanced-knowledge-tools');

      // Use enhanced tools with proper error handling
      const tools = [
        enhancedListDocumentsTool,
        enhancedGetDocumentContentsTool,
        enhancedSearchKnowledgeBaseTool,
      ];

      console.log('[BrainOrchestrator] Using enhanced tools:', {
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
      });

      return tools;
    } catch (error) {
      // Fallback to old system if unified registry fails
      this.logger.warn(
        '[BrainOrchestrator] Unified tool registry failed, falling back to old system',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      );

      // TEMPORARY: Return empty array instead of falling back to broken old system
      this.logger.info(
        '[BrainOrchestrator] TEMPORARY: Returning empty tools array instead of fallback',
      );
      return [];

      // return await getAvailableTools(session);
    }
  }

  public async *stream(
    request: BrainRequest,
    session: any,
  ): AsyncGenerator<string> {
    try {
      // PERFORMANCE OPTIMIZATION: Use enhanced context window manager
      const contextManager = new ContextWindowManager(
        {
          aggressiveOptimization: true,
          maxTokens: 12000, // Conservative for mini model
          enableAutoUpgrade: true,
        },
        this.logger,
      );

      // Load tools with simplified schema conversion
      const tools = await this.getToolsForSession(session);

      // Convert request messages to BaseMessage format for analysis
      const baseMessages = request.messages.map((msg) => ({
        _getType: () => msg.role,
        content: msg.content,
      })) as any[];

      // Get optimal model based on context analysis
      const optimalModel = contextManager.getOptimalModel(
        baseMessages,
        tools.length,
        request.selectedChatModel,
      );

      this.logger.info(
        '[BrainOrchestrator] Performance-optimized model selection',
        {
          requestedModel: request.selectedChatModel,
          optimalModel,
          toolCount: tools.length,
          messageCount: request.messages.length,
        },
      );

      // Create optimized LLM instance
      const llm = contextManager.createOptimizedLLM(
        baseMessages,
        tools.length,
        optimalModel,
        {
          temperature: 0, // Keep deterministic for consistency
        },
      );

      this.logger.info(
        '[BrainOrchestrator] Using LangGraph with real-time streaming',
        {
          model: optimalModel,
          toolCount: tools.length,
          streamingEnabled: true,
        },
      );

      const authSession = await auth();

      // Process context with conversational memory
      const processedContext =
        await this.contextService.processContext(request);

      this.logger.info(
        '[BrainOrchestrator] Context processed with memory integration',
        {
          hasConversationalMemory: !!(
            processedContext.conversationalMemory &&
            processedContext.conversationalMemory.length > 0
          ),
          memorySnippetCount:
            processedContext.conversationalMemory?.length || 0,
          hasProcessedHistory: !!(
            processedContext.processedHistory &&
            processedContext.processedHistory.length > 0
          ),
          processedHistoryCount: processedContext.processedHistory?.length || 0,
        },
      );

      // Use processed history if available, otherwise fall back to converted messages
      const messagesToUse =
        processedContext.processedHistory ||
        this.messageService.convertToLangChainFormat(
          request.messages as MessageData[],
        );

      yield* this.streamWithGraph(
        messagesToUse as BaseMessage[],
        request,
        authSession,
        llm,
        tools,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('[BrainOrchestrator] Real-time streaming error', {
        error: errorMessage,
        stack: errorStack,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });

      console.error('[BrainOrchestrator] STREAMING ERROR DETAILS:', {
        message: errorMessage,
        stack: errorStack,
        fullError: error,
      });

      yield `Error in real-time streaming: ${errorMessage}`;
    }
  }

  private async *streamWithGraph(
    messages: BaseMessage[],
    request: BrainRequest,
    session: any,
    llm: ChatOpenAI,
    tools: any[],
  ): AsyncGenerator<string> {
    try {
      // CRITICAL: Extract user query for semantic tool selection
      const userQuery = this.extractUserQuery(messages);

      // 🚀 PHASE 2 ENHANCEMENT: Initialize MCP client for dynamic tool discovery
      await this.initializeMCPClient();

      // 🚀 CRITICAL: Use MCP-aware ToolRouterGraph for dynamic tool routing
      // This implements Phase 2 MCP scaling with dynamic tool discovery
      const graph = createToolRouterGraph(llm, tools, this.mcpClient);

      this.logger.info(
        '🚀 [BrainOrchestrator] Starting MCP-aware ToolRouterGraph with dynamic routing',
        {
          totalToolCount: tools.length,
          userQuery: userQuery.substring(0, 100),
          hasMCPClient: !!this.mcpClient,
          mcpServices: this.mcpClient
            ? this.mcpClient.getServiceStatus().length
            : 0,
          note: 'Using MCP-enhanced tool router pattern with dynamic discovery',
        },
      );

      // FIXED: Process context and include fileContext in graph input
      console.log(
        '[BrainOrchestrator] DEBUG: Request before context processing:',
        {
          hasFileContext: !!request.fileContext,
          fileContextKeys: request.fileContext
            ? Object.keys(request.fileContext)
            : [],
          requestKeys: Object.keys(request),
        },
      );

      const processedContext =
        await this.contextService.processContext(request);

      console.log('[BrainOrchestrator] Context processed for graph', {
        hasFileContext: !!processedContext.fileContext,
        fileContextFilename: processedContext.fileContext?.filename,
        hasExtractedText: !!processedContext.fileContext?.extractedText,
        extractedTextLength:
          processedContext.fileContext?.extractedText?.length || 0,
      });

      this.logger.info('[BrainOrchestrator] Context processed for graph', {
        hasFileContext: !!processedContext.fileContext,
        fileContextFilename: processedContext.fileContext?.filename,
        hasExtractedText: !!processedContext.fileContext?.extractedText,
        extractedTextLength:
          processedContext.fileContext?.extractedText?.length || 0,
      });

      // Enhanced graph input with file context and processed context
      const graphInput = {
        messages: messages,
        input: userQuery, // Required by StateType
        response_mode: (request.responseMode as string) || 'synthesis',
        specialist_id: request.activeBitContextId || '', // Must be string, not undefined
        // NEW: Pass file context and processed context to graph
        metadata: {
          fileContext: processedContext.fileContext || undefined,
          brainRequest: request,
          processedContext: processedContext,
        },
      };

      this.logger.info('[BrainOrchestrator] Graph input prepared', {
        messageCount: messages.length,
        responseMode: graphInput.response_mode,
        specialistId: graphInput.specialist_id,
        hasFileContext: !!graphInput.metadata.fileContext,
        fileContextPreview: graphInput.metadata.fileContext
          ? {
              filename: graphInput.metadata.fileContext.filename,
              contentType: graphInput.metadata.fileContext.contentType,
              extractedTextLength:
                graphInput.metadata.fileContext.extractedText?.length || 0,
            }
          : null,
      });

      // 🚨 CRITICAL: Add timeout handling to prevent infinite hangs
      const STREAM_TIMEOUT = 60000; // 60 seconds timeout
      let tokenCount = 0;
      let hasYieldedContent = false;
      const startTime = Date.now();

      // Create a timeout promise that rejects after the specified time
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Graph streaming timed out after ${STREAM_TIMEOUT}ms`),
          );
        }, STREAM_TIMEOUT);
      });

      // Create an async generator that handles the streaming with timeout
      const streamWithTimeout = async function* () {
        try {
          const graphStream = graph.stream(graphInput);

          for await (const token of graphStream) {
            tokenCount++;
            hasYieldedContent = true;

            // Log progress every 50 tokens to monitor streaming performance
            if (tokenCount % 50 === 0) {
              const elapsed = Date.now() - startTime;
              const rate = ((tokenCount / elapsed) * 1000).toFixed(1);
              console.log(
                `[BrainOrchestrator] Streaming progress: ${tokenCount} tokens, ${rate} t/s`,
              );
            }

            // Yield the token directly (no more object processing)
            yield token;
          }
        } catch (error) {
          console.error('[BrainOrchestrator] Graph streaming error:', error);
          throw error;
        }
      };

      // Race the stream against the timeout
      try {
        yield* await Promise.race([streamWithTimeout(), timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          this.logger.error('[BrainOrchestrator] Stream timeout detected', {
            duration: Date.now() - startTime,
            tokenCount,
            hasYieldedContent,
            userQuery: userQuery.substring(0, 100),
          });

          yield '⚠️ **Response Timeout**\n\n';
          yield 'The system is experiencing delays. This might be due to:\n';
          yield '- Database connectivity issues\n';
          yield '- Tool execution problems\n';
          yield '- Network timeouts\n\n';
          yield 'Please try your request again. If the problem persists, contact support.\n';

          return;
        }
        throw error;
      }

      const totalTime = Date.now() - startTime;
      this.logger.info(
        '[BrainOrchestrator] Real-time streaming completed successfully',
        {
          totalTokens: tokenCount,
          duration: `${totalTime}ms`,
          avgRate: `${((tokenCount / totalTime) * 1000).toFixed(1)} t/s`,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('[BrainOrchestrator] Real-time streaming error', {
        error: errorMessage,
        stack: errorStack,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });

      console.error('[BrainOrchestrator] STREAMING ERROR DETAILS:', {
        message: errorMessage,
        stack: errorStack,
        fullError: error,
      });

      yield `Error in real-time streaming: ${errorMessage}`;
    }
  }

  /**
   * CRITICAL: Apply AGGRESSIVE semantic tool filtering
   * This implements LangGraph best practices for handling large numbers of tools
   * Reduces 50+ tools to 5-8 most relevant tools using semantic search + contextual rules
   */
  private async applySemanticToolFiltering(
    userQuery: string,
    tools: any[],
  ): Promise<any[]> {
    this.logger.info(
      `🔍 [BrainOrchestrator] Starting semantic tool filtering for query: "${userQuery.substring(0, 100)}"`,
    );

    // Step 1: Analyze query intent
    const queryIntent = this.analyzeQueryIntent(userQuery);
    this.logger.info(`🧠 [BrainOrchestrator] Query intent: ${queryIntent}`);

    // Step 2: Apply contextual filtering to remove conflicting tools
    const filteredTools = this.applyContextualToolFiltering(userQuery, tools);

    // Step 3: Apply semantic scoring to rank remaining tools
    const scoredTools = await this.scoreToolsSemanticly(
      userQuery,
      filteredTools,
    );

    // Step 4: Select top 6-8 tools (LangGraph best practice)
    const selectedTools = scoredTools.slice(0, 8);

    // Step 5: Ensure essential tools are present
    const finalTools = this.ensureEssentialToolsPresent(
      queryIntent,
      selectedTools,
      filteredTools,
    );

    this.logger.info(
      `✅ [BrainOrchestrator] Semantic filtering complete: ${tools.length} → ${finalTools.length} tools`,
    );
    finalTools.forEach((tool, idx) => {
      this.logger.info(
        `   ${idx + 1}. ${tool.name} (${this.getToolCategory(tool.name)})`,
      );
    });

    return finalTools;
  }

  /**
   * Score tools semantically based on query relevance
   */
  private async scoreToolsSemanticly(
    userQuery: string,
    tools: any[],
  ): Promise<any[]> {
    const queryLower = userQuery.toLowerCase();

    // Simple semantic scoring based on keyword matching and tool purpose
    const scoredTools = tools.map((tool) => {
      let score = 0;
      const toolName = tool.name.toLowerCase();
      const toolDesc = tool.description?.toLowerCase() || '';

      // Keyword matching
      const queryWords = queryLower
        .split(' ')
        .filter((word) => word.length > 2);
      queryWords.forEach((word) => {
        if (toolName.includes(word)) score += 3;
        if (toolDesc.includes(word)) score += 2;
      });

      // Query intent matching
      if (
        queryLower.includes('complete contents') ||
        queryLower.includes('full text')
      ) {
        if (toolName.includes('getdocument') || toolName.includes('contents'))
          score += 5;
      }

      if (queryLower.includes('list') || queryLower.includes('find')) {
        if (toolName.includes('list') || toolName.includes('search'))
          score += 3;
      }

      if (
        queryLower.includes('echo tango') ||
        queryLower.includes('core values')
      ) {
        if (
          toolName.includes('document') ||
          toolName.includes('knowledge') ||
          toolName.includes('internal')
        )
          score += 4;
        if (
          toolName.includes('google') ||
          toolName.includes('gmail') ||
          toolName.includes('sheets')
        )
          score -= 10; // Penalize wrong tools
      }

      return { tool, score };
    });

    // Sort by score (highest first)
    return scoredTools
      .sort((a, b) => b.score - a.score)
      .map((item) => item.tool);
  }

  /**
   * Ensure essential tools are present based on query intent
   */
  private ensureEssentialToolsPresent(
    queryIntent: string,
    selectedTools: any[],
    allFilteredTools: any[],
  ): any[] {
    const selectedToolNames = selectedTools.map((t) => t.name);
    const result = [...selectedTools];

    if (queryIntent === 'INTERNAL_KNOWLEDGE_BASE') {
      const essentialTools = [
        'listDocuments',
        'getDocumentContents',
        'searchInternalKnowledgeBase',
      ];

      for (const essentialName of essentialTools) {
        if (!selectedToolNames.includes(essentialName)) {
          const essentialTool = allFilteredTools.find(
            (t) => t.name === essentialName,
          );
          if (essentialTool && result.length < 8) {
            result.unshift(essentialTool); // Add to beginning
            this.logger.info(
              `➕ [BrainOrchestrator] Added essential tool: ${essentialName}`,
            );
          }
        }
      }
    }

    return result.slice(0, 8); // Keep max 8 tools
  }

  /**
   * Get tool category for logging
   */
  private getToolCategory(toolName: string): string {
    if (
      toolName.includes('list') ||
      toolName.includes('Document') ||
      toolName.includes('searchInternal')
    ) {
      return 'KNOWLEDGE_BASE';
    }
    if (
      toolName.includes('gmail') ||
      toolName.includes('sheets') ||
      toolName.includes('docs') ||
      toolName.includes('drive')
    ) {
      return 'GOOGLE_WORKSPACE';
    }
    if (
      toolName.includes('asana') ||
      toolName.includes('task') ||
      toolName.includes('project')
    ) {
      return 'PROJECT_MANAGEMENT';
    }
    if (
      toolName.includes('tavily') ||
      toolName.includes('search') ||
      toolName.includes('research')
    ) {
      return 'RESEARCH';
    }
    return 'UTILITY';
  }
}
