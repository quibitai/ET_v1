/**
 * Graph Prompt Loader Service
 *
 * This service handles loading and formatting of LangGraph-specific prompts.
 * It works alongside the existing specialist prompt system but focuses on
 * graph node execution prompts rather than specialist personas.
 */

import { formatAgentPrompt } from './agent.prompt';
import { formatSynthesisPrompt } from './synthesis.prompt';
import { formatSimpleResponsePrompt } from './simpleResponse.prompt';
import { formatConversationalPrompt } from './conversational.prompt';
import type { GraphState } from '../state';
import { getLastHumanMessage, getToolMessages } from '../state';

/**
 * Enhanced parameters for graph prompt loading
 */
export interface GraphPromptParams {
  nodeType: 'agent' | 'synthesis' | 'simple' | 'conversational';
  state?: GraphState;
  currentDateTime?: string;
  responseMode?: 'synthesis' | 'simple' | 'conversational';
  availableTools?: string[];
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
}

/**
 * Load a graph-specific prompt for a given node type
 */
export async function loadGraphPrompt({
  nodeType,
  state,
  currentDateTime = new Date().toISOString(),
  responseMode = 'synthesis',
  availableTools = [],
  clientConfig,
}: GraphPromptParams): Promise<string> {
  console.log(`[GraphPromptLoader] Loading prompt for node type: ${nodeType}`);

  // Prepare common context
  const userQuery = state ? getLastHumanMessage(state) : '';
  const toolResults = state ? extractToolResultsAsString(state) : '';
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
          response_mode: responseMode,
        });

      case 'synthesis':
        return await formatSynthesisPrompt({
          user_query: userQuery,
          tool_results: toolResults,
          references_context: referencesContext,
          current_date: currentDateTime,
        });

      case 'simple':
        return await formatSimpleResponsePrompt({
          user_query: userQuery,
          tool_results: toolResults,
          references_context: referencesContext,
          current_date: currentDateTime,
        });

      case 'conversational':
        return await formatConversationalPrompt({
          user_query: userQuery,
          tool_results: toolResults,
          references_context: referencesContext,
          current_date: currentDateTime,
        });

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

/**
 * Utility function to determine appropriate response mode based on query
 */
export function determineResponseMode(
  query: string,
): 'synthesis' | 'simple' | 'conversational' {
  const queryLower = query.toLowerCase();

  // Synthesis indicators
  const synthesisKeywords = [
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
  ];

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
  ];

  if (synthesisKeywords.some((keyword) => queryLower.includes(keyword))) {
    return 'synthesis';
  }

  if (conversationalKeywords.some((keyword) => queryLower.includes(keyword))) {
    return 'conversational';
  }

  // Default to simple for straightforward queries
  return 'simple';
}
