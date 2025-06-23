/**
 * Modular LangGraph Wrapper - Streamlined Production Implementation
 *
 * This replaces the monolithic SimpleLangGraphWrapper with a clean, maintainable
 * implementation that leverages the modular node architecture, business logic services,
 * and enhanced observability features.
 */

import type { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { RequestLogger } from '../../services/observabilityService';

import { createGraph, type GraphDependencies } from './graph';
import { DocumentAnalysisService } from './services/DocumentAnalysisService';
import { ContextService } from './services/ContextService';
import { QueryAnalysisService } from './services/QueryAnalysisService';
import { loadGraphPrompt } from './prompts/loader';
import type { GraphState } from './state';

/**
 * Enhanced dependencies with business logic services
 */
interface EnhancedGraphDependencies extends GraphDependencies {
  documentService: DocumentAnalysisService;
  contextService: ContextService;
  queryAnalysisService: QueryAnalysisService;
}

/**
 * Configuration for the modular wrapper
 */
export interface ModularLangGraphConfig {
  llm: ChatOpenAI;
  tools: any[];
  logger: RequestLogger;
  currentDateTime?: string;
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
  // Performance and caching options
  enableCaching?: boolean;
  cacheTimeout?: number; // milliseconds
  maxConcurrentTools?: number;
  enableMetrics?: boolean;
}

/**
 * Performance metrics for execution monitoring
 */
interface ExecutionMetrics {
  totalDuration: number;
  nodeExecutionTimes: Record<string, number>;
  toolExecutionTimes: Record<string, number>;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
  cacheHitRate: number;
  iterationCount: number;
}

/**
 * Cache entry for tool results and responses
 */
interface CacheEntry {
  result: any;
  timestamp: number;
  hitCount: number;
}

/**
 * Streamlined LangGraph Wrapper with Enhanced Features
 *
 * Features:
 * - Modular architecture using dedicated nodes and services
 * - Performance monitoring and metrics collection
 * - Intelligent caching with TTL and hit tracking
 * - Error boundaries with fallback strategies
 * - Comprehensive observability and logging
 */
export class ModularLangGraphWrapper {
  private config: ModularLangGraphConfig;
  private graph: ReturnType<typeof createGraph>;
  private dependencies: EnhancedGraphDependencies;

  // Enhanced features
  private toolResultCache = new Map<string, CacheEntry>();
  private responseCache = new Map<string, CacheEntry>();
  private executionMetrics: ExecutionMetrics[] = [];
  private currentExecution?: {
    startTime: number;
    nodeExecutionTimes: Record<string, number>;
    toolExecutionTimes: Record<string, number>;
  };

  constructor(config: ModularLangGraphConfig) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes default
      maxConcurrentTools: 5,
      enableMetrics: true,
      ...config,
    };

    // Initialize business logic services
    const documentService = new DocumentAnalysisService(this.config.logger);
    const contextService = new ContextService(this.config.logger);
    const queryAnalysisService = new QueryAnalysisService(this.config.logger);

    // Setup dependencies with services
    this.dependencies = {
      llm: this.config.llm,
      tools: this.config.tools,
      logger: this.config.logger,
      currentDateTime: this.config.currentDateTime,
      clientConfig: this.config.clientConfig,
      documentService,
      contextService,
      queryAnalysisService,
    };

    // Compile the graph with dependencies
    this.graph = createGraph(this.dependencies);

    this.config.logger.info(
      '[ModularWrapper] Initialized with modular architecture',
      {
        toolCount: this.config.tools.length,
        cachingEnabled: this.config.enableCaching,
        metricsEnabled: this.config.enableMetrics,
      },
    );
  }

  /**
   * Main invoke method - processes messages and returns final response
   */
  async invoke(
    inputMessages: BaseMessage[],
    config?: RunnableConfig,
  ): Promise<any> {
    const startTime = Date.now();
    const sessionId = this.generateSessionId();

    this.config.logger.info('[ModularWrapper] Starting invoke', {
      sessionId,
      messageCount: inputMessages.length,
      enableCaching: this.config.enableCaching,
    });

    try {
      // Initialize execution tracking
      this.startExecutionTracking();

      // Check response cache first
      const cacheKey = this.generateCacheKey(inputMessages);
      if (this.config.enableCaching) {
        const cachedResponse = this.getCachedResponse(cacheKey);
        if (cachedResponse) {
          this.config.logger.info('[ModularWrapper] Cache hit for response', {
            sessionId,
            cacheKey: cacheKey.substring(0, 16),
          });
          return cachedResponse;
        }
      }

      // Determine if synthesis is needed
      const needsSynthesis = this.determineIfSynthesisNeeded(
        inputMessages[0]?.content?.toString() || '',
      );

      // Execute the graph
      const finalState = await this.graph.graph.invoke(
        {
          messages: inputMessages,
          input: inputMessages[0]?.content?.toString() || '',
          needsSynthesis,
        } as GraphState,
        config,
      );

      // Extract final response
      const finalMessage = finalState.messages[finalState.messages.length - 1];

      // Cache the response
      if (this.config.enableCaching) {
        this.cacheResponse(cacheKey, finalMessage);
      }

      // Record execution metrics
      const executionTime = Date.now() - startTime;
      this.recordExecutionMetrics(executionTime, finalState);

      this.config.logger.info(
        '[ModularWrapper] Invoke completed successfully',
        {
          sessionId,
          duration: executionTime,
          responseLength: finalMessage.content?.toString().length || 0,
          iterations: finalState.iterationCount || 0,
          executionTrace: finalState.node_execution_trace || [],
        },
      );

      return finalMessage;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.config.logger.error('[ModularWrapper] Invoke failed', {
        sessionId,
        error: errorMessage,
        duration: executionTime,
      });

      // Fallback error response
      return this.createErrorFallbackResponse(errorMessage);
    }
  }

  /**
   * Streaming method - streams responses with enhanced monitoring
   */
  async *stream(
    inputMessages: BaseMessage[],
    config?: RunnableConfig,
  ): AsyncGenerator<Uint8Array> {
    const startTime = Date.now();
    const sessionId = this.generateSessionId();

    this.config.logger.info('[ModularWrapper] Starting stream', {
      sessionId,
      messageCount: inputMessages.length,
    });

    try {
      this.startExecutionTracking();

      // Determine synthesis requirement
      const needsSynthesis = this.determineIfSynthesisNeeded(
        inputMessages[0]?.content?.toString() || '',
      );

      // Stream from the graph
      const events = this.graph.graph.streamEvents(
        {
          messages: inputMessages,
          input: inputMessages[0]?.content?.toString() || '',
          needsSynthesis,
        } as GraphState,
        {
          version: 'v1',
          ...config,
        },
      );

      let chunkCount = 0;
      let totalBytes = 0;

      for await (const event of events) {
        // Handle streaming events
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk?.content) {
            const encoded = new TextEncoder().encode(chunk.content);
            chunkCount++;
            totalBytes += encoded.length;
            yield encoded;
          }
        }

        // Handle UI events for progress indicators
        if (event.event === 'on_custom_event' && event.data?.ui) {
          const uiData = JSON.stringify(event.data.ui);
          yield new TextEncoder().encode(`data: ${uiData}\n\n`);
        }
      }

      const executionTime = Date.now() - startTime;
      this.config.logger.info('[ModularWrapper] Stream completed', {
        sessionId,
        duration: executionTime,
        chunkCount,
        totalBytes,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.config.logger.error('[ModularWrapper] Stream failed', {
        sessionId,
        error: errorMessage,
        duration: executionTime,
      });

      // Yield error response
      const errorResponse =
        'I apologize, but I encountered an error while processing your request. Please try again.';
      yield new TextEncoder().encode(errorResponse);
    }
  }

  /**
   * Get execution metrics for monitoring and optimization
   */
  getExecutionMetrics(): ExecutionMetrics[] {
    return [...this.executionMetrics];
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStatistics(): {
    toolCacheSize: number;
    responseCacheSize: number;
    totalCacheHits: number;
    cacheHitRate: number;
  } {
    const toolCacheHits = Array.from(this.toolResultCache.values()).reduce(
      (sum, entry) => sum + entry.hitCount,
      0,
    );
    const responseCacheHits = Array.from(this.responseCache.values()).reduce(
      (sum, entry) => sum + entry.hitCount,
      0,
    );

    const totalHits = toolCacheHits + responseCacheHits;
    const totalCacheSize = this.toolResultCache.size + this.responseCache.size;
    const hitRate = totalCacheSize > 0 ? totalHits / totalCacheSize : 0;

    return {
      toolCacheSize: this.toolResultCache.size,
      responseCacheSize: this.responseCache.size,
      totalCacheHits: totalHits,
      cacheHitRate: hitRate,
    };
  }

  /**
   * Clear caches and reset metrics (useful for testing and maintenance)
   */
  clearCaches(): void {
    this.toolResultCache.clear();
    this.responseCache.clear();
    this.executionMetrics = [];
    this.config.logger.info('[ModularWrapper] Caches and metrics cleared');
  }

  /**
   * Get configuration (for external access)
   */
  getConfig(): ModularLangGraphConfig {
    return { ...this.config };
  }

  // Private helper methods

  private determineIfSynthesisNeeded(input: string): boolean {
    const synthesisKeywords = [
      'analyze',
      'analysis',
      'research',
      'compare',
      'comparison',
      'evaluate',
      'report',
      'comprehensive',
      'detailed',
      'investigate',
      'summarize',
      'assessment',
      'review',
      'study',
      'examination',
    ];

    const inputLower = input.toLowerCase();
    return synthesisKeywords.some((keyword) => inputLower.includes(keyword));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(messages: BaseMessage[]): string {
    const content = messages.map((m) => m.content).join('|');
    // Simple hash for cache key (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  private getCachedResponse(cacheKey: string): any | null {
    const entry = this.responseCache.get(cacheKey);
    if (!entry) return null;

    // Check if cache entry is still valid
    const cacheTimeout = this.config.cacheTimeout ?? 300000;
    if (Date.now() - entry.timestamp > cacheTimeout) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    entry.hitCount++;
    return entry.result;
  }

  private cacheResponse(cacheKey: string, response: any): void {
    this.responseCache.set(cacheKey, {
      result: response,
      timestamp: Date.now(),
      hitCount: 0,
    });

    // Clean up expired cache entries periodically
    if (this.responseCache.size > 100) {
      this.cleanupExpiredCacheEntries();
    }
  }

  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();
    const expired: string[] = [];

    const cacheTimeout = this.config.cacheTimeout ?? 300000;
    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > cacheTimeout) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.responseCache.delete(key);
    }

    this.config.logger.info(
      '[ModularWrapper] Cleaned up expired cache entries',
      {
        expiredCount: expired.length,
        remainingCount: this.responseCache.size,
      },
    );
  }

  private startExecutionTracking(): void {
    if (this.config.enableMetrics) {
      this.currentExecution = {
        startTime: Date.now(),
        nodeExecutionTimes: {},
        toolExecutionTimes: {},
      };
    }
  }

  private recordExecutionMetrics(
    totalDuration: number,
    finalState: GraphState,
  ): void {
    if (!this.config.enableMetrics || !this.currentExecution) return;

    const metrics: ExecutionMetrics = {
      totalDuration,
      nodeExecutionTimes: this.currentExecution.nodeExecutionTimes,
      toolExecutionTimes: this.currentExecution.toolExecutionTimes,
      cacheHitRate: this.getCacheStatistics().cacheHitRate,
      iterationCount: finalState.iterationCount || 0,
    };

    this.executionMetrics.push(metrics);

    // Keep only the last 100 execution records
    if (this.executionMetrics.length > 100) {
      this.executionMetrics = this.executionMetrics.slice(-100);
    }

    this.currentExecution = undefined;
  }

  private createErrorFallbackResponse(errorMessage: string): any {
    return {
      content:
        'I apologize, but I encountered an error while processing your request. Please try rephrasing your question or try again.',
      _getType: () => 'ai',
      response_metadata: {
        error: errorMessage,
        fallback: true,
      },
    };
  }
}

/**
 * Factory function for creating the modular wrapper
 */
export function createModularLangGraphWrapper(
  config: ModularLangGraphConfig,
): ModularLangGraphWrapper {
  return new ModularLangGraphWrapper(config);
}
