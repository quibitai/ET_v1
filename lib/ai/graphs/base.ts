/**
 * Base LangGraph Factory
 *
 * Provides common functionality for creating and configuring LangGraphs,
 * including LLM initialization, tool selection, and structured tool calling setup.
 */

import { ChatOpenAI } from '@langchain/openai';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { modelMapping } from '@/lib/ai/models';
import {
  selectRelevantTools,
  type ToolContext,
} from '@/lib/services/modernToolService';
import type {
  LangGraphConfig,
  BaseGraphState,
  GraphExecutionResult,
  ErrorRecoveryStrategy,
} from './types';

/**
 * Base graph factory for creating LangGraphs with common functionality
 */
export class BaseLangGraphFactory {
  protected logger: RequestLogger;
  protected config: LangGraphConfig;

  constructor(config: LangGraphConfig) {
    this.config = config;
    this.logger = config.logger;
  }

  /**
   * Initialize LLM with structured tool calling enabled
   */
  protected initializeLLM(tools: any[] = []): ChatOpenAI {
    const selectedModel = this.getSelectedModel();

    this.logger.info('Initializing LLM for LangGraph', {
      model: selectedModel,
      contextId: this.config.contextId,
      toolCount: tools.length,
      toolsEnabled: this.config.enableToolExecution,
    });

    const llm = new ChatOpenAI({
      modelName: selectedModel,
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });

    // Bind tools for structured calling if tools are provided
    if (tools.length > 0 && this.config.enableToolExecution) {
      // Create a new instance with bound tools but return as ChatOpenAI type
      const boundLLM = llm.bindTools(tools) as any;
      // Copy over the original properties for compatibility
      return Object.assign(boundLLM, {
        modelName: llm.modelName,
        temperature: llm.temperature,
        streaming: llm.streaming,
      }) as ChatOpenAI;
    }

    return llm;
  }

  /**
   * Select relevant tools based on context and query
   * ENHANCED: Added comprehensive logging for tool disambiguation debugging
   * CRITICAL: Added contextual tool filtering to prevent Google Workspace vs Knowledge Base confusion
   */
  protected async selectTools(userQuery: string): Promise<any[]> {
    if (!this.config.enableToolExecution) {
      return [];
    }

    try {
      const toolContext: ToolContext = {
        userQuery,
        activeBitContextId: this.config.contextId || undefined,
        logger: this.logger,
      };

      // Use the modern tool service to select relevant tools
      let selectedTools = await selectRelevantTools(toolContext, null, 10);

      // CRITICAL: Apply contextual tool filtering to prevent confusion
      selectedTools = this.applyContextualToolFiltering(
        userQuery,
        selectedTools,
      );

      // CRITICAL: Enhanced logging for tool disambiguation debugging
      const knowledgeBaseTools = selectedTools.filter(
        (t) =>
          t.name?.includes('Document') ||
          t.name?.includes('Knowledge') ||
          t.name?.includes('Internal') ||
          t.description?.includes('🗂️ KNOWLEDGE_BASE'),
      );

      const googleDriveTools = selectedTools.filter(
        (t) =>
          t.name?.includes('drive') ||
          t.description?.includes('☁️ GOOGLE_DRIVE'),
      );

      // Log tool selection with disambiguation analysis
      this.logger.info('🔧 TOOL SELECTION ANALYSIS', {
        totalTools: selectedTools.length,
        knowledgeBaseTools: knowledgeBaseTools.length,
        googleDriveTools: googleDriveTools.length,
        userQuery: userQuery.substring(0, 100),
        // CRITICAL: Track which type of tools were selected for debugging
        toolTypes: {
          knowledgeBase: knowledgeBaseTools.map((t) => t.name),
          googleDrive: googleDriveTools.map((t) => t.name),
          other: selectedTools
            .filter(
              (t) =>
                !knowledgeBaseTools.includes(t) &&
                !googleDriveTools.includes(t),
            )
            .map((t) => t.name),
        },
        // Flag potential confusion cases
        potentialConfusion:
          knowledgeBaseTools.length > 0 && googleDriveTools.length > 0,
        queryIntent: this.analyzeQueryIntent(userQuery),
      });

      return selectedTools;
    } catch (error) {
      this.logger.error('Tool selection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userQuery: userQuery.substring(0, 100),
      });
      return [];
    }
  }

  /**
   * Apply contextual tool filtering to prevent Google Workspace vs Knowledge Base confusion
   * CRITICAL: When query is clearly for internal knowledge base content, exclude Google Workspace document tools
   */
  private applyContextualToolFiltering(userQuery: string, tools: any[]): any[] {
    const queryLower = userQuery.toLowerCase();

    // Detect if this is a definite internal knowledge base query
    const isInternalKnowledgeQuery =
      queryLower.includes('echo tango') ||
      queryLower.includes('company') ||
      queryLower.includes('our ') ||
      queryLower.includes('internal') ||
      queryLower.includes('knowledge base') ||
      queryLower.includes('core values') ||
      queryLower.includes('policy') ||
      queryLower.includes('policies') ||
      queryLower.includes('business') ||
      queryLower.includes('organizational');

    // Detect if this is a definite Google Workspace query
    const isGoogleWorkspaceQuery =
      queryLower.includes('google') ||
      queryLower.includes('gmail') ||
      queryLower.includes('calendar') ||
      queryLower.includes('drive') ||
      queryLower.includes('sheets') ||
      queryLower.includes('my personal') ||
      queryLower.includes('my google');

    let filteredTools = tools;

    if (isInternalKnowledgeQuery && !isGoogleWorkspaceQuery) {
      // For internal knowledge queries, EXCLUDE Google Workspace document tools that cause confusion
      const conflictingGoogleTools = [
        'get_docs_content', // Google Docs content (conflicts with getDocumentContents)
        'search_docs', // Google Docs search (conflicts with searchInternalKnowledgeBase)
        'list_docs', // Google Docs list (conflicts with listDocuments)
        'get_drive_file_content', // Google Drive content (conflicts with getDocumentContents)
      ];

      filteredTools = tools.filter(
        (tool) => !conflictingGoogleTools.includes(tool.name),
      );

      this.logger.info('🎯 CONTEXTUAL TOOL FILTERING APPLIED', {
        queryType: 'INTERNAL_KNOWLEDGE_BASE',
        originalToolCount: tools.length,
        filteredToolCount: filteredTools.length,
        excludedTools: conflictingGoogleTools.filter((name) =>
          tools.some((tool) => tool.name === name),
        ),
        retainedKnowledgeTools: filteredTools
          .filter(
            (tool) =>
              tool.name?.includes('Document') ||
              tool.name?.includes('getDocument') ||
              tool.name?.includes('listDocument') ||
              tool.name?.includes('searchInternal'),
          )
          .map((tool) => tool.name),
      });
    } else if (isGoogleWorkspaceQuery && !isInternalKnowledgeQuery) {
      // For Google Workspace queries, could potentially exclude knowledge base tools
      // (but this is less critical since Google Workspace tools are more specific)
      this.logger.info('🎯 GOOGLE WORKSPACE QUERY DETECTED', {
        queryType: 'GOOGLE_WORKSPACE',
        toolCount: filteredTools.length,
        note: 'No filtering applied - Google Workspace tools are more specific',
      });
    } else {
      // Ambiguous or general query - keep all tools but log the ambiguity
      this.logger.info('🎯 AMBIGUOUS QUERY DETECTED', {
        queryType: 'AMBIGUOUS',
        toolCount: filteredTools.length,
        note: 'No filtering applied - keeping all tools available',
      });
    }

    return filteredTools;
  }

  /**
   * Analyze query intent to help with tool disambiguation debugging
   */
  private analyzeQueryIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    // ENHANCED: Strong knowledge base indicators
    if (
      lowerQuery.includes('echo tango') ||
      lowerQuery.includes('company') ||
      lowerQuery.includes('our ') ||
      lowerQuery.includes('internal') ||
      lowerQuery.includes('knowledge base') ||
      lowerQuery.includes('core values') ||
      lowerQuery.includes('policy') ||
      lowerQuery.includes('policies') ||
      lowerQuery.includes('template') ||
      lowerQuery.includes('guideline') ||
      lowerQuery.includes('business') ||
      lowerQuery.includes('organizational')
    ) {
      return 'DEFINITE_KNOWLEDGE_BASE';
    }

    // Strong Google Drive indicators
    if (
      lowerQuery.includes('google drive') ||
      lowerQuery.includes('my drive') ||
      lowerQuery.includes('shared drive') ||
      lowerQuery.includes('gdrive') ||
      lowerQuery.includes('personal files')
    ) {
      return 'DEFINITE_GOOGLE_DRIVE';
    }

    // CRITICAL: Ambiguous file/document references that cause confusion
    if (
      lowerQuery.includes('file') ||
      lowerQuery.includes('document') ||
      lowerQuery.includes('doc') ||
      lowerQuery.includes('content')
    ) {
      return 'AMBIGUOUS_FILE_REFERENCE';
    }

    return 'general_query';
  }

  /**
   * Get the selected model based on configuration
   */
  private getSelectedModel(): string {
    if (this.config.contextId && modelMapping[this.config.contextId]) {
      return modelMapping[this.config.contextId];
    }

    if (this.config.selectedChatModel) {
      return this.config.selectedChatModel;
    }

    return process.env.DEFAULT_MODEL_NAME || modelMapping.default;
  }

  /**
   * Create initial state with common metadata
   */
  protected createInitialState(
    userQuery: string,
    messages: any[] = [],
  ): Partial<BaseGraphState> {
    return {
      messages,
      currentStep: 'start',
      metadata: {
        startTime: Date.now(),
        stepTimes: {},
        toolsUsed: [],
        totalSteps: 0,
      },
    };
  }

  /**
   * Record step timing for observability
   */
  protected recordStepTime(state: BaseGraphState, stepName: string): void {
    if (state.metadata) {
      state.metadata.stepTimes[stepName] = Date.now();
      state.metadata.totalSteps += 1;
    }
  }

  /**
   * Handle errors with recovery strategies
   */
  protected handleError(
    state: BaseGraphState,
    error: Error,
    step: string,
    strategy: ErrorRecoveryStrategy = 'abort',
  ): Partial<BaseGraphState> {
    this.logger.error('Graph execution error', {
      step,
      error: error.message,
      strategy,
      graphState: {
        currentStep: state.currentStep,
        toolsUsed: state.metadata?.toolsUsed || [],
      },
    });

    const errorInfo = {
      message: error.message,
      step,
      recoverable: strategy !== 'abort',
    };

    switch (strategy) {
      case 'retry':
        // Mark for retry but don't change the current step
        return { error: errorInfo };

      case 'skip':
        // Skip to next step
        return {
          error: errorInfo,
          currentStep: 'next', // This would be determined by the specific graph
        };

      case 'fallback':
        // Use fallback strategy
        return {
          error: errorInfo,
          currentStep: 'fallback',
        };

      case 'human_intervention':
        // Require human input
        return {
          error: errorInfo,
          currentStep: 'human_input_required',
        };

      case 'abort':
      default:
        return {
          error: errorInfo,
          currentStep: 'error',
          finalResponse: `I encountered an error: ${error.message}. Please try again or rephrase your request.`,
        };
    }
  }

  /**
   * Finalize graph execution with metrics
   */
  protected finalizeExecution(
    state: BaseGraphState,
    success: boolean,
    executionPath: string[],
  ): GraphExecutionResult {
    const endTime = Date.now();
    const totalTime = state.metadata?.startTime
      ? endTime - state.metadata.startTime
      : 0;

    return {
      finalState: state,
      success,
      metrics: {
        totalTime,
        stepCount: state.metadata?.totalSteps || 0,
        toolCallCount: state.metadata?.toolsUsed.length || 0,
      },
      executionPath,
    };
  }

  /**
   * Create a conditional edge function
   */
  protected createConditionalEdge(
    conditions: Record<string, (state: BaseGraphState) => boolean>,
  ): (state: BaseGraphState) => string {
    return (state: BaseGraphState) => {
      for (const [targetNode, condition] of Object.entries(conditions)) {
        if (condition(state)) {
          return targetNode;
        }
      }
      return 'end'; // Default fallback
    };
  }

  /**
   * Validate state before proceeding
   */
  protected validateState(
    state: BaseGraphState,
    requiredFields: string[],
  ): boolean {
    for (const field of requiredFields) {
      if (!(field in state) || state[field as keyof BaseGraphState] == null) {
        this.logger.warn('State validation failed', {
          missingField: field,
          currentStep: state.currentStep,
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Log state transition for debugging
   */
  protected logStateTransition(
    fromStep: string,
    toStep: string,
    state: BaseGraphState,
    reason?: string,
  ): void {
    if (this.config.verbose) {
      this.logger.info('Graph state transition', {
        fromStep,
        toStep,
        reason,
        stateSnapshot: {
          currentStep: state.currentStep,
          hasError: !!state.error,
          toolResultsCount: Object.keys(state.toolResults || {}).length,
          messagesCount: state.messages.length,
        },
      });
    }
  }
}
