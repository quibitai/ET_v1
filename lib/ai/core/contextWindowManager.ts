/**
 * Context Window Manager
 *
 * Handles token counting, context truncation, and smart model selection
 * to prevent context length exceeded errors in LangGraph operations.
 */

import type { BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import type { RequestLogger } from '@/lib/services/observabilityService';

/**
 * Model context limits (in tokens)
 */
export const MODEL_CONTEXT_LIMITS = {
  'gpt-4.1-mini': 16385,
  'gpt-4.1': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385,
} as const;

/**
 * Context management configuration
 */
export interface ContextConfig {
  maxTokens?: number;
  reserveTokensForResponse?: number;
  reserveTokensForTools?: number;
  enableAutoUpgrade?: boolean;
  preferredModel?: string;
}

/**
 * Context analysis result
 */
export interface ContextAnalysis {
  estimatedTokens: number;
  exceedsLimit: boolean;
  recommendedModel: string;
  shouldTruncate: boolean;
  shouldSummarizeTools: boolean;
}

/**
 * Context Window Manager
 */
export class ContextWindowManager {
  private logger: RequestLogger;
  private config: ContextConfig;

  constructor(logger: RequestLogger, config: ContextConfig = {}) {
    this.logger = logger;
    this.config = {
      maxTokens: 14000, // Leave buffer for response
      reserveTokensForResponse: 2000,
      reserveTokensForTools: 1500,
      enableAutoUpgrade: true,
      ...config,
    };
  }

  /**
   * Estimate token count for messages
   */
  estimateTokenCount(messages: BaseMessage[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Base message overhead (role, metadata, etc.)
      totalTokens += 10;

      // Content tokens
      if (typeof message.content === 'string') {
        totalTokens += this.estimateStringTokens(message.content);
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (typeof part === 'string') {
            totalTokens += this.estimateStringTokens(part);
          } else if (part && typeof part === 'object') {
            totalTokens += this.estimateStringTokens(JSON.stringify(part));
          }
        }
      }

      // Tool calls and results add significant overhead
      if (message._getType() === 'ai' && (message as any).tool_calls) {
        const toolCalls = (message as any).tool_calls;
        totalTokens += toolCalls.length * 50; // Base overhead per tool call
        for (const toolCall of toolCalls) {
          totalTokens += this.estimateStringTokens(JSON.stringify(toolCall));
        }
      }

      if (message._getType() === 'tool') {
        totalTokens += 50; // Tool message overhead
        totalTokens += this.estimateStringTokens(message.content as string);
      }
    }

    return totalTokens;
  }

  /**
   * Estimate tokens for a string (rough approximation)
   */
  private estimateStringTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    // Add some buffer for special tokens and encoding
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Analyze context and provide recommendations
   */
  analyzeContext(
    messages: BaseMessage[],
    currentModel: string,
    toolCount = 0,
  ): ContextAnalysis {
    const estimatedTokens = this.estimateTokenCount(messages);
    const modelLimit =
      MODEL_CONTEXT_LIMITS[currentModel as keyof typeof MODEL_CONTEXT_LIMITS] ??
      16385;

    // Account for tool definitions and response space
    const toolTokens = toolCount * (this.config.reserveTokensForTools ?? 1500);
    const totalNeeded =
      estimatedTokens +
      toolTokens +
      (this.config.reserveTokensForResponse ?? 2000);

    const exceedsLimit = totalNeeded > modelLimit;
    const shouldTruncate =
      totalNeeded > (this.config.maxTokens || modelLimit * 0.8);

    // Recommend model upgrade for complex operations
    let recommendedModel = currentModel;
    if (this.config.enableAutoUpgrade && (exceedsLimit || toolCount > 3)) {
      if (currentModel === 'gpt-4.1-mini') {
        recommendedModel = 'gpt-4.1';
      }
    }

    // Suggest tool result summarization for very large contexts
    const shouldSummarizeTools =
      estimatedTokens > 10000 &&
      messages.some(
        (m) =>
          m._getType() === 'tool' &&
          m.content &&
          (m.content as string).length > 5000,
      );

    this.logger.info('[ContextWindowManager] Context analysis', {
      estimatedTokens,
      modelLimit,
      toolTokens,
      totalNeeded,
      exceedsLimit,
      shouldTruncate,
      shouldSummarizeTools,
      currentModel,
      recommendedModel,
      messageCount: messages.length,
    });

    return {
      estimatedTokens,
      exceedsLimit,
      recommendedModel,
      shouldTruncate,
      shouldSummarizeTools,
    };
  }

  /**
   * Truncate conversation history intelligently while preserving tool call/response pairs
   */
  truncateMessages(
    messages: BaseMessage[],
    maxTokens: number,
    toolCount = 0,
  ): BaseMessage[] {
    if (messages.length === 0) return messages;

    // Reserve space for tools and response
    const reservedTokens =
      toolCount * (this.config.reserveTokensForTools ?? 1500) +
      (this.config.reserveTokensForResponse ?? 2000);
    const availableTokens = Math.max(1000, maxTokens - reservedTokens);

    // CONSERVATIVE APPROACH: Preserve complete conversation blocks
    const systemMessages = messages.filter((m) => m._getType() === 'system');
    const nonSystemMessages = messages.filter((m) => m._getType() !== 'system');

    // Start with system messages
    const result = [...systemMessages];
    let currentTokens = this.estimateTokenCount(result);

    // Find complete conversation blocks (user -> ai -> tools -> ai cycles)
    const conversationBlocks: BaseMessage[][] = [];
    let currentBlock: BaseMessage[] = [];

    for (const msg of nonSystemMessages) {
      currentBlock.push(msg);

      // End block when we see a complete cycle or standalone message
      if (
        msg._getType() === 'ai' &&
        !(msg as any).tool_calls &&
        currentBlock.length > 0
      ) {
        // Complete AI response without tool calls - end block
        conversationBlocks.push([...currentBlock]);
        currentBlock = [];
      } else if (
        msg._getType() === 'human' &&
        currentBlock.length > 1 &&
        currentBlock[currentBlock.length - 2]._getType() === 'ai'
      ) {
        // New user message after AI response - start new block
        const lastMsg = currentBlock.pop();
        if (lastMsg && currentBlock.length > 0) {
          conversationBlocks.push([...currentBlock]);
        }
        currentBlock = lastMsg ? [lastMsg] : []; // Start new block with the user message
      }
    }

    // Add any remaining messages as the final block
    if (currentBlock.length > 0) {
      conversationBlocks.push(currentBlock);
    }

    // Add blocks from most recent, ensuring we don't exceed token limit
    for (let i = conversationBlocks.length - 1; i >= 0; i--) {
      const block = conversationBlocks[i];
      const testMessages = [...result, ...block];
      const testTokens = this.estimateTokenCount(testMessages);

      if (testTokens <= availableTokens) {
        result.push(...block);
        currentTokens = testTokens;
      } else {
        // If this block would exceed limit, stop adding blocks
        break;
      }
    }

    // CRITICAL FIX: Ensure we always have at least one non-system message
    // If truncation removed all conversation, preserve the most recent user message
    const hasNonSystemMessages = result.some((m) => m._getType() !== 'system');
    if (!hasNonSystemMessages && nonSystemMessages.length > 0) {
      // Find the most recent user message
      const lastUserMessage = [...nonSystemMessages]
        .reverse()
        .find((m) => m._getType() === 'human');
      if (lastUserMessage) {
        result.push(lastUserMessage);
        this.logger.warn(
          '[ContextWindowManager] Emergency preservation of user message to prevent empty array',
        );
      }
    }

    this.logger.info(
      '[ContextWindowManager] Conservative truncation completed',
      {
        originalCount: messages.length,
        truncatedCount: result.length,
        blocksConsidered: conversationBlocks.length,
        blocksIncluded:
          conversationBlocks.length -
          Math.max(
            0,
            conversationBlocks.findIndex((block) => {
              const testMessages = [...systemMessages, ...block];
              return this.estimateTokenCount(testMessages) > availableTokens;
            }),
          ),
        estimatedTokens: this.estimateTokenCount(result),
        availableTokens,
        hasNonSystemMessages,
      },
    );

    // FINAL SAFETY CHECK: Never return empty array
    if (result.length === 0 && messages.length > 0) {
      this.logger.error(
        '[ContextWindowManager] CRITICAL: Truncation resulted in empty array, preserving original first message',
      );
      return [messages[0]];
    }

    return result;
  }

  /**
   * Summarize large tool results
   */
  async summarizeToolResults(messages: BaseMessage[]): Promise<BaseMessage[]> {
    const summarizedMessages = [];
    const summarizationLLM = new ChatOpenAI({
      modelName: 'gpt-4.1-mini', // Use a fast and cheap model for this
      temperature: 0.2,
      streaming: true,
    });

    for (const message of messages) {
      if (
        message._getType() === 'tool' &&
        message.content &&
        (message.content as string).length > 4000
      ) {
        const content = message.content as string;
        this.logger.info(
          '[ContextWindowManager] Summarizing large tool result',
          {
            toolName: (message as any).name,
            originalLength: content.length,
          },
        );

        try {
          const summaryPrompt = `Summarize the following tool result concisely. Focus on extracting the most critical information, key facts, figures, and conclusions. **Crucially, you must preserve any source URLs or links mentioned in the original content.**

Original Content:
---
${content.substring(0, 15000)}
---

Concise Summary with preserved links:`;

          const response = await summarizationLLM.invoke(summaryPrompt);
          const summary = response.content as string;

          const summarizedMessage = new (message.constructor as any)({
            ...message,
            content: `[SUMMARIZED TOOL RESULT - Original: ${content.length} chars]\n${summary}`,
          });
          summarizedMessages.push(summarizedMessage);

          this.logger.info(
            '[ContextWindowManager] Tool result summarized successfully',
            {
              newLength: summary.length,
            },
          );
        } catch (error) {
          this.logger.error(
            '[ContextWindowManager] Error summarizing tool result, using original',
            {
              error,
            },
          );
          // On error, fall back to the original content
          summarizedMessages.push(message);
        }
      } else {
        summarizedMessages.push(message);
      }
    }

    return summarizedMessages;
  }

  /**
   * Create an upgraded LLM instance with larger context
   */
  createUpgradedLLM(currentLLM: ChatOpenAI, targetModel: string): ChatOpenAI {
    this.logger.info('[ContextWindowManager] Upgrading model', {
      from: currentLLM.modelName,
      to: targetModel,
    });

    return new ChatOpenAI({
      modelName: targetModel,
      temperature: currentLLM.temperature,
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });
  }
}
