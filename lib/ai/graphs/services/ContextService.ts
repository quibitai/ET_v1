/**
 * Context Service
 *
 * Handles context optimization and management including:
 * - Message window optimization
 * - Tool result summarization
 * - Context relevance assessment
 * - Memory management
 */

import type { BaseMessage } from '@langchain/core/messages';
import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';
import { getLastHumanMessage, getToolMessages } from '../state';

/**
 * Context optimization result
 */
export interface ContextOptimization {
  originalMessageCount: number;
  optimizedMessageCount: number;
  compressionRatio: number;
  strategiesApplied: string[];
  tokensEstimate: {
    before: number;
    after: number;
    saved: number;
  };
}

/**
 * Tool result summary
 */
export interface ToolResultSummary {
  toolName: string;
  executionTime?: number;
  resultType: 'document' | 'search' | 'analysis' | 'error' | 'other';
  keyFindings: string[];
  relevanceScore: number;
  citationInfo?: string;
  summary: string;
}

/**
 * Context analysis result
 */
export interface ContextAnalysis {
  conversationLength: number;
  contextComplexity: 'simple' | 'moderate' | 'complex';
  hasDocumentContext: boolean;
  hasSearchContext: boolean;
  topicCoherence: number;
  recommendedOptimization: string[];
}

/**
 * Service for optimizing conversation context and managing information flow
 */
export class ContextService {
  private readonly MAX_MESSAGE_WINDOW = 25;
  private readonly CONTEXT_TOKEN_LIMIT = 8000;
  private readonly CHARS_PER_TOKEN = 4; // Rough estimate

  constructor(private logger: RequestLogger) {}

  /**
   * Optimize message context for better performance and relevance
   */
  optimizeContext(state: GraphState): {
    optimizedMessages: BaseMessage[];
    optimization: ContextOptimization;
  } {
    const originalMessages = state.messages || [];
    const startTime = Date.now();

    if (originalMessages.length <= this.MAX_MESSAGE_WINDOW) {
      return {
        optimizedMessages: originalMessages,
        optimization: {
          originalMessageCount: originalMessages.length,
          optimizedMessageCount: originalMessages.length,
          compressionRatio: 1.0,
          strategiesApplied: ['no_optimization_needed'],
          tokensEstimate: {
            before: this.estimateTokens(originalMessages),
            after: this.estimateTokens(originalMessages),
            saved: 0,
          },
        },
      };
    }

    const strategiesApplied: string[] = [];
    let optimizedMessages = [...originalMessages];

    // Strategy 1: Preserve system message and recent messages
    if (optimizedMessages.length > this.MAX_MESSAGE_WINDOW) {
      const systemMessage = optimizedMessages.find(
        (msg) => msg._getType?.() === 'system',
      );
      const recentMessages = optimizedMessages.slice(
        -this.MAX_MESSAGE_WINDOW + (systemMessage ? 1 : 0),
      );

      optimizedMessages = systemMessage
        ? [systemMessage, ...recentMessages]
        : recentMessages;

      strategiesApplied.push('message_window_truncation');
    }

    // Strategy 2: Summarize old tool results
    if (this.shouldSummarizeToolResults(optimizedMessages)) {
      optimizedMessages = this.summarizeOldToolResults(optimizedMessages);
      strategiesApplied.push('tool_result_summarization');
    }

    // Strategy 3: Compress redundant content
    const compressedMessages = this.compressRedundantContent(optimizedMessages);
    if (compressedMessages.length < optimizedMessages.length) {
      optimizedMessages = compressedMessages;
      strategiesApplied.push('redundancy_compression');
    }

    const optimization: ContextOptimization = {
      originalMessageCount: originalMessages.length,
      optimizedMessageCount: optimizedMessages.length,
      compressionRatio: optimizedMessages.length / originalMessages.length,
      strategiesApplied,
      tokensEstimate: {
        before: this.estimateTokens(originalMessages),
        after: this.estimateTokens(optimizedMessages),
        saved:
          this.estimateTokens(originalMessages) -
          this.estimateTokens(optimizedMessages),
      },
    };

    const duration = Date.now() - startTime;
    this.logger.info('[ContextService] Context optimized', {
      ...optimization,
      duration,
    });

    return {
      optimizedMessages,
      optimization,
    };
  }

  /**
   * Analyze conversation context to understand complexity and characteristics
   */
  analyzeContext(state: GraphState): ContextAnalysis {
    const messages = state.messages || [];
    const toolMessages = getToolMessages(state);

    // Determine complexity based on various factors
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';

    if (messages.length > 15 || toolMessages.length > 5) {
      complexity = 'complex';
    } else if (messages.length > 8 || toolMessages.length > 2) {
      complexity = 'moderate';
    }

    // Check for different types of context
    const hasDocumentContext = toolMessages.some((msg) =>
      this.isDocumentToolResult(msg),
    );

    const hasSearchContext = toolMessages.some((msg) =>
      this.isSearchToolResult(msg),
    );

    // Calculate topic coherence
    const topicCoherence = this.calculateTopicCoherence(messages);

    // Generate optimization recommendations
    const recommendedOptimization = this.generateOptimizationRecommendations({
      conversationLength: messages.length,
      contextComplexity: complexity,
      hasDocumentContext,
      hasSearchContext,
      topicCoherence,
    });

    return {
      conversationLength: messages.length,
      contextComplexity: complexity,
      hasDocumentContext,
      hasSearchContext,
      topicCoherence,
      recommendedOptimization,
    };
  }

  /**
   * Summarize tool results for better context management
   */
  summarizeToolResults(state: GraphState): ToolResultSummary[] {
    const toolMessages = getToolMessages(state);

    return toolMessages.map((message) => {
      try {
        const content =
          typeof message.content === 'string'
            ? JSON.parse(message.content)
            : message.content;

        const summary = this.createToolResultSummary(content, message);

        this.logger.info('[ContextService] Tool result summarized', {
          toolName: summary.toolName,
          resultType: summary.resultType,
          relevanceScore: summary.relevanceScore,
        });

        return summary;
      } catch (error) {
        // Handle unparseable content
        return {
          toolName: 'unknown',
          resultType: 'error' as const,
          keyFindings: ['Failed to parse tool result'],
          relevanceScore: 0.1,
          summary: 'Tool result could not be processed',
        };
      }
    });
  }

  /**
   * Extract key information from conversation for reference
   */
  extractKeyInformation(state: GraphState): {
    userIntent: string;
    keyDocuments: string[];
    importantFindings: string[];
    actionItems: string[];
  } {
    const userQuery = getLastHumanMessage(state);
    const toolSummaries = this.summarizeToolResults(state);

    // Extract user intent
    const userIntent = this.extractUserIntent(userQuery);

    // Identify key documents
    const keyDocuments = toolSummaries
      .filter((summary) => summary.resultType === 'document')
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
      .map((summary) => summary.citationInfo || summary.toolName);

    // Extract important findings
    const importantFindings = toolSummaries
      .flatMap((summary) => summary.keyFindings)
      .filter((finding) => finding.length > 10)
      .slice(0, 10);

    // Generate action items (placeholder for now)
    const actionItems: string[] = [];
    if (userQuery.toLowerCase().includes('recommend')) {
      actionItems.push('Provide specific recommendations');
    }
    if (userQuery.toLowerCase().includes('compare')) {
      actionItems.push('Create comparison analysis');
    }

    return {
      userIntent,
      keyDocuments,
      importantFindings,
      actionItems,
    };
  }

  /**
   * Estimate token count for messages
   */
  private estimateTokens(messages: BaseMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);

    return Math.ceil(totalChars / this.CHARS_PER_TOKEN);
  }

  /**
   * Check if tool results should be summarized
   */
  private shouldSummarizeToolResults(messages: BaseMessage[]): boolean {
    const toolMessages = messages.filter((msg) => msg._getType?.() === 'tool');
    const oldToolMessages = toolMessages.slice(0, -3); // Keep last 3 tool results

    return oldToolMessages.length > 0;
  }

  /**
   * Summarize old tool results to save context space
   */
  private summarizeOldToolResults(messages: BaseMessage[]): BaseMessage[] {
    const nonToolMessages = messages.filter(
      (msg) => msg._getType?.() !== 'tool',
    );
    const toolMessages = messages.filter((msg) => msg._getType?.() === 'tool');

    if (toolMessages.length <= 3) {
      return messages;
    }

    // Keep last 3 tool messages, summarize the rest
    const recentToolMessages = toolMessages.slice(-3);
    const oldToolMessages = toolMessages.slice(0, -3);

    // Create summary message
    const summaryContent = oldToolMessages
      .map((msg) => {
        try {
          const content =
            typeof msg.content === 'string'
              ? JSON.parse(msg.content)
              : msg.content;

          return `Tool: ${content.tool_name || 'unknown'} - ${content.title || content.summary || 'Result available'}`;
        } catch (e) {
          return `Tool result: ${msg.content.toString().substring(0, 100)}...`;
        }
      })
      .join('\n');

    const summaryMessage = {
      _getType: () => 'system',
      content: `[Previous tool results summary]\n${summaryContent}`,
    } as BaseMessage;

    // Reconstruct message list with summary
    const result = [
      ...nonToolMessages,
      summaryMessage,
      ...recentToolMessages,
    ].sort((a, b) => {
      // Maintain rough chronological order
      const aIndex = messages.indexOf(a);
      const bIndex = messages.indexOf(b);
      return aIndex - bIndex;
    });

    return result;
  }

  /**
   * Remove redundant or duplicate content
   */
  private compressRedundantContent(messages: BaseMessage[]): BaseMessage[] {
    // Simple deduplication based on content similarity
    const unique: BaseMessage[] = [];
    const seen = new Set<string>();

    for (const message of messages) {
      const content =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

      const contentHash = this.simpleHash(content.substring(0, 200));

      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        unique.push(message);
      }
    }

    return unique;
  }

  /**
   * Calculate topic coherence across messages
   */
  private calculateTopicCoherence(messages: BaseMessage[]): number {
    // Simple coherence calculation based on keyword overlap
    if (messages.length < 2) return 1.0;

    const texts = messages.map((msg) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      return content.toLowerCase();
    });

    // Extract keywords from each message
    const keywordSets = texts.map(
      (text) => new Set(text.split(/\s+/).filter((word) => word.length > 3)),
    );

    // Calculate average pairwise overlap
    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 0; i < keywordSets.length; i++) {
      for (let j = i + 1; j < keywordSets.length; j++) {
        const setA = keywordSets[i];
        const setB = keywordSets[j];
        const intersection = new Set([...setA].filter((x) => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        if (union.size > 0) {
          totalOverlap += intersection.size / union.size;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalOverlap / comparisons : 0.5;
  }

  /**
   * Generate optimization recommendations based on context analysis
   */
  private generateOptimizationRecommendations(
    analysis: Partial<ContextAnalysis>,
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.conversationLength && analysis.conversationLength > 20) {
      recommendations.push('Consider message window truncation');
    }

    if (analysis.contextComplexity === 'complex') {
      recommendations.push('Apply aggressive summarization');
      recommendations.push('Prioritize recent context');
    }

    if (analysis.topicCoherence && analysis.topicCoherence < 0.3) {
      recommendations.push('Focus on main topic thread');
    }

    if (analysis.hasDocumentContext && analysis.hasSearchContext) {
      recommendations.push('Separate document and search contexts');
    }

    return recommendations;
  }

  /**
   * Check if message is a document tool result
   */
  private isDocumentToolResult(message: BaseMessage): boolean {
    try {
      const content =
        typeof message.content === 'string'
          ? JSON.parse(message.content)
          : message.content;

      return !!(content.document_id || content.title || content.documents);
    } catch {
      return false;
    }
  }

  /**
   * Check if message is a search tool result
   */
  private isSearchToolResult(message: BaseMessage): boolean {
    try {
      const content =
        typeof message.content === 'string'
          ? JSON.parse(message.content)
          : message.content;

      return !!(content.query || content.search_results || content.url);
    } catch {
      return false;
    }
  }

  /**
   * Create summary for a tool result
   */
  private createToolResultSummary(
    content: any,
    message: BaseMessage,
  ): ToolResultSummary {
    // Determine tool name and type
    const toolName = content.tool_name || message.name || 'unknown';
    let resultType: ToolResultSummary['resultType'] = 'other';

    if (content.document_id || content.title || content.documents) {
      resultType = 'document';
    } else if (content.query || content.search_results) {
      resultType = 'search';
    } else if (content.analysis || content.findings) {
      resultType = 'analysis';
    } else if (content.error) {
      resultType = 'error';
    }

    // Extract key findings
    const keyFindings: string[] = [];
    if (content.title) keyFindings.push(`Document: ${content.title}`);
    if (content.summary) keyFindings.push(content.summary);
    if (content.key_points) keyFindings.push(...content.key_points);
    if (content.findings) keyFindings.push(...content.findings);

    // Calculate relevance score (simple heuristic)
    let relevanceScore = 0.5;
    if (keyFindings.length > 2) relevanceScore += 0.2;
    if (content.title && content.content) relevanceScore += 0.2;
    if (resultType === 'document') relevanceScore += 0.1;

    // Generate summary
    const summary =
      keyFindings.length > 0
        ? keyFindings.slice(0, 2).join('; ')
        : `${toolName} tool executed successfully`;

    return {
      toolName,
      resultType,
      keyFindings,
      relevanceScore: Math.min(relevanceScore, 1.0),
      citationInfo: content.title || content.url,
      summary,
    };
  }

  /**
   * Extract user intent from query
   */
  private extractUserIntent(query: string): string {
    const queryLower = query.toLowerCase();

    if (queryLower.includes('compare') || queryLower.includes('versus')) {
      return 'comparison';
    }
    if (queryLower.includes('analyze') || queryLower.includes('analysis')) {
      return 'analysis';
    }
    if (queryLower.includes('recommend') || queryLower.includes('suggest')) {
      return 'recommendation';
    }
    if (queryLower.includes('explain') || queryLower.includes('understand')) {
      return 'explanation';
    }
    if (queryLower.includes('find') || queryLower.includes('search')) {
      return 'information_retrieval';
    }

    return 'general_inquiry';
  }

  /**
   * Simple hash function for content deduplication
   */
  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}
