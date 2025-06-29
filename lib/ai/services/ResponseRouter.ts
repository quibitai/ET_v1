/**
 * Response Router Service
 *
 * Handles routing decisions for the LangGraph workflow, determining the next step
 * based on message state, tool execution, and workflow management.
 * Extracted from SimpleLangGraphWrapper for better separation of concerns.
 *
 * @module ResponseRouter
 */

import type { RequestLogger } from '../../services/observabilityService';
import {
  QueryClassifier,
  type QueryClassificationResult,
} from '../../services/queryClassifier';
import { SynthesisValidator } from '../core/SynthesisValidator';
import type { GraphState } from './QueryIntentAnalyzer'; // Keep GraphState type for now

export type RouteDecision =
  | 'use_tools'
  | 'synthesis'
  | 'simple_response'
  | 'conversational_response'
  | '__end__';

export interface RouteContext {
  workflowManager: any; // ToolWorkflowManager - avoiding circular dependency for now
  synthesisValidator: SynthesisValidator;
  redundancyChecker: (
    state: GraphState,
    toolCalls: any[],
  ) => {
    isRedundant: boolean;
    reason: string;
    redundantToolCount: number;
  };
  multiDocDetector: (state: GraphState) => {
    isMultiDocument: boolean;
    documentsFound: number;
    analysisType?: string;
    toolsUsed: string[];
  };
}

/**
 * Service for making routing decisions in the LangGraph workflow
 */
export class ResponseRouter {
  private logger: RequestLogger;
  private queryClassifier: QueryClassifier;
  private readonly MAX_ITERATIONS = 3;
  private readonly MAX_TOOL_FORCING = 2;

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.queryClassifier = new QueryClassifier(logger);
  }

  /**
   * Convert QueryClassifier result to QueryIntent format for compatibility
   */
  private async analyzeQueryIntent(state: GraphState): Promise<{
    intentType: string;
    complexity: string;
    requiresDeepAnalysis: boolean;
    suggestedResponseType: string;
  }> {
    // Get the original user query
    const userMessages = state.messages.filter(
      (msg) => msg._getType() === 'human',
    );
    const originalQuery =
      userMessages.length > 0
        ? typeof userMessages[0].content === 'string'
          ? userMessages[0].content
          : JSON.stringify(userMessages[0].content)
        : state.input || '';

    // Use QueryClassifier for analysis
    const classification =
      await this.queryClassifier.classifyQuery(originalQuery);

    // Convert to QueryIntent format
    let intentType = 'conversational';
    let complexity = 'low';
    let requiresDeepAnalysis = false;
    let suggestedResponseType = 'conversational_response';

    // Map QueryClassifier results to QueryIntent format
    if (classification.complexity > 0.7) {
      complexity = 'high';
      requiresDeepAnalysis = true;
      suggestedResponseType = 'synthesis';
    } else if (classification.complexity > 0.4) {
      complexity = 'medium';
      suggestedResponseType = 'simple_response';
    }

    // Determine intent type based on patterns
    if (
      classification.patterns.includes('analysis') ||
      classification.patterns.includes('comparison')
    ) {
      intentType = 'analysis';
      requiresDeepAnalysis = true;
    } else if (
      classification.patterns.includes('research') ||
      classification.patterns.includes('report')
    ) {
      intentType = 'research';
      requiresDeepAnalysis = true;
    } else if (classification.patterns.includes('simple_lookup')) {
      intentType = 'simple_lookup';
    } else if (classification.patterns.includes('creative')) {
      intentType = 'creative';
      requiresDeepAnalysis = true;
    }

    return {
      intentType,
      complexity,
      requiresDeepAnalysis,
      suggestedResponseType,
    };
  }

  /**
   * Determine the next step in the LangGraph workflow
   */
  routeNextStep(state: GraphState, context: RouteContext): RouteDecision {
    this.logger.info('[ResponseRouter] Evaluating next step...', {
      messageCount: state.messages.length,
      needsSynthesis: state.needsSynthesis,
      toolForcingCount: state.toolForcingCount,
      iterationCount: state.iterationCount,
    });

    const lastMessage = state.messages[state.messages.length - 1];
    const currentIterationCount = state.iterationCount || 0;

    // 🚨 CRITICAL: Check circuit breaker FIRST before any tool routing
    if (currentIterationCount > this.MAX_ITERATIONS) {
      this.logger.warn(
        '[ResponseRouter] 🛑 CIRCUIT BREAKER OVERRIDE: Forcing synthesis due to max iterations exceeded',
        {
          currentIterationCount,
          maxIterations: this.MAX_ITERATIONS,
          originalToolCalls:
            lastMessage &&
            'tool_calls' in lastMessage &&
            Array.isArray(lastMessage.tool_calls)
              ? lastMessage.tool_calls.length
              : 0,
        },
      );

      // Force synthesis with available data to break the loop
      return 'synthesis';
    }

    // 🔄 Workflow Management Integration
    const userMessages = state.messages.filter(
      (msg) => msg._getType() === 'human',
    );
    const currentQuery =
      userMessages.length > 0
        ? typeof userMessages[0].content === 'string'
          ? userMessages[0].content
          : JSON.stringify(userMessages[0].content)
        : state.input || '';

    // **AGGRESSIVE CHECK**: If we have both web search results AND document listings, force synthesis
    const hasWebSearchResults = state.messages.some(
      (msg) =>
        msg._getType() === 'tool' &&
        'name' in msg &&
        msg.name === 'tavilySearch',
    );

    const hasDocumentListings = state.messages.some(
      (msg) =>
        msg._getType() === 'tool' &&
        'name' in msg &&
        msg.name === 'listDocuments',
    );

    if (
      hasWebSearchResults &&
      hasDocumentListings &&
      currentIterationCount >= 2
    ) {
      this.logger.info(
        '[ResponseRouter] 🎯 AGGRESSIVE SYNTHESIS: Have web search + document listings, forcing synthesis',
        {
          hasWebSearchResults,
          hasDocumentListings,
          currentIterationCount,
        },
      );
      return 'synthesis';
    }

    // Check if workflow is ready for synthesis
    const isWorkflowReady =
      context.workflowManager.isWorkflowReadyForSynthesis(currentQuery);
    const workflowStatus = context.workflowManager.getWorkflowStatus();

    this.logger.info('[ResponseRouter] Workflow status check:', {
      isWorkflowReady,
      workflowStatus,
      currentQuery: currentQuery.substring(0, 100),
    });

    // Get suggested tools from workflow manager
    const suggestedTools =
      context.workflowManager.getSuggestedNextTools(currentQuery);
    const hasHighPriorityTools = suggestedTools.some(
      (tool: any) => tool.priority === 'high',
    );

    this.logger.info('[ResponseRouter] Tool suggestions:', {
      suggestedToolCount: suggestedTools.length,
      hasHighPriorityTools,
      suggestions: suggestedTools.map((s: any) => ({
        toolName: s.toolName,
        priority: s.priority,
        reason: `${s.reason.substring(0, 50)}...`,
      })),
    });

    // **ENHANCED REDUNDANCY CHECK**: Check for redundant tool call patterns
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      const redundancyCheck = context.redundancyChecker(
        state,
        lastMessage.tool_calls,
      );

      this.logger.info('[ResponseRouter] Redundancy check result:', {
        isRedundant: redundancyCheck.isRedundant,
        reason: redundancyCheck.reason,
        redundantToolCount: redundancyCheck.redundantToolCount,
      });

      if (redundancyCheck.isRedundant) {
        this.logger.warn(
          '[ResponseRouter] 🛑 REDUNDANCY DETECTED: Forcing synthesis to break redundant loop',
          {
            reason: redundancyCheck.reason,
            redundantToolCount: redundancyCheck.redundantToolCount,
            currentIterationCount,
          },
        );

        // Force synthesis to break the redundant loop
        return 'synthesis';
      }
    }

    // Continue with workflow-aware routing logic
    if (!isWorkflowReady && hasHighPriorityTools) {
      this.logger.info(
        '[ResponseRouter] 🔄 Workflow incomplete - suggesting tools before synthesis:',
        {
          suggestedTools: suggestedTools.map((t: any) => ({
            name: t.toolName,
            priority: t.priority,
            reason: t.reason,
          })),
          workflowStatus,
        },
      );

      // If we have tool calls in the last message, continue with them
      if (
        lastMessage &&
        'tool_calls' in lastMessage &&
        Array.isArray(lastMessage.tool_calls) &&
        lastMessage.tool_calls.length > 0
      ) {
        return 'use_tools';
      }
    }

    // 1. If the last AI message has tool calls, route to the tool executor
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      // Apply document listing circuit breaker
      const isDocumentListingRequest =
        this.isDocumentListingRequest(currentQuery);
      const hasListDocumentsResult = this.hasListDocumentsResult(state);

      // Circuit breaker: If this is a document listing request and we already have results, skip tools
      if (isDocumentListingRequest && hasListDocumentsResult) {
        this.logger.info(
          '[ResponseRouter] 🛑 CIRCUIT BREAKER: Document listing request with existing results - skipping tools and routing to synthesis',
          {
            userQuery: currentQuery.substring(0, 100),
            hasListDocumentsResult,
            toolCallsCount: lastMessage.tool_calls.length,
          },
        );
        return 'synthesis';
      }

      this.logger.info('[ResponseRouter] Decision: Route to tools node.');
      return 'use_tools';
    }

    // 1.5. CRITICAL: If the last message is an AI response with content (no tool calls), end the graph
    if (this.isAIResponseWithContent(lastMessage)) {
      this.logger.info(
        '[ResponseRouter] Decision: AI provided final response with content. Ending graph to prevent duplicate responses.',
        {
          messageType: lastMessage._getType(),
          hasContent: !!lastMessage.content,
          hasToolCalls: this.getToolCallsCount(lastMessage),
        },
      );
      return '__end__';
    }

    // 2. Check if we have tool results and handle synthesis routing
    const hasToolResults = state.messages.some((m) => m._getType() === 'tool');

    if (hasToolResults) {
      return this.routeWithToolResults(state, context);
    }

    // 3. Handle scenarios with no tool results
    return this.routeWithoutToolResults(state, lastMessage);
  }

  /**
   * Route when tool results are present
   */
  private async routeWithToolResults(
    state: GraphState,
    context: RouteContext,
  ): Promise<RouteDecision> {
    let needsSynthesis = state.needsSynthesis ?? true; // Default to true for backward compatibility
    const toolForcingCount = state.toolForcingCount || 0;

    this.logger.info(
      '[ResponseRouter] Analyzing tool results and synthesis need',
      {
        hasToolResults: true,
        toolForcingCount,
        MAX_TOOL_FORCING: this.MAX_TOOL_FORCING,
        needsSynthesis: state.needsSynthesis,
      },
    );

    // Analyze query intent for better routing using QueryClassifier
    const queryIntent = await this.analyzeQueryIntent(state);

    // Force synthesis for multi-document scenarios
    const multiDocResults = context.multiDocDetector(state);
    if (multiDocResults.isMultiDocument) {
      this.logger.info(
        '[ResponseRouter] Multi-document scenario detected, forcing synthesis',
        {
          originalNeedsSynthesis: needsSynthesis,
          multiDocDetails: multiDocResults,
        },
      );
      needsSynthesis = true;
    }

    // Enhanced Synthesis Validation using SynthesisValidator
    const validationResult = this.validateSynthesis(
      state,
      needsSynthesis,
      context,
    );
    if (validationResult.validationOverride) {
      this.logger.info(
        '[ResponseRouter] Synthesis validation override applied',
        {
          originalNeedsSynthesis: needsSynthesis,
          forcedSynthesis: validationResult.shouldForceSynthesis,
          reason: validationResult.reason,
          confidence: validationResult.confidence,
        },
      );
      needsSynthesis = validationResult.shouldForceSynthesis;
    }

    // Apply intent-based routing overrides
    needsSynthesis = this.applyIntentOverrides(
      needsSynthesis,
      queryIntent,
      multiDocResults,
    );

    this.logger.info(
      '[ResponseRouter] Tool results exist, checking synthesis requirement',
      {
        needsSynthesis,
        originalNeedsSynthesis: state.needsSynthesis,
        queryIntent,
        circuitBreakerHit: toolForcingCount >= this.MAX_TOOL_FORCING,
      },
    );

    // RESPECT needsSynthesis flag (potentially modified by validation and intent analysis)
    if (needsSynthesis) {
      this.logger.info(
        '[ResponseRouter] Decision: Tool results exist and synthesis needed. Routing to synthesis.',
      );
      return 'synthesis';
    } else {
      this.logger.info(
        '[ResponseRouter] Decision: Tool results exist but synthesis not needed. Routing to simple response.',
      );
      return 'simple_response';
    }
  }

  /**
   * Route when no tool results are present
   */
  private routeWithoutToolResults(
    state: GraphState,
    lastMessage: any,
  ): RouteDecision {
    // Use intent analysis for no-tool scenarios
    const queryIntent = this.intentAnalyzer.analyzeQueryIntent(state);

    // Check if the last message is an AI response without tool calls (conversational response)
    if (lastMessage && lastMessage._getType() === 'ai' && lastMessage.content) {
      this.logger.info(
        '[ResponseRouter] Decision: AI provided conversational response. Finishing graph.',
        { queryIntent },
      );
      return '__end__';
    }

    // If this is a conversational query that doesn't need tools, route to conversational response
    if (
      queryIntent.intentType === 'conversational' &&
      queryIntent.complexity === 'low'
    ) {
      this.logger.info(
        '[ResponseRouter] Decision: Simple conversational query, routing to conversational response.',
        { queryIntent },
      );
      return 'conversational_response';
    }

    this.logger.warn(
      '[ResponseRouter] Decision: No tool calls and no results. Finishing graph to prevent loops.',
      { queryIntent },
    );
    return '__end__';
  }

  /**
   * Helper methods for routing logic
   */
  private isDocumentListingRequest(query: string): boolean {
    return /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
      query,
    );
  }

  private hasListDocumentsResult(state: GraphState): boolean {
    return state.messages.some(
      (msg) =>
        msg._getType() === 'tool' &&
        typeof msg.content === 'string' &&
        msg.content.includes('available_documents'),
    );
  }

  private isAIResponseWithContent(lastMessage: any): boolean {
    return (
      lastMessage &&
      lastMessage._getType() === 'ai' &&
      lastMessage.content &&
      (!('tool_calls' in lastMessage) ||
        !lastMessage.tool_calls ||
        (Array.isArray(lastMessage.tool_calls) &&
          lastMessage.tool_calls.length === 0))
    );
  }

  private getToolCallsCount(message: any): number {
    return 'tool_calls' in message && Array.isArray(message.tool_calls)
      ? message.tool_calls.length
      : 0;
  }

  private validateSynthesis(
    state: GraphState,
    needsSynthesis: boolean,
    context: RouteContext,
  ) {
    const userMessages = state.messages.filter(
      (msg) => msg._getType() === 'human',
    );
    const originalQuery =
      userMessages.length > 0
        ? typeof userMessages[0].content === 'string'
          ? userMessages[0].content
          : JSON.stringify(userMessages[0].content)
        : state.input || '';

    const toolResults = state.messages.filter(
      (msg) => msg._getType() === 'tool',
    );
    const validationContext = SynthesisValidator.createValidationContext(
      originalQuery,
      needsSynthesis,
      toolResults,
    );

    return context.synthesisValidator.validateSynthesisNeed(validationContext);
  }

  private applyIntentOverrides(
    needsSynthesis: boolean,
    queryIntent: QueryClassificationResult,
    multiDocResults: any,
  ): boolean {
    // Apply intent-based routing overrides
    if (queryIntent.requiresDeepAnalysis && !needsSynthesis) {
      this.logger.info(
        '[ResponseRouter] Query requires deep analysis, overriding to synthesis',
        {
          originalNeedsSynthesis: needsSynthesis,
          queryIntent,
        },
      );
      return true;
    }

    // Special case: Simple lookups with tool results should use simple response
    if (
      queryIntent.intentType === 'simple_lookup' &&
      queryIntent.complexity === 'low' &&
      !multiDocResults.isMultiDocument
    ) {
      this.logger.info(
        '[ResponseRouter] Simple lookup detected, preferring simple response',
        {
          queryIntent,
          multiDocResults,
        },
      );
      return false;
    }

    return needsSynthesis;
  }
}
