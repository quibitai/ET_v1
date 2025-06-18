/**
 * Graph State Definitions for LangGraph
 *
 * This module contains all state management definitions for the modular LangGraph implementation.
 * Extracted from SimpleLangGraphWrapper for better organization and maintainability.
 *
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
 * - Added metadata field for execution plan storage
 * - Support for strategic planning context in graph state
 * - Enables Plan-and-Execute pattern implementation
 */

import { Annotation } from '@langchain/langgraph';
import type { BaseMessage, AIMessage } from '@langchain/core/messages';
// NEW: Import ExecutionPlan type for strategic planning
import type { ExecutionPlan } from './services/PlannerService';

// UI message type with proper metadata
export interface UIMessage {
  id: string;
  name: string;
  props: Record<string, any>;
  metadata?: {
    message_id?: string;
    toolCallId?: string;
    toolName?: string;
  };
}

/**
 * Enhanced Graph State Annotation with improved observability and execution plan support
 */
export const GraphStateAnnotation = Annotation.Root({
  // Core message flow
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[] = [], y: BaseMessage[] = []) => x.concat(y),
    default: () => [],
  }),

  // User input
  input: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),

  // Agent's final response
  agent_outcome: Annotation<AIMessage | undefined>({
    reducer: (x?: AIMessage, y?: AIMessage) => y ?? x,
    default: () => undefined,
  }),

  // UI streaming messages
  ui: Annotation<UIMessage[]>({
    reducer: (x: UIMessage[] = [], y: UIMessage[] = []) => {
      const existingIds = new Set(x.map((ui) => ui.id));
      const filtered = y.filter((ui) => !existingIds.has(ui.id));
      return [...x, ...filtered];
    },
    default: () => [],
  }),

  // Tool execution results cache
  _lastToolExecutionResults: Annotation<any[]>({
    reducer: (x: any[] = [], y: any[] = []) => [...x, ...y],
    default: () => [],
  }),

  // Tool forcing count for complex scenarios
  toolForcingCount: Annotation<number>({
    reducer: (x = 0, y = 0) => Math.max(x, y),
    default: () => 0,
  }),

  // Iteration tracking
  iterationCount: Annotation<number>({
    reducer: (x = 0, y = 0) => Math.max(x, y),
    default: () => 0,
  }),

  // Synthesis requirement flag
  needsSynthesis: Annotation<boolean>({
    reducer: (x = true, y = true) => y,
    default: () => true,
  }),

  // Enhanced observability fields
  response_mode: Annotation<'synthesis' | 'simple' | 'conversational'>({
    reducer: (x, y) => y ?? x,
    default: () => 'synthesis',
  }),

  node_execution_trace: Annotation<string[]>({
    reducer: (x: string[] = [], y: string[] = []) => [...x, ...y],
    default: () => [],
  }),

  // Tool workflow state tracking
  tool_workflow_state: Annotation<{
    documentsListed: boolean;
    documentsRetrieved: string[];
    webSearchCompleted: boolean;
    extractionCompleted: boolean;
    multiDocAnalysisCompleted: boolean;
  }>({
    reducer: (x, y) => y ?? x,
    default: () => ({
      documentsListed: false,
      documentsRetrieved: [],
      webSearchCompleted: false,
      extractionCompleted: false,
      multiDocAnalysisCompleted: false,
    }),
  }),

  // NEW: Metadata field for execution plan and other contextual information
  metadata: Annotation<{
    executionPlan?: ExecutionPlan;
    fileContext?: any;
    brainRequest?: any;
    planningMetrics?: {
      planCreatedAt: number;
      planDuration: number;
      planAccuracy?: number;
    };
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

export type GraphState = typeof GraphStateAnnotation.State;

/**
 * Type definitions for enhanced observability
 */
export interface NodeExecutionMetrics {
  nodeName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export interface DocumentScenario {
  isMultiDocument: boolean;
  documentsFound: number;
  recommendedResponseMode: 'synthesis' | 'simple' | 'conversational';
  requiresSpecialHandling: boolean;
  recommendedRoute: string;
}

export interface ResponseStrategy {
  type: 'comparative_analysis' | 'analytical_report' | 'general_response';
  mode: 'synthesis' | 'simple' | 'conversational';
}

/**
 * State utility functions
 */

/**
 * Extract the last human message from state
 */
export function getLastHumanMessage(state: GraphState): string {
  const humanMessage = state.messages.find(
    (msg) => msg._getType?.() === 'human',
  );
  if (!humanMessage?.content) return '';

  // Handle different content types
  if (typeof humanMessage.content === 'string') {
    return humanMessage.content;
  }

  // If content is an array, extract text content
  if (Array.isArray(humanMessage.content)) {
    const textContent = humanMessage.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join(' ');
    return textContent;
  }

  return '';
}

/**
 * Extract all tool messages from state
 */
export function getToolMessages(state: GraphState): BaseMessage[] {
  return state.messages.filter((msg) => msg._getType?.() === 'tool');
}

/**
 * Check if state contains tool calls
 */
export function hasToolCalls(state: GraphState): boolean {
  const lastMessage = state.messages[state.messages.length - 1];
  return !!(lastMessage as AIMessage)?.tool_calls?.length;
}

/**
 * Get execution trace as string
 */
export function getExecutionTrace(state: GraphState): string {
  return state.node_execution_trace?.join(' → ') || '';
}

/**
 * Check if workflow is ready for final response
 */
export function isReadyForResponse(state: GraphState): boolean {
  const lastMessage = state.messages[state.messages.length - 1];
  return (
    lastMessage?._getType?.() === 'ai' &&
    !(lastMessage as AIMessage).tool_calls?.length
  );
}
