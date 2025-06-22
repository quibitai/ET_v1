/**
 * StateManagementService - Centralized State Management for LangGraph
 *
 * Handles all graph state operations, validations, and transitions.
 * Replaces scattered state management logic throughout SimpleLangGraphWrapper.
 */

import type { BaseMessage } from '@langchain/core/messages';

export interface GraphState {
  messages: BaseMessage[];
  toolCalls?: any[];
  [key: string]: any;
}

export interface WorkflowStateData {
  documentsListed: boolean;
  documentsRetrieved: string[];
  webSearchCompleted: boolean;
  extractionCompleted: boolean;
  multiDocAnalysisCompleted: boolean;
}

export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MultiDocumentScenario {
  isMultiDocument: boolean;
  documentsFound: number;
  analysisType?: string;
  toolsUsed: string[];
}

export interface QueryIntentAnalysis {
  intentType:
    | 'analysis'
    | 'research'
    | 'simple_lookup'
    | 'conversational'
    | 'creative';
  complexity: 'high' | 'medium' | 'low';
  requiresDeepAnalysis: boolean;
  suggestedResponseType:
    | 'synthesis'
    | 'simple_response'
    | 'conversational_response';
}

export namespace StateManagementService {
  /**
   * Initialize a new graph state with default values
   */
  export function initializeGraphState(
    initialMessages: BaseMessage[] = [],
  ): GraphState {
    return {
      messages: initialMessages,
      toolCalls: [],
    };
  }

  /**
   * Validate graph state structure and content
   */
  export function validateGraphState(state: GraphState): StateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required properties
    if (!state.messages) {
      errors.push('Graph state missing required messages array');
    } else if (!Array.isArray(state.messages)) {
      errors.push('Graph state messages must be an array');
    }

    // Check message structure
    if (state.messages && Array.isArray(state.messages)) {
      state.messages.forEach((msg, index) => {
        if (!msg || typeof msg !== 'object') {
          errors.push(`Invalid message at index ${index}: must be an object`);
        }
        if (msg && typeof msg._getType !== 'function') {
          warnings.push(`Message at index ${index} missing _getType method`);
        }
      });
    }

    // Check tool calls if present
    if (state.toolCalls && !Array.isArray(state.toolCalls)) {
      errors.push('Graph state toolCalls must be an array if present');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Merge partial state updates into existing state
   */
  export function mergeGraphState(
    currentState: GraphState,
    partialUpdate: Partial<GraphState>,
  ): GraphState {
    return {
      ...currentState,
      ...partialUpdate,
      // Special handling for messages array
      messages: partialUpdate.messages || currentState.messages,
    };
  }

  /**
   * Extract user query from graph state messages
   */
  export function extractUserQuery(state: GraphState): string {
    if (!state.messages || state.messages.length === 0) {
      return '';
    }

    // Find the most recent human message
    const humanMessages = state.messages.filter(
      (msg) => msg._getType() === 'human',
    );
    const lastHumanMessage = humanMessages[humanMessages.length - 1];

    if (!lastHumanMessage) {
      return '';
    }

    return typeof lastHumanMessage.content === 'string'
      ? lastHumanMessage.content
      : '';
  }

  /**
   * Extract tool messages from graph state
   */
  export function extractToolMessages(state: GraphState): BaseMessage[] {
    if (!state.messages || state.messages.length === 0) {
      return [];
    }

    return state.messages.filter((msg) => msg._getType() === 'tool');
  }

  /**
   * Check if state has minimum data for synthesis
   */
  export function hasMinimumDataForSynthesis(state: GraphState): boolean {
    const toolMessages = extractToolMessages(state);
    const userQuery = extractUserQuery(state);

    // Must have at least one tool result and a user query
    if (toolMessages.length === 0 || !userQuery.trim()) {
      return false;
    }

    // Check for substantial content in tool results
    const hasSubstantialContent = toolMessages.some((msg) => {
      if (!msg.content) return false;

      try {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        return content.length > 50; // Minimum content threshold
      } catch {
        return false;
      }
    });

    return hasSubstantialContent;
  }

  /**
   * Detect multi-document scenario from state
   */
  export function detectMultiDocumentScenario(
    state: GraphState,
  ): MultiDocumentScenario {
    const toolMessages = extractToolMessages(state);
    const userQuery = extractUserQuery(state);

    let documentsFound = 0;
    let analysisType: string | undefined;
    const toolsUsed: string[] = [];

    // Analyze tool results for document indicators
    toolMessages.forEach((msg) => {
      const toolName = (msg as any)?.name || 'unknown';
      toolsUsed.push(toolName);

      try {
        const content =
          typeof msg.content === 'string'
            ? JSON.parse(msg.content)
            : msg.content;

        // Count documents from various tool types
        if (
          content?.available_documents &&
          Array.isArray(content.available_documents)
        ) {
          documentsFound += content.available_documents.length;
        }

        if (content?.documents && Array.isArray(content.documents)) {
          documentsFound += content.documents.length;
        }

        if (content?.results && Array.isArray(content.results)) {
          documentsFound += content.results.length;
        }
      } catch {
        // Ignore parsing errors
      }
    });

    // Determine analysis type from query
    const queryLower = userQuery.toLowerCase();
    if (
      queryLower.includes('compare') ||
      queryLower.includes('vs') ||
      queryLower.includes('versus')
    ) {
      analysisType = 'comparison';
    } else if (
      queryLower.includes('analyze') ||
      queryLower.includes('analysis')
    ) {
      analysisType = 'analysis';
    } else if (
      queryLower.includes('summary') ||
      queryLower.includes('summarize')
    ) {
      analysisType = 'summary';
    }

    return {
      isMultiDocument: documentsFound > 1,
      documentsFound,
      analysisType,
      toolsUsed: [...new Set(toolsUsed)], // Remove duplicates
    };
  }

  /**
   * Analyze query intent from state
   */
  export function analyzeQueryIntent(state: GraphState): QueryIntentAnalysis {
    const userQuery = extractUserQuery(state);
    const toolMessages = extractToolMessages(state);

    const queryLower = userQuery.toLowerCase();
    const hasToolResults = toolMessages.length > 0;

    // Determine intent type
    let intentType: QueryIntentAnalysis['intentType'] = 'simple_lookup';

    if (
      queryLower.includes('analyze') ||
      queryLower.includes('analysis') ||
      queryLower.includes('compare') ||
      queryLower.includes('evaluate')
    ) {
      intentType = 'analysis';
    } else if (
      queryLower.includes('research') ||
      queryLower.includes('investigate') ||
      queryLower.includes('study') ||
      queryLower.includes('report')
    ) {
      intentType = 'research';
    } else if (
      queryLower.includes('create') ||
      queryLower.includes('write') ||
      queryLower.includes('generate') ||
      queryLower.includes('design')
    ) {
      intentType = 'creative';
    } else if (
      queryLower.includes('chat') ||
      queryLower.includes('discuss') ||
      queryLower.includes('talk') ||
      queryLower.includes('conversation')
    ) {
      intentType = 'conversational';
    }

    // Determine complexity
    let complexity: QueryIntentAnalysis['complexity'] = 'low';

    const complexityIndicators = [
      'comprehensive',
      'detailed',
      'thorough',
      'complete',
      'extensive',
      'analyze',
      'compare',
      'evaluate',
      'assess',
      'investigate',
    ];

    const mediumComplexityIndicators = [
      'explain',
      'describe',
      'summarize',
      'overview',
      'outline',
    ];

    if (
      complexityIndicators.some((indicator) => queryLower.includes(indicator))
    ) {
      complexity = 'high';
    } else if (
      mediumComplexityIndicators.some((indicator) =>
        queryLower.includes(indicator),
      )
    ) {
      complexity = 'medium';
    }

    // Determine if deep analysis is required
    const requiresDeepAnalysis =
      intentType === 'analysis' ||
      intentType === 'research' ||
      complexity === 'high' ||
      hasToolResults;

    // Suggest response type
    let suggestedResponseType: QueryIntentAnalysis['suggestedResponseType'] =
      'simple_response';

    if (requiresDeepAnalysis || hasToolResults) {
      suggestedResponseType = 'synthesis';
    } else if (intentType === 'conversational') {
      suggestedResponseType = 'conversational_response';
    }

    return {
      intentType,
      complexity,
      requiresDeepAnalysis,
      suggestedResponseType,
    };
  }

  /**
   * Check if state should force synthesis
   */
  export function shouldForceSynthesis(state: GraphState): boolean {
    const toolMessages = extractToolMessages(state);
    const userQuery = extractUserQuery(state);
    const multiDocScenario = detectMultiDocumentScenario(state);

    // Force synthesis for multi-document scenarios
    if (multiDocScenario.isMultiDocument) {
      return true;
    }

    // Force synthesis for research queries with tool results
    const isResearchQuery =
      userQuery.toLowerCase().includes('research') ||
      userQuery.toLowerCase().includes('analysis') ||
      userQuery.toLowerCase().includes('report');

    if (isResearchQuery && toolMessages.length > 0) {
      return true;
    }

    // Force synthesis when multiple tools were used
    const uniqueTools = new Set(
      toolMessages.map((msg) => (msg as any)?.name || 'unknown'),
    );

    if (uniqueTools.size > 1) {
      return true;
    }

    return false;
  }

  /**
   * Get current state summary for debugging
   */
  export function getStateSummary(state: GraphState): Record<string, any> {
    const toolMessages = extractToolMessages(state);
    const userQuery = extractUserQuery(state);
    const validation = validateGraphState(state);
    const multiDocScenario = detectMultiDocumentScenario(state);
    const queryIntent = analyzeQueryIntent(state);

    return {
      messageCount: state.messages?.length || 0,
      toolMessageCount: toolMessages.length,
      userQuery:
        userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
      isValid: validation.isValid,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      multiDocScenario,
      queryIntent,
      hasMinimumData: hasMinimumDataForSynthesis(state),
      shouldForceSynthesis: shouldForceSynthesis(state),
    };
  }
}
