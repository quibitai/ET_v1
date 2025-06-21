/**
 * Tool Execution Service
 *
 * Extracted from SimpleLangGraphWrapper to handle all tool execution
 * logic including deduplication, caching, and workflow management.
 *
 * Features:
 * - Tool execution with caching
 * - Deduplication of tool calls
 * - Performance monitoring
 * - Error handling and recovery
 * - Integration with workflow management
 */

import type { RequestLogger } from '../../services/observabilityService';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ToolCache } from './ToolCache';
import type { ToolCall } from './ToolCache';
import { ToolRegistry } from './ToolRegistry';
import type { ToolDefinition } from './ToolRegistry';

export interface ToolExecutionResult {
  toolMessages: ToolMessage[];
  cacheStats: {
    cached: number;
    executed: number;
    total: number;
  };
  executionTime: number;
  errors?: string[];
}

export interface ToolExecutionConfig {
  enableCaching?: boolean;
  enableDeduplication?: boolean;
  maxConcurrentExecutions?: number;
  timeoutMs?: number;
}

export class ToolExecutionService {
  private toolCache: ToolCache;
  private toolRegistry: ToolRegistry;
  private tools: any[];
  private config: ToolExecutionConfig;

  constructor(
    tools: any[],
    private logger: RequestLogger,
    private workflowManager?: any,
    config: ToolExecutionConfig = {},
  ) {
    this.toolCache = new ToolCache(logger);
    this.toolRegistry = new ToolRegistry(logger);
    this.tools = tools;
    this.config = {
      enableCaching: true,
      enableDeduplication: true,
      maxConcurrentExecutions: 10,
      timeoutMs: 30000,
      ...config,
    };

    // Register all tools
    this.initializeTools();
  }

  /**
   * Initialize and register all tools
   */
  private initializeTools(): void {
    const toolDefinitions: ToolDefinition[] = this.tools.map((tool) => ({
      name: tool.name || 'unnamed',
      description: tool.description,
      schema: tool.schema,
      func: tool.func,
      ...tool,
    }));

    const result = this.toolRegistry.registerAll(toolDefinitions);

    this.logger.info('[Tool Execution Service] Initialized', {
      totalTools: this.tools.length,
      successful: result.successful.length,
      failed: result.failed.length,
      warnings: result.warnings.length,
    });

    if (result.failed.length > 0) {
      this.logger.warn(
        '[Tool Execution Service] Some tools failed to register',
        {
          failedTools: result.failed.map((f) => f.tool.name),
        },
      );
    }
  }

  /**
   * Execute tools from an AI message with tool calls
   */
  async executeToolsFromMessage(
    lastMessage: AIMessage,
    config?: RunnableConfig,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
      this.logger.warn('[Tool Execution] No tool calls found in message');
      return {
        toolMessages: [],
        cacheStats: { cached: 0, executed: 0, total: 0 },
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Convert tool calls to our ToolCall interface
      const toolCalls: ToolCall[] = lastMessage.tool_calls.map((tc) => ({
        id: tc.id || '',
        name: tc.name,
        args: tc.args || {},
      }));

      // Deduplicate tool calls if enabled
      const processedToolCalls = this.config.enableDeduplication
        ? this.deduplicateToolCalls(toolCalls)
        : toolCalls;

      this.logger.info('[Tool Execution] Processing tool calls', {
        originalCount: toolCalls.length,
        processedCount: processedToolCalls.length,
        duplicatesRemoved: toolCalls.length - processedToolCalls.length,
        toolCalls: processedToolCalls.map((tc) => ({
          name: tc.name,
          id: tc.id,
        })),
      });

      // Get cached results and determine what needs execution
      const { cached, toExecute } = this.config.enableCaching
        ? this.toolCache.getCachedResults(processedToolCalls)
        : { cached: [], toExecute: processedToolCalls };

      let newToolMessages: ToolMessage[] = [];

      // Execute tools that aren't cached
      if (toExecute.length > 0) {
        newToolMessages = await this.executeTools(toExecute, config);

        // Cache the new results if caching is enabled
        if (this.config.enableCaching) {
          this.toolCache.cacheResults(toExecute, newToolMessages);
        }

        // Analyze tool results for workflow management
        if (this.workflowManager) {
          this.analyzeToolResults(toExecute, newToolMessages);
        }
      }

      // Combine cached and newly executed results
      const allToolMessages = [...cached, ...newToolMessages];

      const executionTime = Date.now() - startTime;

      this.logger.info('[Tool Execution] Completed', {
        totalMessages: allToolMessages.length,
        cachedCount: cached.length,
        executedCount: newToolMessages.length,
        executionTime,
      });

      return {
        toolMessages: allToolMessages,
        cacheStats: {
          cached: cached.length,
          executed: newToolMessages.length,
          total: allToolMessages.length,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error('[Tool Execution] Error executing tools', {
        error,
        executionTime,
      });

      return {
        toolMessages: [],
        cacheStats: { cached: 0, executed: 0, total: 0 },
        executionTime,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Execute a list of tool calls
   */
  private async executeTools(
    toolCalls: ToolCall[],
    config?: RunnableConfig,
  ): Promise<ToolMessage[]> {
    this.logger.info('[Tool Execution] Executing uncached tools', {
      uncachedTools: toolCalls.map((tc) => tc.name),
    });

    // Create a mock AI message with the tools to execute
    const modifiedMessage = new AIMessage({
      content: '',
      tool_calls: toolCalls,
    });

    // Use LangGraph's ToolNode for execution
    const toolNode = new ToolNode(this.tools);
    const executedToolMessages = await toolNode.invoke(
      [modifiedMessage],
      config,
    );

    // Convert to array if not already
    const toolMessages = Array.isArray(executedToolMessages)
      ? executedToolMessages
      : [executedToolMessages];

    // Log tool message structure for debugging
    this.logger.info('[Tool Execution] Tool messages received', {
      messageCount: toolMessages.length,
      messageSample: toolMessages.map((msg) => ({
        type: msg._getType(),
        name: (msg as any)?.name,
        tool_call_id: (msg as any)?.tool_call_id,
        keys: Object.keys(msg),
      })),
    });

    return toolMessages;
  }

  /**
   * Deduplicate tool calls within the same execution batch
   */
  private deduplicateToolCalls(toolCalls: ToolCall[]): ToolCall[] {
    const seen = new Set<string>();
    const deduplicated: ToolCall[] = [];

    for (const toolCall of toolCalls) {
      // Generate deduplication key using the cache key generator
      const dedupKey = this.toolCache.generateKey(toolCall);

      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        deduplicated.push(toolCall);

        this.logger.info(`[Tool Deduplication] ✅ Keeping: ${toolCall.name}`, {
          toolId: toolCall.id,
          dedupKey,
        });
      } else {
        this.logger.info(
          `[Tool Deduplication] 🚫 Removing duplicate: ${toolCall.name}`,
          {
            toolId: toolCall.id,
            dedupKey,
            reason: 'Identical tool call already in this batch',
          },
        );
      }
    }

    return deduplicated;
  }

  /**
   * Analyze tool results for workflow management
   */
  private analyzeToolResults(
    toolCalls: ToolCall[],
    toolMessages: ToolMessage[],
  ): void {
    if (!this.workflowManager) return;

    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const toolMessage = toolMessages[i];

      if (toolMessage) {
        this.workflowManager.analyzeToolResults(
          toolCall.name,
          toolMessage.content,
          toolCall.args,
        );
      }
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    cache: any;
    registry: any;
    execution: {
      totalExecutions: number;
      averageExecutionTime: number;
      errorRate: number;
    };
  } {
    return {
      cache: this.toolCache.getStats(),
      registry: this.toolRegistry.getStats(),
      execution: {
        totalExecutions: 0, // TODO: Track this
        averageExecutionTime: 0, // TODO: Track this
        errorRate: 0, // TODO: Track this
      },
    };
  }

  /**
   * Update tool configuration
   */
  updateConfig(newConfig: Partial<ToolExecutionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info(
      '[Tool Execution Service] Configuration updated',
      this.config,
    );
  }

  /**
   * Clear caches and reset state
   */
  reset(): void {
    this.toolCache.clear();
    this.logger.info('[Tool Execution Service] Reset completed');
  }

  /**
   * Get registered tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.toolRegistry.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return this.toolRegistry.getAll();
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.toolRegistry.has(name);
  }
}
