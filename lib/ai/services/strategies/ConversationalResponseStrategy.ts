/**
 * Conversational Response Strategy
 *
 * Handles simple conversational responses that don't require tool execution or synthesis.
 * Extracted from SimpleLangGraphWrapper conversationalResponseNode method.
 *
 * @module ConversationalResponseStrategy
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

/**
 * Strategy for handling conversational responses
 */
export class ConversationalResponseStrategy implements IResponseStrategy {
  private config: ResponseStrategyConfig;

  constructor(config: ResponseStrategyConfig) {
    this.config = config;
  }

  /**
   * Get the strategy type
   */
  getStrategyType(): ResponseStrategyType {
    return 'conversational_response';
  }

  /**
   * Check if this strategy can handle the given state
   */
  canHandle(state: GraphState): boolean {
    // This strategy handles simple conversational queries without tool results
    const hasToolResults =
      state.messages?.some((m) => m._getType() === 'tool') || false;
    const needsSynthesis = state.needsSynthesis ?? false;

    // Can handle if no tool results and no synthesis needed
    return !hasToolResults && !needsSynthesis;
  }

  /**
   * Create the conversational response node
   */
  createNode(): Runnable<GraphState, Partial<GraphState>> {
    const conversationalChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.config.logger.info(
          '[ConversationalResponseStrategy] Processing conversational response',
        );

        // Check if we have an AI response that's just loading messages
        const lastAIMessage = state.messages
          ?.filter((m) => m._getType() === 'ai')
          .pop();

        const isLoadingMessage =
          typeof lastAIMessage?.content === 'string' &&
          (lastAIMessage.content.includes('🔍 Analyzing your request') ||
            lastAIMessage.content.includes('💬 Preparing response'));

        // If the AI response is just loading messages, we need to generate actual content
        if (isLoadingMessage || !lastAIMessage) {
          this.config.logger.info(
            '[ConversationalResponseStrategy] Generating actual response content',
          );

          // Get the original user message
          const userMessage = state.messages?.find(
            (m) => m._getType() === 'human',
          );

          return [
            new SystemMessage({
              content: this.config.systemPrompt,
            }),
            userMessage || new HumanMessage({ content: 'Please help me.' }),
          ];
        } else {
          // We have a proper AI response, but let's regenerate it with the enhanced prompt
          // to ensure the file context is properly processed
          this.config.logger.info(
            '[ConversationalResponseStrategy] Regenerating response with enhanced context',
          );

          // Get the original user message
          const userMessage = state.messages?.find(
            (m) => m._getType() === 'human',
          );

          return [
            new SystemMessage({
              content: this.config.systemPrompt,
            }),
            userMessage || new HumanMessage({ content: 'Please help me.' }),
          ];
        }
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.config.llm.withConfig({
        tags: ['conversational_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'conversational',
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
          '[ConversationalResponseStrategy] Conversational response completed',
        );
        return { messages: [aiMessage] };
      }),
    ]);

    // ENHANCED STREAMING FIX: Ensure comprehensive tags for streaming detection
    return conversationalChain.withConfig({
      tags: ['final_node', 'conversational', 'streaming_enabled'],
      metadata: {
        streaming: true,
        streamMode: 'token',
        node_type: 'conversational',
        enableTokenStreaming: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }
}
