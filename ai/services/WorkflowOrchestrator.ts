/**
 * WorkflowOrchestrator - Advanced Workflow State Management
 *
 * Orchestrates tool execution sequences and manages workflow state.
 * Replaces and enhances the ToolWorkflowManager class from SimpleLangGraphWrapper.
 */

import type { RequestLogger } from '../../services/observabilityService';

export interface WorkflowState {
  documentsListed: boolean;
  documentsRetrieved: string[];
  webSearchCompleted: boolean;
  extractionCompleted: boolean;
  multiDocAnalysisCompleted: boolean;
}

export interface ExecutedTool {
  name: string;
  success: boolean;
  result?: any;
  args?: any;
  timestamp: number;
  executionTime?: number;
}

export interface ToolSuggestion {
  toolName: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  forceCall?: boolean;
  suggestedArgs?: any;
}

export interface WorkflowStatus {
  documentsListed: boolean;
  documentsRetrieved: number;
  webSearchCompleted: boolean;
  extractionCompleted: boolean;
  multiDocAnalysisCompleted: boolean;
  executedTools: string[];
  isReadyForSynthesis: boolean;
  nextSuggestedTools: ToolSuggestion[];
}

export class WorkflowOrchestrator {
  private executedTools = new Map<string, ExecutedTool>();
  private workflowState: WorkflowState = {
    documentsListed: false,
    documentsRetrieved: [],
    webSearchCompleted: false,
    extractionCompleted: false,
    multiDocAnalysisCompleted: false,
  };
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Analyze tool results and update workflow state
   */
  analyzeToolResults(toolName: string, toolResult: any, toolArgs: any): void {
    const startTime = Date.now();

    // Record tool execution
    this.executedTools.set(toolName, {
      name: toolName,
      success: toolResult !== null && toolResult !== undefined,
      result: toolResult,
      args: toolArgs,
      timestamp: startTime,
    });

    // Update workflow state based on tool type
    this.updateWorkflowState(toolName, toolResult, toolArgs);

    this.logger.info('[WorkflowOrchestrator] Tool analyzed', {
      toolName,
      success: toolResult !== null && toolResult !== undefined,
      workflowState: this.workflowState,
    });
  }

  /**
   * Update workflow state based on specific tool execution
   */
  private updateWorkflowState(
    toolName: string,
    toolResult: any,
    toolArgs: any,
  ): void {
    switch (toolName) {
      case 'listDocuments':
        this.workflowState.documentsListed = true;
        this.logger.info(
          '[WorkflowOrchestrator] Documents listed - ready for retrieval',
        );
        break;

      case 'getDocumentContents': {
        const docId = toolArgs?.id || toolArgs?.title || 'unknown';
        if (!this.workflowState.documentsRetrieved.includes(docId)) {
          this.workflowState.documentsRetrieved.push(docId);
        }
        this.logger.info('[WorkflowOrchestrator] Document retrieved', {
          docId,
        });
        break;
      }

      case 'searchInternalKnowledgeBase': {
        // Track knowledge base searches as document retrieval
        const docId = `kb_search_${Date.now()}`;
        if (!this.workflowState.documentsRetrieved.includes(docId)) {
          this.workflowState.documentsRetrieved.push(docId);
        }
        this.logger.info('[WorkflowOrchestrator] Knowledge base searched', {
          docId,
        });
        break;
      }

      case 'tavilySearch':
        this.workflowState.webSearchCompleted = true;
        this.logger.info('[WorkflowOrchestrator] Web search completed');
        break;

      case 'tavilyExtract':
        this.workflowState.extractionCompleted = true;
        this.logger.info('[WorkflowOrchestrator] Content extraction completed');
        break;

      case 'multiDocumentRetrieval':
        this.workflowState.multiDocAnalysisCompleted = true;
        this.logger.info(
          '[WorkflowOrchestrator] Multi-document analysis completed',
        );
        break;
    }
  }

  /**
   * Get suggested next tools based on current workflow state and query
   */
  getSuggestedNextTools(currentQuery: string): ToolSuggestion[] {
    const suggestions: ToolSuggestion[] = [];
    const queryLower = currentQuery.toLowerCase();

    // Web search suggestions
    if (
      this.isWebSearchNeeded(currentQuery) &&
      !this.workflowState.webSearchCompleted
    ) {
      suggestions.push({
        toolName: 'tavilySearch',
        priority: 'high',
        reason: 'Query requires external information that needs web search',
        forceCall: true,
        suggestedArgs: {
          query: this.buildComprehensiveSearchQuery(currentQuery),
        },
      });
    }

    // Document listing suggestions
    if (
      this.requiresDocuments(currentQuery) &&
      !this.workflowState.documentsListed
    ) {
      suggestions.push({
        toolName: 'listDocuments',
        priority: 'high',
        reason: 'Query requires document access but documents not yet listed',
        forceCall: true,
      });
    }

    // Document retrieval suggestions
    if (
      this.workflowState.documentsListed &&
      this.workflowState.documentsRetrieved.length === 0
    ) {
      suggestions.push({
        toolName: 'getDocumentContents',
        priority: 'medium',
        reason: 'Documents are available but none have been retrieved',
      });
    }

    // Content extraction suggestions
    if (
      this.workflowState.webSearchCompleted &&
      !this.workflowState.extractionCompleted
    ) {
      suggestions.push({
        toolName: 'tavilyExtract',
        priority: 'medium',
        reason: 'Web search completed but content not yet extracted',
      });
    }

    // Multi-document analysis suggestions
    if (
      this.workflowState.documentsRetrieved.length > 1 &&
      !this.workflowState.multiDocAnalysisCompleted
    ) {
      suggestions.push({
        toolName: 'multiDocumentRetrieval',
        priority: 'high',
        reason: 'Multiple documents available for comprehensive analysis',
        forceCall: true,
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Check if web search is needed based on query content
   */
  private isWebSearchNeeded(query: string): boolean {
    const webSearchIndicators = [
      'current',
      'latest',
      'recent',
      'news',
      'today',
      'now',
      'update',
      'price',
      'cost',
      'market',
      'stock',
      'weather',
      'forecast',
      'event',
      'happening',
      'schedule',
      'calendar',
      'when',
      'compare',
      'vs',
      'versus',
      'alternative',
      'option',
      'review',
      'rating',
      'opinion',
      'feedback',
      'recommendation',
    ];

    const queryLower = query.toLowerCase();
    return webSearchIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );
  }

  /**
   * Check if documents are required based on query content
   */
  private requiresDocuments(query: string): boolean {
    const documentIndicators = [
      'document',
      'file',
      'report',
      'analysis',
      'study',
      'research',
      'policy',
      'procedure',
      'guideline',
      'manual',
      'specification',
      'contract',
      'agreement',
      'proposal',
      'plan',
      'strategy',
    ];

    const queryLower = query.toLowerCase();
    return documentIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );
  }

  /**
   * Build comprehensive search query from user input
   */
  private buildComprehensiveSearchQuery(userQuery: string): string {
    // Extract key entities and concepts
    const entities = this.extractEntitiesFromQuery(userQuery);
    const aspects = this.determineSearchAspects(userQuery);

    // Combine entities with relevant aspects
    const searchTerms = [...entities, ...aspects].filter(
      (term) => term.length > 2,
    ); // Filter out very short terms

    // Build comprehensive query
    return searchTerms.slice(0, 5).join(' '); // Limit to top 5 terms
  }

  /**
   * Extract key entities from user query
   */
  private extractEntitiesFromQuery(query: string): string[] {
    // Simple entity extraction - in production, could use NLP libraries
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    // Filter out common stop words
    const stopWords = new Set([
      'this',
      'that',
      'with',
      'have',
      'will',
      'been',
      'from',
      'they',
      'know',
      'want',
      'been',
      'good',
      'much',
      'some',
      'time',
      'very',
      'when',
      'come',
      'here',
      'just',
      'like',
      'long',
      'make',
      'many',
      'over',
      'such',
      'take',
      'than',
      'them',
      'well',
      'were',
    ]);

    return words.filter((word) => !stopWords.has(word));
  }

  /**
   * Determine search aspects based on query type
   */
  private determineSearchAspects(query: string): string[] {
    const aspects: string[] = [];
    const queryLower = query.toLowerCase();

    if (queryLower.includes('price') || queryLower.includes('cost')) {
      aspects.push('pricing', 'cost');
    }
    if (queryLower.includes('review') || queryLower.includes('opinion')) {
      aspects.push('reviews', 'ratings');
    }
    if (queryLower.includes('compare') || queryLower.includes('vs')) {
      aspects.push('comparison', 'alternatives');
    }
    if (queryLower.includes('how to') || queryLower.includes('guide')) {
      aspects.push('tutorial', 'guide', 'instructions');
    }

    return aspects;
  }

  /**
   * Get executed tools for validation
   */
  getExecutedTools(): ExecutedTool[] {
    return Array.from(this.executedTools.values());
  }

  /**
   * Check if workflow is complete enough for synthesis
   */
  isWorkflowReadyForSynthesis(currentQuery: string): boolean {
    // For research queries, ensure we have both external and internal data
    const isResearchQuery =
      currentQuery.toLowerCase().includes('research') ||
      currentQuery.toLowerCase().includes('report') ||
      currentQuery.toLowerCase().includes('analysis');

    if (isResearchQuery) {
      const hasInternalData = this.workflowState.documentsRetrieved.length > 0;
      const hasExternalData = this.workflowState.webSearchCompleted;

      if (!hasInternalData || !hasExternalData) {
        this.logger.info(
          '[WorkflowOrchestrator] Research workflow incomplete',
          {
            hasInternalData,
            hasExternalData,
            documentsRetrieved: this.workflowState.documentsRetrieved.length,
          },
        );
        return false;
      }
    }

    // For document queries, ensure documents are actually retrieved
    if (
      this.workflowState.documentsListed &&
      this.workflowState.documentsRetrieved.length === 0
    ) {
      this.logger.info(
        '[WorkflowOrchestrator] Documents listed but not retrieved',
      );
      return false;
    }

    // Check if we have any substantial data
    const hasAnyData =
      this.workflowState.documentsRetrieved.length > 0 ||
      this.workflowState.webSearchCompleted ||
      this.executedTools.size > 0;

    return hasAnyData;
  }

  /**
   * Reset workflow state for new conversation
   */
  reset(): void {
    this.executedTools.clear();
    this.workflowState = {
      documentsListed: false,
      documentsRetrieved: [],
      webSearchCompleted: false,
      extractionCompleted: false,
      multiDocAnalysisCompleted: false,
    };
    this.logger.info('[WorkflowOrchestrator] State reset for new conversation');
  }

  /**
   * Get comprehensive workflow status
   */
  getWorkflowStatus(currentQuery = ''): WorkflowStatus {
    return {
      documentsListed: this.workflowState.documentsListed,
      documentsRetrieved: this.workflowState.documentsRetrieved.length,
      webSearchCompleted: this.workflowState.webSearchCompleted,
      extractionCompleted: this.workflowState.extractionCompleted,
      multiDocAnalysisCompleted: this.workflowState.multiDocAnalysisCompleted,
      executedTools: Array.from(this.executedTools.keys()),
      isReadyForSynthesis: this.isWorkflowReadyForSynthesis(currentQuery),
      nextSuggestedTools: this.getSuggestedNextTools(currentQuery),
    };
  }

  /**
   * Get workflow state data
   */
  getWorkflowState(): WorkflowState {
    return { ...this.workflowState };
  }

  /**
   * Check if a specific tool has been executed
   */
  hasToolBeenExecuted(toolName: string): boolean {
    return this.executedTools.has(toolName);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const tools = Array.from(this.executedTools.values());
    const successfulTools = tools.filter((tool) => tool.success);
    const failedTools = tools.filter((tool) => !tool.success);

    const executionTimes = tools
      .filter((tool) => tool.executionTime)
      .map((tool) => tool.executionTime || 0);

    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) /
          executionTimes.length
        : 0;

    return {
      totalTools: tools.length,
      successfulTools: successfulTools.length,
      failedTools: failedTools.length,
      averageExecutionTime,
    };
  }
}
