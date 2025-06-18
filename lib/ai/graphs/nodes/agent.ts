/**
 * Agent Node - Decision Making and Tool Usage
 *
 * This node handles the core agent functionality including:
 * - Analyzing user queries
 * - Deciding when to use tools
 * - Processing tool results
 * - Making final response decisions
 *
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
 * - Extracts execution plan from graph state metadata
 * - Guides tool usage based on strategic planning
 * - Implements Plan-and-Execute pattern for improved efficiency
 */

import type { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';
import { getLastHumanMessage, hasToolCalls } from '../state';
import { loadGraphPrompt } from '../prompts/loader';
import type { DocumentAnalysisService } from '../services/DocumentAnalysisService';
import type { ContextService } from '../services/ContextService';
import type { QueryAnalysisService } from '../services/QueryAnalysisService';
// NEW: Import ExecutionPlan type for strategic planning
import type { ExecutionPlan } from '../services/PlannerService';

/**
 * Dependencies injected into the agent node
 */
export interface AgentNodeDependencies {
  llm: ChatOpenAI;
  tools: any[];
  logger: RequestLogger;
  currentDateTime?: string;
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
  // NEW: Service dependencies for business logic
  documentService?: DocumentAnalysisService;
  contextService?: ContextService;
  queryService?: QueryAnalysisService;
}

/**
 * Agent node function - core decision-making logic
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION
 */
export async function agentNode(
  state: GraphState,
  dependencies: AgentNodeDependencies,
): Promise<Partial<GraphState>> {
  const {
    llm,
    tools,
    logger,
    currentDateTime,
    clientConfig,
    documentService,
    contextService,
    queryService,
  } = dependencies;

  const startTime = Date.now();

  // NEW: Extract execution plan from state metadata
  const executionPlan = extractExecutionPlan(state);

  logger.info('[Agent] Node execution started with strategic context', {
    messageCount: state.messages.length,
    toolsAvailable: tools.length,
    currentIteration: state.iterationCount || 0,
    hasExistingTrace: !!state.node_execution_trace?.length,
    hasExecutionPlan: !!executionPlan,
    planType: executionPlan?.task_type || 'none',
    externalTopics: executionPlan?.external_research_topics?.length || 0,
    internalDocs: executionPlan?.required_internal_documents?.length || 0,
  });

  // NEW: Log execution plan guidance if available
  if (executionPlan && state.iterationCount === 1) {
    logger.info('[Agent] Strategic execution plan guidance', {
      taskType: executionPlan.task_type,
      requiredDocs: executionPlan.required_internal_documents,
      externalResearch: executionPlan.external_research_topics,
      outputFormat: executionPlan.final_output_format,
    });
  }

  try {
    // USE SERVICES: Optimize context if service available
    let optimizedMessages = state.messages;
    if (contextService) {
      const optimization = contextService.optimizeContext(state);
      optimizedMessages = optimization.optimizedMessages;

      logger.info('[Agent] Context optimized by service', {
        originalMessages: optimization.optimization.originalMessageCount,
        optimizedMessages: optimization.optimization.optimizedMessageCount,
        strategiesApplied: optimization.optimization.strategiesApplied,
      });
    }

    // USE SERVICES: Analyze query for better decision making
    let responseMode = state.response_mode;
    if (queryService && !responseMode) {
      const queryAnalysis = queryService.analyzeQuery(state);

      if (queryAnalysis.intent.suggestedResponseStyle === 'analytical') {
        responseMode = 'synthesis';
      } else if (
        queryAnalysis.intent.suggestedResponseStyle === 'conversational'
      ) {
        responseMode = 'conversational';
      } else {
        responseMode = 'simple';
      }

      logger.info('[Agent] Query analyzed by service', {
        complexity: queryAnalysis.complexity.level,
        intent: queryAnalysis.intent.primary,
        responseMode,
      });
    } else {
      // Fallback to original logic if no service or mode already set
      responseMode = responseMode || determineAgentResponseMode(state);
    }

    // NEW: Load the appropriate agent prompt with execution plan context
    const agentPrompt = await loadGraphPrompt({
      nodeType: 'agent',
      state: { ...state, messages: optimizedMessages },
      currentDateTime: currentDateTime || new Date().toISOString(),
      responseMode,
      availableTools: tools.map((tool) => tool.name),
      clientConfig,
      executionPlan, // NEW: Pass execution plan to prompt loading
    });

    // Prepare the conversation with system prompt and optimized messages
    const messages = [new SystemMessage(agentPrompt), ...optimizedMessages];

    // Bind tools to the model for tool calling capability
    const modelWithTools = llm.bindTools(tools);

    logger.info('[Agent] Invoking LLM with strategic guidance', {
      toolCount: tools.length,
      messageCount: messages.length,
      responseMode,
      hasExecutionPlan: !!executionPlan,
      planGuidance: executionPlan
        ? `${executionPlan.task_type} task with ${executionPlan.external_research_topics.length} external topics`
        : 'no plan available',
    });

    // Get the agent's response
    const response = await modelWithTools.invoke(messages);

    const duration = Date.now() - startTime;

    // Log the agent's decision
    const hasToolCallsInResponse = !!(response as AIMessage).tool_calls?.length;
    logger.info('[Agent] Response generated with strategic context', {
      hasToolCalls: hasToolCallsInResponse,
      toolCallCount: (response as AIMessage).tool_calls?.length || 0,
      duration,
      responseMode,
      planAlignment: executionPlan
        ? assessPlanAlignment(response as AIMessage, executionPlan)
        : 'no plan',
    });

    // Update workflow state based on tool calls
    const updatedWorkflowState = updateWorkflowState(
      state.tool_workflow_state,
      response as AIMessage,
    );

    return {
      messages: [response],
      agent_outcome: response as AIMessage,
      response_mode: responseMode,
      node_execution_trace: [...(state.node_execution_trace || []), 'agent'],
      iterationCount: (state.iterationCount || 0) + 1,
      tool_workflow_state: updatedWorkflowState,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('[Agent] Node execution failed', {
      error: errorMessage,
      duration,
      stack: errorStack,
    });

    // Return error state but allow graph to continue
    return {
      messages: [
        new AIMessage(
          'I encountered an error while processing your request. Please try again.',
        ),
      ],
      node_execution_trace: [
        ...(state.node_execution_trace || []),
        'agent_error',
      ],
      iterationCount: (state.iterationCount || 0) + 1,
    };
  }
}

/**
 * NEW: Extract execution plan from graph state metadata
 */
function extractExecutionPlan(state: GraphState): ExecutionPlan | undefined {
  // The execution plan is passed through the RunnableConfig metadata
  // This is set in the langchainBridge when streaming starts
  if (state.metadata?.executionPlan) {
    return state.metadata.executionPlan as ExecutionPlan;
  }

  // Fallback: check if it's in the state directly (for testing)
  if ((state as any).executionPlan) {
    return (state as any).executionPlan as ExecutionPlan;
  }

  return undefined;
}

/**
 * NEW: Assess how well the agent's response aligns with the execution plan
 */
function assessPlanAlignment(response: AIMessage, plan: ExecutionPlan): string {
  const toolCalls = response.tool_calls || [];
  const toolNames = toolCalls.map((call) => call.name);

  let alignment = 'good';
  const issues: string[] = [];

  // Check if external research is needed but not requested
  if (
    plan.external_research_topics.length > 0 &&
    !toolNames.includes('tavilySearch')
  ) {
    issues.push('missing_external_research');
    alignment = 'partial';
  }

  // Check if internal documents are needed but not requested
  if (
    plan.required_internal_documents.length > 0 &&
    !toolNames.some((name) =>
      ['listDocuments', 'getDocumentContents', 'getMultipleDocuments'].includes(
        name,
      ),
    )
  ) {
    issues.push('missing_internal_docs');
    alignment = 'partial';
  }

  // Check for unnecessary tools based on plan
  if (plan.task_type === 'simple_qa' && toolCalls.length > 0) {
    issues.push('unnecessary_tools');
    alignment = 'partial';
  }

  if (issues.length > 2) {
    alignment = 'poor';
  }

  return issues.length > 0 ? `${alignment} (${issues.join(', ')})` : alignment;
}

/**
 * Determine the appropriate response mode for the agent
 */
function determineAgentResponseMode(
  state: GraphState,
): 'synthesis' | 'simple' | 'conversational' {
  // Use existing response mode if set
  if (state.response_mode) {
    return state.response_mode;
  }

  const userQuery = getLastHumanMessage(state);
  const queryLower = userQuery.toLowerCase();

  // Analysis indicators suggest synthesis
  const analysisKeywords = [
    'analyze',
    'analysis',
    'research',
    'compare',
    'comparison',
    'evaluate',
    'report',
    'comprehensive',
    'detailed',
    'investigate',
    'summarize',
    'synthesis',
    'assessment',
  ];

  if (analysisKeywords.some((keyword) => queryLower.includes(keyword))) {
    return 'synthesis';
  }

  // Conversational indicators
  const conversationalKeywords = [
    'chat',
    'discuss',
    'talk about',
    'tell me about',
    'what do you think',
    'opinion',
    'recommend',
    'suggest',
    'advice',
    'help me understand',
  ];

  if (conversationalKeywords.some((keyword) => queryLower.includes(keyword))) {
    return 'conversational';
  }

  // Check if we have tool results that suggest complexity
  const toolMessages = state.messages.filter(
    (msg) => msg._getType?.() === 'tool',
  );
  if (toolMessages.length > 1) {
    return 'synthesis';
  }

  // Default to simple
  return 'simple';
}

/**
 * Update the workflow state based on the agent's tool calls
 */
function updateWorkflowState(
  currentWorkflowState: any,
  agentResponse: AIMessage,
): any {
  if (!agentResponse.tool_calls?.length) {
    return currentWorkflowState;
  }

  const updatedState = { ...currentWorkflowState };

  // Track which tools the agent is about to execute
  agentResponse.tool_calls.forEach((toolCall) => {
    switch (toolCall.name) {
      case 'listDocuments':
        // Agent is going to list documents
        break;
      case 'getDocumentContents':
        // Agent is going to retrieve specific documents
        break;
      case 'tavilySearch':
        // Agent is going to perform web search
        break;
      case 'multiDocumentRetrieval':
        // Agent is going to perform multi-document analysis
        break;
    }
  });

  return updatedState;
}

/**
 * Enhanced workflow state update with service data
 */
function updateWorkflowStateWithServices(
  currentWorkflowState: any,
  agentResponse: AIMessage,
  serviceData: {
    queryAnalysis?: any;
    documentScenario?: any;
    contextOptimization?: any;
  },
): any {
  // Start with base workflow update
  const updatedState = updateWorkflowState(currentWorkflowState, agentResponse);

  // Add service insights
  if (serviceData.queryAnalysis) {
    updatedState.queryComplexity = serviceData.queryAnalysis.complexity.level;
    updatedState.detectedIntent = serviceData.queryAnalysis.intent.primary;
    updatedState.recommendedTools = serviceData.queryAnalysis.toolsToUse;
  }

  if (serviceData.documentScenario) {
    updatedState.isMultiDocumentScenario =
      serviceData.documentScenario.isMultiDocument;
    updatedState.documentsFound = serviceData.documentScenario.documentsFound;
    updatedState.requiresSpecialHandling =
      serviceData.documentScenario.requiresSpecialHandling;
  }

  if (serviceData.contextOptimization) {
    updatedState.contextOptimized = true;
    updatedState.optimizationStrategies =
      serviceData.contextOptimization.strategiesApplied;
    updatedState.tokensSaved =
      serviceData.contextOptimization.tokensEstimate.saved;
  }

  return updatedState;
}

/**
 * Validate agent node configuration
 */
export function validateAgentNode(dependencies: AgentNodeDependencies): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!dependencies.llm) {
    issues.push('LLM is required for agent node');
  }

  if (!dependencies.tools || dependencies.tools.length === 0) {
    issues.push('At least one tool is required for agent node');
  }

  if (!dependencies.logger) {
    issues.push('Logger is required for agent node');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Development helper to analyze agent decisions
 */
export function analyzeAgentDecision(
  state: GraphState,
  agentResponse: AIMessage,
): {
  decision: 'use_tools' | 'final_response';
  toolsRequested: string[];
  reasoning: string;
} {
  const hasTools = !!agentResponse.tool_calls?.length;

  if (hasTools) {
    return {
      decision: 'use_tools',
      toolsRequested: agentResponse.tool_calls?.map((tc) => tc.name) || [],
      reasoning: `Agent requested ${agentResponse.tool_calls?.length} tool(s) to gather more information`,
    };
  }

  return {
    decision: 'final_response',
    toolsRequested: [],
    reasoning:
      'Agent provided final response without requesting additional tools',
  };
}
