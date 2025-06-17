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

/**
 * Utility function to determine response mode based on conversation state
 */
export function determineResponseMode(
  state: GraphState,
): 'synthesis' | 'simple' | 'conversational' {
  const messages = state.messages;
  const toolMessages = messages.filter((msg) => msg._getType?.() === 'tool');

  // If we have multiple tool results, likely need synthesis
  if (toolMessages.length > 2) {
    return 'synthesis';
  }

  // If we have document retrieval results, likely need analysis
  const hasDocuments = toolMessages.some((msg) => {
    try {
      const content =
        typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      return content.document_id || content.title;
    } catch {
      return false;
    }
  });

  if (hasDocuments) {
    return 'synthesis';
  }

  // Check for conversational indicators in the original query
  const humanMessage = messages.find((msg) => msg._getType?.() === 'human');
  if (humanMessage?.content) {
    const content =
      typeof humanMessage.content === 'string'
        ? humanMessage.content
        : JSON.stringify(humanMessage.content);

    const conversationalKeywords = [
      'chat',
      'discuss',
      'talk about',
      'tell me about',
      'what do you think',
      'opinion',
      'recommend',
      'suggest',
      'advice',
    ];

    if (
      conversationalKeywords.some((keyword) =>
        content.toLowerCase().includes(keyword),
      )
    ) {
      return 'conversational';
    }
  }

  // Default to simple for straightforward queries
  return 'simple';
}

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
  const testState: Partial<GraphState> = {
    messages: [{ _getType: () => 'tool', content: 'test tool result' } as any],
  };

  const route = routeNextStep(testState as GraphState);
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
