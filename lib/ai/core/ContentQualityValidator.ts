/**
 * Content Quality Validator
 *
 * Ensures that when synthesis is requested, the response actually contains
 * analysis rather than just document dumps. Validates response quality
 * and triggers retry with forced synthesis if needed.
 *
 * Addresses the issue where comparative analysis requests were returning
 * raw document content instead of actual analysis.
 */

import type { RequestLogger } from '@/lib/services/observabilityService';
import type { RoutingDisplayContext } from './ResponseRoutingDisplay';

export interface QualityValidationResult {
  isQualityResponse: boolean;
  qualityScore: number;
  issues: QualityIssue[];
  shouldRetry: boolean;
  retryReason?: string;
  improvementSuggestions: string[];
}

export interface QualityIssue {
  type:
    | 'missing_analysis'
    | 'document_dump'
    | 'insufficient_synthesis'
    | 'low_relevance'
    | 'formatting_issues';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
}

export interface ValidationContext {
  originalQuery: string;
  expectedResponseType:
    | 'synthesis'
    | 'simple_response'
    | 'conversational_response';
  routingContext?: RoutingDisplayContext;
  response: string;
  toolResults?: any[];
  processingTime: number;
}

export class ContentQualityValidator {
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Validate response quality based on expected type and context
   */
  public validateResponseQuality(
    context: ValidationContext,
  ): QualityValidationResult {
    const startTime = performance.now();

    this.logger.info('[QualityValidator] Starting quality validation', {
      originalQuery: context.originalQuery.substring(0, 100),
      expectedResponseType: context.expectedResponseType,
      responseLength: context.response.length,
      processingTime: context.processingTime,
    });

    const issues: QualityIssue[] = [];
    let qualityScore = 1.0; // Start with perfect score

    // Validate based on expected response type
    switch (context.expectedResponseType) {
      case 'synthesis':
        issues.push(...this.validateSynthesisResponse(context));
        break;
      case 'simple_response':
        issues.push(...this.validateSimpleResponse(context));
        break;
      case 'conversational_response':
        issues.push(...this.validateConversationalResponse(context));
        break;
    }

    // General quality checks
    issues.push(...this.validateGeneralQuality(context));

    // Calculate quality score based on issues
    qualityScore = this.calculateQualityScore(issues);

    // Determine if retry is needed
    const shouldRetry = this.shouldRetryResponse(issues, qualityScore, context);
    const retryReason = shouldRetry ? this.getRetryReason(issues) : undefined;

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(
      issues,
      context,
    );

    const duration = performance.now() - startTime;

    this.logger.info('[QualityValidator] Quality validation completed', {
      qualityScore: qualityScore.toFixed(2),
      issueCount: issues.length,
      shouldRetry,
      retryReason,
      duration: `${duration.toFixed(2)}ms`,
    });

    return {
      isQualityResponse: qualityScore >= 0.7,
      qualityScore,
      issues,
      shouldRetry,
      retryReason,
      improvementSuggestions,
    };
  }

  /**
   * Validate synthesis responses for actual analysis content
   */
  private validateSynthesisResponse(
    context: ValidationContext,
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const response = context.response.toLowerCase();
    const query = context.originalQuery.toLowerCase();

    // Check for comparative analysis when requested
    if (this.isComparativeQuery(query)) {
      const hasComparativeAnalysis = this.hasComparativeAnalysis(response);
      if (!hasComparativeAnalysis) {
        issues.push({
          type: 'missing_analysis',
          severity: 'critical',
          description:
            'Comparative analysis was requested but response lacks comparison elements',
          confidence: 0.9,
        });
      }
    }

    // Check for relationship analysis when requested
    if (this.isRelationshipQuery(query)) {
      const hasRelationshipAnalysis = this.hasRelationshipAnalysis(response);
      if (!hasRelationshipAnalysis) {
        issues.push({
          type: 'missing_analysis',
          severity: 'critical',
          description:
            'Relationship analysis was requested but response lacks relationship elements',
          confidence: 0.85,
        });
      }
    }

    // Check if response is just document content dump
    if (this.isDocumentDump(response, context.toolResults)) {
      issues.push({
        type: 'document_dump',
        severity: 'critical',
        description:
          'Response appears to be raw document content without synthesis',
        confidence: 0.8,
      });
    }

    // Check for synthesis indicators
    const hasSynthesisIndicators = this.hasSynthesisIndicators(response);
    if (!hasSynthesisIndicators) {
      issues.push({
        type: 'insufficient_synthesis',
        severity: 'high',
        description:
          'Response lacks synthesis indicators (analysis, comparison, insights)',
        confidence: 0.75,
      });
    }

    return issues;
  }

  /**
   * Validate simple responses for appropriate content
   */
  private validateSimpleResponse(context: ValidationContext): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const response = context.response;

    // Check if response is too complex for simple query
    if (this.isTooComplexForSimpleQuery(response, context.originalQuery)) {
      issues.push({
        type: 'low_relevance',
        severity: 'medium',
        description:
          'Response may be overly complex for simple information request',
        confidence: 0.6,
      });
    }

    // Check if response addresses the query
    if (!this.addressesQuery(response, context.originalQuery)) {
      issues.push({
        type: 'low_relevance',
        severity: 'high',
        description: 'Response does not adequately address the original query',
        confidence: 0.8,
      });
    }

    return issues;
  }

  /**
   * Validate conversational responses
   */
  private validateConversationalResponse(
    context: ValidationContext,
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const response = context.response;

    // Check for conversational tone
    if (!this.hasConversationalTone(response)) {
      issues.push({
        type: 'formatting_issues',
        severity: 'low',
        description:
          'Response lacks conversational tone for conversational query',
        confidence: 0.5,
      });
    }

    return issues;
  }

  /**
   * General quality validation checks
   */
  private validateGeneralQuality(context: ValidationContext): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const response = context.response;

    // Check response length
    if (response.length < 50) {
      issues.push({
        type: 'insufficient_synthesis',
        severity: 'high',
        description: 'Response is too short to be meaningful',
        confidence: 0.9,
      });
    }

    // Check for repetitive content
    if (this.hasRepetitiveContent(response)) {
      issues.push({
        type: 'formatting_issues',
        severity: 'medium',
        description: 'Response contains repetitive or duplicated content',
        confidence: 0.7,
      });
    }

    // Check for proper formatting
    if (!this.hasProperFormatting(response)) {
      issues.push({
        type: 'formatting_issues',
        severity: 'low',
        description: 'Response formatting could be improved',
        confidence: 0.6,
      });
    }

    return issues;
  }

  /**
   * Check if query is requesting comparative analysis
   */
  private isComparativeQuery(query: string): boolean {
    const comparativePatterns = [
      /\bcomparative\s+analysis\b/i,
      /\bcompare\s+.*\s+(?:and|with|to|vs)\b/i,
      /\b(?:vs|versus|against)\b/i,
      /\bbetween\s+.*\s+and\s+.*\b/i,
      /\b(?:similarities|differences|contrast)\b/i,
    ];

    return comparativePatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Check if query is requesting relationship analysis
   */
  private isRelationshipQuery(query: string): boolean {
    const relationshipPatterns = [
      /\b(?:relationship|align|alignment)\b/i,
      /\bhow.*(?:relate|connect|match)\b/i,
      /\b(?:connection|correlation)\b/i,
    ];

    return relationshipPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Check if response contains comparative analysis elements
   */
  private hasComparativeAnalysis(response: string): boolean {
    const comparativeIndicators = [
      /\b(?:compared to|in comparison|versus|vs)\b/i,
      /\b(?:similarly|likewise|in contrast|however|whereas)\b/i,
      /\b(?:both|neither|either|while|although)\b/i,
      /\b(?:difference|similarity|contrast|parallel)\b/i,
      /\b(?:on one hand|on the other hand)\b/i,
    ];

    return comparativeIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check if response contains relationship analysis elements
   */
  private hasRelationshipAnalysis(response: string): boolean {
    const relationshipIndicators = [
      /\b(?:aligns with|relates to|connects to)\b/i,
      /\b(?:relationship|connection|correlation)\b/i,
      /\b(?:supports|reinforces|complements)\b/i,
      /\b(?:consistent with|inconsistent with)\b/i,
    ];

    return relationshipIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check if response is just a document content dump
   */
  private isDocumentDump(response: string, toolResults?: any[]): boolean {
    if (!toolResults || toolResults.length === 0) return false;

    // Check if response is mostly raw document content
    const responseWords = response.toLowerCase().split(/\s+/);
    let matchingWords = 0;
    let totalDocumentWords = 0;

    toolResults.forEach((result) => {
      if (result.content) {
        const docWords = result.content.toLowerCase().split(/\s+/);
        totalDocumentWords += docWords.length;

        docWords.forEach((word) => {
          if (word.length > 3 && responseWords.includes(word)) {
            matchingWords++;
          }
        });
      }
    });

    // If more than 70% of response words match document content, it's likely a dump
    const matchRatio = matchingWords / responseWords.length;
    return matchRatio > 0.7;
  }

  /**
   * Check if response has synthesis indicators
   */
  private hasSynthesisIndicators(response: string): boolean {
    const synthesisIndicators = [
      /\b(?:analysis|analyze|examining)\b/i,
      /\b(?:insight|conclusion|finding)\b/i,
      /\b(?:suggests|indicates|reveals)\b/i,
      /\b(?:overall|in summary|to summarize)\b/i,
      /\b(?:key points|main themes|important aspects)\b/i,
    ];

    return synthesisIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check if response is too complex for simple query
   */
  private isTooComplexForSimpleQuery(response: string, query: string): boolean {
    const simpleQueryPatterns = [
      /\b(?:what is|who is|when is|where is)\b/i,
      /\b(?:list|show|display)\b/i,
    ];

    const isSimpleQuery = simpleQueryPatterns.some((pattern) =>
      pattern.test(query),
    );
    if (!isSimpleQuery) return false;

    // Check if response is overly analytical for simple query
    const complexIndicators = [
      /\b(?:analysis|synthesis|comparison)\b/i,
      /\b(?:furthermore|moreover|additionally)\b/i,
      /\b(?:in conclusion|to summarize)\b/i,
    ];

    const complexityCount = complexIndicators.reduce((count, pattern) => {
      return count + (pattern.test(response) ? 1 : 0);
    }, 0);

    return complexityCount > 2;
  }

  /**
   * Check if response addresses the original query
   */
  private addressesQuery(response: string, query: string): boolean {
    // Extract key terms from query
    const queryTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 3)
      .slice(0, 5); // Top 5 terms

    const responseLower = response.toLowerCase();
    const matchingTerms = queryTerms.filter((term) =>
      responseLower.includes(term),
    );

    // At least 40% of key terms should be addressed
    return matchingTerms.length / queryTerms.length >= 0.4;
  }

  /**
   * Check if response has conversational tone
   */
  private hasConversationalTone(response: string): boolean {
    const conversationalIndicators = [
      /\b(?:you|your|let me|I'll|I can)\b/i,
      /\b(?:here's|here are|this is|these are)\b/i,
      /\b(?:hope this helps|feel free|please)\b/i,
    ];

    return conversationalIndicators.some((pattern) => pattern.test(response));
  }

  /**
   * Check for repetitive content
   */
  private hasRepetitiveContent(response: string): boolean {
    const sentences = response
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10);
    const uniqueSentences = new Set(
      sentences.map((s) => s.trim().toLowerCase()),
    );

    // If less than 80% of sentences are unique, consider it repetitive
    return uniqueSentences.size / sentences.length < 0.8;
  }

  /**
   * Check for proper formatting
   */
  private hasProperFormatting(response: string): boolean {
    // Basic formatting checks
    const hasProperCapitalization = /^[A-Z]/.test(response.trim());
    const hasProperPunctuation = /[.!?]$/.test(response.trim());
    const hasReasonableLineBreaks =
      response.split('\n').length > 1 || response.length < 500;

    return (
      hasProperCapitalization && hasProperPunctuation && hasReasonableLineBreaks
    );
  }

  /**
   * Calculate overall quality score based on issues
   */
  private calculateQualityScore(issues: QualityIssue[]): number {
    let score = 1.0;

    issues.forEach((issue) => {
      const severityPenalties = {
        low: 0.05,
        medium: 0.15,
        high: 0.25,
        critical: 0.4,
      };

      const penalty = severityPenalties[issue.severity] * issue.confidence;
      score -= penalty;
    });

    return Math.max(score, 0);
  }

  /**
   * Determine if response should be retried
   */
  private shouldRetryResponse(
    issues: QualityIssue[],
    qualityScore: number,
    context: ValidationContext,
  ): boolean {
    // Don't retry if processing took too long already
    if (context.processingTime > 15000) {
      // 15 seconds
      return false;
    }

    // Retry for critical issues
    const hasCriticalIssues = issues.some(
      (issue) => issue.severity === 'critical',
    );
    if (hasCriticalIssues) {
      return true;
    }

    // Retry if quality score is very low
    if (qualityScore < 0.5) {
      return true;
    }

    // Retry for synthesis responses with missing analysis
    if (context.expectedResponseType === 'synthesis' && qualityScore < 0.7) {
      const hasMissingAnalysis = issues.some(
        (issue) => issue.type === 'missing_analysis',
      );
      return hasMissingAnalysis;
    }

    return false;
  }

  /**
   * Get retry reason based on issues
   */
  private getRetryReason(issues: QualityIssue[]): string {
    const criticalIssues = issues.filter(
      (issue) => issue.severity === 'critical',
    );
    if (criticalIssues.length > 0) {
      return criticalIssues[0].description;
    }

    const highIssues = issues.filter((issue) => issue.severity === 'high');
    if (highIssues.length > 0) {
      return highIssues[0].description;
    }

    return 'Quality score below acceptable threshold';
  }

  /**
   * Generate improvement suggestions based on issues
   */
  private generateImprovementSuggestions(
    issues: QualityIssue[],
    context: ValidationContext,
  ): string[] {
    const suggestions: string[] = [];

    issues.forEach((issue) => {
      switch (issue.type) {
        case 'missing_analysis':
          suggestions.push(
            'Add comparative analysis elements like similarities, differences, and relationships',
          );
          break;
        case 'document_dump':
          suggestions.push(
            'Synthesize document content rather than presenting raw text',
          );
          break;
        case 'insufficient_synthesis':
          suggestions.push(
            'Include analysis keywords like "suggests", "indicates", "reveals"',
          );
          break;
        case 'low_relevance':
          suggestions.push(
            'Focus more directly on addressing the original query',
          );
          break;
        case 'formatting_issues':
          suggestions.push('Improve response formatting and structure');
          break;
      }
    });

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  /**
   * Quick quality check for streaming responses
   */
  public quickQualityCheck(
    response: string,
    expectedType: 'synthesis' | 'simple_response' | 'conversational_response',
  ): { isAcceptable: boolean; confidence: number } {
    let confidence = 0.7;

    // Quick checks based on expected type
    if (expectedType === 'synthesis') {
      const hasSynthesis = this.hasSynthesisIndicators(response);
      confidence = hasSynthesis ? 0.8 : 0.4;
    }

    const isAcceptable = confidence > 0.6 && response.length > 50;

    return { isAcceptable, confidence };
  }
}
