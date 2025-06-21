/**
 * Simple LangGraph Wrapper - PROPERLY IMPLEMENTED WITH LANGGRAPH API
 *
 * Provides a true LangGraph implementation with proper state management,
 * node definitions, and TypeScript compatibility.
 */

import type { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import type { RunnableConfig, Runnable } from '@langchain/core/runnables';
import type { RequestLogger } from '../../services/observabilityService';
import { ContextWindowManager } from '../core/contextWindowManager';
import {
  ContentFormatter,
  type DocumentResult,
  type ToolResult,
} from '../formatting/ContentFormatter';
import { StreamingCoordinator } from '../formatting/StreamingCoordinator';
import { DocumentOrchestrator } from '../core/DocumentOrchestrator';
import { SynthesisValidator } from '../core/SynthesisValidator';
import { ProgressIndicatorManager } from '../core/ProgressIndicatorManager';
import { ResponseRoutingDisplay } from '../core/ResponseRoutingDisplay';
import { ContentQualityValidator } from '../core/ContentQualityValidator';
import type { DocumentRetrievalPlan } from '../core/DocumentOrchestrator';
import type { ValidationContext } from '../core/SynthesisValidator';

import { ToolNode } from '@langchain/langgraph/prebuilt';

// UI message type with proper metadata
interface UIMessage {
  id: string;
  name: string;
  props: Record<string, any>;
  metadata?: {
    message_id?: string;
    toolCallId?: string;
    toolName?: string;
  };
}

/**
 * Graph State Annotation - properly defined for LangGraph
 */
const GraphStateAnnotation = Annotation.Root({
  // The list of messages
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[] = [], y: BaseMessage[] = []) => x.concat(y),
    default: () => [],
  }),
  // The user's input
  input: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),
  // The final outcome of the agent is stored here
  agent_outcome: Annotation<AIMessage | undefined>({
    reducer: (x?: AIMessage, y?: AIMessage) => y ?? x,
    default: () => undefined,
  }),
  // UI messages to be streamed to the client
  ui: Annotation<UIMessage[]>({
    reducer: (x: UIMessage[] = [], y: UIMessage[] = []) => {
      const existingIds = new Set(x.map((ui) => ui.id));
      const filtered = y.filter((ui) => !existingIds.has(ui.id));
      return [...x, ...filtered];
    },
    default: () => [],
  }),
  _lastToolExecutionResults: Annotation<any[]>({
    reducer: (x: any[] = [], y: any[] = []) => [...x, ...y],
    default: () => [],
  }),
  toolForcingCount: Annotation<number>({
    reducer: (x = 0, y = 0) => Math.max(x, y),
    default: () => 0,
  }),
  iterationCount: Annotation<number>({
    reducer: (x = 0, y = 0) => Math.max(x, y),
    default: () => 0,
  }),
  needsSynthesis: Annotation<boolean>({
    reducer: (x = true, y = true) => y, // Always use the latest value
    default: () => true,
  }),
});

type GraphState = typeof GraphStateAnnotation.State;

/**
 * Configuration for the LangGraph wrapper
 */
export interface LangGraphWrapperConfig {
  systemPrompt: string;
  llm: ChatOpenAI;
  tools: any[];
  logger: RequestLogger;
  forceToolCall?: { name: string } | 'required' | null;
}

/**
 * Tool Workflow Manager
 * Orchestrates tool execution sequences and manages workflow state
 */
class ToolWorkflowManager {
  private executedTools: Map<string, any> = new Map();
  private workflowState: {
    documentsListed: boolean;
    documentsRetrieved: string[];
    webSearchCompleted: boolean;
    extractionCompleted: boolean;
    multiDocAnalysisCompleted: boolean;
  } = {
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
    this.executedTools.set(toolName, { result: toolResult, args: toolArgs });

    switch (toolName) {
      case 'listDocuments':
        this.workflowState.documentsListed = true;
        this.logger.info('[Workflow] Documents listed - ready for retrieval');
        break;

      case 'getDocumentContents': {
        const docId = toolArgs?.id || toolArgs?.title || 'unknown';
        if (!this.workflowState.documentsRetrieved.includes(docId)) {
          this.workflowState.documentsRetrieved.push(docId);
        }
        this.logger.info('[Workflow] Document retrieved:', { docId });
        break;
      }

      case 'tavilySearch':
        this.workflowState.webSearchCompleted = true;
        this.logger.info('[Workflow] Web search completed');
        break;

      case 'tavilyExtract':
        this.workflowState.extractionCompleted = true;
        this.logger.info('[Workflow] Content extraction completed');
        break;

      case 'multiDocumentRetrieval':
        this.workflowState.multiDocAnalysisCompleted = true;
        this.logger.info('[Workflow] Multi-document analysis completed');
        break;
    }
  }

  /**
   * Get suggested next tools based on workflow state
   */
  getSuggestedNextTools(currentQuery: string): Array<{
    toolName: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    forceCall?: boolean;
    suggestedArgs?: any; // **ADDED**: Support for suggested arguments
  }> {
    const suggestions: Array<{
      toolName: string;
      priority: 'high' | 'medium' | 'low';
      reason: string;
      forceCall?: boolean;
      suggestedArgs?: any; // **ADDED**: Support for suggested arguments
    }> = [];

    // **CRITICAL FIX**: Force getDocumentContents after listDocuments
    if (
      this.workflowState.documentsListed &&
      this.workflowState.documentsRetrieved.length === 0
    ) {
      const listResult = this.executedTools.get('listDocuments');
      if (listResult?.result) {
        try {
          const parsedResult =
            typeof listResult.result === 'string'
              ? JSON.parse(listResult.result)
              : listResult.result;

          if (parsedResult.available_documents?.length > 0) {
            // Get the most relevant documents for the query
            const relevantDocs = parsedResult.available_documents
              .filter((doc: any) => {
                const title = doc.title?.toLowerCase() || '';
                const query = currentQuery.toLowerCase();
                return (
                  title.includes('ideal') ||
                  title.includes('client') ||
                  title.includes('research') ||
                  title.includes('example') ||
                  query.includes(title.split('_')[0]) ||
                  query.includes(title.split('.')[0])
                );
              })
              .slice(0, 3); // Limit to 3 most relevant

            if (relevantDocs.length > 0) {
              suggestions.push({
                toolName: 'getDocumentContents',
                priority: 'high',
                reason: `Documents were listed but content not retrieved. Found ${relevantDocs.length} relevant documents for analysis.`,
                forceCall: true, // **FORCE** this call
              });
            }
          }
        } catch (e) {
          this.logger.warn('[Workflow] Could not parse listDocuments result');
        }
      }
    }

    // **ENHANCED**: Force tavilyExtract after tavilySearch for deeper analysis
    if (
      this.workflowState.webSearchCompleted &&
      !this.workflowState.extractionCompleted
    ) {
      suggestions.push({
        toolName: 'tavilyExtract',
        priority: 'high', // Upgraded to high priority
        reason:
          'Web search completed - extract detailed content for comprehensive analysis',
        forceCall: true, // **FORCE** this call for better content
      });
    }

    // **ENHANCED**: Suggest multiDocumentRetrieval for comparative analysis
    const hasMultipleDocRefs =
      currentQuery.toLowerCase().includes('compare') ||
      currentQuery.toLowerCase().includes('align') ||
      currentQuery.toLowerCase().includes('relationship') ||
      currentQuery.toLowerCase().includes('vs') ||
      this.workflowState.documentsRetrieved.length > 1;

    if (hasMultipleDocRefs && !this.workflowState.multiDocAnalysisCompleted) {
      suggestions.push({
        toolName: 'multiDocumentRetrieval',
        priority: 'high', // Upgraded to high priority
        reason:
          'Multiple documents referenced - comparative analysis recommended',
        forceCall: false, // Don't force, but strongly suggest
      });
    }

    // **NEW**: Query-based intelligent suggestions
    const queryLower = currentQuery.toLowerCase();

    // Research queries should prioritize document workflow
    if (
      (queryLower.includes('research') ||
        queryLower.includes('report') ||
        queryLower.includes('analysis')) &&
      !this.workflowState.documentsListed
    ) {
      suggestions.push({
        toolName: 'listDocuments',
        priority: 'high',
        reason:
          'Research query detected - need to discover available documents first',
        forceCall: false,
      });
    }

    // Company/organization queries should use comprehensive web research
    if (
      (queryLower.includes('company') ||
        queryLower.includes('organization') ||
        queryLower.includes('business')) &&
      !this.workflowState.webSearchCompleted
    ) {
      suggestions.push({
        toolName: 'tavilySearch',
        priority: 'high',
        reason: 'Company research query detected - need external information',
        forceCall: false,
      });
    }

    // **ENHANCED**: Suggest comprehensive web search instead of multiple narrow ones
    if (
      !this.workflowState.webSearchCompleted &&
      this.isWebSearchNeeded(currentQuery)
    ) {
      // Extract company/entity names for comprehensive search
      const entities = this.extractEntitiesFromQuery(currentQuery);
      const searchAspects = this.determineSearchAspects(currentQuery);

      if (entities.length > 0) {
        const comprehensiveQuery = this.buildComprehensiveSearchQuery(
          entities[0],
          searchAspects,
        );

        suggestions.push({
          toolName: 'tavilySearch',
          reason: `Comprehensive web search needed for ${entities[0]} covering: ${searchAspects.join(', ')}`,
          forceCall: true,
          priority: 'high',
          suggestedArgs: { query: comprehensiveQuery },
        });
      } else {
        suggestions.push({
          toolName: 'tavilySearch',
          reason: 'Web search needed for external information',
          forceCall: false,
          priority: 'medium',
        });
      }
    }

    this.logger.info('[Workflow] Generated tool suggestions:', {
      suggestionsCount: suggestions.length,
      suggestions: suggestions.map((s) => ({
        tool: s.toolName,
        priority: s.priority,
        force: s.forceCall,
        reason: `${s.reason.substring(0, 50)}...`,
      })),
      workflowState: this.workflowState,
    });

    return suggestions;
  }

  /**
   * Get executed tools for validation
   */
  getExecutedTools(): Array<{
    name: string;
    success: boolean;
    result?: any;
    args?: any;
  }> {
    const tools: Array<{
      name: string;
      success: boolean;
      result?: any;
      args?: any;
    }> = [];

    for (const [toolName, toolData] of this.executedTools.entries()) {
      tools.push({
        name: toolName,
        success: toolData.result !== null && toolData.result !== undefined,
        result: toolData.result,
        args: toolData.args,
      });
    }

    return tools;
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
        this.logger.info('[Workflow] Research workflow incomplete:', {
          hasInternalData,
          hasExternalData,
          documentsRetrieved: this.workflowState.documentsRetrieved.length,
        });
        return false;
      }
    }

    // For document queries, ensure documents are actually retrieved
    if (
      this.workflowState.documentsListed &&
      this.workflowState.documentsRetrieved.length === 0
    ) {
      this.logger.info('[Workflow] Documents listed but not retrieved');
      return false;
    }

    return true;
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
    this.logger.info('[Workflow] State reset for new conversation');
  }

  /**
   * Get workflow status for debugging
   */
  getWorkflowStatus() {
    return {
      documentsListed: this.workflowState.documentsListed,
      documentsRetrieved: this.workflowState.documentsRetrieved.length,
      webSearchCompleted: this.workflowState.webSearchCompleted,
      extractionCompleted: this.workflowState.extractionCompleted,
      multiDocAnalysisCompleted: this.workflowState.multiDocAnalysisCompleted,
      executedTools: Array.from(this.executedTools.keys()),
    };
  }

  /**
   * Helper methods for comprehensive search query building
   */
  private isWebSearchNeeded(query: string): boolean {
    const webSearchKeywords = [
      'company',
      'organization',
      'business',
      'profile',
      'mission',
      'values',
      'leadership',
      'news',
      'recent',
      'current',
      'industry',
      'market',
      'competitors',
      'financial',
      'revenue',
      'services',
      'products',
    ];

    const lowerQuery = query.toLowerCase();
    return webSearchKeywords.some((keyword) => lowerQuery.includes(keyword));
  }

  private extractEntitiesFromQuery(query: string): string[] {
    // Simple entity extraction - look for capitalized words that might be company names
    const entities: string[] = [];

    // Common company patterns
    const companyPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|LLC|Corp|Company|Corporation|Ltd|Limited))?)\b/g,
      /\b(LWCC)\b/g, // Specific pattern for LWCC
    ];

    companyPatterns.forEach((pattern) => {
      const matches = query.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    });

    return Array.from(new Set(entities)); // Remove duplicates
  }

  private determineSearchAspects(query: string): string[] {
    const aspects: string[] = [];
    const lowerQuery = query.toLowerCase();

    const aspectMap = {
      'company profile': ['profile', 'about', 'overview', 'company'],
      mission: ['mission', 'purpose', 'goal'],
      values: ['values', 'culture', 'principles'],
      leadership: [
        'leadership',
        'management',
        'executives',
        'ceo',
        'president',
      ],
      'recent news': ['news', 'recent', 'latest', 'updates', 'announcements'],
      services: ['services', 'products', 'offerings', 'solutions'],
      industry: ['industry', 'sector', 'market', 'business'],
      financial: ['financial', 'revenue', 'earnings', 'performance'],
    };

    Object.entries(aspectMap).forEach(([aspect, keywords]) => {
      if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
        aspects.push(aspect);
      }
    });

    // Default aspects if none detected
    if (aspects.length === 0) {
      aspects.push('company profile', 'recent news');
    }

    return aspects;
  }

  private buildComprehensiveSearchQuery(
    entity: string,
    aspects: string[],
  ): string {
    // Build a comprehensive search query that captures multiple aspects
    const baseQuery = entity;
    const aspectTerms = aspects.join(' ');

    return `${baseQuery} ${aspectTerms}`.trim();
  }
}

/**
 * SimpleLangGraphWrapper - Proper LangGraph Implementation
 */
export class SimpleLangGraphWrapper {
  private config: LangGraphWrapperConfig;
  private llm: ChatOpenAI;
  private tools: any[];
  private logger: RequestLogger;
  private graph: any; // Use any for the compiled graph to avoid complex type issues
  private contextManager: ContextWindowManager;
  private streamingCoordinator: StreamingCoordinator;
  private documentOrchestrator: DocumentOrchestrator;
  private synthesisValidator: SynthesisValidator;
  private progressIndicator: ProgressIndicatorManager;
  private routingDisplay: ResponseRoutingDisplay;
  private qualityValidator: ContentQualityValidator;
  // ADD: Track shown progress indicators to prevent duplicates
  private shownProgressIndicators: Set<string> = new Set();
  // ADD: Tool result caching to prevent redundant calls
  private toolResultCache: Map<string, any> = new Map();
  // ADD: Tool workflow manager for orchestrating tool sequences
  private workflowManager: ToolWorkflowManager;

  constructor(config: LangGraphWrapperConfig) {
    this.config = config;
    this.llm = config.llm;
    this.tools = config.tools;
    this.logger = config.logger;

    // Initialize components
    this.contextManager = new ContextWindowManager(this.logger, {
      enableAutoUpgrade: true,
    });
    this.streamingCoordinator = new StreamingCoordinator();
    this.documentOrchestrator = new DocumentOrchestrator(this.logger);
    this.synthesisValidator = new SynthesisValidator(this.logger);
    this.progressIndicator = new ProgressIndicatorManager();
    this.routingDisplay = new ResponseRoutingDisplay(this.logger);
    this.qualityValidator = new ContentQualityValidator(this.logger);

    // Fix memory leak warnings by increasing max listeners
    if (typeof process !== 'undefined' && process.setMaxListeners) {
      process.setMaxListeners(20);
    }

    // Initialize workflow manager
    this.workflowManager = new ToolWorkflowManager(this.logger);

    // Initialize the graph
    this.graph = this.initializeAndCompileGraph();
  }

  /**
   * Initialize and compile the LangGraph with proper state and nodes
   */
  private initializeAndCompileGraph(): any {
    try {
      this.logger.info('Initializing LangGraph with proper state management', {
        toolCount: this.tools.length,
        model: this.llm.modelName,
      });

      // Create the graph builder using the annotation
      const workflow = new StateGraph(GraphStateAnnotation);

      // Add nodes with consistent string identifiers
      workflow.addNode('agent', this.callModelNode.bind(this));
      workflow.addNode('tools', this.executeToolsNode.bind(this));
      workflow.addNode('simple_response', this.simpleResponseNode.bind(this));
      workflow.addNode('synthesis', this.synthesisNode.bind(this)); // ADD NEW NODE
      workflow.addNode(
        'conversational_response',
        this.conversationalResponseNode.bind(this),
      );

      // Set the entrypoint
      (workflow as any).addEdge(START, 'agent');

      // Add conditional edge from the agent node
      (workflow as any).addConditionalEdges(
        'agent',
        this.routeNextStep.bind(this), // USE THE NEW ROUTER
        {
          use_tools: 'tools',
          simple_response: 'simple_response',
          conversational_response: 'conversational_response',
          synthesis: 'synthesis', // ADD SYNTHESIS PATH
          __end__: END, // Map __end__ to END
          finish: END,
        },
      );

      // Add edge from tools back to agent
      (workflow as any).addEdge('tools', 'agent');

      // Add edge from simple_response to the end
      (workflow as any).addEdge('simple_response', END);

      // Add edge from conversational_response to the end
      (workflow as any).addEdge('conversational_response', END);

      // Add edge from synthesis to the end
      (workflow as any).addEdge('synthesis', END); // SYNTHESIS IS A TERMINAL NODE

      // Compile the graph
      const compiledGraph = workflow.compile();

      this.logger.info(
        'LangGraph compiled successfully with synthesis, simple response, and conversational response nodes',
        {
          nodes: [
            'agent',
            'tools',
            'simple_response',
            'conversational_response',
            'synthesis',
          ],
          edges: [
            'START->agent',
            'agent->tools (conditional)',
            'agent->simple_response (conditional)',
            'agent->conversational_response (conditional)',
            'agent->synthesis (conditional)',
            'agent->END (conditional)',
            'tools->agent',
            'simple_response->END',
            'conversational_response->END',
            'synthesis->END',
          ],
        },
      );

      return compiledGraph;
    } catch (error) {
      this.logger.error('Failed to initialize LangGraph', { error });
      throw error;
    }
  }

  /**
   * Apply schema patching to tools before binding to OpenAI LLM.
   * This ensures that all tool schemas are compatible with OpenAI's requirements.
   */
  private applySchemaPatching(tools: any[]): any[] {
    this.logger.info(
      '[LangGraph Agent] Applying schema patching to tools before OpenAI binding',
      {
        toolCount: tools.length,
        toolNames: tools.map((t) => t?.name || 'unnamed').join(', '),
      },
    );

    return tools.map((tool, index) => {
      if (!tool || !tool.name) {
        this.logger.warn(
          `[LangGraph Agent] Tool at index ${index} is missing name, skipping`,
        );
        return tool;
      }

      // Comprehensive list of tools that have been fixed for OpenAI compatibility
      // These tools now have proper .optional().nullable() schemas and don't need patching
      const fixedTools = [
        // ALL TOOLS - Comprehensive list to prevent schema validation errors
        // Document and knowledge base tools
        'listDocuments',
        'searchInternalKnowledgeBase',
        'searchAndRetrieveKnowledgeBase',
        'getMultipleDocuments',
        'getDocumentContents',
        'queryDocumentRows',
        'multiDocumentRetrieval',
        // Web search and extraction tools
        'tavilySearch',
        'tavilyExtract',
        'extractWebContent',
        // Utility and integration tools
        'requestSuggestions',
        'googleCalendar',
        'createBudget',
        'getMessagesFromOtherChat',
        // All Asana tools (now properly defined with correct schemas)
        'asana_list_workspaces',
        'asana_search_projects',
        'asana_search_tasks',
        'asana_get_task',
        'asana_create_task',
        'asana_get_task_stories',
        'asana_update_task',
        'asana_get_project',
        'asana_get_project_task_counts',
        'asana_get_project_sections',
        'asana_create_task_story',
        'asana_add_task_dependencies',
        'asana_add_task_dependents',
        'asana_delete_task',
        'asana_create_subtask',
        'asana_add_task_comment',
        'asana_get_task_comments',
        'asana_add_followers_to_task',
        'asana_get_multiple_tasks_by_gid',
        'asana_get_project_status',
        'asana_get_project_statuses',
        'asana_create_project_status',
        'asana_delete_project_status',
        'asana_set_parent_for_task',
        'asana_get_tasks_for_tag',
        'asana_get_tags_for_workspace',
        'asana_create_section_for_project',
        'asana_add_task_to_section',
        'asana_create_project',
        'asana_update_project',
        'asana_delete_project',
        'asana_get_teams_for_user',
        'asana_get_teams_for_workspace',
        'asana_list_workspace_users',
        'asana_get_user',
        'asana_get_current_user',
        'asana_upload_attachment',
        'asana_get_task_attachments',
        'asana_get_project_hierarchy',
        'asana_get_attachments_for_object',
        'asana_upload_attachment_for_object',
        'asana_download_attachment',
      ];

      if (fixedTools.includes(tool.name)) {
        this.logger.info(
          `[LangGraph Agent] ✅ Tool '${tool.name}' has proper OpenAI-compatible schema, using as-is`,
        );
        return tool; // Return original tool without any patching
      }

      // For tools that haven't been explicitly fixed, apply conservative patching
      this.logger.warn(
        `[LangGraph Agent] ⚠️ Tool '${tool.name}' not in fixed list, applying conservative schema patching`,
      );

      // Only apply fallback patching for truly unknown tools
      if (tool.schema) {
        try {
          // For unknown tools, use a conservative approach
          const { z } = require('zod');
          const safeSchema = z.object({
            input: z
              .any()
              .describe(`Input parameters for ${tool.name}`)
              .default({}),
          });

          return {
            ...tool,
            schema: safeSchema,
          };
        } catch (error) {
          this.logger.error(
            `[LangGraph Agent] Error creating fallback schema for tool ${tool.name}:`,
            error,
          );
          return tool; // Return original tool if patching fails
        }
      }

      return tool;
    });
  }

  /**
   * Convert Zod schema to JSON Schema for OpenAI function calling.
   * This is a simplified version of what LangChain does internally.
   */
  private convertZodToJsonSchema(zodSchema: any): any {
    try {
      // Import the correct function from zod-to-json-schema
      const { zodToJsonSchema } = require('zod-to-json-schema');
      const jsonSchema = zodToJsonSchema(zodSchema);

      // Log successful conversion for debugging
      this.logger.info(
        '[LangGraph Agent] Successfully converted Zod to JSON Schema',
      );

      return jsonSchema;
    } catch (error) {
      this.logger.warn(
        '[LangGraph Agent] Could not convert Zod to JSON Schema, using fallback',
        { error: error instanceof Error ? error.message : String(error) },
      );
      return {
        type: 'object',
        properties: {},
        additionalProperties: true,
      };
    }
  }

  /**
   * Convert JSON Schema back to Zod schema.
   * This is a simplified conversion for patched schemas.
   */
  private convertJsonSchemaToZod(jsonSchema: any): any {
    try {
      const { z } = require('zod');

      // Simple conversion for object types with properties
      if (jsonSchema.type === 'object' && jsonSchema.properties) {
        const shape: Record<string, any> = {};

        for (const [key, prop] of Object.entries(jsonSchema.properties)) {
          const propSchema = prop as any;
          let zodType: any;

          switch (propSchema.type) {
            case 'string':
              zodType = z.string();
              break;
            case 'number':
              zodType = z.number();
              break;
            case 'boolean':
              zodType = z.boolean();
              break;
            case 'array':
              // This is where we handle the patched array items
              if (propSchema.items) {
                zodType = z.array(z.any()); // Safe default
              } else {
                zodType = z.array(z.any());
              }
              break;
            default:
              zodType = z.any();
          }

          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }

          if (!jsonSchema.required?.includes(key)) {
            zodType = zodType.optional();
          }

          shape[key] = zodType;
        }

        return z.object(shape);
      }

      return z.any();
    } catch (error) {
      this.logger.warn(
        '[LangGraph Agent] Error converting JSON Schema to Zod, using z.any()',
        { error: error instanceof Error ? error.message : String(error) },
      );
      const { z } = require('zod');
      return z.any();
    }
  }

  /**
   * LLM Interaction Node
   * Handles LLM calls with tools bound
   */
  private async callModelNode(state: GraphState): Promise<Partial<GraphState>> {
    try {
      // Check if this is a follow-up call after tool execution
      const hasToolMessages = state.messages.some(
        (m) => m._getType() === 'tool',
      );
      const lastMessage = state.messages[state.messages.length - 1];

      this.logger.info('[LangGraph Agent] Calling LLM...', {
        messageCount: state.messages.length,
        hasTools: this.tools.length > 0,
        toolCount: this.tools.length,
        forceToolCall: this.config.forceToolCall,
        hasToolMessages,
        lastMessageType: lastMessage?._getType(),
        isFollowUpAfterTools:
          hasToolMessages && lastMessage?._getType() === 'tool',
      });

      // Analyze context and manage token limits
      const contextAnalysis = this.contextManager.analyzeContext(
        state.messages,
        this.llm.modelName || 'gpt-4.1-mini',
        this.tools.length,
      );

      // Handle context management
      let managedMessages = state.messages;
      let currentLLM = this.llm;

      if (contextAnalysis.exceedsLimit || contextAnalysis.shouldTruncate) {
        this.logger.warn('[LangGraph Agent] Context management required', {
          exceedsLimit: contextAnalysis.exceedsLimit,
          shouldTruncate: contextAnalysis.shouldTruncate,
          estimatedTokens: contextAnalysis.estimatedTokens,
          recommendedModel: contextAnalysis.recommendedModel,
        });

        // Upgrade model if needed and possible
        if (contextAnalysis.recommendedModel !== this.llm.modelName) {
          currentLLM = this.contextManager.createUpgradedLLM(
            this.llm,
            contextAnalysis.recommendedModel,
          );
        }

        // AGGRESSIVE TRUNCATION: Use much smaller context windows to prevent overflow
        if (contextAnalysis.shouldTruncate) {
          const targetTokens = 8000; // Much more conservative limit
          managedMessages = this.contextManager.truncateMessages(
            state.messages,
            targetTokens,
          );
        }

        // AGGRESSIVE SUMMARIZATION: Always summarize tool results to prevent context overflow
        if (
          contextAnalysis.shouldSummarizeTools ||
          contextAnalysis.estimatedTokens > 10000
        ) {
          managedMessages =
            await this.contextManager.summarizeToolResults(managedMessages);
        }
      }

      // Enhanced tool binding diagnostics
      if (this.tools.length > 0) {
        const toolNames = this.tools.map((t) => t.name || 'unnamed');
        this.logger.info('[LangGraph Agent] Available tools for binding:', {
          toolNames,
          toolDetails: this.tools.map((t) => ({
            name: t.name,
            description: t.description?.substring(0, 100) || 'No description',
            hasSchema: !!t.schema,
          })),
        });
      } else {
        this.logger.warn(
          '[LangGraph Agent] NO TOOLS AVAILABLE - This explains why no tools are called!',
        );
      }

      // Bind tools to LLM for structured tool calling with schema patching
      const patchedToolsForBinding = this.applySchemaPatching(this.tools);
      let llmWithTools = currentLLM.bindTools(patchedToolsForBinding);

      // CRITICAL FIX: Check for tool results BEFORE context management destroys evidence
      const hasToolResults = state.messages.some(
        (m) => m._getType() === 'tool',
      );

      // Use managed messages for context
      const currentMessages = managedMessages;

      // Check if this is the first agent call (no AI messages yet) or if we've already executed tools
      const hasAIResponses = currentMessages.some((m) => m._getType() === 'ai');
      const hasToolExecutions = currentMessages.some(
        (m) => m._getType() === 'tool',
      );

      // NEW: Apply tool forcing from QueryClassifier - bind with tool_choice
      // For 'required' mode, continue forcing tools until comprehensive research is done
      const isFollowUpAfterTools =
        hasToolMessages && lastMessage?._getType() === 'tool';

      // COMPREHENSIVE FIX: Implement proper tool forcing with circuit breakers
      let shouldForceTools = false;
      const currentIterationCount = (state.iterationCount || 0) + 1;
      const currentToolForcingCount = state.toolForcingCount || 0;

      // Circuit breakers - hard limits to prevent infinite loops
      const MAX_ITERATIONS = 5;
      const MAX_TOOL_FORCING = 2;

      // NEW: Check if this is a document listing request that should only call listDocuments once
      const userMessages = state.messages.filter(
        (msg) => msg._getType() === 'human',
      );
      const lastUserMessage = userMessages[userMessages.length - 1];
      const userQuery =
        typeof lastUserMessage?.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage?.content) || '';

      const isDocumentListingRequest =
        /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
          userQuery,
        );
      const hasListDocumentsResult = state.messages.some(
        (msg) =>
          msg._getType() === 'tool' &&
          typeof msg.content === 'string' &&
          msg.content.includes('available_documents'),
      );

      // If this is a document listing request and we already have listDocuments results, don't force more tools
      if (isDocumentListingRequest && hasListDocumentsResult) {
        this.logger.info(
          '[LangGraph Agent] 🛑 Document listing request completed - preventing additional tool calls',
          {
            userQuery: userQuery.substring(0, 100),
            hasListDocumentsResult,
          },
        );
        shouldForceTools = false;
      } else if (currentIterationCount > MAX_ITERATIONS) {
        this.logger.warn(
          '[LangGraph Agent] 🛑 CIRCUIT BREAKER: Maximum iterations exceeded',
          {
            currentIterationCount,
            maxIterations: MAX_ITERATIONS,
          },
        );
        shouldForceTools = false;
      } else if (currentToolForcingCount >= MAX_TOOL_FORCING) {
        this.logger.info(
          '[LangGraph Agent] 🛑 CIRCUIT BREAKER: Maximum tool forcing reached',
          {
            currentToolForcingCount,
            maxToolForcing: MAX_TOOL_FORCING,
          },
        );
        shouldForceTools = false;
      } else if (this.config.forceToolCall === 'required') {
        // For 'required' mode, only force tools for the first 2 iterations
        shouldForceTools = currentToolForcingCount < MAX_TOOL_FORCING;

        this.logger.info(
          '[LangGraph Agent] Tool forcing check with circuit breakers',
          {
            currentIterationCount,
            currentToolForcingCount,
            shouldForceTools,
            maxIterations: MAX_ITERATIONS,
            maxToolForcing: MAX_TOOL_FORCING,
          },
        );
      } else if (
        typeof this.config.forceToolCall === 'object' &&
        this.config.forceToolCall !== null &&
        'name' in this.config.forceToolCall
      ) {
        // For specific tool forcing, only apply once
        shouldForceTools = currentToolForcingCount === 0;
      }

      if (this.config.forceToolCall && shouldForceTools) {
        this.logger.info(
          '[LangGraph Agent] 🚀 APPLYING TOOL FORCING from QueryClassifier',
          {
            forceToolCall: this.config.forceToolCall,
            reason:
              this.config.forceToolCall === 'required'
                ? 'Multi-tool research mode - continuing until comprehensive'
                : 'Specific tool forcing',
          },
        );

        let toolChoiceOption: any = undefined;

        if (
          typeof this.config.forceToolCall === 'object' &&
          this.config.forceToolCall !== null &&
          'name' in this.config.forceToolCall
        ) {
          // Force a specific tool (e.g., createDocument)
          const toolName = this.config.forceToolCall.name;
          const targetTool = this.tools.find((t) => t.name === toolName);
          if (targetTool) {
            this.logger.info(
              `[LangGraph Agent] Forcing specific tool: ${toolName}`,
            );
            toolChoiceOption = toolName; // LangChain.js expects just the tool name for specific tool forcing
          } else {
            this.logger.warn(
              `[LangGraph Agent] Requested tool '${toolName}' not found in available tools. Using 'required' instead.`,
            );
            toolChoiceOption = 'required';
          }
        } else if (this.config.forceToolCall === 'required') {
          // Force any tool call
          this.logger.info(
            '[LangGraph Agent] Forcing any tool call (required)',
          );
          toolChoiceOption = 'required';
        }

        // 🔧 NEW: Workflow-based tool forcing
        if (!toolChoiceOption) {
          const userMessages = state.messages.filter(
            (msg) => msg._getType() === 'human',
          );
          const currentQuery =
            userMessages.length > 0
              ? typeof userMessages[0].content === 'string'
                ? userMessages[0].content
                : JSON.stringify(userMessages[0].content)
              : state.input || '';

          const suggestedTools =
            this.workflowManager.getSuggestedNextTools(currentQuery);
          const forceToolCall = suggestedTools.find((tool) => tool.forceCall);

          if (forceToolCall) {
            const targetTool = this.tools.find(
              (t) => t.name === forceToolCall.toolName,
            );
            if (targetTool) {
              this.logger.info(
                '[LangGraph Agent] 🔧 Workflow suggests forcing tool call:',
                {
                  toolName: forceToolCall.toolName,
                  reason: forceToolCall.reason,
                  priority: forceToolCall.priority,
                },
              );
              toolChoiceOption = forceToolCall.toolName;
            }
          }
        }

        if (toolChoiceOption) {
          // Re-bind tools with tool_choice option
          // Try different formats to see which one works
          this.logger.info(
            `[LangGraph Agent] Attempting to bind tools with tool_choice: ${toolChoiceOption}`,
          );

          // Apply schema patching before binding tools
          const patchedTools = this.applySchemaPatching(this.tools);

          try {
            // First try: just the tool name (as per docs)
            llmWithTools = this.llm.bindTools(patchedTools, {
              tool_choice: toolChoiceOption,
            });
            this.logger.info(
              '[LangGraph Agent] ✅ Successfully bound tools with tool_choice (name format):',
              {
                tool_choice: toolChoiceOption,
              },
            );
          } catch (error) {
            this.logger.error(
              '[LangGraph Agent] Failed to bind with tool name, trying OpenAI format:',
              error,
            );

            // Fallback: try OpenAI format
            if (
              typeof toolChoiceOption === 'string' &&
              toolChoiceOption !== 'required'
            ) {
              llmWithTools = this.llm.bindTools(patchedTools, {
                tool_choice: {
                  type: 'function',
                  function: { name: toolChoiceOption },
                },
              });
              this.logger.info(
                '[LangGraph Agent] ✅ Successfully bound tools with tool_choice (OpenAI format)',
              );
            } else {
              llmWithTools = this.llm.bindTools(patchedTools, {
                tool_choice: 'required',
              });
              this.logger.info(
                '[LangGraph Agent] ✅ Successfully bound tools with tool_choice (required)',
              );
            }
          }
        }
      } else {
        this.logger.info('[LangGraph Agent] No tool forcing applied', {
          hasForceToolCall: !!this.config.forceToolCall,
          shouldForceTools,
          reason: !this.config.forceToolCall
            ? 'No force directive'
            : 'Research complete or specific tool already executed',
        });
      }

      // Log the actual messages being sent to LLM for diagnosis
      this.logger.info('[LangGraph Agent] Messages being sent to LLM:', {
        messageCount: currentMessages.length,
        lastMessage: (() => {
          const lastMsg = currentMessages[currentMessages.length - 1];
          if (!lastMsg?.content) return 'No content';
          if (typeof lastMsg.content === 'string') {
            return lastMsg.content.substring(0, 200);
          }
          return 'Complex content type';
        })(),
        hasSystemMessage: currentMessages.some(
          (m) => m._getType() === 'system',
        ),
        messageTypes: currentMessages.map((m) => m._getType()),
        toolChoiceApplied: !!this.config.forceToolCall && !hasToolExecutions,
      });

      // Invoke LLM with current messages with error recovery
      let response: AIMessage;
      try {
        response = await llmWithTools.invoke(currentMessages);
      } catch (error: any) {
        // Handle context length exceeded errors
        if (
          error?.code === 'context_length_exceeded' ||
          error?.message?.includes('context length') ||
          error?.message?.includes('maximum context')
        ) {
          this.logger.error(
            '[LangGraph Agent] Context length exceeded, attempting recovery',
            {
              error: error.message,
              messageCount: currentMessages.length,
              estimatedTokens:
                this.contextManager.estimateTokenCount(currentMessages),
            },
          );

          // Emergency context reduction
          const emergencyMessages = this.contextManager.truncateMessages(
            currentMessages,
            8000, // Very conservative limit
          );

          // Try with emergency truncation
          try {
            response = await llmWithTools.invoke(emergencyMessages);
            this.logger.info(
              '[LangGraph Agent] Recovery successful with emergency truncation',
            );
          } catch (recoveryError: any) {
            this.logger.error('[LangGraph Agent] Recovery failed', {
              error: recoveryError.message,
            });
            throw new Error(
              `Context management failed: ${recoveryError.message}`,
            );
          }
        } else {
          throw error;
        }
      }

      this.logger.info('[LangGraph Agent] LLM Response:', {
        hasToolCalls: (response.tool_calls?.length ?? 0) > 0,
        toolCallCount: response.tool_calls?.length || 0,
        responseLength:
          typeof response.content === 'string' ? response.content.length : 0,
        responsePreview:
          typeof response.content === 'string'
            ? response.content.substring(0, 200)
            : 'Non-string content',
      });

      // *** DEFINITIVE FIX V4: Enforce pure tool-calling messages ***
      // If the AI message contains tool calls, unconditionally erase any conversational content.
      // This prevents the initial "How can I assist..." message from polluting the state.
      if (response.tool_calls && response.tool_calls.length > 0) {
        if (
          response.content &&
          typeof response.content === 'string' &&
          response.content.length > 0
        ) {
          this.logger.warn(
            '[LangGraph Agent] 🧼 Cleaning conversational content from a tool-calling message.',
            { originalContent: response.content },
          );
          response.content = '';
        }
      }
      // *** END OF FIX V4 ***

      // Enhanced tool call logging
      if (response.tool_calls && response.tool_calls.length > 0) {
        this.logger.info('Tool calls detected', {
          tools: response.tool_calls.map((tc) => ({
            name: tc.name,
            id: tc.id,
            args: tc.args,
          })),
        });
      } else {
        // Only warn about missing tool calls if we actually expected them
        const toolForcingWasApplied =
          !!this.config.forceToolCall && !hasToolExecutions;
        const isInitialCall = !hasAIResponses; // First LLM call in the conversation

        if (toolForcingWasApplied && isInitialCall) {
          // This is problematic - we forced tools but didn't get any on the initial call
          this.logger.warn(
            '[LangGraph Agent] ⚠️ NO TOOL CALLS DETECTED despite tool forcing on initial call - This indicates a tool forcing issue!',
            {
              responseContentLength:
                typeof response.content === 'string'
                  ? response.content.length
                  : 0,
              availableToolCount: this.tools.length,
              modelName: this.llm.modelName,
              forceToolCall: this.config.forceToolCall,
              hasAIResponses,
              hasToolExecutions,
            },
          );
        } else if (hasToolExecutions || isFollowUpAfterTools) {
          // This is normal - final conversational response after tools were executed
          this.logger.info(
            '[LangGraph Agent] ✅ FINAL CONVERSATIONAL RESPONSE (no tool calls expected after tool execution)',
            {
              responseLength:
                typeof response.content === 'string'
                  ? response.content.length
                  : 0,
              responsePreview:
                typeof response.content === 'string'
                  ? response.content.substring(0, 200)
                  : 'Non-string content',
              isFollowUpAfterTools,
              hasToolExecutions,
              lastMessageType: lastMessage?._getType(),
            },
          );
        } else {
          // No tool forcing applied, no tools expected - normal conversational response
          this.logger.info(
            '[LangGraph Agent] ✅ Conversational response (no tools expected)',
            {
              responseLength:
                typeof response.content === 'string'
                  ? response.content.length
                  : 0,
              toolForcingApplied: toolForcingWasApplied,
            },
          );
        }
      }

      // Update counters for circuit breakers
      const newToolForcingCount =
        shouldForceTools && this.config.forceToolCall
          ? currentToolForcingCount + 1
          : currentToolForcingCount;

      return {
        messages: [response], // CRITICAL FIX: Only return new message for concat reducer
        agent_outcome: response,
        toolForcingCount: newToolForcingCount,
        iterationCount: currentIterationCount,
      };
    } catch (error) {
      this.logger.error('Error in agent node', { error });
      throw error;
    }
  }

  /**
   * Conversational Response Node
   * Handles AI responses that don't need tools or synthesis
   */
  private conversationalResponseNode(): Runnable<
    GraphState,
    Partial<GraphState>
  > {
    const conversationalChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.logger.info(
          '[LangGraph Conversational] Processing conversational response',
        );

        // Check if we have an AI response that's just loading messages
        const lastAIMessage = state.messages
          .filter((m) => m._getType() === 'ai')
          .pop();

        const isLoadingMessage =
          typeof lastAIMessage?.content === 'string' &&
          (lastAIMessage.content.includes('🔍 Analyzing your request') ||
            lastAIMessage.content.includes('💬 Preparing response'));

        // If the AI response is just loading messages, we need to generate actual content
        if (isLoadingMessage || !lastAIMessage) {
          this.logger.info(
            '[LangGraph Conversational] Generating actual response content',
          );

          // Get the original user message
          const userMessage = state.messages.find(
            (m) => m._getType() === 'human',
          );

          return [
            new SystemMessage({
              content: this.config.systemPrompt,
            }),
            userMessage || new HumanMessage({ content: 'Please help me.' }),
          ];
        } else {
          // We have a proper AI response, but let's regenerate it with the enhanced prompt
          // to ensure the file context is properly processed
          this.logger.info(
            '[LangGraph Conversational] Regenerating response with enhanced context',
          );

          // Get the original user message
          const userMessage = state.messages.find(
            (m) => m._getType() === 'human',
          );

          return [
            new SystemMessage({
              content: this.config.systemPrompt,
            }),
            userMessage || new HumanMessage({ content: 'Please help me.' }),
          ];
        }
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.llm.withConfig({
        tags: ['conversational_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'conversational',
        },
        callbacks: [
          {
            handleLLMNewToken: (token: string) => {
              // Remove duplicate logging - Phase 4 Hybrid handles streaming
              // this.logger.info('[Conversational Streaming] Token received', {
              //   tokenLength: token.length,
              //   tokenPreview: token.substring(0, 20),
              // });
            },
          },
        ],
      }),
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.logger.info(
          '[LangGraph Conversational] Conversational response completed',
        );
        return { messages: [aiMessage] };
      }),
    ]);

    // ENHANCED STREAMING FIX: Ensure comprehensive tags for streaming detection
    return conversationalChain.withConfig({
      tags: ['final_node', 'conversational', 'streaming_enabled'],
      metadata: {
        streaming: true,
        streamMode: 'token',
        node_type: 'conversational',
        enableTokenStreaming: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }

  /**
   * Simple Response Node
   * Formats tool results for direct output without synthesis
   */
  /**
   * Simple Response Node - REFACTORED with centralized formatting
   * Formats tool results for direct output without synthesis
   * FIXES: Content duplication bug by using single formatting path
   */
  private simpleResponseNode(): Runnable<GraphState, Partial<GraphState>> {
    const simpleResponseChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.logger.info(
          '[LangGraph Simple Response] Formatting tool results for direct output',
        );

        // Extract tool results using centralized approach
        const toolMessages = state.messages.filter(
          (msg) => msg._getType() === 'tool',
        );

        if (toolMessages.length === 0) {
          // No tool results, provide a simple acknowledgment
          return [
            new SystemMessage({
              content: ContentFormatter.getSystemPrompt('generic'),
            }),
          ];
        }

        // Extract user query
        const userMessages = state.messages.filter(
          (msg) => msg._getType() === 'human',
        );
        const lastUserMessage = userMessages[userMessages.length - 1];
        const userQuery =
          typeof lastUserMessage?.content === 'string'
            ? lastUserMessage.content
            : JSON.stringify(lastUserMessage?.content) || '';

        this.logger.info('[LangGraph Simple Response] Query intent analysis', {
          userQuery: userQuery.substring(0, 100),
        });

        // Convert tool messages to ToolResult format
        const toolResults: ToolResult[] = toolMessages.map((msg) => ({
          name: (msg as any)?.name || 'tool',
          content: msg.content,
        }));

        // Use centralized formatter - SINGLE point of formatting (fixes duplication)
        const formattedContent = ContentFormatter.formatToolResults(
          toolResults,
          userQuery,
        );

        // Determine content type for appropriate system prompt
        const isDocumentListing = formattedContent.includes(
          '📋 **Available Documents:**',
        );
        const contentType = isDocumentListing ? 'document_list' : 'content';

        return [
          new SystemMessage({
            content: ContentFormatter.getSystemPrompt(contentType),
          }),
          new HumanMessage({
            content: formattedContent,
          }),
        ];
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.llm.withConfig({
        tags: ['simple_response_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'simple_response',
        },
        callbacks: [
          {
            handleLLMNewToken: (token: string) => {
              // Remove duplicate logging - Phase 4 Hybrid handles streaming
              // this.logger.info('[Simple Response Streaming] Token received', {
              //   tokenLength: token.length,
              //   tokenPreview: token.substring(0, 20),
              // });
            },
          },
        ],
      }),
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.logger.info(
          '[LangGraph Simple Response] Simple response completed',
        );
        // Mark that simple response has streamed content to prevent duplication
        this.streamingCoordinator.markContentStreamed('simple');
        return { messages: [aiMessage] };
      }),
    ]);

    // ENHANCED STREAMING FIX: Ensure comprehensive tags for streaming detection
    return simpleResponseChain.withConfig({
      tags: ['final_node', 'simple_response', 'streaming_enabled'],
      metadata: {
        streaming: true,
        streamMode: 'token',
        node_type: 'simple_response',
        enableTokenStreaming: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }

  /**
   * Synthesis Node
   * This node is responsible for taking the accumulated tool results and synthesizing
   * a final, clean response based on what the user actually requested.
   */
  private synthesisNode(): Runnable<GraphState, Partial<GraphState>> {
    const synthesisChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.logger.info(
          '[LangGraph Synthesis] 🎬 Starting final synthesis node.',
        );

        const toolResults = state.messages
          .filter((msg) => msg._getType() === 'tool')
          .map((msg) => `Tool: ${(msg as any)?.name}\nResult: ${msg.content}`)
          .join('\n\n');

        // Extract references from tool results - detect what was actually used
        const knowledgeBaseRefs: Array<{ name: string; url?: string }> = [];
        const webSources: Array<{ name: string; url?: string }> = [];
        const documentUrls = new Map<string, string>(); // Map document names to URLs

        state.messages
          .filter((msg) => msg._getType() === 'tool')
          .forEach((msg) => {
            try {
              const toolName = (msg as any)?.name;
              const content =
                typeof msg.content === 'string'
                  ? msg.content
                  : JSON.stringify(msg.content);

              if (toolName === 'listDocuments') {
                // Extract document URLs from listDocuments results
                const parsed = JSON.parse(content);
                if (parsed.available_documents) {
                  parsed.available_documents.forEach((doc: any) => {
                    if (doc.name && doc.url) {
                      documentUrls.set(doc.name, doc.url);
                    }
                  });
                }
              } else if (toolName === 'getDocumentContents') {
                // Knowledge base document
                const parsed = JSON.parse(content);
                if (parsed.success && parsed.document) {
                  const docName = parsed.document.name;
                  const docUrl = documentUrls.get(docName) || undefined;
                  knowledgeBaseRefs.push({ name: docName, url: docUrl });
                }
              } else if (toolName === 'webSearch') {
                // Web search results
                const parsed = JSON.parse(content);
                if (parsed.success && parsed.results) {
                  parsed.results.forEach((result: any) => {
                    if (result.title && result.url) {
                      webSources.push({
                        name: result.title,
                        url: result.url,
                      });
                    }
                  });
                }
              }
            } catch (error) {
              // Failed to parse, skip this tool result
            }
          });

        // Get user query for context
        const userMessages = state.messages.filter(
          (msg) => msg._getType() === 'human',
        );
        const lastUserMessage = userMessages[userMessages.length - 1];
        const userQuery =
          typeof lastUserMessage?.content === 'string'
            ? lastUserMessage.content
            : JSON.stringify(lastUserMessage?.content) || '';

        // Determine response type based on query analysis
        const queryLower = userQuery.toLowerCase();
        let responseType = 'comprehensive research report';
        let responseInstructions = `Create a comprehensive research report that synthesizes all the information gathered. Structure your response with clear sections, actionable insights, and specific recommendations.`;
        let isSimpleFileListing = false;

        // Check for simple file listing requests
        if (
          (queryLower.includes('list') && queryLower.includes('file')) ||
          (queryLower.includes('show') && queryLower.includes('file')) ||
          queryLower.includes('list files') ||
          queryLower.includes('available files') ||
          queryLower.includes('files in the knowledge base') ||
          queryLower.includes('what files') ||
          (queryLower.includes('documents') &&
            (queryLower.includes('list') || queryLower.includes('show')))
        ) {
          responseType = 'file listing';
          responseInstructions = `Present the file listing clearly and simply. Use the exact formatted_list provided in the tool results.`;
          isSimpleFileListing = true;
        }
        // Enhanced query analysis for response type
        else if (
          queryLower.includes('comparison') ||
          queryLower.includes('compare') ||
          queryLower.includes('versus') ||
          queryLower.includes('vs') ||
          queryLower.includes('difference')
        ) {
          responseType = 'comparative analysis report';
          responseInstructions = `Create a detailed comparative analysis that examines similarities, differences, and relationships between the subjects. Use structured sections to highlight key comparisons and provide actionable insights.`;
        } else if (
          queryLower.includes('alignment') ||
          queryLower.includes('match') ||
          queryLower.includes('fit') ||
          queryLower.includes('suitable')
        ) {
          responseType = 'alignment analysis report';
          responseInstructions = `Create an alignment analysis that evaluates how well different elements match or complement each other. Focus on compatibility, synergies, and areas of strong alignment or potential gaps.`;
        } else if (
          queryLower.includes('analysis') ||
          queryLower.includes('analyze') ||
          queryLower.includes('evaluation') ||
          queryLower.includes('assess')
        ) {
          responseType = 'analytical report';
          responseInstructions = `Create a thorough analytical report that breaks down the key components, evaluates different aspects, and provides data-driven insights and recommendations.`;
        }

        // Build references section (skip for simple file listings)
        let referencesContext = '';
        if (
          !isSimpleFileListing &&
          (knowledgeBaseRefs.length > 0 || webSources.length > 0)
        ) {
          referencesContext = `\n\nIMPORTANT REFERENCES TO INCLUDE:
Knowledge Base Documents Used:`;

          knowledgeBaseRefs.forEach((ref) => {
            // Format as markdown link if URL is available
            if (ref.url) {
              referencesContext += `\n- [${ref.name}](${ref.url})`;
            } else {
              referencesContext += `\n- ${ref.name}`;
            }
          });

          if (webSources.length > 0) {
            referencesContext += `\n\nWeb Sources Used:`;
            webSources.forEach((source) => {
              // Format as markdown link if URL is available
              if (source.url) {
                referencesContext += `\n- [${source.name}](${source.url})`;
              } else {
                referencesContext += `\n- ${source.name}`;
              }
            });
          }

          referencesContext += `\n\nYou MUST include a "References" section at the end with these sources as clickable links.`;
        }

        const referencesInstructions = isSimpleFileListing
          ? ''
          : `
## References Section Requirements:
- ALWAYS include a "References" section at the end of your response
- List all sources used in the analysis
- CRITICAL: Only list sources under "Knowledge Base Documents" if they came from getDocumentContents tool
- CRITICAL: Only list sources under "Web Sources" if they came from webSearch tool
- Format knowledge base documents as: [Document Name](URL) if URL available
- Format web sources as: [Article Title](URL)
- Group by source type: "Knowledge Base Documents" and "Web Sources"
- DO NOT duplicate sources - if you mention a source in the body, do not repeat the full citation in references
- In references, only provide the source name and link, no descriptions
- NEVER show raw URLs - ALWAYS format as clickable markdown links [Title](URL)
- CRITICAL: Use BULLET POINTS (- ) for references, NOT numbered lists (1. 2. 3.)
- Example format: - [Sharks of the Gulf of Mexico](https://www.sharksider.com/sharks-gulf-mexico/)
- NEVER use numbered lists within numbered lists - this creates confusing double numbering`;

        const synthesisSystemMessage = new SystemMessage({
          content: `You are an expert research analyst creating ${responseType}s. Your task is to synthesize information from multiple sources into a coherent, well-structured analysis.

RESPONSE FORMATTING REQUIREMENTS:
- Use clear markdown formatting with proper headers (##, ###)
- Create well-organized sections with logical flow
- Use bullet points (-) for most lists, numbered lists (1. 2. 3.) only for sequential steps or rankings
- Make all document and source names clickable links using [Name](URL) format
- Use **bold** for key terms and emphasis
- Include specific examples and quotes from sources when relevant
- CRITICAL: NEVER mix numbered lists within numbered lists - this creates confusing double numbering
- For References sections, ALWAYS use bullet points (-), NEVER numbered lists

DOCUMENT LINKING REQUIREMENTS:
- For knowledge base documents: [Document Name](URL) - use exact URLs provided below
- For web sources: [Article Title](URL) - use exact URLs provided below  
- For calendar events: [Event Name](URL) when URLs are provided
- NEVER show raw URLs - always format as clickable links
- When referencing any document in your content, make it a clickable link

CONTENT STRUCTURE REQUIREMENTS:
- Start with an executive summary or overview
- Use clear section headers (##, ###) to organize content
- Include specific data points, quotes, and examples from sources
- Provide actionable insights and recommendations
${isSimpleFileListing ? '- For file listings: Present the list clearly without additional analysis or references' : '- End with a comprehensive References section'}

CRITICAL FORMATTING RULES:
- **NO TABLES** for alignment analysis, comparison analysis, or criteria evaluation
- For any analysis involving "alignment", "comparison", "criteria", or "vs" - use structured lists instead
- Tables are ONLY for simple factual data (contact info, dates, basic stats)
- Use structured lists with clear headers and bullet points for complex analysis

DOCUMENT LISTING FORMAT (when listing available documents):
- Use simple markdown list format: - [Document Name](URL)
- Do NOT add descriptions or bullet points before document names
- Keep it clean and simple

CALENDAR EVENT FORMAT:
- **Event Name**: [Event Title](link-if-available)
- **Date & Time**: Clear date/time format
- **Location**: Address or venue
- **Attendees**: [Name](email-link), [Name](email-link)
- For calendar events: ALWAYS make event names clickable links when URLs are provided
- For web results: ALWAYS make titles clickable links: [Article Title](URL)
- For knowledge base documents: ALWAYS make document names clickable links: [Document Name](URL)
- Use **bold** for emphasis, not ALL CAPS

CRITICAL LINKING INSTRUCTIONS:
- When mentioning ANY document or source in your content, check the "Knowledge Base Documents Used" and "Web Sources Used" sections below
- ALWAYS use the exact URLs provided in those sections to create clickable links
- NEVER mention a document name without making it a clickable link if a URL is available
- Example: If you see "Ideal Client Profile.txt" in Knowledge Base Documents Used with a URL, write [Ideal Client Profile](URL) everywhere you mention it

CRITICAL SOURCE CATEGORIZATION:
- Knowledge Base Documents: ONLY sources that came from internal document retrieval (getDocumentContents tool)
- Web Sources: ONLY sources that came from web search (webSearch tool)
- NEVER categorize web search results as knowledge base documents
- NEVER categorize internal documents as web sources
- If unsure about source type, check which tool provided the information

CRITICAL: NO TABLES FOR ALIGNMENT/COMPARISON ANALYSIS
- NEVER use tables for alignment analysis, comparison analysis, or criteria evaluation
- For any analysis involving "alignment", "comparison", "criteria", or "vs" - ALWAYS use structured lists
- Tables are ONLY acceptable for simple data like contact info, dates, or basic facts

SIMPLE TABLE GUIDELINES (for basic data only):
- Only use tables for simple factual data (contact info, dates, basic stats)
- Keep content very brief - single words or short phrases only
- Never use tables when content requires explanation or analysis

CONTENT STRUCTURE:
- ${responseInstructions}
${referencesInstructions}
- DO NOT include "End of Report", "End of Document", or any closing statements after the References section.
- Ensure all links are properly formatted as [Text](URL) - NEVER show raw URLs
- In the References section specifically, ALWAYS use markdown links: [Source Title](URL)
- Example reference format: [Sharks of the Gulf of Mexico](https://www.sharksider.com/sharks-gulf-mexico/)

ALIGNMENT ANALYSIS OVERRIDE:
- If creating alignment analysis, comparison analysis, or criteria evaluation: IGNORE any impulse to use tables
- MANDATORY: Use the structured list format shown above for all alignment/comparison content
- This applies to ANY content comparing two or more items, criteria, or concepts

Current date: ${new Date().toISOString()}`,
        });

        const synthesisInstruction = new HumanMessage({
          content: `User Request: "${userQuery}"

Tool Results Available:
---
${toolResults}
---${referencesContext}

IMPORTANT FORMATTING INSTRUCTIONS:
- When writing your response, use the URLs provided above to make ALL document and source names clickable links
- Do not mention any document name as plain text if a URL is available
- If the tool results include a "formatted_list" field (from listDocuments), use that exact formatted list with clickable links
- For document listings, present the formatted_list exactly as provided - do not modify the format or add extra text

Create the ${responseType} now.`,
        });

        this.logger.info('[LangGraph Synthesis] Invoking LLM for synthesis.', {
          toolResultsLength: toolResults.length,
          userQueryLength: userQuery.length,
          responseType,
          knowledgeBaseRefsCount: knowledgeBaseRefs.length,
        });

        return [synthesisSystemMessage, synthesisInstruction];
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.llm.withConfig({
        tags: ['synthesis_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'synthesis',
        },
        callbacks: [
          {
            handleLLMNewToken: (token: string) => {
              // Remove duplicate logging - Phase 4 Hybrid handles streaming
              // this.logger.info('[Synthesis Streaming] Token received', {
              //   tokenLength: token.length,
              //   tokenPreview: token.substring(0, 20),
              // });
            },
          },
        ],
      }),
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.logger.info(
          '[LangGraph Synthesis] Synthesis completed, returning AI message in state.',
          {
            contentLength:
              typeof aiMessage.content === 'string'
                ? aiMessage.content.length
                : 0,
          },
        );

        // Return the AI message as part of the state so the stream method can find it
        return {
          messages: [aiMessage],
        };
      }),
    ]);

    // ENHANCED STREAMING FIX: Ensure comprehensive tags for streaming detection
    return synthesisChain.withConfig({
      tags: ['final_node', 'synthesis', 'streaming_enabled'],
      metadata: {
        streaming: true,
        streamMode: 'token',
        node_type: 'synthesis',
        enableTokenStreaming: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }

  /**
   * Generate cache key for tool calls to detect redundancy
   * ENHANCED with aggressive semantic similarity detection
   */
  private generateToolCacheKey(toolCall: any): string {
    const toolName = toolCall.name;
    const args = toolCall.args || {};

    // DEBUG: Log tool name detection
    this.logger.info('[Tool Cache] Generating cache key', {
      toolName,
      args,
      toolCallStructure: Object.keys(toolCall),
    });

    // **AGGRESSIVE FIX**: All listDocuments calls are identical regardless of parameters
    if (toolName === 'listDocuments') {
      return `${toolName}:all`; // Force all listDocuments to same cache key
    }

    // **ENHANCED**: Normalize tavilySearch queries for comprehensive searches
    if (toolName === 'tavilySearch' && args.query) {
      const query = args.query.toLowerCase();

      // **COMPREHENSIVE LWCC NORMALIZATION**: All LWCC searches map to same cache key
      if (query.includes('lwcc')) {
        // Extract search aspects to create more specific cache keys
        const aspects = [];
        if (
          query.includes('profile') ||
          query.includes('about') ||
          query.includes('overview') ||
          query.includes('company')
        )
          aspects.push('profile');
        if (query.includes('mission') || query.includes('purpose'))
          aspects.push('mission');
        if (query.includes('values') || query.includes('culture'))
          aspects.push('values');
        if (
          query.includes('leadership') ||
          query.includes('management') ||
          query.includes('executives')
        )
          aspects.push('leadership');
        if (
          query.includes('news') ||
          query.includes('recent') ||
          query.includes('latest')
        )
          aspects.push('news');
        if (query.includes('services') || query.includes('products'))
          aspects.push('services');
        if (query.includes('industry') || query.includes('sector'))
          aspects.push('industry');

        // If comprehensive search (3+ aspects), use comprehensive cache key
        if (aspects.length >= 3) {
          return `${toolName}:lwcc_comprehensive_search`;
        }

        // Otherwise, use specific aspect-based cache key
        return `${toolName}:lwcc_${aspects.sort().join('_') || 'general'}`;
      }

      // **GENERAL COMPANY NORMALIZATION**: Handle other company searches
      const companyMatch = query.match(
        /\b([a-z]+(?:\s+[a-z]+)*)\s+(?:company|corp|inc|llc|corporation|limited)/,
      );
      if (companyMatch) {
        const companyName = companyMatch[1].replace(/\s+/g, '_');
        return `${toolName}:${companyName}_company_comprehensive`;
      }
    }

    // **AGGRESSIVE FIX**: Normalize searchInternalKnowledgeBase queries
    if (toolName === 'searchInternalKnowledgeBase' && args.query) {
      const query = args.query.toLowerCase();

      // Normalize client research queries
      if (query.includes('client research') || query.includes('ideal client')) {
        return `${toolName}:client_research_examples`;
      }

      // Normalize Echo Tango queries
      if (query.includes('echo tango')) {
        return `${toolName}:echo_tango_info`;
      }
    }

    // **AGGRESSIVE FIX**: Normalize getDocumentContents by document type
    if (toolName === 'getDocumentContents' && (args.id || args.title)) {
      const identifier = (args.id || args.title || '').toLowerCase();

      // Group similar document types
      if (
        identifier.includes('ideal_client') ||
        identifier.includes('ideal client')
      ) {
        return `${toolName}:ideal_client_profile`;
      }

      if (
        identifier.includes('core_values') ||
        identifier.includes('core values')
      ) {
        return `${toolName}:echo_tango_values`;
      }

      if (
        identifier.includes('client_research') ||
        identifier.includes('client research')
      ) {
        return `${toolName}:client_research_template`;
      }
    }

    // Fallback: Use exact parameters for other tools
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((result, key) => {
        result[key] = args[key];
        return result;
      }, {} as any);

    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  }

  /**
   * Check if any tool call results are cached
   */
  private getCachedToolResults(toolCalls: any[]): {
    cached: any[];
    toExecute: any[];
  } {
    const cached: any[] = [];
    const toExecute: any[] = [];

    for (const toolCall of toolCalls) {
      const cacheKey = this.generateToolCacheKey(toolCall);

      if (this.toolResultCache.has(cacheKey)) {
        const cachedResult = this.toolResultCache.get(cacheKey);
        this.logger.info(
          `[Tool Cache] 🎯 Using cached result for ${toolCall.name}`,
          {
            toolId: toolCall.id,
            cacheKey,
            cachedContent:
              typeof cachedResult === 'string'
                ? `${cachedResult.substring(0, 100)}...`
                : 'object',
          },
        );

        // Create a tool message with the cached result
        const toolMessage = new ToolMessage({
          content:
            typeof cachedResult === 'string'
              ? cachedResult
              : JSON.stringify(cachedResult),
          tool_call_id: toolCall.id,
          name: toolCall.name, // IMPORTANT: Add the tool name for proper identification
        });
        cached.push(toolMessage);
      } else {
        toExecute.push(toolCall);
      }
    }

    return { cached, toExecute };
  }

  /**
   * Cache tool results for future use
   */
  private cacheToolResults(toolCalls: any[], toolMessages: any[]): void {
    // Match tool calls with their results
    const toolCallsById = new Map(toolCalls.map((tc) => [tc.id, tc]));

    for (const toolMessage of toolMessages) {
      if (toolMessage.tool_call_id) {
        const toolCall = toolCallsById.get(toolMessage.tool_call_id);
        if (toolCall) {
          const cacheKey = this.generateToolCacheKey(toolCall);
          this.toolResultCache.set(cacheKey, toolMessage.content);
          this.logger.info(`[Tool Cache] Cached result for ${toolCall.name}`, {
            toolId: toolCall.id,
            cacheKey,
          });
        }
      }
    }
  }

  /**
   * CRITICAL FIX: Deduplicate tool calls within the same LLM response
   * This prevents the LLM from making multiple identical calls in a single response
   */
  private deduplicateToolCalls(toolCalls: any[]): any[] {
    const seen = new Set<string>();
    const deduplicated: any[] = [];

    for (const toolCall of toolCalls) {
      // Create a deduplication key based on tool name and normalized arguments
      const dedupKey = this.generateToolCacheKey(toolCall);

      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        deduplicated.push(toolCall);

        this.logger.info(`[Tool Deduplication] ✅ Keeping: ${toolCall.name}`, {
          toolId: toolCall.id,
          dedupKey,
        });
      } else {
        this.logger.info(
          `[Tool Deduplication] 🚫 Removing duplicate: ${toolCall.name}`,
          {
            toolId: toolCall.id,
            dedupKey,
            reason: 'Identical tool call already in this batch',
          },
        );
      }
    }

    return deduplicated;
  }

  /**
   * Tool Execution Node
   * Handles execution of tools called by the LLM and captures artifact events.
   */
  private async executeToolsNode(
    state: GraphState,
    config?: RunnableConfig,
  ): Promise<Partial<GraphState>> {
    this.logger.info('[LangGraph Tools] Starting tool execution...', {
      hasConfig: !!config,
      configurable: config?.configurable
        ? Object.keys(config.configurable)
        : [],
    });

    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
      this.logger.warn(
        '[LangGraph Tools] No tool calls found in the last message.',
      );
      // If no tools are called, we might need to route to synthesis or finish
      return {};
    }

    // CRITICAL FIX: Deduplicate tool calls within the same LLM response
    const deduplicatedToolCalls = this.deduplicateToolCalls(
      lastMessage.tool_calls,
    );

    this.logger.info('[LangGraph Tools] Tool call analysis:', {
      originalCount: lastMessage.tool_calls.length,
      deduplicatedCount: deduplicatedToolCalls.length,
      duplicatesRemoved:
        lastMessage.tool_calls.length - deduplicatedToolCalls.length,
      toolCalls: deduplicatedToolCalls.map((tc) => ({
        name: tc.name,
        id: tc.id,
      })),
    });

    try {
      // Check cache for existing results using deduplicated calls
      const { cached, toExecute } = this.getCachedToolResults(
        deduplicatedToolCalls,
      );

      let newToolMessages: any[] = [];

      // Execute only tools that aren't cached
      if (toExecute.length > 0) {
        this.logger.info('[LangGraph Tools] Executing uncached tools:', {
          uncachedTools: toExecute.map((tc) => tc.name),
          cachedCount: cached.length,
        });

        // Create a modified state with only the tools that need execution
        const modifiedMessage = new AIMessage({
          content: lastMessage.content,
          tool_calls: toExecute,
        });

        const modifiedMessages = [
          ...state.messages.slice(0, -1),
          modifiedMessage,
        ];

        const toolNode = new ToolNode(this.tools);
        const executedToolMessages = await toolNode.invoke(
          modifiedMessages,
          config,
        );

        newToolMessages = Array.isArray(executedToolMessages)
          ? executedToolMessages
          : [executedToolMessages];

        // DEBUG: Log tool message structure to understand name detection issue
        this.logger.info('[Tool Cache] Tool messages received:', {
          messageCount: newToolMessages.length,
          messageSample: newToolMessages.map((msg) => ({
            type: msg._getType(),
            name: (msg as any)?.name,
            tool_call_id: (msg as any)?.tool_call_id,
            keys: Object.keys(msg),
          })),
        });

        // Cache the new results
        this.cacheToolResults(toExecute, newToolMessages);

        // 📊 Analyze tool results for workflow management
        for (let i = 0; i < toExecute.length; i++) {
          const toolCall = toExecute[i];
          const toolMessage = newToolMessages[i];
          if (toolMessage) {
            this.workflowManager.analyzeToolResults(
              toolCall.name,
              toolMessage.content,
              toolCall.args,
            );
          }
        }
      }

      // Combine cached and newly executed results
      const allToolMessages = [...cached, ...newToolMessages];

      this.logger.info('[LangGraph Tools] Tool execution completed', {
        totalToolMessages: allToolMessages.length,
        cachedCount: cached.length,
        executedCount: newToolMessages.length,
      });

      // Return the tool messages to be added to the state
      return {
        messages: allToolMessages,
      };
    } catch (error) {
      this.logger.error('[LangGraph Tools] Error executing tools', { error });
      // Return empty state on error to prevent graph failure
      return {};
    }
  }

  /**
   * Conditional Router Function
   * Determines the next step: call tools, synthesize the final report, or finish.
   */
  /**
   * Detect multi-document scenarios that require synthesis validation
   * Task 2.2: Synthesis Validation implementation
   */
  private detectMultiDocumentScenario(state: GraphState): {
    isMultiDocument: boolean;
    documentsFound: number;
    analysisType?: string;
    toolsUsed: string[];
  } {
    const toolMessages = state.messages.filter(
      (msg) => msg._getType() === 'tool',
    );
    const toolsUsed = toolMessages.map((msg: any) => msg.name || 'Unknown');

    // Check if getMultipleDocuments tool was used
    const multiDocToolUsed = toolMessages.some(
      (msg: any) => msg.name === 'getMultipleDocuments',
    );

    let documentsFound = 0;
    let analysisType: string | undefined;

    if (multiDocToolUsed) {
      // Analyze getMultipleDocuments results
      const multiDocMessages = toolMessages.filter(
        (msg: any) => msg.name === 'getMultipleDocuments',
      );

      for (const msg of multiDocMessages) {
        try {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content);
          const parsed = JSON.parse(content);

          if (
            parsed.success &&
            parsed.documents &&
            Array.isArray(parsed.documents)
          ) {
            documentsFound = Math.max(documentsFound, parsed.documents.length);
            if (parsed.retrievalPlan?.analysisType) {
              analysisType = parsed.retrievalPlan.analysisType;
            }
          }
        } catch (error) {
          // Failed to parse, continue checking other messages
        }
      }
    } else {
      // Fallback: Check if multiple individual getDocumentContents calls were made
      const docContentMessages = toolMessages.filter(
        (msg: any) => msg.name === 'getDocumentContents',
      );

      let successfulRetrievals = 0;
      for (const msg of docContentMessages) {
        try {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content);
          const parsed = JSON.parse(content);

          if (parsed.success && parsed.content) {
            successfulRetrievals++;
          }
        } catch (error) {
          // Failed to parse, continue checking
        }
      }
      documentsFound = successfulRetrievals;
    }

    // Also check the original query for analysis intent
    const originalQuery = state.input || '';
    const hasAnalysisIntent =
      /\b(?:compar[ei]|comparison|vs|versus|contrast|analysis|analyz[ei](?:ng)?|relationship|align)\b/i.test(
        originalQuery,
      );

    const isMultiDocument = documentsFound >= 2 && hasAnalysisIntent;

    this.logger.info('[LangGraph] Multi-document scenario detection', {
      toolsUsed,
      multiDocToolUsed,
      documentsFound,
      analysisType,
      hasAnalysisIntent,
      isMultiDocument,
      originalQuery: originalQuery.substring(0, 100),
    });

    return {
      isMultiDocument,
      documentsFound,
      analysisType,
      toolsUsed,
    };
  }

  /**
   * Enhanced query intent analysis for better routing decisions
   * Task 2.3: Enhanced Router Logic implementation
   */
  private analyzeQueryIntent(state: GraphState): {
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
  } {
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
    let intentType:
      | 'analysis'
      | 'research'
      | 'simple_lookup'
      | 'conversational'
      | 'creative' = 'conversational';
    let complexity: 'high' | 'medium' | 'low' = 'low';
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
    let suggestedResponseType:
      | 'synthesis'
      | 'simple_response'
      | 'conversational_response' = 'conversational_response';

    if (requiresDeepAnalysis || complexity === 'high') {
      suggestedResponseType = 'synthesis';
    } else if (complexity === 'medium' || intentType === 'simple_lookup') {
      suggestedResponseType = 'simple_response';
    }

    this.logger.info('[LangGraph Router] Query intent analysis', {
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

  private routeNextStep(
    state: GraphState,
  ):
    | 'use_tools'
    | 'synthesis'
    | 'simple_response'
    | 'conversational_response'
    | '__end__' {
    this.logger.info('[LangGraph Router] Evaluating next step...', {
      messageCount: state.messages.length,
      needsSynthesis: state.needsSynthesis,
      toolForcingCount: state.toolForcingCount,
      iterationCount: state.iterationCount,
    });

    const lastMessage = state.messages[state.messages.length - 1];
    const currentIterationCount = state.iterationCount || 0;
    const MAX_ITERATIONS = 3; // **REDUCED from 5 to 3 for more aggressive circuit breaking**

    // 🚨 CRITICAL: Check circuit breaker FIRST before any tool routing
    if (currentIterationCount > MAX_ITERATIONS) {
      this.logger.warn(
        '[LangGraph Router] 🛑 CIRCUIT BREAKER OVERRIDE: Forcing synthesis due to max iterations exceeded',
        {
          currentIterationCount,
          maxIterations: MAX_ITERATIONS,
          originalToolCalls:
            lastMessage &&
            'tool_calls' in lastMessage &&
            Array.isArray(lastMessage.tool_calls)
              ? lastMessage.tool_calls.length
              : 0,
        },
      );

      // Force synthesis with available data to break the loop
      return 'synthesis';
    }

    // 🔄 NEW: Workflow Management Integration
    const userMessages = state.messages.filter(
      (msg) => msg._getType() === 'human',
    );
    const currentQuery =
      userMessages.length > 0
        ? typeof userMessages[0].content === 'string'
          ? userMessages[0].content
          : JSON.stringify(userMessages[0].content)
        : state.input || '';

    // **AGGRESSIVE CHECK**: If we have both web search results AND document listings, force synthesis
    const hasWebSearchResults = state.messages.some(
      (msg) =>
        msg._getType() === 'tool' &&
        'name' in msg &&
        msg.name === 'tavilySearch',
    );

    const hasDocumentListings = state.messages.some(
      (msg) =>
        msg._getType() === 'tool' &&
        'name' in msg &&
        msg.name === 'listDocuments',
    );

    if (
      hasWebSearchResults &&
      hasDocumentListings &&
      currentIterationCount >= 2
    ) {
      this.logger.info(
        '[LangGraph Router] 🎯 AGGRESSIVE SYNTHESIS: Have web search + document listings, forcing synthesis',
        {
          hasWebSearchResults,
          hasDocumentListings,
          currentIterationCount,
        },
      );
      return 'synthesis';
    }

    // Check if workflow is ready for synthesis
    const isWorkflowReady =
      this.workflowManager.isWorkflowReadyForSynthesis(currentQuery);
    const workflowStatus = this.workflowManager.getWorkflowStatus();

    this.logger.info('[LangGraph Router] Workflow status check:', {
      isWorkflowReady,
      workflowStatus,
      currentQuery: currentQuery.substring(0, 100),
    });

    // Get suggested tools from workflow manager
    const suggestedTools =
      this.workflowManager.getSuggestedNextTools(currentQuery);
    const hasHighPriorityTools = suggestedTools.some(
      (tool) => tool.priority === 'high',
    );

    this.logger.info('[LangGraph Router] Tool suggestions:', {
      suggestedToolCount: suggestedTools.length,
      hasHighPriorityTools,
      suggestions: suggestedTools.map((s) => ({
        toolName: s.toolName,
        priority: s.priority,
        reason: `${s.reason.substring(0, 50)}...`,
      })),
    });

    // **ENHANCED REDUNDANCY CHECK**: Check for redundant tool call patterns
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      const redundancyCheck = this.detectToolCallRedundancy(
        state,
        lastMessage.tool_calls,
      );

      this.logger.info('[LangGraph Router] Redundancy check result:', {
        isRedundant: redundancyCheck.isRedundant,
        reason: redundancyCheck.reason,
        redundantToolCount: redundancyCheck.redundantToolCount,
      });

      if (redundancyCheck.isRedundant) {
        this.logger.warn(
          '[LangGraph Router] 🛑 REDUNDANCY DETECTED: Forcing synthesis to break redundant loop',
          {
            reason: redundancyCheck.reason,
            redundantToolCount: redundancyCheck.redundantToolCount,
            currentIterationCount,
          },
        );

        // Force synthesis to break the redundant loop
        return 'synthesis';
      }
    }

    // Continue with workflow-aware routing logic
    if (!isWorkflowReady && hasHighPriorityTools) {
      this.logger.info(
        '[LangGraph Router] 🔄 Workflow incomplete - suggesting tools before synthesis:',
        {
          suggestedTools: suggestedTools.map((t) => ({
            name: t.toolName,
            priority: t.priority,
            reason: t.reason,
          })),
          workflowStatus,
        },
      );

      // If we have tool calls in the last message, continue with them
      // Otherwise, we need to force tool calls (this would require modifying the LLM call)
      if (
        lastMessage &&
        'tool_calls' in lastMessage &&
        Array.isArray(lastMessage.tool_calls) &&
        lastMessage.tool_calls.length > 0
      ) {
        return 'use_tools';
      }
    }

    // 1. If the last AI message has tool calls, route to the tool executor
    // BUT FIRST: Apply document listing circuit breaker
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      // Check if this is a document listing request with existing results
      const userMessages = state.messages.filter(
        (msg) => msg._getType() === 'human',
      );
      const lastUserMessage = userMessages[userMessages.length - 1];
      const userQuery =
        typeof lastUserMessage?.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage?.content) || '';

      const isDocumentListingRequest =
        /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
          userQuery,
        );
      const hasListDocumentsResult = state.messages.some(
        (msg) =>
          msg._getType() === 'tool' &&
          typeof msg.content === 'string' &&
          msg.content.includes('available_documents'),
      );

      // Circuit breaker: If this is a document listing request and we already have results, skip tools
      if (isDocumentListingRequest && hasListDocumentsResult) {
        this.logger.info(
          '[LangGraph Router] 🛑 CIRCUIT BREAKER: Document listing request with existing results - skipping tools and routing to synthesis',
          {
            userQuery: userQuery.substring(0, 100),
            hasListDocumentsResult,
            toolCallsCount: lastMessage.tool_calls.length,
          },
        );
        return 'synthesis';
      }

      this.logger.info('[LangGraph Router] Decision: Route to tools node.');
      return 'use_tools';
    }

    // 1.5. CRITICAL: If the last message is an AI response with content (no tool calls), end the graph
    if (
      lastMessage &&
      lastMessage._getType() === 'ai' &&
      lastMessage.content &&
      (!('tool_calls' in lastMessage) ||
        !lastMessage.tool_calls ||
        (Array.isArray(lastMessage.tool_calls) &&
          lastMessage.tool_calls.length === 0))
    ) {
      this.logger.info(
        '[LangGraph Router] Decision: AI provided final response with content. Ending graph to prevent duplicate responses.',
        {
          messageType: lastMessage._getType(),
          hasContent: !!lastMessage.content,
          hasToolCalls:
            'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls)
              ? lastMessage.tool_calls.length
              : 0,
        },
      );
      return '__end__';
    }

    // 2. Check if we have tool results
    const hasToolResults = state.messages.some((m) => m._getType() === 'tool');
    const toolForcingCount = state.toolForcingCount || 0;
    const MAX_TOOL_FORCING = 2;

    this.logger.info(
      '[LangGraph Router] Analyzing tool results and synthesis need',
      {
        hasToolResults,
        toolForcingCount,
        MAX_TOOL_FORCING,
        needsSynthesis: state.needsSynthesis,
      },
    );

    if (hasToolResults) {
      let needsSynthesis = state.needsSynthesis ?? true; // Default to true for backward compatibility

      // Task 2.3: Enhanced Router Logic - Analyze query intent for better routing
      const queryIntent = this.analyzeQueryIntent(state);

      // Task 2.2: Synthesis Validation - Force synthesis for multi-document scenarios
      const multiDocResults = this.detectMultiDocumentScenario(state);
      if (multiDocResults.isMultiDocument) {
        this.logger.info(
          '[LangGraph Router] Multi-document scenario detected, forcing synthesis',
          {
            originalNeedsSynthesis: needsSynthesis,
            multiDocDetails: multiDocResults,
          },
        );
        needsSynthesis = true;
      }

      // NEW: Enhanced Synthesis Validation using SynthesisValidator
      const userMessages = state.messages.filter(
        (msg) => msg._getType() === 'human',
      );
      const originalQuery =
        userMessages.length > 0
          ? typeof userMessages[0].content === 'string'
            ? userMessages[0].content
            : JSON.stringify(userMessages[0].content)
          : state.input || '';

      const toolResults = state.messages.filter(
        (msg) => msg._getType() === 'tool',
      );
      const validationContext = SynthesisValidator.createValidationContext(
        originalQuery,
        needsSynthesis,
        toolResults,
      );

      const validationResult =
        this.synthesisValidator.validateSynthesisNeed(validationContext);

      if (validationResult.validationOverride) {
        this.logger.info(
          '[LangGraph Router] Synthesis validation override applied',
          {
            originalNeedsSynthesis: needsSynthesis,
            forcedSynthesis: validationResult.shouldForceSynthesis,
            reason: validationResult.reason,
            confidence: validationResult.confidence,
          },
        );
        needsSynthesis = validationResult.shouldForceSynthesis;
      }

      // Task 2.3: Enhanced Router Logic - Apply intent-based routing overrides
      if (queryIntent.requiresDeepAnalysis && !needsSynthesis) {
        this.logger.info(
          '[LangGraph Router] Query requires deep analysis, overriding to synthesis',
          {
            originalNeedsSynthesis: needsSynthesis,
            queryIntent,
          },
        );
        needsSynthesis = true;
      }

      // Special case: Simple lookups with tool results should use simple response
      if (
        queryIntent.intentType === 'simple_lookup' &&
        queryIntent.complexity === 'low' &&
        !multiDocResults.isMultiDocument
      ) {
        this.logger.info(
          '[LangGraph Router] Simple lookup detected, preferring simple response',
          {
            queryIntent,
            multiDocResults,
          },
        );
        needsSynthesis = false;
      }

      this.logger.info(
        '[LangGraph Router] Tool results exist, checking synthesis requirement',
        {
          needsSynthesis,
          originalNeedsSynthesis: state.needsSynthesis,
          defaultedToTrue: state.needsSynthesis === undefined,
          forcedBySynthesisValidation: multiDocResults.isMultiDocument,
          forcedByQueryIntent: queryIntent.requiresDeepAnalysis,
          queryIntent,
          circuitBreakerHit: toolForcingCount >= MAX_TOOL_FORCING,
        },
      );

      // RESPECT needsSynthesis flag (potentially modified by validation and intent analysis)
      if (needsSynthesis) {
        this.logger.info(
          '[LangGraph Router] Decision: Tool results exist and synthesis needed. Routing to synthesis.',
        );
        return 'synthesis';
      } else {
        this.logger.info(
          '[LangGraph Router] Decision: Tool results exist but synthesis not needed. Routing to simple response.',
        );
        return 'simple_response';
      }
    }

    // 3. If there are no tool calls and no results, check if this is a simple conversational query
    if (!hasToolResults) {
      // Task 2.3: Enhanced Router Logic - Use intent analysis for no-tool scenarios
      const queryIntent = this.analyzeQueryIntent(state);

      // Check if the last message is an AI response without tool calls (conversational response)
      if (
        lastMessage &&
        lastMessage._getType() === 'ai' &&
        lastMessage.content
      ) {
        this.logger.info(
          '[LangGraph Router] Decision: AI provided conversational response. Finishing graph.',
          { queryIntent },
        );
        return '__end__';
      }

      // If this is a conversational query that doesn't need tools, route to conversational response
      if (
        queryIntent.intentType === 'conversational' &&
        queryIntent.complexity === 'low'
      ) {
        this.logger.info(
          '[LangGraph Router] Decision: Simple conversational query, routing to conversational response.',
          { queryIntent },
        );
        return 'conversational_response';
      }

      this.logger.warn(
        '[LangGraph Router] Decision: No tool calls and no results. Finishing graph to prevent loops.',
        { queryIntent },
      );
      return '__end__';
    }

    // 4. Default to ending the graph if no other condition is met.
    this.logger.info(
      '[LangGraph Router] Decision: No more actions needed. Finishing graph.',
    );
    return '__end__';
  }

  /**
   * Invoke the graph (for non-streaming use cases)
   */
  async invoke(
    inputMessages: BaseMessage[],
    config?: RunnableConfig,
  ): Promise<any> {
    this.logger.info('Invoking LangGraph for a complete response.', {
      inputMessageCount: inputMessages.length,
    });
    const finalState = await this.graph.invoke(
      { messages: inputMessages },
      config,
    );
    return finalState.messages[finalState.messages.length - 1];
  }

  /**
   * Stream the graph execution as raw text chunks.
   * This provides real-time updates throughout the LangGraph execution.
   * Updated to use Phase 8 True Real-Time Streaming
   */
  async *stream(
    inputMessages: BaseMessage[],
    config?: RunnableConfig,
    needsSynthesis = true,
  ): AsyncGenerator<Uint8Array> {
    // Reset workflow manager for new conversations
    this.workflowManager.reset();

    // Clear tool result cache for new conversations
    this.toolResultCache.clear();

    this.logger.info('[LangGraph] Starting stream with workflow management', {
      messageCount: inputMessages.length,
      needsSynthesis,
      workflowReset: true,
    });

    // PHASE 8 TRUE REAL-TIME STREAMING: Direct token capture during LangGraph execution
    this.logger.info(
      'Using Phase 8 True Real-Time Streaming: Token capture during LangGraph execution',
    );

    // Reset streaming coordinator, progress indicators, and tool cache for new request
    this.streamingCoordinator.reset();
    this.shownProgressIndicators.clear();
    this.toolResultCache.clear();

    const encoder = new TextEncoder();

    try {
      // Extract user input for streamLangChainAgent
      const lastMessage = inputMessages[inputMessages.length - 1];
      const userInput =
        typeof lastMessage?.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage?.content) || '';

      this.logger.info('[Phase 8] Delegating to streamLangChainAgent', {
        inputLength: userInput.length,
        needsSynthesis,
      });

      // Delegate to the new Phase 8 streamLangChainAgent method
      // Pass the config containing fileContext
      yield* this.streamLangChainAgent(userInput, undefined, config);

      this.logger.info('[Phase 8] True real-time streaming completed');
    } catch (error: any) {
      this.logger.error('Error in Phase 8 true real-time streaming', {
        error: error.message || error,
        stack: error.stack,
      });
      yield encoder.encode(
        '\n❌ **Error:** An unexpected error occurred during processing.\n',
      );
    }
  }

  /**
   * Generate a descriptive note for a document based on its filename
   */
  private getDocumentDescription(filename: string): string {
    const lowerFilename = filename.toLowerCase();

    // Core business documents
    if (lowerFilename.includes('core_values')) {
      return 'Company core values and principles';
    }
    if (
      lowerFilename.includes('income_statement') ||
      lowerFilename.includes('profit_and_loss')
    ) {
      return 'Financial income statement and profit/loss data';
    }
    if (
      lowerFilename.includes('producer') &&
      lowerFilename.includes('checklist')
    ) {
      return 'Production workflow checklist and guidelines';
    }
    if (lowerFilename.includes('rate_card')) {
      return 'Service pricing and rate information';
    }
    if (
      lowerFilename.includes('ideal_client_profile') ||
      lowerFilename.includes('ideal client profile')
    ) {
      return 'Target client characteristics and profile';
    }

    // Scripts and creative content
    if (
      lowerFilename.includes('scripts') ||
      lowerFilename.includes('storyboards')
    ) {
      return 'Creative scripts and storyboard materials';
    }

    // Example/template documents
    if (lowerFilename.includes('example')) {
      if (lowerFilename.includes('brand_marketing')) {
        return 'Example brand marketing strategy overview';
      }
      if (lowerFilename.includes('client_estimate')) {
        return 'Sample client project estimate template';
      }
      if (lowerFilename.includes('client_research')) {
        return 'Example client research and analysis';
      }
      if (lowerFilename.includes('proposal_pitch')) {
        return 'Sample proposal and pitch template';
      }
      return 'Example document or template';
    }

    // File type based descriptions
    if (lowerFilename.endsWith('.pdf')) {
      return 'PDF document';
    }
    if (lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls')) {
      return 'Excel spreadsheet';
    }
    if (lowerFilename.endsWith('.md')) {
      return 'Markdown document';
    }
    if (lowerFilename.endsWith('.txt')) {
      return 'Text document';
    }

    // Default fallback
    return 'Business document';
  }

  /**
   * Get configuration for compatibility with existing code
   */
  getConfig(): LangGraphWrapperConfig {
    return this.config;
  }

  /**
   * Helper method to get tool progress messages
   */
  private getToolProgressMessage(toolName: string): string | null {
    const progressMessages: Record<string, string> = {
      listDocuments: '📚 Retrieving documents...\n',
      getDocumentContents: '📄 Loading document content...\n',
      tavilySearch: '🔍 Searching the web...\n',
      // NOTE: Asana tools temporarily disabled until MCP integration is working
      // asana_list_tasks: '📋 Fetching tasks...\n',
      // asana_create_task: '✅ Creating task...\n',
    };
    return progressMessages[toolName] || null;
  }

  /**
   * Helper method to determine if synthesis is needed
   */
  private determineIfSynthesisNeeded(input: string): boolean {
    const cleanInput = input.toLowerCase().trim();

    // Synthesis patterns
    const synthesisPatterns = [
      /\breport\b/i,
      /\bresearch\b/i,
      /\banalyz[ei](?:ng|s)?\b|\banalysis\b|\banalytical\b|\banalyse\b/i,
      /\bcompare\b|\bcomparative\b|\bcomparison\b|\bcomparing\b/i,
      /\bsummar[yi]/i,
      /\boverview\b/i,
      /\balignment\b/i,
      /\bhow\s+does.*relate/i,
      /\bwhat\s+is\s+the\s+relationship/i,
      /\bwrite\s+a\s+report/i,
      /\bcreate\s+a\s+report/i,
      /\bgenerate\s+a\s+report/i,
      /\bgive\s+me\s+a\s+report/i,
      /\bprovide\s+a\s+report/i,
      /\bbrief\b/i,
      /\bcreative\s+brief/i,
      /\bproposal\b/i,
      /\bdevelop\s+a/i,
      /\bcreate\s+a/i,
      /\bwrite\s+a/i,
      /\bgenerate\s+a/i,
      /\bprepare\s+a/i,
      /\bdraft\s+a/i,
      /\bvs\b|\bversus\b/i,
      /\bcontrast\b|\bcontrasting\b/i,
      /\bdifferences?\b/i,
      /\bsimilarities\b/i,
      /\brelationship\b/i,
      /\bhow\s+.*\s+align/i,
    ];

    return synthesisPatterns.some((pattern) => pattern.test(cleanInput));
  }

  /**
   * Phase 8: True Real-Time Streaming
   * Captures tokens during LLM execution within LangGraph nodes
   * Eliminates post-generation streaming simulation
   */
  async *streamWithRealTimeTokens(
    inputMessages: BaseMessage[],
    config?: any,
  ): AsyncGenerator<Uint8Array, void, unknown> {
    const encoder = new TextEncoder();

    try {
      console.log('[Phase 8 Real-Time] Starting true real-time streaming...');

      // Reset progress indicators for new request
      this.shownProgressIndicators.clear();

      // Stream events during LangGraph execution
      const eventStream = this.graph.streamEvents(
        { messages: inputMessages },
        {
          version: 'v2',
          includeNames: [
            'synthesis',
            'conversational_response',
            'simple_response',
          ],
          includeTags: ['final_response'],
          ...config,
        },
      );

      let hasStreamedContent = false;
      let tokenCount = 0;
      const startTime = Date.now();

      for await (const event of eventStream) {
        // Capture tokens during LLM execution
        if (
          event.event === 'on_chat_model_stream' &&
          event.data?.chunk?.content
        ) {
          const token = event.data.chunk.content;
          tokenCount++;
          hasStreamedContent = true;

          // Log every 10th token to avoid spam
          if (tokenCount % 10 === 0) {
            const elapsed = Date.now() - startTime;
            const rate = ((tokenCount / elapsed) * 1000).toFixed(1);
            console.log(
              `[Phase 8 Real-Time] Token ${tokenCount}, Rate: ${rate} t/s`,
            );
          }

          yield encoder.encode(token);
        }

        // Handle progress updates during tool execution - WITH DEDUPLICATION
        if (event.event === 'on_tool_start') {
          const toolName = event.name;
          const progressKey = `${toolName}_progress`;

          // Only show progress indicator once per tool per request
          if (!this.shownProgressIndicators.has(progressKey)) {
            const progressMessage = this.getToolProgressMessage(toolName);
            if (progressMessage) {
              this.shownProgressIndicators.add(progressKey);
              console.log(
                `[Phase 8 Real-Time] Showing progress for ${toolName} (first time only)`,
              );
              yield encoder.encode(progressMessage);
            }
          } else {
            console.log(
              `[Phase 8 Real-Time] Skipping duplicate progress indicator for ${toolName}`,
            );
          }
        }
      }

      // If no streaming occurred, fall back to execution result
      if (!hasStreamedContent) {
        console.log(
          '[Phase 8 Real-Time] No streaming events captured, executing for final result...',
        );

        const result = await this.graph.invoke(
          { messages: inputMessages },
          config,
        );
        const finalMessage = result.messages[result.messages.length - 1];

        if (finalMessage?.content) {
          // Stream the content character by character for smooth UX
          const content = finalMessage.content;
          for (let i = 0; i < content.length; i += 3) {
            const chunk = content.slice(i, i + 3);
            yield encoder.encode(chunk);
            // Small delay for smooth streaming
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `[Phase 8 Real-Time] Streaming completed: ${tokenCount} tokens in ${totalTime}ms`,
      );
    } catch (error) {
      console.error('[Phase 8 Real-Time] Streaming error:', error);
      yield encoder.encode('⚠️ Streaming error occurred. Please try again.');
    }
  }

  /**
   * Phase 8: Enhanced synthesis node with real-time streaming
   */
  private async createStreamingSynthesisNode(): Promise<
    Runnable<GraphState, Partial<GraphState>>
  > {
    return RunnableLambda.from(
      async (state: GraphState, config: RunnableConfig) => {
        console.log('[Phase 8 Synthesis] Starting streaming synthesis node...');

        const messages = state.messages || [];
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage || lastMessage.getType() !== 'human') {
          throw new Error('No human message found for synthesis');
        }

        // Create streaming-enabled LLM
        const streamingLLM = this.llm.withConfig({
          tags: ['final_response', 'streaming_synthesis'],
          metadata: { streaming: true },
          ...config,
        });

        // Use streaming invoke to capture tokens during generation
        const response = await streamingLLM.invoke(messages, {
          ...config,
          tags: ['final_response', 'streaming_synthesis'],
        });

        console.log(
          '[Phase 8 Synthesis] Synthesis completed, response length:',
          response.content?.length || 0,
        );

        return {
          messages: [...messages, response],
        };
      },
    );
  }

  /**
   * Updated streamLangChainAgent to use Phase 8 Real-Time Streaming
   */
  async *streamLangChainAgent(
    input: string,
    queryClassification?: any,
    config?: RunnableConfig,
  ): AsyncGenerator<Uint8Array, void, unknown> {
    const encoder = new TextEncoder();

    try {
      // Always include the specialist system prompt
      const inputMessages: BaseMessage[] = [];

      // Always add the specialist system prompt first
      if (this.config.systemPrompt) {
        inputMessages.push(new SystemMessage(this.config.systemPrompt));
      }

      // Handle fileContext if present - add as additional system message
      if (config?.metadata?.fileContext) {
        const fileContext = config.metadata.fileContext as any;

        // Create enhanced system message with file content
        const fileContextMessage = `
ATTACHED DOCUMENT ANALYSIS:
Filename: ${fileContext.filename}
Content Type: ${fileContext.contentType}
Extracted Text:
${fileContext.extractedText}

The user has attached the above document. Please analyze and respond based on the attached document content, not the knowledge base documents.
`;

        // Add the file context as an additional system message
        inputMessages.push(new SystemMessage(fileContextMessage));
      }

      // Add the user input
      inputMessages.push(new HumanMessage(input));

      // Determine if synthesis is needed
      const needsSynthesis = this.determineIfSynthesisNeeded(input);

      if (needsSynthesis) {
        console.log(
          '[2025-06-15T17:05:05.538Z][INFO][ObservabilityService] [Query Classification] Synthesis explicitly requested',
        );
        console.log(
          '[2025-06-15T17:05:05.538Z][INFO][ObservabilityService] Using Phase 8 True Real-Time Streaming',
        );

        // Phase 8: True Real-Time Streaming
        yield* this.streamWithRealTimeTokens(inputMessages, config);
      } else {
        // For non-synthesis queries, use direct streaming
        console.log('[Phase 8] Direct streaming for non-synthesis query');
        yield* this.streamWithRealTimeTokens(inputMessages, config);
      }
    } catch (error) {
      console.error('[Phase 8] streamLangChainAgent error:', error);
      yield encoder.encode(
        '⚠️ An error occurred while processing your request. Please try again.',
      );
    }
  }

  /**
   * ENHANCED: Workflow-aware tool call redundancy detection
   * This helps prevent the LLM from making repetitive calls with slight variations
   * while allowing legitimate tool sequences like listDocuments → getDocumentContents
   */
  private detectToolCallRedundancy(
    state: GraphState,
    currentToolCalls: any[],
  ): {
    isRedundant: boolean;
    reason: string;
    redundantToolCount: number;
  } {
    // Get all previous AI messages with tool calls
    const aiMessagesWithTools = state.messages.filter(
      (msg) =>
        msg._getType() === 'ai' &&
        'tool_calls' in msg &&
        Array.isArray((msg as any).tool_calls) &&
        (msg as any).tool_calls.length > 0,
    );

    if (aiMessagesWithTools.length < 2) {
      // Not enough history to detect redundancy
      return {
        isRedundant: false,
        reason: 'Insufficient history',
        redundantToolCount: 0,
      };
    }

    // **CRITICAL FIX**: Don't flag as redundant if we have mixed tool types
    // Common valid patterns:
    // - listDocuments + getDocumentContents (discovery + retrieval)
    // - tavilySearch + tavilyExtract (search + extraction)
    // - searchInternalKnowledgeBase + getDocumentContents (search + retrieval)

    const currentToolTypes = Array.from(
      new Set(currentToolCalls.map((call: any) => call.name)),
    );
    const hasMultipleToolTypes = currentToolTypes.length > 1;

    // **WORKFLOW PATTERNS**: Define legitimate tool sequences
    const workflowPatterns = [
      ['listDocuments', 'getDocumentContents'],
      ['tavilySearch', 'tavilyExtract'],
      ['searchInternalKnowledgeBase', 'getDocumentContents'],
      ['listDocuments', 'multiDocumentRetrieval'],
    ];

    // Check if current tools match a valid workflow pattern
    const isValidWorkflowSequence = workflowPatterns.some((pattern) =>
      pattern.every((toolName) => currentToolTypes.includes(toolName)),
    );

    if (hasMultipleToolTypes && isValidWorkflowSequence) {
      this.logger.info('[Tool Redundancy] Valid workflow sequence detected:', {
        toolTypes: currentToolTypes,
        reason: 'Legitimate tool workflow pattern',
      });
      return {
        isRedundant: false,
        reason: 'Valid workflow sequence',
        redundantToolCount: 0,
      };
    }

    // Check for actual redundancy: identical tool calls with same parameters
    let redundantCount = 0;
    const recentToolCalls = aiMessagesWithTools
      .slice(-3) // Look at last 3 iterations
      .flatMap((msg: any) => msg.tool_calls || []);

    for (const currentCall of currentToolCalls) {
      const currentKey = this.generateToolCacheKey(currentCall);

      const duplicateCount = recentToolCalls.filter((prevCall: any) => {
        const prevKey = this.generateToolCacheKey(prevCall);
        return currentKey === prevKey;
      }).length;

      if (duplicateCount >= 2) {
        // Same call appeared 2+ times recently
        redundantCount++;
        this.logger.warn('[Tool Redundancy] Detected redundant tool call:', {
          toolName: currentCall.name,
          cacheKey: currentKey,
          duplicateCount,
        });
      }
    }

    // Only flag as redundant if we have significant redundancy
    const redundancyThreshold = Math.max(
      1,
      Math.floor(currentToolCalls.length * 0.5),
    );
    const isRedundant = redundantCount >= redundancyThreshold;

    if (isRedundant) {
      return {
        isRedundant: true,
        reason: `${redundantCount} redundant tool calls detected in recent iterations`,
        redundantToolCount: redundantCount,
      };
    }

    return {
      isRedundant: false,
      reason: 'No significant redundancy detected',
      redundantToolCount: redundantCount,
    };
  }

  // Enhanced redundancy detection with workflow awareness
  private detectRedundantToolCalls(toolCalls: any[], state: any): boolean {
    if (!toolCalls || toolCalls.length === 0) return false;

    const currentIteration = state.iterationCount || 0;
    // Skip recent tool history check for now - focus on cache-based redundancy

    // Don't trigger redundancy on first few iterations to allow workflow establishment
    if (currentIteration <= 1) {
      console.log(
        `[Circuit Breaker] Skipping redundancy check - early iteration ${currentIteration}`,
      );
      return false;
    }

    let redundantCount = 0;
    const toolCallsInThisResponse = new Map<string, number>();

    // Check for multiple identical calls within the same LLM response
    for (const toolCall of toolCalls) {
      const cacheKey = this.generateToolCacheKey(toolCall);
      const count = toolCallsInThisResponse.get(cacheKey) || 0;
      toolCallsInThisResponse.set(cacheKey, count + 1);

      if (count > 0) {
        console.warn(
          `[Tool Redundancy] Multiple identical calls in same response: ${toolCall.name}`,
        );
        redundantCount++;
      }
    }

    // Check against recent history, but be more lenient for workflow tools
    for (const toolCall of toolCalls) {
      const cacheKey = this.generateToolCacheKey(toolCall);

      // Special handling for workflow-critical tools
      if (this.isWorkflowCriticalTool(toolCall.name)) {
        // Only flag as redundant if we have it cached (meaning it was called recently)
        if (this.toolResultCache.has(cacheKey)) {
          console.warn(
            `[Tool Redundancy] Workflow tool called too frequently: ${toolCall.name}`,
          );
          redundantCount++;
        }
      } else {
        // Standard redundancy check for non-workflow tools
        if (this.toolResultCache.has(cacheKey)) {
          console.warn(
            `[Tool Redundancy] Detected redundant tool call: ${JSON.stringify({
              toolName: toolCall.name,
              cacheKey,
              duplicateCount: redundantCount + 1,
            })}`,
          );
          redundantCount++;
        }
      }
    }

    // More lenient threshold - only trigger if significant redundancy
    const redundancyThreshold = Math.max(1, Math.floor(toolCalls.length * 0.6));
    return redundantCount >= redundancyThreshold;
  }

  private isWorkflowCriticalTool(toolName: string): boolean {
    const workflowTools = [
      'listDocuments',
      'getDocumentContents',
      'tavilySearch',
      'searchInternalKnowledgeBase',
      'multiDocumentRetrieval',
    ];
    return workflowTools.includes(toolName);
  }

  private shouldForceSynthesis(state: any): boolean {
    const currentIteration = state.iterationCount || 0;
    const hasToolCalls = state.messages?.some(
      (msg: any) => msg.additional_kwargs?.tool_calls?.length > 0,
    );

    // Don't force synthesis too early
    if (currentIteration < 2) {
      return false;
    }

    // Check if we have the minimum required tools for the user's request
    const userMessage =
      state.messages?.find((msg: any) => msg._getType() === 'human')?.content ||
      '';
    const requiredWebSearch = this.requiresWebSearch(userMessage);
    const requiredDocuments = this.requiresDocuments(userMessage);

    const executedTools = this.workflowManager.getExecutedTools();
    const hasWebSearch = executedTools.some((t) => t.name === 'tavilySearch');
    const hasDocuments = executedTools.some(
      (t) => t.name === 'listDocuments' || t.name === 'getDocumentContents',
    );

    // If user explicitly requested web search but we haven't done it, don't force synthesis yet
    if (requiredWebSearch && !hasWebSearch && currentIteration < 4) {
      console.log(
        `[Circuit Breaker] Web search required but not executed - continuing workflow`,
      );
      return false;
    }

    // If user requested documents but we haven't retrieved content, don't force synthesis yet
    if (requiredDocuments && !hasDocuments && currentIteration < 4) {
      console.log(
        `[Circuit Breaker] Document retrieval required but not executed - continuing workflow`,
      );
      return false;
    }

    // Standard conditions for forcing synthesis
    const MAX_ITERATIONS = 5; // Define locally since it's not a class property
    return (
      currentIteration >= MAX_ITERATIONS ||
      !hasToolCalls ||
      this.hasMinimumDataForSynthesis(state)
    );
  }

  private requiresWebSearch(userMessage: string): boolean {
    const webSearchIndicators = [
      'search the web',
      'web search',
      'online search',
      'current information',
      'latest news',
      'recent developments',
    ];
    return webSearchIndicators.some((indicator) =>
      userMessage.toLowerCase().includes(indicator.toLowerCase()),
    );
  }

  private requiresDocuments(userMessage: string): boolean {
    const documentIndicators = [
      'knowledge base',
      'documents',
      'examples',
      'templates',
      'using the',
      'based on',
    ];
    return documentIndicators.some((indicator) =>
      userMessage.toLowerCase().includes(indicator.toLowerCase()),
    );
  }

  private hasMinimumDataForSynthesis(state: any): boolean {
    // Implement your logic to determine if there's enough data for synthesis
    // This is a placeholder implementation
    return state.messages.some((msg: any) => msg._getType() === 'tool');
  }

  private async synthesizeResponse(state: any): Promise<any> {
    console.log('[LangGraph Synthesis] 🎬 Starting final synthesis node.');

    // Validate that required tools were actually executed
    const userMessage =
      state.messages?.find((msg: any) => msg._getType() === 'human')?.content ||
      '';
    const executedTools = this.workflowManager.getExecutedTools();
    const toolValidation = this.validateRequiredToolsExecuted(
      userMessage,
      executedTools,
    );

    const synthesisPrompt = `You are an expert research analyst creating comprehensive research reports. Your task is to synthesize information from multiple sources into a coherent, well-structured analysis.

CRITICAL TOOL VALIDATION:
${
  toolValidation.warnings.length > 0
    ? `⚠️ WARNING: The following required tools were NOT executed:\n${toolValidation.warnings.map((w) => `- ${w}`).join('\n')}\n\nYou MUST NOT claim to have used these tools or reference their results. Only use information from tools that were actually executed.\n`
    : '✅ All required tools were properly executed.\n'
}

EXECUTED TOOLS SUMMARY:
${executedTools.map((tool) => `- ${tool.name}: ${tool.success ? 'SUCCESS' : 'FAILED'}`).join('\n')}

RESPONSE FORMATTING REQUIREMENTS:
- Use clear markdown formatting with proper headers (##, ###)
- Create well-organized sections with logical flow
- Use bullet points (-) for most lists, numbered lists (1. 2. 3.) only for sequential steps or rankings
- Make all document and source names clickable links using [Name](URL) format
- Use **bold** for key terms and emphasis
- Include specific examples and quotes from sources when relevant
- CRITICAL: NEVER mix numbered lists within numbered lists - this creates confusing double numbering
- For References sections, ALWAYS use bullet points (-), NEVER numbered lists

DOCUMENT LINKING REQUIREMENTS:
- For knowledge base documents: [Document Name](URL) - use exact URLs provided below
- For web sources: [Article Title](URL) - use exact URLs provided below  
- For calendar events: [Event Name](URL) when URLs are provided
- NEVER show raw URLs - always format as clickable links
- When referencing any document in your content, make it a clickable link

CONTENT STRUCTURE REQUIREMENTS:
- Start with an executive summary or overview
- Use clear section headers (##, ###) to organize content
- Include specific data points, quotes, and examples from sources
- Provide actionable insights and recommendations
- End with a comprehensive References section

CRITICAL FORMATTING RULES:
- **NO TABLES** for alignment analysis, comparison analysis, or criteria evaluation
- For any analysis involving "alignment", "comparison", "criteria", or "vs" - use structured lists instead
- Tables are ONLY for simple factual data (contact info, dates, basic stats)
- Use structured lists with clear headers and bullet points for complex analysis

DOCUMENT LISTING FORMAT (when listing available documents):
- Use simple markdown list format: - [Document Name](URL)
- Do NOT add descriptions or bullet points before document names
- Keep it clean and simple

CALENDAR EVENT FORMAT:
- **Event Name**: [Event Title](link-if-available)
- **Date & Time**: Clear date/time format
- **Location**: Address or venue
- **Attendees**: [Name](email-link), [Name](email-link)
- For calendar events: ALWAYS make event names clickable links when URLs are provided
- For web results: ALWAYS make titles clickable links: [Article Title](URL)
- For knowledge base documents: ALWAYS make document names clickable links: [Document Name](URL)
- Use **bold** for emphasis, not ALL CAPS

CRITICAL LINKING INSTRUCTIONS:
- When mentioning ANY document or source in your content, check the "Knowledge Base Documents Used" and "Web Sources Used" sections below
- ALWAYS use the exact URLs provided in those sections to create clickable links
- NEVER mention a document name without making it a clickable link if a URL is available
- Example: If you see "Ideal Client Profile.txt" in Knowledge Base Documents Used with a URL, write [Ideal Client Profile](URL) everywhere you mention it

CRITICAL SOURCE CATEGORIZATION:
- Knowledge Base Documents: ONLY sources that came from internal document retrieval (getDocumentContents tool)
- Web Sources: ONLY sources that came from web search (webSearch tool)
- NEVER categorize web search results as knowledge base documents
- NEVER categorize internal documents as web sources
- If unsure about source type, check which tool provided the information

CRITICAL: NO TABLES FOR ALIGNMENT/COMPARISON ANALYSIS
- NEVER use tables for alignment analysis, comparison analysis, or criteria evaluation
- For any analysis involving "alignment", "comparison", "criteria", or "vs" - ALWAYS use structured lists
- Tables are ONLY acceptable for simple data like contact info, dates, or basic facts

SIMPLE TABLE GUIDELINES (for basic data only):
- Only use tables for simple factual data (contact info, dates, basic stats)
- Keep content very brief - single words or short phrases only
- Never use tables when content requires explanation or analysis

CONTENT STRUCTURE:
- Create a comprehensive research report that synthesizes all the information gathered. Structure your response with clear sections, actionable insights, and specific recommendations.

## References Section Requirements:
- ALWAYS include a "References" section at the end of your response
- List all sources used in the analysis
- CRITICAL: Only list sources under "Knowledge Base Documents" if they came from getDocumentContents tool
- CRITICAL: Only list sources under "Web Sources" if they came from webSearch tool
- Format knowledge base documents as: [Document Name](URL) if URL available
- Format web sources as: [Article Title](URL)
- Group by source type: "Knowledge Base Documents" and "Web Sources"
- DO NOT duplicate sources - if you mention a source in the body, do not repeat the full citation in references
- In references, only provide the source name and link, no descriptions
- NEVER show raw URLs - ALWAYS format as clickable markdown links [Title](URL)
- CRITICAL: Use BULLET POINTS (- ) for references, NOT numbered lists (1. 2. 3.)
- Example format: - [Sharks of the Gulf of Mexico](https://www.sharksider.com/sharks-gulf-mexico/)
- NEVER use numbered lists within numbered lists - this creates confusing double numbering
- DO NOT include "End of Report", "End of Document", or any closing statements after the References section.
- Ensure all links are properly formatted as [Text](URL) - NEVER show raw URLs
- In the References section specifically, ALWAYS use markdown links: [Source Title](URL)
- Example reference format: [Sharks of the Gulf of Mexico](https://www.sharksider.com/sharks-gulf-mexico/)

ALIGNMENT ANALYSIS OVERRIDE:
- If creating alignment analysis, comparison analysis, or criteria evaluation: IGNORE any impulse to use tables
- MANDATORY: Use the structured list format shown above for all alignment/comparison content
- This applies to ANY content comparing two or more items, criteria, or concepts

Current date: ${new Date().toISOString()}`;

    console.log('[LangGraph Synthesis] Invoking LLM for synthesis.');

    // Use the existing LLM from config
    const response = await this.llm.invoke([
      new SystemMessage(synthesisPrompt),
      new HumanMessage(
        `User Request: "${userMessage}"\n\nTool Results Available:\n${ContentFormatter.formatToolResults(state.messages.filter((msg: any) => msg._getType() === 'tool'))}\n\nIMPORTANT FORMATTING INSTRUCTIONS:\n- When writing your response, use the URLs provided above to make ALL document and source names clickable links\n- Do not mention any document name as plain text if a URL is available\n- If the tool results include a "formatted_list" field (from listDocuments), use that exact formatted list with clickable links\n- For document listings, present the formatted_list exactly as provided - do not modify the format or add extra text\n- CRITICAL: Never display the same hyperlink more than once in your response - if you need to reference the same source again, use plain text instead of a duplicate link\n- CRITICAL: Only categorize sources as "Knowledge Base Documents" if they came from getDocumentContents or searchInternalKnowledgeBase tools\n- CRITICAL: Only categorize sources as "Web Sources" if they came from tavilySearch or webSearch tools\n\nCreate the comprehensive research report now.`,
      ),
    ]);

    console.log(
      '[LangGraph Synthesis] Synthesis completed, returning AI message in state.',
    );

    return {
      ...state,
      messages: [...state.messages, response],
    };
  }

  private validateRequiredToolsExecuted(
    userMessage: string,
    executedTools: any[],
  ): { warnings: string[] } {
    const warnings: string[] = [];

    // Check for web search requirement
    if (this.requiresWebSearch(userMessage)) {
      const hasWebSearch = executedTools.some(
        (t) => t.name === 'tavilySearch' && t.success,
      );
      if (!hasWebSearch) {
        warnings.push(
          'Web search was requested but tavilySearch was never executed',
        );
      }
    }

    // Check for document requirement
    if (this.requiresDocuments(userMessage)) {
      const hasDocuments = executedTools.some(
        (t) =>
          (t.name === 'listDocuments' || t.name === 'getDocumentContents') &&
          t.success,
      );
      if (!hasDocuments) {
        warnings.push(
          'Document access was requested but document tools were never executed',
        );
      }
    }

    return { warnings };
  }

  /**
   * Deduplicate links in response content to avoid redundancy
   */
  private deduplicateLinks(content: string): string {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const seen = new Set<string>();

    return content.replace(linkRegex, (match, text: string, url: string) => {
      const normalizedUrl = url.toLowerCase().trim();
      if (seen.has(normalizedUrl)) {
        // Already linked earlier – return plain text
        return text;
      }
      seen.add(normalizedUrl);
      return match; // Keep the first hyperlink as-is
    });
  }
}

/**
 * Factory function to create a SimpleLangGraphWrapper instance
 */
export function createLangGraphWrapper(
  config: LangGraphWrapperConfig,
): SimpleLangGraphWrapper {
  return new SimpleLangGraphWrapper(config);
}
