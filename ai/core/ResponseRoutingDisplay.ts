/**
 * Response Routing Display Manager
 *
 * Shows users exactly which analysis path their query is taking with
 * intelligent routing displays like:
 *
 * 🎯 Analysis Plan: Comparative Analysis Mode
 * 📚 Documents: Core Values + Ideal Client Profile
 * 🔍 Analyzing relationships and alignments...
 *
 * This provides transparency into the AI's decision-making process
 * and sets proper expectations for the type of response they'll receive.
 */

import type { RequestLogger } from '@/lib/services/observabilityService';
import type { DocumentRetrievalPlan } from './DocumentOrchestrator';
import type { SynthesisValidationResult } from './SynthesisValidator';

export interface RoutingDisplayContext {
  originalQuery: string;
  detectedIntent:
    | 'comparative'
    | 'relationship'
    | 'synthesis'
    | 'simple_lookup'
    | 'conversational';
  routingDecision: 'synthesis' | 'simple_response' | 'conversational_response';
  documentsInvolved: string[];
  analysisType?: 'comparative' | 'synthesis' | 'summary' | 'relationship';
  confidence: number;
  overrideReason?: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface RoutingDisplay {
  planHeader: string;
  documentSummary: string;
  analysisDescription: string;
  confidenceIndicator: string;
  estimatedDuration: string;
  fullDisplay: string;
}

export class ResponseRoutingDisplay {
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Generate routing display based on analysis context
   */
  public generateRoutingDisplay(
    query: string,
    retrievalPlan?: DocumentRetrievalPlan,
    validationResult?: SynthesisValidationResult,
    routingDecision?: string,
    toolResults?: any[],
  ): RoutingDisplay {
    const context = this.buildRoutingContext(
      query,
      retrievalPlan,
      validationResult,
      routingDecision,
      toolResults,
    );

    const display = this.createRoutingDisplay(context);

    this.logger.info('[RoutingDisplay] Generated routing display', {
      originalQuery: context.originalQuery,
      detectedIntent: context.detectedIntent,
      routingDecision: context.routingDecision,
      documentsInvolved: context.documentsInvolved,
      confidence: context.confidence,
    });

    return display;
  }

  /**
   * Build routing context from available information
   */
  private buildRoutingContext(
    query: string,
    retrievalPlan?: DocumentRetrievalPlan,
    validationResult?: SynthesisValidationResult,
    routingDecision?: string,
    toolResults?: any[],
  ): RoutingDisplayContext {
    // Detect intent from query
    const detectedIntent = this.detectQueryIntent(query);

    // Determine routing decision
    const finalRoutingDecision = this.determineRoutingDecision(
      detectedIntent,
      validationResult,
      routingDecision,
    );

    // Extract document information
    const documentsInvolved = this.extractDocumentNames(
      retrievalPlan,
      toolResults,
    );

    // Calculate confidence
    const confidence = this.calculateDisplayConfidence(
      detectedIntent,
      retrievalPlan,
      validationResult,
      documentsInvolved,
    );

    // Determine complexity
    const estimatedComplexity = this.estimateComplexity(
      detectedIntent,
      documentsInvolved.length,
      retrievalPlan?.analysisType,
    );

    // Check for override reasons
    const overrideReason =
      validationResult?.shouldForceSynthesis &&
      validationResult.confidence > 0.8
        ? 'Validation detected synthesis requirement'
        : undefined;

    return {
      originalQuery: query,
      detectedIntent,
      routingDecision: finalRoutingDecision,
      documentsInvolved,
      analysisType: retrievalPlan?.analysisType,
      confidence,
      overrideReason,
      estimatedComplexity,
    };
  }

  /**
   * Detect query intent from patterns
   */
  private detectQueryIntent(
    query: string,
  ): RoutingDisplayContext['detectedIntent'] {
    const queryLower = query.toLowerCase();

    // Comparative analysis patterns
    if (
      /\b(?:compar[ei]|comparison|vs|versus|contrast|between.*and)\b/i.test(
        query,
      )
    ) {
      return 'comparative';
    }

    // Relationship analysis patterns
    if (
      /\b(?:relationship|align|alignment|how.*relate|connect|match)\b/i.test(
        query,
      )
    ) {
      return 'relationship';
    }

    // Synthesis patterns
    if (
      /\b(?:synthesis|combine|merge|integrate|together|overall)\b/i.test(query)
    ) {
      return 'synthesis';
    }

    // Simple lookup patterns
    if (
      /\b(?:what\s+is|who\s+is|show\s+me|list|find|get|display)\b/i.test(query)
    ) {
      return 'simple_lookup';
    }

    return 'conversational';
  }

  /**
   * Determine final routing decision
   */
  private determineRoutingDecision(
    detectedIntent: RoutingDisplayContext['detectedIntent'],
    validationResult?: SynthesisValidationResult,
    explicitRouting?: string,
  ): RoutingDisplayContext['routingDecision'] {
    // If validation overrides, use that
    if (
      validationResult?.shouldForceSynthesis &&
      validationResult.confidence > 0.7
    ) {
      return 'synthesis';
    }

    // If explicit routing provided, validate and use that
    if (explicitRouting) {
      const validRoutingDecisions = [
        'synthesis',
        'simple_response',
        'conversational_response',
      ];
      if (validRoutingDecisions.includes(explicitRouting)) {
        return explicitRouting as RoutingDisplayContext['routingDecision'];
      }
    }

    // Default routing based on intent
    const intentRouting = {
      comparative: 'synthesis',
      relationship: 'synthesis',
      synthesis: 'synthesis',
      simple_lookup: 'simple_response',
      conversational: 'conversational_response',
    } as const;

    return intentRouting[detectedIntent];
  }

  /**
   * Extract document names from various sources
   */
  private extractDocumentNames(
    retrievalPlan?: DocumentRetrievalPlan,
    toolResults?: any[],
  ): string[] {
    const documents: string[] = [];

    // From retrieval plan
    if (retrievalPlan?.requiredDocuments) {
      documents.push(...retrievalPlan.requiredDocuments);
    }

    // From tool results
    if (toolResults) {
      toolResults.forEach((result) => {
        if (result.title) {
          documents.push(result.title);
        } else if (result.name) {
          documents.push(result.name);
        }
      });
    }

    // Remove duplicates and clean names
    return [...new Set(documents)]
      .map((doc) => this.cleanDocumentName(doc))
      .filter((doc) => doc.length > 0);
  }

  /**
   * Clean document names for display
   */
  private cleanDocumentName(name: string): string {
    return name
      .replace(/\.(txt|pdf|docx|xlsx)$/i, '') // Remove extensions
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces before capitals
      .trim();
  }

  /**
   * Calculate confidence for display
   */
  private calculateDisplayConfidence(
    detectedIntent: RoutingDisplayContext['detectedIntent'],
    retrievalPlan?: DocumentRetrievalPlan,
    validationResult?: SynthesisValidationResult,
    documentsInvolved?: string[],
  ): number {
    let confidence = 0.6; // Base confidence

    // Higher confidence for clear intents
    const intentConfidence = {
      comparative: 0.9,
      relationship: 0.8,
      synthesis: 0.8,
      simple_lookup: 0.7,
      conversational: 0.5,
    };

    confidence = Math.max(confidence, intentConfidence[detectedIntent]);

    // Boost confidence if we have a clear retrieval plan
    if (retrievalPlan?.confidence && retrievalPlan.confidence > 0.7) {
      confidence += 0.1;
    }

    // Boost confidence if validation agrees
    if (validationResult?.confidence && validationResult.confidence > 0.8) {
      confidence += 0.1;
    }

    // Boost confidence if we have relevant documents
    if (documentsInvolved && documentsInvolved.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Estimate complexity based on analysis requirements
   */
  private estimateComplexity(
    detectedIntent: RoutingDisplayContext['detectedIntent'],
    documentCount: number,
    analysisType?: string,
  ): RoutingDisplayContext['estimatedComplexity'] {
    // Base complexity by intent
    const intentComplexity = {
      comparative: 'high',
      relationship: 'high',
      synthesis: 'medium',
      simple_lookup: 'low',
      conversational: 'low',
    } as const;

    let baseComplexity = intentComplexity[detectedIntent];

    // Adjust based on document count
    if (documentCount > 2) {
      baseComplexity = 'high';
    } else if (documentCount === 2 && baseComplexity === 'low') {
      baseComplexity = 'medium';
    }

    // Adjust based on analysis type
    if (analysisType === 'comparative' && baseComplexity !== 'high') {
      baseComplexity = 'high';
    }

    return baseComplexity;
  }

  /**
   * Create the actual routing display
   */
  private createRoutingDisplay(context: RoutingDisplayContext): RoutingDisplay {
    const planHeader = this.createPlanHeader(context);
    const documentSummary = this.createDocumentSummary(context);
    const analysisDescription = this.createAnalysisDescription(context);
    const confidenceIndicator = this.createConfidenceIndicator(context);
    const estimatedDuration = this.createDurationEstimate(context);

    // Combine into full display
    const fullDisplay = [
      planHeader,
      documentSummary,
      analysisDescription,
      confidenceIndicator,
      estimatedDuration,
    ]
      .filter((section) => section.length > 0)
      .join('\n');

    return {
      planHeader,
      documentSummary,
      analysisDescription,
      confidenceIndicator,
      estimatedDuration,
      fullDisplay,
    };
  }

  /**
   * Create plan header based on routing decision
   */
  private createPlanHeader(context: RoutingDisplayContext): string {
    const routingEmojis = {
      synthesis: '🎯',
      simple_response: '📋',
      conversational_response: '💬',
    };

    const routingLabels = {
      synthesis: 'Analysis Mode',
      simple_response: 'Information Retrieval',
      conversational_response: 'Conversational Response',
    };

    const emoji = routingEmojis[context.routingDecision];
    const label = routingLabels[context.routingDecision];

    // Add specific analysis type if available
    let analysisDetail = '';
    if (context.analysisType && context.routingDecision === 'synthesis') {
      const analysisLabels = {
        comparative: 'Comparative Analysis',
        relationship: 'Relationship Analysis',
        synthesis: 'Content Synthesis',
        summary: 'Summary Generation',
      };
      analysisDetail = `: ${analysisLabels[context.analysisType]}`;
    }

    return `${emoji} **Analysis Plan${analysisDetail}**`;
  }

  /**
   * Create document summary
   */
  private createDocumentSummary(context: RoutingDisplayContext): string {
    if (context.documentsInvolved.length === 0) {
      return '';
    }

    const docList = context.documentsInvolved
      .slice(0, 3) // Limit to first 3 documents
      .join(' + ');

    const moreText =
      context.documentsInvolved.length > 3
        ? ` + ${context.documentsInvolved.length - 3} more`
        : '';

    return `📚 **Documents**: ${docList}${moreText}`;
  }

  /**
   * Create analysis description
   */
  private createAnalysisDescription(context: RoutingDisplayContext): string {
    const descriptions = {
      comparative:
        'Comparing documents to identify similarities, differences, and relationships',
      relationship:
        'Analyzing how documents relate to each other and identifying connections',
      synthesis:
        'Combining information from multiple sources into a comprehensive response',
      simple_lookup: 'Retrieving and presenting relevant information',
      conversational: 'Processing your request in conversational context',
    };

    const baseDescription = descriptions[context.detectedIntent];

    // Add complexity indicator
    const complexityEmojis = {
      low: '⚡',
      medium: '🔍',
      high: '🧠',
    };

    const emoji = complexityEmojis[context.estimatedComplexity];

    return `${emoji} ${baseDescription}`;
  }

  /**
   * Create confidence indicator
   */
  private createConfidenceIndicator(context: RoutingDisplayContext): string {
    if (context.confidence < 0.7) {
      return '⚠️ **Note**: Query interpretation has moderate confidence - results may vary';
    }

    if (context.overrideReason) {
      return `✅ **Validated**: ${context.overrideReason}`;
    }

    if (context.confidence > 0.9) {
      return '✅ **High confidence** analysis path selected';
    }

    return ''; // Don't show confidence for medium confidence levels
  }

  /**
   * Create duration estimate
   */
  private createDurationEstimate(context: RoutingDisplayContext): string {
    const durationEstimates = {
      low: '~2-3 seconds',
      medium: '~5-8 seconds',
      high: '~10-15 seconds',
    };

    const estimate = durationEstimates[context.estimatedComplexity];

    return `⏱️ **Estimated time**: ${estimate}`;
  }

  /**
   * Create a minimal routing display for simple cases
   */
  public createMinimalDisplay(routingDecision: string): string {
    const simpleDisplays = {
      synthesis: '🎯 **Performing analysis...**',
      simple_response: '📋 **Retrieving information...**',
      conversational_response: '💬 **Processing request...**',
    };

    return (
      simpleDisplays[routingDecision as keyof typeof simpleDisplays] ||
      '🔄 **Processing...**'
    );
  }

  /**
   * Create a progress update for routing display
   */
  public updateRoutingProgress(
    originalDisplay: RoutingDisplay,
    currentStage: string,
    progress?: number,
  ): string {
    const stageEmojis = {
      planning: '🎯',
      retrieving: '📚',
      analyzing: '🔍',
      synthesizing: '📝',
      formatting: '✨',
    };

    const emoji = stageEmojis[currentStage as keyof typeof stageEmojis] || '🔄';
    const progressBar = progress ? this.createProgressBar(progress) : '';

    return `${originalDisplay.planHeader}\n${emoji} **Current stage**: ${currentStage}${progressBar}`;
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(progress: number): string {
    const barLength = 10;
    const filledLength = Math.round((progress / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    return ` ${bar} ${Math.round(progress)}%`;
  }
}
