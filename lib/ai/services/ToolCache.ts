/**
 * Tool Cache Service
 *
 * Extracted from SimpleLangGraphWrapper to handle tool result caching
 * with sophisticated deduplication and semantic similarity detection.
 *
 * Features:
 * - Intelligent cache key generation
 * - Semantic similarity detection for tool calls
 * - Cache hit/miss tracking
 * - Performance monitoring
 */

import type { RequestLogger } from '../../services/observabilityService';
import { ToolMessage } from '@langchain/core/messages';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalCalls: number;
}

export class ToolCache {
  private cache = new Map<string, any>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalCalls: 0,
  };

  constructor(private logger: RequestLogger) {}

  /**
   * Generate cache key for tool calls with aggressive semantic similarity detection
   * ENHANCED with comprehensive normalization for common patterns
   */
  generateKey(toolCall: ToolCall): string {
    const { name, args = {} } = toolCall;

    this.logger.info('[Tool Cache] Generating cache key', {
      toolName: name,
      args,
      toolCallStructure: Object.keys(toolCall),
    });

    // AGGRESSIVE FIX: All listDocuments calls are identical regardless of parameters
    if (name === 'listDocuments') {
      return `${name}:all`;
    }

    // ENHANCED: Normalize tavilySearch queries for comprehensive searches
    if (name === 'tavilySearch' && args.query) {
      const query = args.query.toLowerCase();

      // COMPREHENSIVE LWCC NORMALIZATION: All LWCC searches map to same cache key
      if (query.includes('lwcc')) {
        const aspects = this.extractSearchAspects(query);

        // If comprehensive search (3+ aspects), use comprehensive cache key
        if (aspects.length >= 3) {
          return `${name}:lwcc_comprehensive_search`;
        }

        // Otherwise, use specific aspect-based cache key
        return `${name}:lwcc_${aspects.sort().join('_') || 'general'}`;
      }

      // GENERAL COMPANY NORMALIZATION: Handle other company searches
      const companyMatch = query.match(
        /\b([a-z]+(?:\s+[a-z]+)*)\s+(?:company|corp|inc|llc|corporation|limited)/,
      );
      if (companyMatch) {
        const companyName = companyMatch[1].replace(/\s+/g, '_');
        return `${name}:${companyName}_company_comprehensive`;
      }
    }

    // AGGRESSIVE FIX: Normalize searchInternalKnowledgeBase queries
    if (name === 'searchInternalKnowledgeBase' && args.query) {
      const query = args.query.toLowerCase();

      // Normalize client research queries
      if (query.includes('client research') || query.includes('ideal client')) {
        return `${name}:client_research_examples`;
      }

      // Normalize Echo Tango queries
      if (query.includes('echo tango')) {
        return `${name}:echo_tango_info`;
      }
    }

    // AGGRESSIVE FIX: Normalize getDocumentContents by document type
    if (name === 'getDocumentContents' && (args.id || args.title)) {
      const identifier = (args.id || args.title || '').toLowerCase();

      // Group similar document types
      if (
        identifier.includes('ideal_client') ||
        identifier.includes('ideal client')
      ) {
        return `${name}:ideal_client_profile`;
      }

      if (
        identifier.includes('core_values') ||
        identifier.includes('core values')
      ) {
        return `${name}:echo_tango_values`;
      }

      if (
        identifier.includes('client_research') ||
        identifier.includes('client research')
      ) {
        return `${name}:client_research_template`;
      }
    }

    // Fallback: Use exact parameters for other tools
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((result, key) => {
        result[key] = args[key];
        return result;
      }, {} as any);

    return `${name}:${JSON.stringify(sortedArgs)}`;
  }

  /**
   * Extract search aspects from query for better caching
   */
  private extractSearchAspects(query: string): string[] {
    const aspects = [];
    if (
      query.includes('profile') ||
      query.includes('about') ||
      query.includes('overview') ||
      query.includes('company')
    ) {
      aspects.push('profile');
    }
    if (query.includes('mission') || query.includes('purpose')) {
      aspects.push('mission');
    }
    if (query.includes('values') || query.includes('culture')) {
      aspects.push('values');
    }
    if (
      query.includes('leadership') ||
      query.includes('management') ||
      query.includes('executives')
    ) {
      aspects.push('leadership');
    }
    if (
      query.includes('news') ||
      query.includes('recent') ||
      query.includes('latest')
    ) {
      aspects.push('news');
    }
    if (query.includes('services') || query.includes('products')) {
      aspects.push('services');
    }
    if (query.includes('industry') || query.includes('sector')) {
      aspects.push('industry');
    }
    return aspects;
  }

  /**
   * Get cached result for a tool call
   */
  get(toolCall: ToolCall): any | undefined {
    const cacheKey = this.generateKey(toolCall);
    const result = this.cache.get(cacheKey);

    this.stats.totalCalls++;

    if (result !== undefined) {
      this.stats.hits++;
      this.logger.info(`[Tool Cache] 🎯 Cache HIT for ${toolCall.name}`, {
        toolId: toolCall.id,
        cacheKey,
        cachedContent:
          typeof result === 'string'
            ? `${result.substring(0, 100)}...`
            : 'object',
      });
    } else {
      this.stats.misses++;
      this.logger.info(`[Tool Cache] ❌ Cache MISS for ${toolCall.name}`, {
        toolId: toolCall.id,
        cacheKey,
      });
    }

    this.updateHitRate();
    return result;
  }

  /**
   * Set cached result for a tool call
   */
  set(toolCall: ToolCall, result: any): void {
    const cacheKey = this.generateKey(toolCall);
    this.cache.set(cacheKey, result);

    this.logger.info(`[Tool Cache] ✅ Cached result for ${toolCall.name}`, {
      toolId: toolCall.id,
      cacheKey,
    });
  }

  /**
   * Get cached results for multiple tool calls
   */
  getCachedResults(toolCalls: ToolCall[]): {
    cached: ToolMessage[];
    toExecute: ToolCall[];
  } {
    const cached: ToolMessage[] = [];
    const toExecute: ToolCall[] = [];

    for (const toolCall of toolCalls) {
      const cachedResult = this.get(toolCall);

      if (cachedResult !== undefined) {
        // Create a tool message with the cached result
        const toolMessage = new ToolMessage({
          content:
            typeof cachedResult === 'string'
              ? cachedResult
              : JSON.stringify(cachedResult),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
        cached.push(toolMessage);
      } else {
        toExecute.push(toolCall);
      }
    }

    return { cached, toExecute };
  }

  /**
   * Cache results for multiple tool calls
   */
  cacheResults(toolCalls: ToolCall[], toolMessages: any[]): void {
    // Match tool calls with their results
    const toolCallsById = new Map(toolCalls.map((tc) => [tc.id, tc]));

    for (const toolMessage of toolMessages) {
      if (toolMessage.tool_call_id) {
        const toolCall = toolCallsById.get(toolMessage.tool_call_id);
        if (toolCall) {
          this.set(toolCall, toolMessage.content);
        }
      }
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    this.stats.hitRate =
      this.stats.totalCalls > 0 ? this.stats.hits / this.stats.totalCalls : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalCalls: 0,
    };
    this.logger.info('[Tool Cache] Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}
