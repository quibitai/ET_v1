/**
 * LangGraph Implementations Index
 *
 * Central export point for all LangGraph implementations and factory functions.
 * Provides a simple interface for creating graphs based on query patterns.
 * 
 * UPDATED: Following Development Roadmap v6.0.0 - Simple implementations only
 */

export { BaseLangGraphFactory } from './base';
export type {
  LangGraphConfig,
  BaseGraphState,
  MultiStepReasoningState,
  KnowledgeRetrievalState,
  WorkflowState,
  GraphExecutionResult,
  ErrorRecoveryStrategy,
  InterruptionReason,
} from './types';

// Simple LangGraph implementation following roadmap simplification
export { createGraph, createConfiguredGraph } from './graph';
export type { GraphState } from './state';

// Import for internal use
import { createConfiguredGraph } from './graph';

// Simple prompt system following roadmap simplification
export { createSystemMessage, createAgentPrompt } from './prompts/simple';

/**
 * Create a simple LangGraph wrapper for backward compatibility
 * Following roadmap simplification - no complex service layers
 */
export function createSimpleLangGraphWrapper(config: {
  llm: any;
  tools: any[];
  logger?: any;
  responseMode?: string;
}) {
  const { llm, tools } = config;
  const { graph, config: graphConfig } = createConfiguredGraph(llm, tools);
  
  return {
    async stream(input: any): Promise<AsyncIterable<string>> {
      const graphInput = {
        messages: input.messages || [],
        input: input.input || '',
        response_mode: config.responseMode || 'synthesis',
      };

      async function* streamResults() {
        try {
          // FIXED: SimpleGraph now yields strings directly, not state objects
          for await (const token of graph.stream(graphInput)) {
            // Token is already a string - yield it directly
            if (typeof token === 'string') {
              yield token;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield `Error in graph execution: ${errorMessage}`;
        }
      }

      return streamResults();
    }
  };
}

// Maintain backwards compatibility with existing aliases
export { createSimpleLangGraphWrapper as createModularLangGraphWrapper };
export { createSimpleLangGraphWrapper as createLangGraphWrapper };

/**
 * Create a LangGraph based on query complexity and patterns
 * SIMPLIFIED: Now uses simple graph implementation
 */
export function createGraphForPatterns(patterns: string[], config: any) {
  return createSimpleLangGraphWrapper(config);
}

/**
 * Determine if a query should use LangGraph based on patterns
 */
export function shouldUseLangGraph(patterns: string[]): boolean {
  // Safety check for undefined or null patterns
  if (!patterns || !Array.isArray(patterns)) {
    return false;
  }

  // Criteria for using LangGraph:
  // - Complex tool operations
  // - Multi-step reasoning needed
  // - Workflow orchestration
  const complexPatterns = [
    'TOOL_OPERATION',
    'MULTI_STEP',
    'REASONING',
    'WORKFLOW',
    'KNOWLEDGE_RETRIEVAL',
  ];

  return patterns.some((pattern) => {
    // Safety check for undefined pattern
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }
    return complexPatterns.some((complex) => pattern.includes(complex));
  });
}
