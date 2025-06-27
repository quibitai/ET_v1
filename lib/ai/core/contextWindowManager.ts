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
  // Legacy support for any old references
  'gpt-4o-mini': 16385,
  'gpt-4o': 128000,
} as const;

/**
 * Performance-optimized model selection rules
 */
export const MODEL_SELECTION_RULES = {
  // Use mini for simple conversations (< 3 tools, < 8k tokens)
  SIMPLE_CONVERSATION_THRESHOLD: {
    maxTools: 2,
    maxTokens: 8000,
    recommendedModel: 'gpt-4.1-mini',
  },

  // Use mini for research tasks with good prompt engineering
  RESEARCH_TASK_THRESHOLD: {
    maxTools: 4,
    maxTokens: 12000,
    recommendedModel: 'gpt-4.1-mini',
  },

  // Upgrade to full model for complex multi-step operations
  COMPLEX_TASK_THRESHOLD: {
    minTools: 5,
    minTokens: 12000,
    recommendedModel: 'gpt-4.1',
  },
} as const;

/**
 * Context analysis result
 */
export interface ContextAnalysis {
  estimatedTokens: number;
  exceedsLimit: boolean;
  recommendedModel: string;
  shouldTruncate: boolean;
  shouldSummarizeTools: boolean;
  reasoning: string;
}

/**
 * Context Window Manager
 */
export interface ContextWindowConfig {
  maxTokens?: number;
  reserveTokensForResponse?: number;
  reserveTokensForTools?: number;
  enableAutoUpgrade?: boolean;
  aggressiveOptimization?: boolean;
}

/**
 * Enhanced Context Window Manager with performance optimization
 */
export class ContextWindowManager {
  private config: ContextWindowConfig;
  private logger: RequestLogger;

  constructor(config: ContextWindowConfig = {}, logger: RequestLogger) {
    this.config = {
      maxTokens: config.maxTokens || 12000, // Conservative default for mini
      reserveTokensForResponse: config.reserveTokensForResponse || 2000,
      reserveTokensForTools: config.reserveTokensForTools || 1000, // Reduced from 1500
      enableAutoUpgrade: config.enableAutoUpgrade ?? true,
      aggressiveOptimization: config.aggressiveOptimization ?? true,
      ...config,
    };
    this.logger = logger;
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  estimateTokenCount(messages: BaseMessage[]): number {
    const totalChars = messages.reduce((acc, msg) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      return acc + content.length;
    }, 0);

    // More accurate estimation: ~3.5 chars per token for English
    return Math.ceil(totalChars / 3.5);
  }

  /**
   * Enhanced context analysis with performance optimization
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
    const toolTokens = toolCount * (this.config.reserveTokensForTools ?? 1000);
    const totalNeeded =
      estimatedTokens +
      toolTokens +
      (this.config.reserveTokensForResponse ?? 2000);

    const exceedsLimit = totalNeeded > modelLimit;
    const shouldTruncate =
      totalNeeded > (this.config.maxTokens || modelLimit * 0.8);

    // ENHANCED: Performance-first model selection
    let recommendedModel = currentModel;
    let reasoning = 'Current model maintained';

    if (this.config.aggressiveOptimization) {
      // Try to keep using mini model whenever possible
      if (currentModel === 'gpt-4.1' || currentModel === 'gpt-4o') {
        const { maxTools, maxTokens } =
          MODEL_SELECTION_RULES.RESEARCH_TASK_THRESHOLD;
        if (toolCount <= maxTools && estimatedTokens <= maxTokens) {
          recommendedModel = 'gpt-4.1-mini';
          reasoning =
            'Downgraded to mini for efficiency (task within mini capabilities)';
        }
      }

      // Only upgrade if absolutely necessary
      if (currentModel === 'gpt-4.1-mini' || currentModel === 'gpt-4o-mini') {
        const { minTools, minTokens } =
          MODEL_SELECTION_RULES.COMPLEX_TASK_THRESHOLD;
        if (
          exceedsLimit ||
          (toolCount >= minTools && estimatedTokens >= minTokens)
        ) {
          recommendedModel = 'gpt-4.1'; // Always upgrade to gpt-4.1
          reasoning =
            'Upgraded to full model for complex task or context limit';
        }
      }
    } else {
      // Original logic for backward compatibility
      if (this.config.enableAutoUpgrade && (exceedsLimit || toolCount > 3)) {
        if (currentModel === 'gpt-4.1-mini' || currentModel === 'gpt-4o-mini') {
          recommendedModel = 'gpt-4.1'; // Always upgrade to gpt-4.1
          reasoning = 'Upgraded due to context or tool complexity';
        }
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

    this.logger.info('[ContextWindowManager] Enhanced context analysis', {
      estimatedTokens,
      modelLimit,
      toolTokens,
      totalNeeded,
      exceedsLimit,
      shouldTruncate,
      shouldSummarizeTools,
      currentModel,
      recommendedModel,
      reasoning,
      messageCount: messages.length,
      toolCount,
      aggressiveOptimization: this.config.aggressiveOptimization,
    });

    return {
      estimatedTokens,
      exceedsLimit,
      recommendedModel,
      shouldTruncate,
      shouldSummarizeTools,
      reasoning,
    };
  }

  /**
   * Get optimal model for a given context
   */
  getOptimalModel(
    messages: BaseMessage[],
    toolCount: number,
    preferredModel?: string,
  ): string {
    const analysis = this.analyzeContext(
      messages,
      preferredModel || 'gpt-4.1-mini',
      toolCount,
    );
    return analysis.recommendedModel;
  }

  /**
   * Create optimized ChatOpenAI instance
   */
  createOptimizedLLM(
    messages: BaseMessage[],
    toolCount: number,
    preferredModel?: string,
    additionalConfig?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>,
  ): ChatOpenAI {
    const optimalModel = this.getOptimalModel(
      messages,
      toolCount,
      preferredModel,
    );

    const config = {
      modelName: optimalModel,
      temperature: 0.1, // Slightly lower for more consistent performance
      streaming: true,
      ...additionalConfig,
    };

    this.logger.info('[ContextWindowManager] Created optimized LLM', {
      model: optimalModel,
      toolCount,
      messageCount: messages.length,
      config,
    });

    return new ChatOpenAI(config);
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
      toolCount * (this.config.reserveTokensForTools ?? 1000) +
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
