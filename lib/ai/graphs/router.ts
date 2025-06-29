/**
 * Graph Routing Logic
 *
 * This module contains the corrected routing logic for the LangGraph implementation.
 * It implements the proper ReAct (Reason-Act-Observe) pattern where tools ALWAYS
 * return to the agent for result processing.
 */

import type { GraphState } from './state';
import { hasToolCalls, isReadyForResponse } from './state';

/**
 * Primary router function with corrected ReAct pattern logic
 *
 * CRITICAL: Tools ALWAYS return to agent - this was the key flaw in the original plan
 */
export function routeNextStep(
  state: GraphState,
): 'agent' | 'tools' | 'generate_response' | '__end__' {
  const lastMessage = state.messages[state.messages.length - 1];

  // 1. Agent requested tools → Execute them
  if (lastMessage?._getType?.() === 'ai' && hasToolCalls(state)) {
    return 'tools';
  }

  // 2. Tools just executed → ALWAYS return to agent to process results
  if (lastMessage?._getType?.() === 'tool') {
    return 'agent'; // This was the critical fix - never go directly to response
  }

  // 3. Agent has final answer (no tool calls) → Generate response
  if (lastMessage?._getType?.() === 'ai' && !hasToolCalls(state)) {
    return 'generate_response';
  }

  // 4. Fallback to end if no clear path
  return '__end__';
}

/**
 * Enhanced router with additional business logic support
 * This version can incorporate service-based decision making
 */
export function routeNextStepEnhanced(
  state: GraphState,
  services?: {
    documentService?: any;
    contextService?: any;
  },
): 'agent' | 'tools' | 'generate_response' | '__end__' {
  const lastMessage = state.messages[state.messages.length - 1];

  // Primary routing logic (same as basic router)
  if (lastMessage?._getType?.() === 'ai' && hasToolCalls(state)) {
    return 'tools';
  }

  if (lastMessage?._getType?.() === 'tool') {
    return 'agent'; // Critical: Tools ALWAYS return to agent
  }

  // Enhanced logic for final response decision
  if (lastMessage?._getType?.() === 'ai' && !hasToolCalls(state)) {
    // Check if we have sufficient information using services
    if (services?.documentService) {
      const analysis = services.documentService.analyzeDocumentScenario(state);

      // For complex multi-document scenarios, ensure we have enough context
      if (analysis.isMultiDocument && !analysis.hasMinimumContext) {
        // Could potentially force additional tool calls, but for now proceed to response
        console.log(
          '[Router] Multi-document scenario detected, proceeding to response generation',
        );
      }
    }

    return 'generate_response';
  }

  return '__end__';
}

// DEPRECATED FUNCTION REMOVED - Use determineResponseMode from utils/responseMode.ts instead

/**
 * Router configuration and edge definitions for graph assembly
 */
export const ROUTER_CONFIG = {
  // Conditional edges mapping
  edges: {
    agent: 'agent',
    tools: 'tools',
    generate_response: 'generate_response',
    __end__: '__end__',
  },

  // Default fallback
  default: '__end__',
};

/**
 * Validation function to ensure router logic is correct
 */
export function validateRouterLogic(): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Critical validation: Ensure tools never route directly to generate_response
  const testState: GraphState = {
    messages: [{ _getType: () => 'tool', content: 'test tool result' } as any],
    input: 'test input',
    agent_outcome: undefined,
    ui: [],
    _lastToolExecutionResults: [],
    toolForcingCount: 0,
    iterationCount: 0,
    needsSynthesis: true,
    response_mode: 'synthesis' as const,
    node_execution_trace: [],
    tool_workflow_state: {
      documentsListed: false,
      documentsRetrieved: [],
      webSearchCompleted: false,
      extractionCompleted: false,
      multiDocAnalysisCompleted: false,
    },
    metadata: {},
  };

  const route = routeNextStep(testState);
  if (route !== 'agent') {
    issues.push(
      'CRITICAL: Tools do not route back to agent - ReAct pattern broken',
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Development helper to trace routing decisions
 */
export function traceRouting(
  state: GraphState,
  stepName: string = 'unknown',
): void {
  const lastMessage = state.messages[state.messages.length - 1];
  const messageType = lastMessage?._getType?.() || 'unknown';
  const hasTools = hasToolCalls(state);
  const route = routeNextStep(state);

  console.log(`[Router] Step: ${stepName}`);
  console.log(`[Router] Last message type: ${messageType}`);
  console.log(`[Router] Has tool calls: ${hasTools}`);
  console.log(`[Router] Next route: ${route}`);
  console.log(
    `[Router] Execution trace: ${state.node_execution_trace?.join(' → ') || 'none'}`,
  );
}
