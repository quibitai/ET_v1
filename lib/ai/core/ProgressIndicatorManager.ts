/**
 * Enhanced Progress Indicator Manager for LangGraph Streaming
 * Provides context-aware, phase-based progress tracking with intelligent timing
 */

export interface ProgressPhase {
  phase: 'PLANNING' | 'RETRIEVING' | 'ANALYZING' | 'SYNTHESIZING' | 'COMPLETE';
  message: string;
  emoji: string;
  estimatedDuration?: number;
}

export interface ProgressContext {
  queryType:
    | 'comparative'
    | 'relationship'
    | 'synthesis'
    | 'simple_lookup'
    | 'conversational';
  documentsExpected: number;
  toolsAvailable: string[];
  startTime: number;
  currentPhase: ProgressPhase['phase'];
  contentStreamingStarted: boolean;
}

export class ProgressIndicatorManager {
  private context: ProgressContext | null = null;
  private phaseHistory: Set<ProgressPhase['phase']> = new Set();

  constructor() {
    this.reset();
  }

  /**
   * Initialize progress tracking for a new query
   */
  initializeProgress(
    query: string,
    retrievalPlan?: any,
    availableTools: string[] = [],
  ): ProgressContext {
    const queryType = this.analyzeQueryType(query);

    this.context = {
      queryType,
      documentsExpected: this.estimateDocumentCount(query, retrievalPlan),
      toolsAvailable: availableTools,
      startTime: Date.now(),
      currentPhase: 'PLANNING',
      contentStreamingStarted: false,
    };

    this.phaseHistory.clear();
    return this.context;
  }

  /**
   * Get progress indicator for current phase - only shows once per phase
   */
  getPhaseIndicator(newPhase: ProgressPhase['phase']): string | null {
    if (!this.context || this.context.contentStreamingStarted) {
      return null;
    }

    // Only show indicator if we haven't shown this phase before
    if (this.phaseHistory.has(newPhase)) {
      return null;
    }

    this.phaseHistory.add(newPhase);
    this.context.currentPhase = newPhase;

    const phase = this.getPhaseConfig(newPhase);
    return `${phase.emoji} ${phase.message}`;
  }

  /**
   * Mark that content streaming has started - stops all progress indicators
   */
  markContentStreamingStarted(): void {
    if (this.context) {
      this.context.contentStreamingStarted = true;
      this.context.currentPhase = 'COMPLETE';
    }
  }

  /**
   * Get tool completion summary instead of individual tool messages
   */
  getToolCompletionSummary(
    toolResults: Array<{ name: string; success: boolean; data?: any }>,
  ): string | null {
    if (!this.context || this.context.contentStreamingStarted) {
      return null;
    }

    const documentCount = toolResults.filter(
      (r) => r.name === 'getDocumentContents' && r.success,
    ).length;

    const webResultCount = toolResults.filter(
      (r) => r.name === 'tavilySearch' && r.success,
    ).length;

    const summaryParts: string[] = [];

    if (documentCount > 0) {
      summaryParts.push(
        `📄 Retrieved ${documentCount} document${documentCount > 1 ? 's' : ''}`,
      );
    }

    if (webResultCount > 0) {
      summaryParts.push(
        `🌐 Found ${webResultCount} web result${webResultCount > 1 ? 's' : ''}`,
      );
    }

    return summaryParts.length > 0 ? summaryParts.join('\n') : null;
  }

  /**
   * Reset progress tracking
   */
  reset(): void {
    this.context = null;
    this.phaseHistory.clear();
  }

  /**
   * Check if we should show progress indicators
   */
  shouldShowProgress(): boolean {
    return this.context !== null && !this.context.contentStreamingStarted;
  }

  private getPhaseConfig(phase: ProgressPhase['phase']): ProgressPhase {
    const configs: Record<ProgressPhase['phase'], ProgressPhase> = {
      PLANNING: {
        phase: 'PLANNING',
        emoji: '🎯',
        message: 'Analysis plan...',
        estimatedDuration: 2000,
      },
      RETRIEVING: {
        phase: 'RETRIEVING',
        emoji: '📚',
        message: 'Retrieving information...',
        estimatedDuration: 5000,
      },
      ANALYZING: {
        phase: 'ANALYZING',
        emoji: '🔗',
        message: 'Planning relationship analysis...',
        estimatedDuration: 3000,
      },
      SYNTHESIZING: {
        phase: 'SYNTHESIZING',
        emoji: '📝',
        message: 'Synthesizing response...',
        estimatedDuration: 8000,
      },
      COMPLETE: {
        phase: 'COMPLETE',
        emoji: '✅',
        message: 'Complete',
        estimatedDuration: 0,
      },
    };

    return configs[phase];
  }

  private analyzeQueryType(query: string): ProgressContext['queryType'] {
    const lowerQuery = query.toLowerCase();

    if (/\b(compar[ei]|vs|versus|contrast)\b/.test(lowerQuery)) {
      return 'comparative';
    }

    if (/\b(relationship|align|connect|between)\b/.test(lowerQuery)) {
      return 'relationship';
    }

    if (/\b(analyz[ei]|synthesis|research|report)\b/.test(lowerQuery)) {
      return 'synthesis';
    }

    if (/\b(show|list|display|get|find)\b/.test(lowerQuery)) {
      return 'simple_lookup';
    }

    return 'conversational';
  }

  private estimateDocumentCount(query: string, retrievalPlan?: any): number {
    if (retrievalPlan?.requiredDocuments) {
      return retrievalPlan.requiredDocuments.length;
    }

    // Estimate based on query patterns
    const documentKeywords = [
      'document',
      'file',
      'profile',
      'values',
      'report',
    ];
    const matches = documentKeywords.filter((keyword) =>
      query.toLowerCase().includes(keyword),
    ).length;

    return Math.max(1, matches);
  }
}
