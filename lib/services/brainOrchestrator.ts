import type {
  BrainRequest,
  MessageData,
} from '@/lib/validation/brainValidation';
import type { RequestLogger } from './observabilityService';
import { MessageService } from './messageService';
import { ChatRepository } from '@/lib/db/repositories/chatRepository';
import { auth } from '@/app/(auth)/auth';
import type { BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { getAvailableTools } from '@/lib/ai/tools';
// Use our simplified graph implementation
import { createConfiguredGraph } from '@/lib/ai/graphs';
import { ContextWindowManager } from '@/lib/ai/core/contextWindowManager';

export class BrainOrchestrator {
  private logger: RequestLogger;
  private messageService: MessageService;
  private chatRepository: ChatRepository;

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.messageService = new MessageService(logger);
    this.chatRepository = new ChatRepository();
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
      const { ToolLoader } = await import('@/lib/ai/tools/registry/ToolLoader');
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
      });

      return convertedTools;
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

      return await getAvailableTools(session);
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
      const langChainMessages = this.messageService.convertToLangChainFormat(
        request.messages as MessageData[],
      );

      yield* this.streamWithGraph(
        langChainMessages as BaseMessage[],
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
      // Use our simplified graph implementation directly
      const { graph } = createConfiguredGraph(llm, tools);

      this.logger.info(
        '[BrainOrchestrator] Starting real-time token streaming with specialist context',
      );

      // Simple graph input with specialist context
      const graphInput = {
        messages: messages,
        response_mode: (request.responseMode as string) || 'synthesis',
        specialist_id: request.activeBitContextId || undefined, // Pass specialist ID to graph
      };

      // FIXED: Stream tokens directly from the graph (no more state object processing)
      let tokenCount = 0;
      const startTime = Date.now();

      for await (const token of graph.stream(graphInput)) {
        tokenCount++;

        // Log progress every 50 tokens to monitor streaming performance
        if (tokenCount % 50 === 0) {
          const elapsed = Date.now() - startTime;
          const rate = ((tokenCount / elapsed) * 1000).toFixed(1);
          this.logger.info(
            `[BrainOrchestrator] Streaming progress: ${tokenCount} tokens, ${rate} t/s`,
          );
        }

        // Yield the token directly (no more object processing)
        yield token;
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
}
