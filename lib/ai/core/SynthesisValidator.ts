/**
 * Synthesis Validation Layer
 *
 * Ensures that multi-document scenarios with analysis intent
 * always trigger synthesis mode, even if initial classification missed it.
 *
 * This addresses the critical issue where "comparative analysis between
 * core values and ideal client profile" was not triggering synthesis.
 */

import type { RequestLogger } from '@/lib/services/observabilityService';
import type { DocumentRetrievalPlan } from './DocumentOrchestrator';

export interface SynthesisValidationResult {
  shouldForceSynthesis: boolean;
  reason: string;
  confidence: number;
  originalNeedsSynthesis: boolean;
  validationOverride: boolean;
}

export interface ValidationContext {
  originalQuery: string;
  originalNeedsSynthesis: boolean;
  toolResults: any[];
  retrievalPlan?: DocumentRetrievalPlan;
  documentCount: number;
}

export class SynthesisValidator {
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Validate if synthesis should be forced based on context
   */
  public validateSynthesisNeed(
    context: ValidationContext,
  ): SynthesisValidationResult {
    const startTime = performance.now();

    this.logger.info('[SynthesisValidator] Validating synthesis requirement', {
      originalQuery: context.originalQuery.substring(0, 100),
      originalNeedsSynthesis: context.originalNeedsSynthesis,
      documentCount: context.documentCount,
      hasRetrievalPlan: !!context.retrievalPlan,
    });

    // Start with original classification
    let shouldForceSynthesis = context.originalNeedsSynthesis;
    let reason = 'original_classification';
    let confidence = 0.5;
    let validationOverride = false;

    // Rule 1: Multi-document scenarios with analysis intent
    const multiDocAnalysisResult = this.checkMultiDocumentAnalysis(context);
    if (multiDocAnalysisResult.shouldForce) {
      shouldForceSynthesis = true;
      reason = multiDocAnalysisResult.reason;
      confidence = multiDocAnalysisResult.confidence;
      validationOverride = !context.originalNeedsSynthesis;
    }

    // Rule 2: Comparative keywords with multiple documents
    const comparativeResult = this.checkComparativeKeywords(context);
    if (
      comparativeResult.shouldForce &&
      comparativeResult.confidence > confidence
    ) {
      shouldForceSynthesis = true;
      reason = comparativeResult.reason;
      confidence = comparativeResult.confidence;
      validationOverride = !context.originalNeedsSynthesis;
    }

    // Rule 3: Relationship analysis patterns
    const relationshipResult = this.checkRelationshipAnalysis(context);
    if (
      relationshipResult.shouldForce &&
      relationshipResult.confidence > confidence
    ) {
      shouldForceSynthesis = true;
      reason = relationshipResult.reason;
      confidence = relationshipResult.confidence;
      validationOverride = !context.originalNeedsSynthesis;
    }

    // Rule 4: High-priority retrieval plan validation
    const retrievalPlanResult = this.checkRetrievalPlan(context);
    if (
      retrievalPlanResult.shouldForce &&
      retrievalPlanResult.confidence > confidence
    ) {
      shouldForceSynthesis = true;
      reason = retrievalPlanResult.reason;
      confidence = retrievalPlanResult.confidence;
      validationOverride = !context.originalNeedsSynthesis;
    }

    const duration = performance.now() - startTime;

    this.logger.info('[SynthesisValidator] Validation completed', {
      shouldForceSynthesis,
      reason,
      confidence: confidence.toFixed(2),
      validationOverride,
      duration: `${duration.toFixed(2)}ms`,
    });

    return {
      shouldForceSynthesis,
      reason,
      confidence,
      originalNeedsSynthesis: context.originalNeedsSynthesis,
      validationOverride,
    };
  }

  /**
   * Check if multi-document scenario requires synthesis
   */
  private checkMultiDocumentAnalysis(context: ValidationContext): {
    shouldForce: boolean;
    reason: string;
    confidence: number;
  } {
    // Must have multiple documents
    if (context.documentCount < 2) {
      return { shouldForce: false, reason: 'single_document', confidence: 0 };
    }

    // Check for analysis intent patterns
    const analysisPatterns = [
      /\b(?:analyz[ei](?:ng|s)?|analysis|analytical)\b/i,
      /\b(?:compar[ei]|comparison|comparative|comparing)\b/i,
      /\b(?:relationship|align|alignment|relate)\b/i,
      /\b(?:vs|versus|against|between.*and)\b/i,
      /\b(?:contrast|contrasting|difference|differences)\b/i,
      /\b(?:synthesis|synthesize|combine|merge)\b/i,
    ];

    const hasAnalysisIntent = analysisPatterns.some((pattern) =>
      pattern.test(context.originalQuery),
    );

    if (hasAnalysisIntent) {
      const confidence = Math.min(
        0.8 + (context.documentCount - 2) * 0.1,
        0.95,
      );
      return {
        shouldForce: true,
        reason: 'multi_document_analysis_detected',
        confidence,
      };
    }

    return { shouldForce: false, reason: 'no_analysis_intent', confidence: 0 };
  }

  /**
   * Check for comparative keywords that require synthesis
   */
  private checkComparativeKeywords(context: ValidationContext): {
    shouldForce: boolean;
    reason: string;
    confidence: number;
  } {
    const query = context.originalQuery.toLowerCase();

    // Strong comparative indicators
    const strongComparativePatterns = [
      /\bcomparative\s+analysis\b/i,
      /\bcompare\s+.*\s+(?:and|with|to|vs)\b/i,
      /\b(?:how\s+do|how\s+does)\s+.*\s+(?:align|relate|compare)\b/i,
      /\b(?:what\s+is|what\s+are)\s+the\s+(?:relationship|differences|similarities)\b/i,
      /\bbetween\s+.*\s+and\s+.*\b/i,
    ];

    const hasStrongComparative = strongComparativePatterns.some((pattern) =>
      pattern.test(context.originalQuery),
    );

    if (hasStrongComparative && context.documentCount >= 1) {
      return {
        shouldForce: true,
        reason: 'strong_comparative_keywords',
        confidence: 0.9,
      };
    }

    // Moderate comparative indicators
    const moderateComparativePatterns = [
      /\b(?:compare|comparison|vs|versus)\b/i,
      /\b(?:contrast|contrasting)\b/i,
      /\b(?:align|alignment)\b/i,
    ];

    const hasModerateComparative = moderateComparativePatterns.some((pattern) =>
      pattern.test(context.originalQuery),
    );

    if (hasModerateComparative && context.documentCount >= 2) {
      return {
        shouldForce: true,
        reason: 'moderate_comparative_keywords',
        confidence: 0.7,
      };
    }

    return {
      shouldForce: false,
      reason: 'no_comparative_keywords',
      confidence: 0,
    };
  }

  /**
   * Check for relationship analysis patterns
   */
  private checkRelationshipAnalysis(context: ValidationContext): {
    shouldForce: boolean;
    reason: string;
    confidence: number;
  } {
    const relationshipPatterns = [
      /\b(?:relationship|relate|related|relating)\b/i,
      /\b(?:align|alignment|aligned)\b/i,
      /\b(?:connect|connection|connected)\b/i,
      /\b(?:how\s+do|how\s+does)\s+.*\s+(?:work\s+together|fit\s+together)\b/i,
      /\b(?:overlap|overlapping|intersection)\b/i,
    ];

    const hasRelationshipIntent = relationshipPatterns.some((pattern) =>
      pattern.test(context.originalQuery),
    );

    if (hasRelationshipIntent && context.documentCount >= 2) {
      return {
        shouldForce: true,
        reason: 'relationship_analysis_detected',
        confidence: 0.8,
      };
    }

    return {
      shouldForce: false,
      reason: 'no_relationship_analysis',
      confidence: 0,
    };
  }

  /**
   * Check retrieval plan for synthesis requirements
   */
  private checkRetrievalPlan(context: ValidationContext): {
    shouldForce: boolean;
    reason: string;
    confidence: number;
  } {
    if (!context.retrievalPlan) {
      return { shouldForce: false, reason: 'no_retrieval_plan', confidence: 0 };
    }

    const plan = context.retrievalPlan;

    // High-priority plans with comparative/relationship analysis
    if (
      plan.priority === 'high' &&
      (plan.analysisType === 'comparative' ||
        plan.analysisType === 'relationship')
    ) {
      return {
        shouldForce: true,
        reason: 'high_priority_retrieval_plan',
        confidence: Math.min(plan.confidence + 0.1, 0.95),
      };
    }

    // Plans with relationship mapping (indicates comparative analysis)
    if (Object.keys(plan.relationshipMapping).length > 0) {
      return {
        shouldForce: true,
        reason: 'relationship_mapping_present',
        confidence: Math.min(plan.confidence + 0.05, 0.9),
      };
    }

    return {
      shouldForce: false,
      reason: 'plan_not_synthesis_worthy',
      confidence: 0,
    };
  }

  /**
   * Create validation context from graph state
   */
  public static createValidationContext(
    originalQuery: string,
    originalNeedsSynthesis: boolean,
    toolResults: any[],
    retrievalPlan?: DocumentRetrievalPlan,
  ): ValidationContext {
    // Count documents from tool results
    let documentCount = 0;

    toolResults.forEach((result) => {
      try {
        const content =
          typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content);

        const parsed = JSON.parse(content);

        // Count from getMultipleDocuments results
        if (
          parsed.success &&
          parsed.documents &&
          Array.isArray(parsed.documents)
        ) {
          documentCount = Math.max(documentCount, parsed.documents.length);
        }

        // Count from individual getDocumentContents results
        if (parsed.success && parsed.document) {
          documentCount += 1;
        }

        // Count from listDocuments results
        if (
          parsed.success &&
          parsed.available_documents &&
          Array.isArray(parsed.available_documents)
        ) {
          // Don't count listDocuments as retrieved documents, just available ones
        }
      } catch (error) {
        // Not JSON, might be direct content
        if (
          result.content &&
          typeof result.content === 'string' &&
          result.content.length > 100
        ) {
          documentCount += 1;
        }
      }
    });

    return {
      originalQuery,
      originalNeedsSynthesis,
      toolResults,
      retrievalPlan,
      documentCount,
    };
  }

  /**
   * Quick validation for immediate use in routing decisions
   */
  public quickValidate(
    query: string,
    needsSynthesis: boolean,
    documentCount: number,
  ): boolean {
    // Quick multi-document + analysis check
    if (documentCount >= 2) {
      const analysisPatterns = [
        /\b(?:compar[ei]|comparison|comparative|vs|versus|analysis|analyz[ei])\b/i,
        /\b(?:relationship|align|between.*and)\b/i,
      ];

      return analysisPatterns.some((pattern) => pattern.test(query));
    }

    return needsSynthesis;
  }
}
