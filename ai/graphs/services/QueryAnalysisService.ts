/**
 * Query Analysis Service
 *
 * Handles query analysis and intent detection including:
 * - Query complexity assessment
 * - Intent classification
 * - Tool recommendation
 * - Response type determination
 */

import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';
import { getLastHumanMessage } from '../state';

/**
 * Query complexity assessment
 */
export interface QueryComplexity {
  level: 'simple' | 'moderate' | 'complex';
  factors: string[];
  confidence: number;
  recommendedTools: string[];
}

/**
 * Intent classification result
 */
export interface QueryIntent {
  primary: string;
  secondary?: string;
  confidence: number;
  indicators: string[];
  suggestedResponseStyle: 'direct' | 'analytical' | 'conversational';
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  query: string;
  complexity: QueryComplexity;
  intent: QueryIntent;
  recommendedApproach: string;
  toolsToUse: string[];
  expectedResponseLength: 'short' | 'medium' | 'long';
}

/**
 * Service for analyzing user queries and determining optimal processing approach
 */
export class QueryAnalysisService {
  constructor(private logger: RequestLogger) {}

  /**
   * Perform comprehensive query analysis
   */
  analyzeQuery(state: GraphState): QueryAnalysis {
    const query = getLastHumanMessage(state);

    const complexity = this.assessComplexity(query);
    const intent = this.classifyIntent(query);
    const recommendedApproach = this.determineApproach(complexity, intent);
    const toolsToUse = this.recommendTools(query, complexity, intent);
    const expectedResponseLength = this.estimateResponseLength(
      complexity,
      intent,
    );

    const analysis: QueryAnalysis = {
      query,
      complexity,
      intent,
      recommendedApproach,
      toolsToUse,
      expectedResponseLength,
    };

    this.logger.info('[QueryAnalysis] Query analyzed', {
      complexityLevel: complexity.level,
      primaryIntent: intent.primary,
      recommendedApproach,
      toolCount: toolsToUse.length,
    });

    return analysis;
  }

  /**
   * Assess query complexity based on various factors
   */
  assessComplexity(query: string): QueryComplexity {
    const factors: string[] = [];
    let complexityScore = 0;

    const words = query.split(/\s+/);
    const queryLower = query.toLowerCase();

    // Length factor
    if (words.length > 20) {
      factors.push('long_query');
      complexityScore += 2;
    } else if (words.length > 10) {
      factors.push('medium_length');
      complexityScore += 1;
    }

    // Multiple questions
    const questionMarks = (query.match(/\?/g) || []).length;
    if (questionMarks > 1) {
      factors.push('multiple_questions');
      complexityScore += 2;
    }

    // Complex keywords
    const complexKeywords = [
      'compare',
      'analyze',
      'evaluate',
      'comprehensive',
      'detailed',
      'relationship',
      'correlation',
      'implications',
      'consequences',
    ];
    const foundComplexKeywords = complexKeywords.filter((keyword) =>
      queryLower.includes(keyword),
    );
    if (foundComplexKeywords.length > 0) {
      factors.push('complex_keywords');
      complexityScore += foundComplexKeywords.length;
    }

    // Multiple entities or topics
    if (this.hasMultipleEntities(query)) {
      factors.push('multiple_entities');
      complexityScore += 2;
    }

    // Determine complexity level
    let level: 'simple' | 'moderate' | 'complex' = 'simple';
    if (complexityScore >= 5) {
      level = 'complex';
    } else if (complexityScore >= 2) {
      level = 'moderate';
    }

    // Recommend tools based on complexity
    const recommendedTools = this.getToolsForComplexity(level, queryLower);

    return {
      level,
      factors,
      confidence: Math.min(0.7 + complexityScore * 0.05, 0.95),
      recommendedTools,
    };
  }

  /**
   * Classify query intent
   */
  classifyIntent(query: string): QueryIntent {
    const queryLower = query.toLowerCase();

    // Define intent patterns
    const intentPatterns = {
      information_seeking: [
        'what is',
        'what are',
        'tell me about',
        'explain',
        'define',
        'how does',
        'how do',
        'describe',
        'information about',
      ],
      comparison: [
        'compare',
        'difference',
        'versus',
        'vs',
        'better',
        'worse',
        'similar',
        'contrast',
        'pros and cons',
      ],
      analysis: [
        'analyze',
        'analysis',
        'evaluate',
        'assessment',
        'review',
        'examine',
        'investigate',
        'study',
      ],
      recommendation: [
        'recommend',
        'suggest',
        'advice',
        'should i',
        'best option',
        'what would you',
        'help me choose',
      ],
      procedural: [
        'how to',
        'steps',
        'process',
        'procedure',
        'guide',
        'instructions',
        'tutorial',
      ],
      research: [
        'research',
        'find information',
        'sources',
        'papers',
        'studies',
        'evidence',
        'data',
      ],
    };

    let bestMatch = {
      intent: 'general_inquiry',
      confidence: 0.3,
      indicators: [] as string[],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      const matchedPatterns = patterns.filter((pattern) =>
        queryLower.includes(pattern),
      );
      if (matchedPatterns.length > 0) {
        const confidence = Math.min(0.6 + matchedPatterns.length * 0.1, 0.9);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent,
            confidence,
            indicators: matchedPatterns,
          };
        }
      }
    }

    // Determine suggested response style
    let suggestedResponseStyle: 'direct' | 'analytical' | 'conversational' =
      'direct';

    if (['analysis', 'comparison', 'research'].includes(bestMatch.intent)) {
      suggestedResponseStyle = 'analytical';
    } else if (['recommendation', 'procedural'].includes(bestMatch.intent)) {
      suggestedResponseStyle = 'conversational';
    }

    return {
      primary: bestMatch.intent,
      confidence: bestMatch.confidence,
      indicators: bestMatch.indicators,
      suggestedResponseStyle,
    };
  }

  /**
   * Determine optimal processing approach
   */
  private determineApproach(
    complexity: QueryComplexity,
    intent: QueryIntent,
  ): string {
    if (complexity.level === 'complex' || intent.primary === 'analysis') {
      return 'comprehensive_analysis';
    }

    if (intent.primary === 'comparison') {
      return 'comparative_analysis';
    }

    if (intent.primary === 'research') {
      return 'research_synthesis';
    }

    if (complexity.level === 'moderate') {
      return 'focused_response';
    }

    return 'direct_answer';
  }

  /**
   * Recommend appropriate tools based on query analysis
   */
  private recommendTools(
    query: string,
    complexity: QueryComplexity,
    intent: QueryIntent,
  ): string[] {
    const tools: string[] = [];
    const queryLower = query.toLowerCase();

    // Document-related queries
    if (this.hasDocumentKeywords(queryLower)) {
      tools.push('listDocuments', 'getDocumentContents');

      if (complexity.level === 'complex' || intent.primary === 'analysis') {
        tools.push('multiDocumentRetrieval');
      }
    }

    // Current information or external research
    if (this.needsCurrentInfo(queryLower) || intent.primary === 'research') {
      tools.push('tavilySearch');
    }

    // Default fallback
    if (tools.length === 0) {
      tools.push('listDocuments');
    }

    return tools;
  }

  /**
   * Estimate expected response length
   */
  private estimateResponseLength(
    complexity: QueryComplexity,
    intent: QueryIntent,
  ): 'short' | 'medium' | 'long' {
    if (
      complexity.level === 'complex' ||
      ['analysis', 'research', 'comparison'].includes(intent.primary)
    ) {
      return 'long';
    }

    if (
      complexity.level === 'moderate' ||
      ['recommendation', 'procedural'].includes(intent.primary)
    ) {
      return 'medium';
    }

    return 'short';
  }

  /**
   * Check if query has multiple entities or topics
   */
  private hasMultipleEntities(query: string): boolean {
    // Simple heuristic: check for conjunctions and multiple nouns
    const conjunctions = [
      'and',
      'or',
      'but',
      'however',
      'also',
      'additionally',
    ];
    const hasConjunctions = conjunctions.some((conj) =>
      query.toLowerCase().includes(` ${conj} `),
    );

    // Count capitalized words (potential entities)
    const capitalizedWords = query.match(/\b[A-Z][a-z]+/g) || [];

    return hasConjunctions || capitalizedWords.length > 3;
  }

  /**
   * Get recommended tools for complexity level
   */
  private getToolsForComplexity(level: string, queryLower: string): string[] {
    const baseTools = ['listDocuments'];

    if (level === 'complex') {
      return [...baseTools, 'multiDocumentRetrieval', 'tavilySearch'];
    }

    if (level === 'moderate') {
      return [...baseTools, 'getDocumentContents'];
    }

    return baseTools;
  }

  /**
   * Check if query contains document-related keywords
   */
  private hasDocumentKeywords(query: string): boolean {
    const documentKeywords = [
      'document',
      'file',
      'report',
      'paper',
      'article',
      'study',
      'research',
      'analysis',
      'findings',
      'according to',
      'based on',
      'mentioned in',
    ];

    return documentKeywords.some((keyword) => query.includes(keyword));
  }

  /**
   * Check if query needs current/external information
   */
  private needsCurrentInfo(query: string): boolean {
    const currentInfoKeywords = [
      'recent',
      'latest',
      'current',
      'today',
      'now',
      'news',
      'update',
      'trend',
      'new',
      'modern',
      'contemporary',
      '2024',
      '2023',
    ];

    return currentInfoKeywords.some((keyword) => query.includes(keyword));
  }
}
