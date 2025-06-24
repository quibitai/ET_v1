/**
 * LangGraph Implementations Index
 *
 * Central export point for all LangGraph implementations and factory functions.
 * Provides a simple interface for creating graphs based on query patterns.
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

// Primary LangGraph implementation (ModularLangGraphWrapper)
export {
  ModularLangGraphWrapper,
  createModularLangGraphWrapper,
} from './ModularLangGraphWrapper';
export type { ModularLangGraphConfig } from './ModularLangGraphWrapper';

// Maintain backwards compatibility with existing aliases
export { ModularLangGraphWrapper as SimpleLangGraphWrapper } from './ModularLangGraphWrapper';
export { createModularLangGraphWrapper as createLangGraphWrapper } from './ModularLangGraphWrapper';
export type { ModularLangGraphConfig as LangGraphWrapperConfig } from './ModularLangGraphWrapper';

/**
 * Create a LangGraph based on query complexity and patterns
 * UPDATED: Now uses ModularLangGraphWrapper by default
 */
export function createGraphForPatterns(patterns: string[], config: any) {
  // Use the new ModularLangGraphWrapper for all patterns
  const { createModularLangGraphWrapper } = require('./ModularLangGraphWrapper');
  return createModularLangGraphWrapper(config);
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
