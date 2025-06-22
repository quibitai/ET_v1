/**
 * Graph Prompt Loader Service
 *
 * This service handles loading and formatting of LangGraph-specific prompts.
 * It works alongside the existing specialist prompt system but focuses on
 * graph node execution prompts rather than specialist personas.
 *
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
 * - Supports execution plan context in prompt loading
 * - Passes strategic planning information to agent prompts
 * - Enables Plan-and-Execute pattern for improved agent performance
 */

import { formatAgentPrompt } from './agent.prompt';
import { formatSimpleResponsePrompt } from './simpleResponse.prompt';
import {
  UnifiedSystemPromptManager,
  type PromptContext,
} from '../../services/UnifiedSystemPromptManager';
import type { GraphState } from '../state';
import { getLastHumanMessage, getToolMessages } from '../state';
// NEW: Import ExecutionPlan type for strategic planning
import type { ExecutionPlan } from '../services/PlannerService';

/**
 * Enhanced parameters for graph prompt loading
 */
export interface GraphPromptParams {
  nodeType: 'agent' | 'synthesis' | 'simple' | 'conversational';
  state?: GraphState;
  currentDateTime?: string;
  responseType?:
    | 'synthesis'
    | 'simple'
    | 'conversational'
    | 'document_list'
    | 'content'
    | 'generic';
  availableTools?: string[];
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
  // NEW: Execution plan for strategic guidance
  executionPlan?: ExecutionPlan;
}

/**
 * Load a graph-specific prompt for a given node type
 * NOW ENHANCED WITH EXECUTION PLAN SUPPORT
 */
export async function loadGraphPrompt({
  nodeType,
  state,
  currentDateTime = new Date().toISOString(),
  responseType = 'synthesis',
  availableTools = [],
  clientConfig,
  executionPlan, // NEW: Accept execution plan parameter
}: GraphPromptParams): Promise<string> {
  console.log(`[GraphPromptLoader] Loading prompt for node type: ${nodeType}`, {
    hasExecutionPlan: !!executionPlan,
    planType: executionPlan?.task_type || 'none',
  });

  // Prepare common context
  const userQuery = state ? getLastHumanMessage(state) : '';
  const toolMessages = state ? getToolMessages(state) : [];
  const hasToolResults = toolMessages.length > 0;
  const referencesContext = state ? buildReferencesContext(state) : '';
  const availableToolsString =
    availableTools.join(', ') ||
    'listDocuments, getDocumentContents, tavilySearch, multiDocumentRetrieval';

  try {
    switch (nodeType) {
      case 'agent':
        return await formatAgentPrompt({
          current_date: currentDateTime,
          available_tools: availableToolsString,
          response_mode: responseType as
            | 'synthesis'
            | 'simple'
            | 'conversational'
            | undefined,
          execution_plan: executionPlan, // NEW: Pass execution plan to agent prompt
        });

      case 'synthesis': {
        const context: PromptContext = {
          responseType: 'synthesis',
          userQuery,
          hasToolResults,
          currentDate: currentDateTime,
        };
        return UnifiedSystemPromptManager.getSystemPrompt(context);
      }

      case 'simple':
        if (!state) {
          throw new Error('State is required for simple response prompt');
        }
        return formatSimpleResponsePrompt(state);

      case 'conversational': {
        const context: PromptContext = {
          responseType: 'conversational',
          userQuery,
          hasToolResults,
          currentDate: currentDateTime,
        };
        return UnifiedSystemPromptManager.getSystemPrompt(context);
      }

      default:
        throw new Error(`Unknown graph node type: ${nodeType}`);
    }
  } catch (error) {
    console.error(
      `[GraphPromptLoader] Error loading prompt for ${nodeType}:`,
      error,
    );

    // Fallback to a basic prompt
    return createFallbackPrompt(nodeType, currentDateTime);
  }
}

/**
 * Extract tool results from state as formatted string
 */
function extractToolResultsAsString(state: GraphState): string {
  const toolMessages = getToolMessages(state);

  if (toolMessages.length === 0) {
    return 'No tool results available.';
  }

  return toolMessages
    .map((msg, index) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);

      return `## Tool Result ${index + 1}
${content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build references and citations context from tool results
 */
function buildReferencesContext(state: GraphState): string {
  const toolMessages = getToolMessages(state);

  if (toolMessages.length === 0) {
    return '';
  }

  const references: string[] = [];

  toolMessages.forEach((msg) => {
    try {
      const content =
        typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;

      // Extract document references
      if (content.document_id || content.title) {
        references.push(`Document: ${content.title || content.document_id}`);
      }

      // Extract web references
      if (content.url) {
        references.push(`Source: ${content.url}`);
      }

      // Extract search query references
      if (content.query) {
        references.push(`Search: "${content.query}"`);
      }
    } catch (e) {
      // Ignore parsing errors for non-JSON tool results
    }
  });

  if (references.length === 0) {
    return '';
  }

  return `## Available References
${references.join('\n')}`;
}

/**
 * Create a fallback prompt when the primary loading fails
 */
function createFallbackPrompt(
  nodeType: string,
  currentDateTime: string,
): string {
  const fallbackPrompts = {
    agent: `You are an AI assistant with access to tools. Analyze the user's request and use appropriate tools to gather information before responding. Current date: ${currentDateTime}`,
    synthesis: `You are an expert analyst. Create a comprehensive response based on the available information. Use clear formatting and cite sources. Current date: ${currentDateTime}`,
    simple: `You are a helpful assistant. Provide a clear, direct response to the user's question based on the available information. Current date: ${currentDateTime}`,
    conversational: `You are a friendly AI assistant. Respond naturally to the user's request in a conversational tone. Current date: ${currentDateTime}`,
  };

  return (
    fallbackPrompts[nodeType as keyof typeof fallbackPrompts] ||
    `You are a helpful AI assistant. Current date: ${currentDateTime}`
  );
}

/**
 * Enhanced loader that can work with the existing prompt system
 */
export interface ExtendedLoadPromptParams {
  modelId: string;
  contextId: string | null;
  clientConfig?: any;
  currentDateTime?: string;
  // NEW: Graph-specific parameters
  promptType?: 'specialist' | 'graph' | 'orchestrator';
  graphNodeType?: 'agent' | 'synthesis' | 'simple' | 'conversational';
  state?: GraphState;
  availableTools?: string[];
}

/**
 * Extended prompt loader that handles both specialist and graph prompts
 * This can be used to gradually migrate from the existing system
 */
export async function loadPromptEnhanced({
  modelId,
  contextId,
  clientConfig,
  currentDateTime = new Date().toISOString(),
  promptType = 'specialist',
  graphNodeType,
  state,
  availableTools,
}: ExtendedLoadPromptParams): Promise<string> {
  // Handle graph-specific prompts
  if (promptType === 'graph' && graphNodeType) {
    console.log(
      `[ExtendedPromptLoader] Loading graph prompt for node: ${graphNodeType}`,
    );

    return await loadGraphPrompt({
      nodeType: graphNodeType,
      state,
      currentDateTime,
      availableTools,
      clientConfig,
    });
  }

  // For non-graph prompts, delegate to the existing system
  // Note: This would require importing the existing loadPrompt function
  // For now, we'll return a basic fallback
  console.log(
    `[ExtendedPromptLoader] Delegating to existing prompt system for ${promptType}`,
  );

  // TODO: Import and call the existing loadPrompt function
  // const { loadPrompt } = await import('../prompts/loader');
  // return await loadPrompt({ modelId, contextId, clientConfig, currentDateTime });

  return createFallbackPrompt('agent', currentDateTime);
}
