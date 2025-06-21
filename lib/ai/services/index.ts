/**
 * Services Index
 *
 * Exports all the extracted services from the LangGraph refactor.
 * These services replace the monolithic SimpleLangGraphWrapper logic.
 */

// Phase 1: Tool Execution Services
export { ToolCache } from './ToolCache';
export type { ToolCall, CacheStats } from './ToolCache';

export { ToolRegistry } from './ToolRegistry';
export type { ToolDefinition, ToolRegistrationResult } from './ToolRegistry';

export { ToolExecutionService } from './ToolExecutionService';
export type {
  ToolExecutionResult,
  ToolExecutionConfig,
} from './ToolExecutionService';

// Phase 2: Response Strategy Services
export { QueryIntentAnalyzer } from './QueryIntentAnalyzer';
export type { QueryIntent, GraphState } from './QueryIntentAnalyzer';

export { ResponseRouter } from './ResponseRouter';
export type { RouteDecision, RouteContext } from './ResponseRouter';

export { ResponseStrategyFactory } from './ResponseStrategyFactory';
export type {
  IResponseStrategy,
  ResponseStrategyConfig,
  ResponseStrategyType,
} from './ResponseStrategyFactory';

// Phase 2: Individual Response Strategies
export { ConversationalResponseStrategy } from './strategies/ConversationalResponseStrategy';
export { SimpleResponseStrategy } from './strategies/SimpleResponseStrategy';
export { SynthesisResponseStrategy } from './strategies/SynthesisResponseStrategy';
