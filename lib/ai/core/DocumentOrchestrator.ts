/**
 * Document Orchestration Layer
 *
 * Coordinates multi-document retrieval and analysis scenarios.
 * Ensures all relevant documents are retrieved for comparative analysis,
 * synthesis, and relationship analysis.
 */

import type { RequestLogger } from '@/lib/services/observabilityService';

export interface DocumentRetrievalPlan {
  requiredDocuments: string[];
  analysisType: 'comparative' | 'synthesis' | 'summary' | 'relationship';
  relationshipMapping: Record<string, string[]>;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-1 score for plan accuracy
}

export interface DocumentReference {
  id?: string;
  title: string;
  keywords: string[];
  matchScore: number;
  retrievalStrategy: 'exact' | 'fuzzy' | 'semantic';
}

export interface OrchestrationResult {
  plan: DocumentRetrievalPlan;
  documentReferences: DocumentReference[];
  shouldForceMultiDocRetrieval: boolean;
  estimatedRetrievalTime: number;
  fallbackStrategy?: string;
}

export class DocumentOrchestrator {
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Analyze query and create comprehensive document retrieval plan
   */
  public analyzeQuery(query: string): OrchestrationResult {
    const startTime = performance.now();

    this.logger.info(
      '[DocumentOrchestrator] Analyzing query for multi-document needs',
      {
        query: query.substring(0, 100),
      },
    );

    // Extract document keywords with enhanced patterns
    const documentReferences = this.extractDocumentReferences(query);

    // Determine analysis type with confidence scoring
    const analysisType = this.determineAnalysisType(query);

    // Create relationship mapping for comparative scenarios
    const relationshipMapping = this.createRelationshipMapping(
      documentReferences,
      analysisType,
    );

    // Calculate priority and confidence
    const priority = this.calculatePriority(
      analysisType,
      documentReferences.length,
    );
    const confidence = this.calculateConfidence(
      query,
      documentReferences,
      analysisType,
    );

    const plan: DocumentRetrievalPlan = {
      requiredDocuments: documentReferences.map((ref) => ref.title),
      analysisType,
      relationshipMapping,
      priority,
      confidence,
    };

    // Determine if we should force multi-document retrieval
    const shouldForceMultiDocRetrieval = this.shouldForceMultiDocRetrieval(
      query,
      documentReferences,
      analysisType,
    );

    const estimatedRetrievalTime =
      this.estimateRetrievalTime(documentReferences);
    const fallbackStrategy = this.determineFallbackStrategy(plan);

    const duration = performance.now() - startTime;

    this.logger.info('[DocumentOrchestrator] Query analysis completed', {
      analysisType,
      documentsIdentified: documentReferences.length,
      shouldForceMultiDoc: shouldForceMultiDocRetrieval,
      confidence,
      duration: `${duration.toFixed(2)}ms`,
    });

    return {
      plan,
      documentReferences,
      shouldForceMultiDocRetrieval,
      estimatedRetrievalTime,
      fallbackStrategy,
    };
  }

  /**
   * Enhanced document keyword extraction with multiple strategies
   */
  private extractDocumentReferences(query: string): DocumentReference[] {
    const references: DocumentReference[] = [];
    const queryLower = query.toLowerCase();

    // Enhanced document patterns with scoring
    const documentPatterns = [
      // Core business documents
      {
        pattern: /\b(?:core\s+values?|company\s+values?|values?)\b/gi,
        title: 'Core Values',
        keywords: ['core', 'values', 'company', 'principles'],
        baseScore: 0.9,
      },
      {
        pattern:
          /\b(?:ideal\s+client\s+profile?|client\s+profile?|icp|target\s+client)\b/gi,
        title: 'Ideal Client Profile',
        keywords: ['ideal', 'client', 'profile', 'target', 'customer'],
        baseScore: 0.9,
      },
      {
        pattern:
          /\b(?:brand\s+overview|brand\s+guide|brand\s+guidelines?|brand)\b/gi,
        title: 'Brand Overview',
        keywords: ['brand', 'overview', 'guide', 'guidelines'],
        baseScore: 0.8,
      },
      {
        pattern:
          /\b(?:producer\s+checklist|production\s+checklist|checklist)\b/gi,
        title: 'Producer Checklist',
        keywords: ['producer', 'production', 'checklist', 'workflow'],
        baseScore: 0.8,
      },
      {
        pattern: /\b(?:client\s+research|market\s+research|research)\b/gi,
        title: 'Client Research',
        keywords: ['client', 'market', 'research', 'analysis'],
        baseScore: 0.7,
      },
      {
        pattern: /\b(?:rate\s+card|pricing|rates?|cost\s+sheet|costs?)\b/gi,
        title: 'Rate Card',
        keywords: ['rate', 'pricing', 'cost', 'budget'],
        baseScore: 0.8,
      },
      {
        pattern:
          /\b(?:profit\s+and\s+loss|p&l|financial\s+statement|income\s+statement)\b/gi,
        title: 'Financial Statement',
        keywords: ['profit', 'loss', 'financial', 'income'],
        baseScore: 0.8,
      },
    ];

    // Extract matches with confidence scoring
    documentPatterns.forEach(({ pattern, title, keywords, baseScore }) => {
      const matches = queryLower.match(pattern);
      if (matches) {
        // Calculate match score based on pattern strength and context
        const contextBonus = this.calculateContextBonus(queryLower, keywords);
        const matchScore = Math.min(baseScore + contextBonus, 1.0);

        references.push({
          title,
          keywords,
          matchScore,
          retrievalStrategy: matchScore > 0.8 ? 'exact' : 'fuzzy',
        });
      }
    });

    // Sort by match score (highest confidence first)
    return references.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate context bonus for keyword relevance
   */
  private calculateContextBonus(query: string, keywords: string[]): number {
    let bonus = 0;
    keywords.forEach((keyword) => {
      if (query.includes(keyword)) {
        bonus += 0.05; // Small bonus for each keyword match
      }
    });
    return Math.min(bonus, 0.2); // Cap at 0.2 bonus
  }

  /**
   * Determine analysis type with confidence scoring
   */
  private determineAnalysisType(
    query: string,
  ): DocumentRetrievalPlan['analysisType'] {
    const queryLower = query.toLowerCase();

    // Comparative analysis patterns (highest priority)
    if (
      /\b(?:compar[ei]|comparison|vs|versus|contrast|between.*and)\b/i.test(
        query,
      )
    ) {
      return 'comparative';
    }

    // Relationship analysis patterns
    if (
      /\b(?:relationship|align|alignment|how.*relate|connect|connection)\b/i.test(
        query,
      )
    ) {
      return 'relationship';
    }

    // Synthesis patterns
    if (
      /\b(?:synthesis|synth|combine|merge|integrate|together)\b/i.test(query)
    ) {
      return 'synthesis';
    }

    // Default to summary for multi-document scenarios
    return 'summary';
  }

  /**
   * Create relationship mapping for comparative analysis
   */
  private createRelationshipMapping(
    references: DocumentReference[],
    analysisType: DocumentRetrievalPlan['analysisType'],
  ): Record<string, string[]> {
    const mapping: Record<string, string[]> = {};

    if (analysisType === 'comparative' && references.length >= 2) {
      // For comparative analysis, map each document to all others
      references.forEach((ref, index) => {
        mapping[ref.title] = references
          .filter((_, i) => i !== index)
          .map((r) => r.title);
      });
    }

    return mapping;
  }

  /**
   * Calculate retrieval priority based on analysis complexity
   */
  private calculatePriority(
    analysisType: DocumentRetrievalPlan['analysisType'],
    documentCount: number,
  ): DocumentRetrievalPlan['priority'] {
    if (analysisType === 'comparative' || documentCount > 2) {
      return 'high';
    }
    if (analysisType === 'relationship' || documentCount === 2) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate confidence score for the retrieval plan
   */
  private calculateConfidence(
    query: string,
    references: DocumentReference[],
    analysisType: DocumentRetrievalPlan['analysisType'],
  ): number {
    let confidence = 0;

    // Base confidence from document matches
    if (references.length > 0) {
      const avgMatchScore =
        references.reduce((sum, ref) => sum + ref.matchScore, 0) /
        references.length;
      confidence += avgMatchScore * 0.6; // 60% weight for document matching
    }

    // Analysis type confidence
    const analysisPatterns = {
      comparative: /\b(?:compar[ei]|comparison|vs|versus|contrast)\b/i,
      relationship: /\b(?:relationship|align|alignment|relate)\b/i,
      synthesis: /\b(?:synthesis|combine|merge)\b/i,
      summary: /\b(?:summary|overview|summarize)\b/i,
    };

    if (analysisPatterns[analysisType]?.test(query)) {
      confidence += 0.3; // 30% weight for analysis type clarity
    }

    // Multi-document scenario bonus
    if (references.length >= 2) {
      confidence += 0.1; // 10% bonus for multi-document scenarios
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Determine if multi-document retrieval should be forced
   */
  private shouldForceMultiDocRetrieval(
    query: string,
    references: DocumentReference[],
    analysisType: DocumentRetrievalPlan['analysisType'],
  ): boolean {
    // Force multi-doc for comparative analysis
    if (analysisType === 'comparative' && references.length >= 2) {
      return true;
    }

    // Force multi-doc for relationship analysis
    if (analysisType === 'relationship' && references.length >= 2) {
      return true;
    }

    // Force multi-doc if query explicitly mentions multiple documents
    const multiDocPatterns = [
      /\b(?:both|all|multiple)\s+(?:documents|files)\b/i,
      /\b(?:document[s]?|file[s]?)\s+(?:and|&|\+)\s+(?:document[s]?|file[s]?)\b/i,
      /\b(?:between|among)\s+.*(?:and|&)\b/i,
    ];

    return multiDocPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Estimate retrieval time based on document count and complexity
   */
  private estimateRetrievalTime(references: DocumentReference[]): number {
    const baseTime = 500; // Base 500ms
    const perDocTime = 200; // 200ms per additional document
    const complexityMultiplier = references.some(
      (ref) => ref.retrievalStrategy === 'semantic',
    )
      ? 1.5
      : 1.0;

    return Math.round(
      (baseTime + references.length * perDocTime) * complexityMultiplier,
    );
  }

  /**
   * Determine fallback strategy if primary retrieval fails
   */
  private determineFallbackStrategy(plan: DocumentRetrievalPlan): string {
    if (plan.confidence < 0.5) {
      return 'semantic_search';
    }
    if (plan.requiredDocuments.length > 3) {
      return 'prioritize_top_matches';
    }
    return 'fuzzy_matching';
  }

  /**
   * Validate retrieval results against the plan
   */
  public validateRetrievalResults(
    plan: DocumentRetrievalPlan,
    retrievedDocuments: any[],
  ): {
    isComplete: boolean;
    missingDocuments: string[];
    shouldProceedWithSynthesis: boolean;
    confidence: number;
  } {
    const retrievedTitles = retrievedDocuments
      .map((doc) => doc.title || '')
      .filter(Boolean);
    const missingDocuments = plan.requiredDocuments.filter(
      (required) =>
        !retrievedTitles.some(
          (retrieved) =>
            retrieved.toLowerCase().includes(required.toLowerCase()) ||
            required.toLowerCase().includes(retrieved.toLowerCase()),
        ),
    );

    const isComplete = missingDocuments.length === 0;
    const completionRate =
      (plan.requiredDocuments.length - missingDocuments.length) /
      plan.requiredDocuments.length;

    // Should proceed with synthesis if we have at least 50% of required documents
    // and it's a high-priority analysis type
    const shouldProceedWithSynthesis =
      completionRate >= 0.5 &&
      (plan.analysisType === 'comparative' ||
        plan.analysisType === 'relationship') &&
      retrievedDocuments.length >= 1;

    const confidence = completionRate * plan.confidence;

    this.logger.info('[DocumentOrchestrator] Retrieval validation completed', {
      isComplete,
      missingCount: missingDocuments.length,
      completionRate: `${(completionRate * 100).toFixed(1)}%`,
      shouldProceedWithSynthesis,
      confidence: confidence.toFixed(2),
    });

    return {
      isComplete,
      missingDocuments,
      shouldProceedWithSynthesis,
      confidence,
    };
  }
}
