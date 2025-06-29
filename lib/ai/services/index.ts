/**
 * Services Index
 *
 * Exports all the extracted services from the LangGraph refactor.
 * These services replace the monolithic SimpleLangGraphWrapper logic.
 */

// Phase 1: Tool Execution Services
export { ToolCache } from './ToolCache';
export type { ToolCall, CacheStats } from './ToolCache';

// ToolRegistry removed - now using UnifiedToolRegistry from tools/registry

export { ToolExecutionService } from './ToolExecutionService';
export type {
  ToolExecutionResult,
  ToolExecutionConfig,
} from './ToolExecutionService';

// Phase 2: Response Strategy Services
// QueryIntentAnalyzer removed - consolidated into QueryClassifier
// Types moved to ResponseRouter for now to maintain compatibility

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

// Phase 3.5: Formatting Consolidation Services
export { StandardizedResponseFormatter } from './StandardizedResponseFormatter';
export type {
  ToolResult,
  DocumentResult,
  FormattingOptions,
} from './StandardizedResponseFormatter';

export { UnifiedSystemPromptManager } from './UnifiedSystemPromptManager';
export type { PromptContext } from './UnifiedSystemPromptManager';

// Phase 4: State Management Services
export { StateManagementService } from './StateManagementService';
export type {
  WorkflowStateData,
  StateValidationResult,
  MultiDocumentScenario,
  QueryIntentAnalysis,
} from './StateManagementService';

export { WorkflowOrchestrator } from './WorkflowOrchestrator';
export type {
  WorkflowState,
  ExecutedTool,
  ToolSuggestion,
  WorkflowStatus,
} from './WorkflowOrchestrator';
