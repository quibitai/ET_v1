/**
 * Generate Response Node - Unified Final Response Generation
 *
 * This node handles the final response generation with different modes:
 * - Synthesis: Comprehensive analysis with structured formatting
 * - Simple: Direct, concise responses for straightforward queries
 * - Conversational: Natural, engaging dialogue responses
 */

import type { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';
import { getLastHumanMessage, getToolMessages } from '../state';
import { loadGraphPrompt } from '../prompts/loader';
import { determineResponseMode as unifiedDetermineResponseMode } from '../../utils/responseMode';

/**
 * Dependencies for the response generation node
 */
export interface GenerateResponseNodeDependencies {
  llm: ChatOpenAI;
  logger: RequestLogger;
  currentDateTime?: string;
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
}

/**
 * Response generation result
 */
interface ResponseGenerationResult {
  response: AIMessage;
  mode: 'synthesis' | 'simple' | 'conversational';
  duration: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Generate response node function - creates final formatted responses
 */
export async function generateResponseNode(
  state: GraphState,
  dependencies: GenerateResponseNodeDependencies,
): Promise<Partial<GraphState>> {
  const { llm, logger, currentDateTime, clientConfig } = dependencies;

  const startTime = Date.now();

  // Determine response mode (use existing or auto-detect using unified utility)
  const responseMode =
    state.response_mode || unifiedDetermineResponseMode(state).mode;

  logger.info('[GenerateResponse] Starting response generation', {
    mode: responseMode,
    messageCount: state.messages.length,
    toolResultsCount: getToolMessages(state).length,
    userQuery: `${getLastHumanMessage(state).substring(0, 100)}...`,
  });

  try {
    const result = await generateResponseByMode(
      state,
      responseMode,
      dependencies,
    );

    logger.info('[GenerateResponse] Response generated successfully', {
      mode: result.mode,
      duration: result.duration,
      responseLength: result.response.content?.toString().length || 0,
      tokenUsage: result.tokenUsage,
    });

    return {
      messages: [result.response],
      agent_outcome: result.response,
      response_mode: result.mode,
      node_execution_trace: [
        ...(state.node_execution_trace || []),
        `response_${result.mode}`,
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('[GenerateResponse] Response generation failed', {
      mode: responseMode,
      error: errorMessage,
      duration,
    });

    // Fallback to a simple error response
    const fallbackResponse = new AIMessage(
      'I apologize, but I encountered an error while generating my response. Please try rephrasing your question or try again.',
    );

    return {
      messages: [fallbackResponse],
      agent_outcome: fallbackResponse,
      node_execution_trace: [
        ...(state.node_execution_trace || []),
        'response_error',
      ],
    };
  }
}

/**
 * Generate response based on the specified mode
 */
async function generateResponseByMode(
  state: GraphState,
  mode: 'synthesis' | 'simple' | 'conversational',
  dependencies: GenerateResponseNodeDependencies,
): Promise<ResponseGenerationResult> {
  const { llm, logger, currentDateTime, clientConfig } = dependencies;
  const startTime = Date.now();

  // Load the appropriate prompt template
  const promptTemplate = await loadGraphPrompt({
    nodeType: mode,
    state,
    currentDateTime: currentDateTime || new Date().toISOString(),
    responseMode: mode,
    clientConfig,
  });

  logger.info('[GenerateResponse] Loaded prompt template', {
    mode,
    promptLength: promptTemplate.length,
  });

  // Generate the response
  const response = await llm.invoke([new SystemMessage(promptTemplate)]);

  const duration = Date.now() - startTime;

  return {
    response: response as AIMessage,
    mode,
    duration,
    // Note: Token usage would come from the LLM response if available
    tokenUsage: undefined,
  };
}

/**
 * Auto-detect the appropriate response mode based on conversation context
 * @deprecated Use unifiedDetermineResponseMode from utils/responseMode.ts instead
 */
function autoDetectResponseMode(
  state: GraphState,
): 'synthesis' | 'simple' | 'conversational' {
  console.warn(
    '[GenerateResponse] Using deprecated autoDetectResponseMode - switch to utils/responseMode.ts',
  );
  return unifiedDetermineResponseMode(state).mode;
}

/**
 * Extract and format tool results for prompt context
 */
function extractToolResultsContext(state: GraphState): {
  toolResults: string;
  referencesContext: string;
} {
  const toolMessages = getToolMessages(state);

  if (toolMessages.length === 0) {
    return {
      toolResults: 'No tool results available.',
      referencesContext: '',
    };
  }

  // Format tool results
  const toolResults = toolMessages
    .map((msg, index) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);

      return `## Tool Result ${index + 1}
${content}`;
    })
    .join('\n\n---\n\n');

  // Extract references
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

      // Extract search references
      if (content.query) {
        references.push(`Search: "${content.query}"`);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  });

  const referencesContext =
    references.length > 0
      ? `## Available References\n${references.join('\n')}`
      : '';

  return {
    toolResults,
    referencesContext,
  };
}

/**
 * Validate response generation node configuration
 */
export function validateGenerateResponseNode(
  dependencies: GenerateResponseNodeDependencies,
): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!dependencies.llm) {
    issues.push('LLM is required for response generation');
  }

  if (!dependencies.logger) {
    issues.push('Logger is required for response generation');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Get response generation metrics
 */
export function getResponseMetrics(result: ResponseGenerationResult): {
  mode: string;
  duration: number;
  responseLength: number;
  estimatedTokens: number;
} {
  const responseContent = result.response.content?.toString() || '';

  return {
    mode: result.mode,
    duration: result.duration,
    responseLength: responseContent.length,
    // Rough estimate: ~4 characters per token
    estimatedTokens: Math.ceil(responseContent.length / 4),
  };
}

/**
 * Development helper to analyze response quality
 */
export function analyzeResponseQuality(
  userQuery: string,
  toolResults: any[],
  generatedResponse: string,
): {
  completeness: 'high' | 'medium' | 'low';
  relevance: 'high' | 'medium' | 'low';
  citationCount: number;
  recommendations: string[];
} {
  const recommendations: string[] = [];

  // Check completeness based on query complexity
  const queryWords = userQuery.split(' ').length;
  const responseWords = generatedResponse.split(' ').length;

  let completeness: 'high' | 'medium' | 'low' = 'low';
  if (responseWords > queryWords * 5) {
    completeness = 'high';
  } else if (responseWords > queryWords * 2) {
    completeness = 'medium';
  }

  // Check for citations
  const citationCount =
    (generatedResponse.match(/\[(.*?)\]/g) || []).length +
    (generatedResponse.match(/Source:/g) || []).length +
    (generatedResponse.match(/Document:/g) || []).length;

  // Basic relevance check (could be enhanced with semantic similarity)
  const relevance: 'high' | 'medium' | 'low' = 'medium'; // Placeholder

  if (citationCount === 0 && toolResults.length > 0) {
    recommendations.push('Consider adding citations to tool results');
  }

  if (completeness === 'low') {
    recommendations.push('Response might benefit from more detail');
  }

  return {
    completeness,
    relevance,
    citationCount,
    recommendations,
  };
}
