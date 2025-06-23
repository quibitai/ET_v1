/**
 * Enhanced Tool Calling System
 *
 * Implements 2024-2025 best practices for AI tool calling:
 * - Structured outputs with strict validation
 * - Semantic tool selection
 * - Comprehensive error handling
 * - Tool execution monitoring
 * - Natural language processing for tool selection
 */

import { z } from 'zod';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// ===== ENHANCED TOOL INTERFACE =====

export interface EnhancedTool {
  /** Tool identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description with usage criteria upfront */
  description: string;
  /** Structured schema with strict validation */
  schema: z.ZodSchema;
  /** Execution handler */
  handler: (params: any, context: ToolExecutionContext) => Promise<ToolResult>;
  /** Tool metadata for intelligent selection */
  metadata: ToolMetadata;
}

export interface ToolMetadata {
  /** Tool category for filtering */
  category: ToolCategory;
  /** Confidence score for semantic matching (0-1) */
  baseConfidence: number;
  /** Keywords for semantic matching */
  keywords: string[];
  /** Usage patterns for context-aware selection */
  usagePatterns: string[];
  /** Whether tool supports error recovery */
  supportsErrorRecovery: boolean;
  /** Whether tool requires authentication */
  requiresAuth: boolean;
  /** Estimated execution time (ms) */
  estimatedDuration: number;
}

export enum ToolCategory {
  PRODUCTIVITY = 'productivity',
  KNOWLEDGE = 'knowledge',
  ANALYSIS = 'analysis',
  COMMUNICATION = 'communication',
  CONTENT = 'content',
  UTILITY = 'utility',
}

export interface ToolExecutionContext {
  sessionId: string;
  requestId: string;
  userIntent: string;
  conversationHistory?: any[];
  urgency?: 'low' | 'medium' | 'high';
  userPreferences?: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    toolId: string;
    duration: number;
    retryCount: number;
    confidence: number;
  };
  suggestions?: string[];
}

// ===== SEMANTIC TOOL SELECTION ENGINE =====

export class SemanticToolSelector {
  private tools = new Map<string, EnhancedTool>();
  private toolVectors = new Map<string, number[]>();

  /**
   * Register a tool with the selector
   */
  registerTool(tool: EnhancedTool): void {
    this.tools.set(tool.id, tool);
    // In a real implementation, you'd compute embeddings here
    // For now, using keyword-based similarity
    this.toolVectors.set(tool.id, this.computeKeywordVector(tool));
  }

  /**
   * Select the most relevant tools for a given query
   */
  async selectTools(
    query: string,
    context: ToolExecutionContext,
    maxTools: number = 5,
  ): Promise<Array<{ tool: EnhancedTool; confidence: number }>> {
    const queryVector = this.computeQueryVector(query);
    const scored: Array<{ tool: EnhancedTool; confidence: number }> = [];

    for (const [toolId, tool] of this.tools) {
      const toolVector = this.toolVectors.get(toolId);
      if (!toolVector) continue;
      const semanticScore = this.cosineSimilarity(queryVector, toolVector);

      // Adjust score based on context
      const contextScore = this.computeContextScore(tool, context);
      const finalScore = semanticScore * 0.7 + contextScore * 0.3;

      if (finalScore > 0.1) {
        // Threshold for relevance
        scored.push({ tool, confidence: finalScore });
      }
    }

    // Sort by confidence and return top results
    return scored
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTools);
  }

  /**
   * Compute keyword-based vector (simplified semantic matching)
   */
  private computeKeywordVector(tool: EnhancedTool): number[] {
    const keywords = [
      ...tool.metadata.keywords,
      ...tool.description.toLowerCase().split(' '),
      ...tool.metadata.usagePatterns,
    ];

    // Create a simple TF-IDF style vector
    const vector: number[] = new Array(100).fill(0);
    keywords.forEach((keyword, index) => {
      vector[index % 100] = keyword.length / 10; // Simplified weighting
    });

    return vector;
  }

  /**
   * Compute query vector for semantic matching
   */
  private computeQueryVector(query: string): number[] {
    const words = query.toLowerCase().split(' ');
    const vector: number[] = new Array(100).fill(0);

    words.forEach((word, index) => {
      vector[index % 100] = word.length / 10;
    });

    return vector;
  }

  /**
   * Compute cosine similarity between vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB) || 0;
  }

  /**
   * Compute context-based score adjustments
   */
  private computeContextScore(
    tool: EnhancedTool,
    context: ToolExecutionContext,
  ): number {
    let score = tool.metadata.baseConfidence;

    // Adjust based on urgency
    if (context.urgency === 'high' && tool.metadata.estimatedDuration > 5000) {
      score *= 0.8; // Penalize slow tools for urgent requests
    }

    // Adjust based on authentication requirements
    if (tool.metadata.requiresAuth) {
      score *= 0.9; // Slight penalty for auth complexity
    }

    return score;
  }
}

// ===== TOOL EXECUTION ENGINE =====

export class ToolExecutionEngine {
  private selector: SemanticToolSelector;
  private retryConfig = { maxRetries: 3, baseDelay: 1000 };

  constructor() {
    this.selector = new SemanticToolSelector();
  }

  /**
   * Register tools with the execution engine
   */
  registerTools(tools: EnhancedTool[]): void {
    tools.forEach((tool) => this.selector.registerTool(tool));
  }

  /**
   * Execute a tool call with comprehensive error handling
   */
  async executeTool(
    query: string,
    params: any,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const startTime = performance.now();
    let retryCount = 0;

    // Select the best tool for the query
    const selectedTools = await this.selector.selectTools(query, context, 1);

    if (selectedTools.length === 0) {
      return {
        success: false,
        error: 'No suitable tool found for the given query',
        metadata: {
          toolId: 'none',
          duration: performance.now() - startTime,
          retryCount: 0,
          confidence: 0,
        },
        suggestions: ['Try rephrasing your request', 'Check available tools'],
      };
    }

    const { tool, confidence } = selectedTools[0];

    // Validate parameters against schema
    const validation = tool.schema.safeParse(params);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.error.message}`,
        metadata: {
          toolId: tool.id,
          duration: performance.now() - startTime,
          retryCount: 0,
          confidence,
        },
        suggestions: ['Check parameter format', 'Review tool documentation'],
      };
    }

    // Execute with retry logic
    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        // Track tool usage
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolId: tool.id,
            toolName: tool.name,
            confidence,
            retryCount,
            sessionId: context.sessionId,
            userIntent: context.userIntent,
            timestamp: new Date().toISOString(),
          },
        });

        const result = await tool.handler(validation.data, context);
        const duration = performance.now() - startTime;

        // Track successful completion
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolId: tool.id,
            success: true,
            duration: Math.round(duration),
            retryCount,
            confidence,
            timestamp: new Date().toISOString(),
          },
        });

        return {
          ...result,
          metadata: {
            toolId: tool.id,
            duration,
            retryCount,
            confidence,
          },
        };
      } catch (error) {
        retryCount++;

        if (retryCount > this.retryConfig.maxRetries) {
          const duration = performance.now() - startTime;

          // Track error
          await trackEvent({
            eventName: ANALYTICS_EVENTS.TOOL_USED,
            properties: {
              toolId: tool.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: Math.round(duration),
              retryCount,
              confidence,
              timestamp: new Date().toISOString(),
            },
          });

          return {
            success: false,
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              toolId: tool.id,
              duration,
              retryCount,
              confidence,
            },
            suggestions: this.generateErrorSuggestions(tool, error),
          };
        }

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            this.retryConfig.baseDelay * Math.pow(2, retryCount - 1),
          ),
        );
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected execution path');
  }

  /**
   * Generate helpful error suggestions
   */
  private generateErrorSuggestions(tool: EnhancedTool, error: any): string[] {
    const suggestions: string[] = [];

    if (tool.metadata.requiresAuth) {
      suggestions.push('Check authentication credentials');
    }

    if (error?.message?.includes('timeout')) {
      suggestions.push(
        'Try again - the service may be temporarily unavailable',
      );
    }

    if (error?.message?.includes('rate limit')) {
      suggestions.push('Wait a moment before trying again');
    }

    suggestions.push('Contact support if the issue persists');

    return suggestions;
  }
}

// ===== EXPORT FACTORY =====

/**
 * Create an enhanced tool calling system instance
 */
export function createEnhancedToolSystem(): ToolExecutionEngine {
  return new ToolExecutionEngine();
}

// ===== UTILITY FUNCTIONS =====

/**
 * Convert LangChain DynamicStructuredTool to EnhancedTool
 */
export function convertLangChainTool(
  langchainTool: DynamicStructuredTool,
  metadata: ToolMetadata,
): EnhancedTool {
  return {
    id: langchainTool.name,
    name: langchainTool.name,
    description: langchainTool.description,
    schema: langchainTool.schema as z.ZodSchema,
    handler: async (params: any, context: ToolExecutionContext) => {
      const result = await langchainTool.func(params);
      return {
        success: true,
        data: result,
        metadata: {
          toolId: langchainTool.name,
          duration: 0, // Will be set by execution engine
          retryCount: 0,
          confidence: 1,
        },
      };
    },
    metadata,
  };
}

// If DynamicStructuredTool is imported from a library, extend it locally for development purposes:

export interface ExtendedDynamicStructuredTool extends DynamicStructuredTool {
  responseType?: string;
}
