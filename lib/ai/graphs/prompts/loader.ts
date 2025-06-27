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

  // CRITICAL FIX: Check array length, not truthiness of joined string
  const availableToolsString =
    availableTools.length > 0
      ? availableTools.join(', ')
      : 'listDocuments, getDocumentContents, tavilySearch, multiDocumentRetrieval';

  console.log(`[GraphPromptLoader] Available tools for ${nodeType}:`, {
    toolsArray: availableTools,
    toolsCount: availableTools.length,
    toolsString: availableToolsString,
  });

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
export function buildReferencesContext(state: GraphState): string {
  const toolMessages = getToolMessages(state);

  if (toolMessages.length === 0) {
    return '';
  }

  const knowledgeBaseSources: string[] = [];
  const webSources: string[] = [];
  const otherSources: string[] = [];

  toolMessages.forEach((msg, index) => {
    try {
      let content: any;
      if (typeof msg.content === 'string') {
        // Try to parse as JSON, but handle non-JSON strings gracefully
        try {
          content = JSON.parse(msg.content);
        } catch (jsonError) {
          // If it's not valid JSON, treat it as a plain string
          console.log(
            `[buildReferencesContext] Message ${index + 1} content is not JSON, treating as string:`,
            {
              contentPreview: msg.content.substring(0, 100),
              error:
                jsonError instanceof Error
                  ? jsonError.message
                  : 'Unknown JSON error',
            },
          );
          content = { text: msg.content };
        }
      } else {
        content = msg.content;
      }

      // Determine tool type for proper categorization
      const toolName = msg.name || '';

      // Knowledge Base Sources
      if (
        toolName.includes('getDocumentContents') ||
        toolName.includes('searchInternalKnowledgeBase') ||
        toolName.includes('listDocuments')
      ) {
        if (content.document_id || content.title) {
          const title = content.title || content.document_id;
          const url = content.url || `internal://doc/${content.document_id}`;
          const sourceEntry = `[${index + 1}] ${title} - Internal Knowledge Base (${url})`;
          knowledgeBaseSources.push(sourceEntry);
        }
        // Handle document listings
        else if (
          content.available_documents &&
          Array.isArray(content.available_documents)
        ) {
          content.available_documents.forEach((doc: any, docIndex: number) => {
            if (doc.title && doc.id) {
              const url = `/api/documents/${doc.id}`;
              const sourceEntry = `[${index + 1}.${docIndex + 1}] [${doc.title}](${url}) - Internal Knowledge Base`;
              knowledgeBaseSources.push(sourceEntry);
            }
          });
        }
      }
      // Web Sources
      else if (
        toolName.includes('tavilySearch') ||
        toolName.includes('webSearch')
      ) {
        // Handle single result with URL and title
        if (content.url && content.title) {
          const domain = extractDomain(content.url);
          const sourceEntry = `[${index + 1}] [${content.title}](${content.url}) - ${domain}`;
          webSources.push(sourceEntry);
        }
        // Handle array of search results
        else if (content.results && Array.isArray(content.results)) {
          content.results.forEach((result: any, resultIndex: number) => {
            if (result.url && result.title) {
              const domain = extractDomain(result.url);
              const sourceEntry = `[${index + 1}.${resultIndex + 1}] [${result.title}](${result.url}) - ${domain}`;
              webSources.push(sourceEntry);
            }
          });
        }
        // Handle string content that might contain multiple results
        else if (typeof content === 'string' && content.includes('URL:')) {
          const urlMatches = content.match(
            /\*\*(.*?)\*\*\nURL: (https?:\/\/[^\s]+)/g,
          );
          if (urlMatches) {
            urlMatches.forEach((match, matchIndex) => {
              const titleMatch = match.match(/\*\*(.*?)\*\*/);
              const urlMatch = match.match(/URL: (https?:\/\/[^\s]+)/);
              if (titleMatch && urlMatch) {
                const title = titleMatch[1];
                const url = urlMatch[1];
                const domain = extractDomain(url);
                const sourceEntry = `[${index + 1}.${matchIndex + 1}] [${title}](${url}) - ${domain}`;
                webSources.push(sourceEntry);
              }
            });
          }
        } else {
          console.log(
            '[buildReferencesContext] Web search content format not recognized:',
            {
              hasUrl: !!content.url,
              hasTitle: !!content.title,
              hasResults: !!content.results,
              contentKeys: Object.keys(content),
            },
          );
        }
      }
      // Other tool sources
      else {
        if (content.url && content.title) {
          const sourceEntry = `[${index + 1}] [${content.title}](${content.url})`;
          otherSources.push(sourceEntry);
        } else if (content.query) {
          const sourceEntry = `[${index + 1}] Search Query: "${content.query}"`;
          otherSources.push(sourceEntry);
        }
      }
    } catch (e) {
      console.log(
        `[buildReferencesContext] Error parsing tool message ${index + 1}:`,
        e,
      );
    }
  });

  // Build structured references context
  let referencesContext = '';

  if (
    knowledgeBaseSources.length > 0 ||
    webSources.length > 0 ||
    otherSources.length > 0
  ) {
    referencesContext += '\n## AVAILABLE SOURCES FOR CITATION:\n\n';

    if (knowledgeBaseSources.length > 0) {
      referencesContext += '**Knowledge Base Documents:**\n';
      referencesContext += knowledgeBaseSources.join('\n') + '\n\n';
    }

    if (webSources.length > 0) {
      referencesContext += '**Web Sources:**\n';
      referencesContext += webSources.join('\n') + '\n\n';
    }

    if (otherSources.length > 0) {
      referencesContext += '**Other Sources:**\n';
      referencesContext += otherSources.join('\n') + '\n\n';
    }

    referencesContext += `**CITATION INSTRUCTIONS:**
- For synthesis/structured reports: Use numbered citations [1], [2] in text with References section at end
- For conversational responses: Use inline links [Title](URL) naturally in the text
- Never duplicate the same hyperlink - reuse citation numbers for repeated references
- ALWAYS include source attribution - do not write content without citing sources
`;
  }

  return referencesContext;
}

/**
 * Extract domain name from URL for cleaner source attribution
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
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
