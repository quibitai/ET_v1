/**
 * Simple Response Strategy
 *
 * Handles formatting tool results for direct output without synthesis.
 * Extracted from SimpleLangGraphWrapper simpleResponseNode method.
 *
 * @module SimpleResponseStrategy
 */

import {
  HumanMessage,
  SystemMessage,
  type AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import type { Runnable } from '@langchain/core/runnables';
import type {
  IResponseStrategy,
  ResponseStrategyConfig,
  ResponseStrategyType,
} from '../ResponseStrategyFactory';
import type { GraphState } from '../QueryIntentAnalyzer';
import {
  ContentFormatter,
  type ToolResult,
} from '../../formatting/ContentFormatter';

/**
 * Strategy for handling simple responses with tool result formatting
 */
export class SimpleResponseStrategy implements IResponseStrategy {
  private config: ResponseStrategyConfig;

  constructor(config: ResponseStrategyConfig) {
    this.config = config;
  }

  /**
   * Get the strategy type
   */
  getStrategyType(): ResponseStrategyType {
    return 'simple_response';
  }

  /**
   * Check if this strategy can handle the given state
   */
  canHandle(state: GraphState): boolean {
    // This strategy handles cases with tool results but no synthesis needed
    const hasToolResults =
      state.messages?.some((m) => m._getType() === 'tool') || false;
    const needsSynthesis = state.needsSynthesis ?? true; // Default to true for backward compatibility

    // Can handle if we have tool results but don't need synthesis
    return hasToolResults && !needsSynthesis;
  }

  /**
   * Create the simple response node
   */
  createNode(): Runnable<GraphState, Partial<GraphState>> {
    const simpleResponseChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.config.logger.info(
          '[SimpleResponseStrategy] Formatting tool results for direct output',
        );

        // Extract tool results using centralized approach
        const toolMessages =
          state.messages?.filter((msg) => msg._getType() === 'tool') || [];

        if (toolMessages.length === 0) {
          // No tool results, provide a simple acknowledgment
          return [
            new SystemMessage({
              content: ContentFormatter.getSystemPrompt('generic'),
            }),
          ];
        }

        // Extract user query
        const userMessages =
          state.messages?.filter((msg) => msg._getType() === 'human') || [];
        const lastUserMessage = userMessages[userMessages.length - 1];
        const userQuery =
          typeof lastUserMessage?.content === 'string'
            ? lastUserMessage.content
            : JSON.stringify(lastUserMessage?.content) || '';

        this.config.logger.info(
          '[SimpleResponseStrategy] Query intent analysis',
          {
            userQuery: userQuery.substring(0, 100),
          },
        );

        // Convert tool messages to ToolResult format
        const toolResults: ToolResult[] = toolMessages.map((msg) => ({
          name: (msg as any)?.name || 'tool',
          content: msg.content,
        }));

        // Use centralized formatter - SINGLE point of formatting (fixes duplication)
        const formattedContent = ContentFormatter.formatToolResults(
          toolResults,
          userQuery,
        );

        // Determine content type for appropriate system prompt
        const isDocumentListing = formattedContent.includes(
          '📋 **Available Documents:**',
        );
        const contentType = isDocumentListing ? 'document_list' : 'content';

        return [
          new SystemMessage({
            content: ContentFormatter.getSystemPrompt(contentType),
          }),
          new HumanMessage({
            content: formattedContent,
          }),
        ];
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.config.llm.withConfig({
        tags: ['simple_response_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'simple_response',
        },
        callbacks: [
          {
            handleLLMNewToken: (token: string) => {
              // Token streaming handled by parent coordinator
            },
          },
        ],
      }),
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.config.logger.info(
          '[SimpleResponseStrategy] Simple response completed',
        );
        // Mark that simple response has streamed content to prevent duplication
        this.config.streamingCoordinator?.markContentStreamed('simple');
        return { messages: [aiMessage] };
      }),
    ]);

    // ENHANCED STREAMING FIX: Ensure comprehensive tags for streaming detection
    return simpleResponseChain.withConfig({
      tags: ['final_node', 'simple_response', 'streaming_enabled'],
      metadata: {
        streaming: true,
        streamMode: 'token',
        node_type: 'simple_response',
        enableTokenStreaming: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }
}
