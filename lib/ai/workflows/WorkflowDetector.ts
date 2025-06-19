/**
 * WorkflowDetector - Identifies multi-step workflows from user queries
 *
 * This class analyzes user input to determine if it requires a multi-step workflow
 * rather than a single tool execution. It uses pattern matching and natural language
 * processing to detect workflow complexity and provide confidence scoring.
 */

import type { WorkflowDetection, WorkflowPattern } from './types';
import { WorkflowComplexity, WorkflowStepType } from './types';

export class WorkflowDetector {
  private patterns: WorkflowPattern[] = [
    // Sequential workflow patterns
    {
      name: 'create_and_add',
      regex: /create\s+.*\s+and\s+(add|assign|set)/i,
      confidence: 0.9,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.CREATE, WorkflowStepType.RELATE],
      description: 'Create something and add/assign related items',
    },
    {
      name: 'find_then_update',
      regex: /find\s+.*\s+(then|and)\s+(update|modify|change)/i,
      confidence: 0.85,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.QUERY, WorkflowStepType.UPDATE],
      description: 'Find items then update them',
    },
    {
      name: 'get_for_each_create',
      regex: /get\s+.*\s+for\s+each\s+(create|generate|make)/i,
      confidence: 0.8,
      complexity: WorkflowComplexity.COMPLEX,
      stepTypes: [
        WorkflowStepType.QUERY,
        WorkflowStepType.ANALYZE,
        WorkflowStepType.CREATE,
      ],
      description: 'Get data and create something for each item',
    },
    {
      name: 'all_that_then',
      regex: /all\s+.*\s+that\s+.*\s+(then|and)\s+/i,
      confidence: 0.75,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.QUERY, WorkflowStepType.UPDATE],
      description: 'Find all items matching criteria then perform action',
    },

    // Sequential indicators
    {
      name: 'sequential_indicators',
      regex: /(first|then|next|after|finally|lastly)\s+/i,
      confidence: 0.7,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.QUERY, WorkflowStepType.CREATE],
      description: 'Sequential workflow indicators',
    },

    // Multiple action patterns
    {
      name: 'multiple_actions',
      regex:
        /(create|add|update|delete|assign|move).*\s+(and|then)\s+(create|add|update|delete|assign|move)/i,
      confidence: 0.8,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.CREATE, WorkflowStepType.UPDATE],
      description: 'Multiple distinct actions',
    },

    // Bulk operations
    {
      name: 'bulk_operations',
      regex: /(all|every|each|bulk)\s+.*\s+(update|delete|assign|move|notify)/i,
      confidence: 0.85,
      complexity: WorkflowComplexity.COMPLEX,
      stepTypes: [WorkflowStepType.QUERY, WorkflowStepType.BATCH],
      description: 'Bulk operations on multiple items',
    },

    // Analysis workflows
    {
      name: 'analysis_workflow',
      regex:
        /(analyze|report|summary|calculate|compare)\s+.*\s+(and|then)\s+(create|generate|send)/i,
      confidence: 0.8,
      complexity: WorkflowComplexity.COMPLEX,
      stepTypes: [
        WorkflowStepType.QUERY,
        WorkflowStepType.ANALYZE,
        WorkflowStepType.CREATE,
      ],
      description: 'Analysis followed by action',
    },

    // Notification workflows
    {
      name: 'notify_workflow',
      regex: /.*\s+(and|then)\s+(notify|alert|email|message)/i,
      confidence: 0.75,
      complexity: WorkflowComplexity.MODERATE,
      stepTypes: [WorkflowStepType.UPDATE, WorkflowStepType.NOTIFY],
      description: 'Action followed by notification',
    },

    // Complex project setup
    {
      name: 'project_setup',
      regex: /create\s+project.*\s+(add|with)\s+.*(tasks|members|sections)/i,
      confidence: 0.9,
      complexity: WorkflowComplexity.COMPLEX,
      stepTypes: [
        WorkflowStepType.CREATE,
        WorkflowStepType.RELATE,
        WorkflowStepType.UPDATE,
      ],
      description: 'Complex project setup with multiple components',
    },
  ];

  /**
   * Detect if a query requires a multi-step workflow
   */
  public detectWorkflow(query: string): WorkflowDetection {
    const normalizedQuery = this.normalizeQuery(query);
    const matchedPatterns: string[] = [];
    let maxConfidence = 0;
    let detectedComplexity = WorkflowComplexity.SIMPLE;
    let estimatedSteps = 1;

    // Check each pattern
    for (const pattern of this.patterns) {
      if (pattern.regex.test(normalizedQuery)) {
        matchedPatterns.push(pattern.name);

        if (pattern.confidence > maxConfidence) {
          maxConfidence = pattern.confidence;
          detectedComplexity = pattern.complexity;
          estimatedSteps = this.estimateSteps(
            pattern.stepTypes.length,
            pattern.complexity,
          );
        }
      }
    }

    // Additional heuristics
    const additionalScore = this.calculateAdditionalScore(normalizedQuery);
    const finalConfidence = Math.min(maxConfidence + additionalScore, 1.0);

    // Adjust complexity based on additional indicators
    if (additionalScore > 0.2) {
      estimatedSteps = Math.max(estimatedSteps, 3);
      if (detectedComplexity === WorkflowComplexity.SIMPLE) {
        detectedComplexity = WorkflowComplexity.MODERATE;
      }
    }

    const isWorkflow = finalConfidence >= 0.6 && matchedPatterns.length > 0;

    return {
      isWorkflow,
      confidence: finalConfidence,
      complexity: detectedComplexity,
      estimatedSteps,
      detectedPatterns: matchedPatterns,
      reasoning: this.generateReasoning(
        matchedPatterns,
        finalConfidence,
        normalizedQuery,
      ),
    };
  }

  /**
   * Normalize query for better pattern matching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?;]/g, '');
  }

  /**
   * Calculate additional scoring based on various indicators
   */
  private calculateAdditionalScore(query: string): number {
    let score = 0;

    // Count action words
    const actionWords = [
      'create',
      'add',
      'update',
      'delete',
      'assign',
      'move',
      'notify',
      'send',
      'generate',
      'analyze',
    ];
    const actionCount = actionWords.filter((word) =>
      query.includes(word),
    ).length;
    if (actionCount >= 2) score += 0.2;
    if (actionCount >= 3) score += 0.1;

    // Check for conjunctions
    const conjunctions = ['and', 'then', 'also', 'plus', 'additionally'];
    const conjunctionCount = conjunctions.filter((word) =>
      query.includes(word),
    ).length;
    score += conjunctionCount * 0.1;

    // Check for quantifiers suggesting bulk operations
    const quantifiers = ['all', 'every', 'each', 'multiple', 'several', 'many'];
    if (quantifiers.some((word) => query.includes(word))) score += 0.15;

    // Check for time-based sequences
    const timeIndicators = [
      'first',
      'second',
      'third',
      'finally',
      'after',
      'before',
      'once',
    ];
    if (timeIndicators.some((word) => query.includes(word))) score += 0.1;

    // Check for complex entities (projects with tasks, etc.)
    const complexEntities = [
      'project with tasks',
      'team with members',
      'section with tasks',
    ];
    if (complexEntities.some((phrase) => query.includes(phrase))) score += 0.2;

    return Math.min(score, 0.4); // Cap additional score
  }

  /**
   * Estimate number of steps based on complexity and step types
   */
  private estimateSteps(
    baseSteps: number,
    complexity: WorkflowComplexity,
  ): number {
    const multiplier = {
      [WorkflowComplexity.SIMPLE]: 1,
      [WorkflowComplexity.MODERATE]: 1.5,
      [WorkflowComplexity.COMPLEX]: 2,
    };

    return Math.ceil(baseSteps * multiplier[complexity]);
  }

  /**
   * Generate human-readable reasoning for the detection
   */
  private generateReasoning(
    patterns: string[],
    confidence: number,
    query: string,
  ): string {
    if (patterns.length === 0) {
      return 'No workflow patterns detected. Query appears to be a single-step operation.';
    }

    const patternDescriptions = patterns.map((patternName) => {
      const pattern = this.patterns.find((p) => p.name === patternName);
      return pattern?.description || patternName;
    });

    let reasoning = `Detected workflow patterns: ${patternDescriptions.join(', ')}. `;

    if (confidence >= 0.9) {
      reasoning += 'High confidence multi-step workflow detected.';
    } else if (confidence >= 0.7) {
      reasoning += 'Moderate confidence multi-step workflow detected.';
    } else {
      reasoning +=
        'Low confidence workflow detection. May be single-step with complex parameters.';
    }

    return reasoning;
  }

  /**
   * Add custom pattern for specific use cases
   */
  public addPattern(pattern: WorkflowPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get all registered patterns
   */
  public getPatterns(): WorkflowPattern[] {
    return [...this.patterns];
  }
}
