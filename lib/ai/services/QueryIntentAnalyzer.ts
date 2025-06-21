/**
 * Query Intent Analyzer Service
 *
 * Analyzes user queries to determine intent type, complexity, and required response strategy.
 * Extracted from SimpleLangGraphWrapper to provide focused, testable query analysis.
 *
 * @module QueryIntentAnalyzer
 */

import type { BaseMessage } from '@langchain/core/messages';
import type { RequestLogger } from '../../services/observabilityService';

export interface QueryIntent {
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

export interface GraphState {
  messages: BaseMessage[];
  input?: string;
  [key: string]: any;
}

/**
 * Service for analyzing user query intent and determining appropriate response strategies
 */
export class QueryIntentAnalyzer {
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Analyze query intent and determine response strategy
   */
  analyzeQueryIntent(state: GraphState): QueryIntent {
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
    const queryLower = originalQuery.toLowerCase();

    // Intent classification patterns
    const analysisPatterns =
      /\b(?:analyz[ei](?:ng)?|analysis|analytical|compar[ei]|comparison|vs|versus|contrast|relationship|align|alignment|how.*relate|what.*relationship|differences?|similarities)\b/i;
    const researchPatterns =
      /\b(?:research|report|brief|proposal|summary|overview|findings|insights|recommendations?)\b/i;
    const creativePatterns =
      /\b(?:creative\s+brief|write\s+a|create\s+a|generate\s+a|develop\s+a|draft\s+a|prepare\s+a)\b/i;
    const simpleLookupPatterns =
      /\b(?:what\s+is|who\s+is|when\s+is|where\s+is|how\s+much|list|show\s+me|find|get\s+me)\b/i;

    // Determine intent type
    let intentType: QueryIntent['intentType'] = 'conversational';
    let complexity: QueryIntent['complexity'] = 'low';
    let requiresDeepAnalysis = false;

    if (analysisPatterns.test(originalQuery)) {
      intentType = 'analysis';
      complexity = 'high';
      requiresDeepAnalysis = true;
    } else if (creativePatterns.test(originalQuery)) {
      intentType = 'creative';
      complexity = 'high';
      requiresDeepAnalysis = true;
    } else if (researchPatterns.test(originalQuery)) {
      intentType = 'research';
      complexity = 'medium';
      requiresDeepAnalysis = true;
    } else if (simpleLookupPatterns.test(originalQuery)) {
      intentType = 'simple_lookup';
      complexity = 'low';
      requiresDeepAnalysis = false;
    }

    // Adjust complexity based on query length and structure
    if (
      originalQuery.length > 100 ||
      (originalQuery.includes('?') && originalQuery.split('?').length > 2)
    ) {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }

    // Determine suggested response type
    let suggestedResponseType: QueryIntent['suggestedResponseType'] =
      'conversational_response';

    if (requiresDeepAnalysis || complexity === 'high') {
      suggestedResponseType = 'synthesis';
    } else if (complexity === 'medium' || intentType === 'simple_lookup') {
      suggestedResponseType = 'simple_response';
    }

    this.logger.info('[QueryIntentAnalyzer] Query intent analysis completed', {
      originalQuery: originalQuery.substring(0, 100),
      intentType,
      complexity,
      requiresDeepAnalysis,
      suggestedResponseType,
    });

    return {
      intentType,
      complexity,
      requiresDeepAnalysis,
      suggestedResponseType,
    };
  }

  /**
   * Convenience method to check if query requires synthesis
   */
  requiresSynthesis(state: GraphState): boolean {
    const intent = this.analyzeQueryIntent(state);
    return intent.suggestedResponseType === 'synthesis';
  }

  /**
   * Convenience method to check if query is a simple lookup
   */
  isSimpleLookup(state: GraphState): boolean {
    const intent = this.analyzeQueryIntent(state);
    return intent.intentType === 'simple_lookup' && intent.complexity === 'low';
  }

  /**
   * Convenience method to check if query is conversational
   */
  isConversational(state: GraphState): boolean {
    const intent = this.analyzeQueryIntent(state);
    return (
      intent.intentType === 'conversational' && intent.complexity === 'low'
    );
  }
}
