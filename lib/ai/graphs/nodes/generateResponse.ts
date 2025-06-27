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
import { buildReferencesContext } from '../prompts/loader';
import { StandardizedResponseFormatter } from '../../services/StandardizedResponseFormatter';

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
  const responseType =
    state.response_mode || unifiedDetermineResponseMode(state).mode;

  logger.info('[GenerateResponse] Starting response generation', {
    mode: responseType,
    messageCount: state.messages.length,
    toolResultsCount: getToolMessages(state).length,
    userQuery: `${getLastHumanMessage(state).substring(0, 100)}...`,
  });

  try {
    const result = await generateResponseByMode(
      state,
      responseType,
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
      mode: responseType,
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

  // Extract tool results for context
  const { toolResults, referencesContext } = extractToolResultsContext(state);

  // For simple document listing, use the formatted results directly
  if (mode === 'simple' && toolResults.includes('formatted_list')) {
    try {
      const toolMessages = getToolMessages(state);
      if (toolMessages.length > 0) {
        const parsed = JSON.parse(toolMessages[0].content as string);
        if (parsed.formatted_list) {
          const simpleResponse = `Here are the files available in the knowledge base:

${parsed.formatted_list}

If you want me to retrieve or summarize any specific file, just let me know!`;

          const response = new AIMessage(simpleResponse);
          return { response, mode, duration: Date.now() - startTime };
        }
      }
    } catch (e) {
      // Fall through to normal processing
    }
  }

  // Load the appropriate prompt template
  const promptTemplate = await loadGraphPrompt({
    nodeType: mode,
    state,
    currentDateTime: currentDateTime || new Date().toISOString(),
    responseType: mode,
    clientConfig,
  });

  logger.info('[GenerateResponse] Loaded prompt template', {
    mode,
    promptLength: promptTemplate.length,
    hasToolResults: toolResults !== 'No tool results available.',
  });

  // Create context-aware prompt with tool results
  const contextualPrompt = `${promptTemplate}

## Current Context
User Query: ${getLastHumanMessage(state)}

## Tool Results
${toolResults}

${referencesContext}

Please provide a direct, helpful response based on the tool results above. Do not use generic templates or placeholders.`;

  logger.info('[GenerateResponse] Final prompt structure', {
    mode,
    promptTemplateLength: promptTemplate.length,
    toolResultsLength: toolResults.length,
    referencesContextLength: referencesContext.length,
    hasReferences: referencesContext.length > 0,
    referencesPreview: `${referencesContext.substring(0, 200)}...`,
    totalPromptLength: contextualPrompt.length,
  });

  // Generate the response
  const response = await llm.invoke([new SystemMessage(contextualPrompt)]);

  // Apply hyperlink formatting to the final response
  const processedResponse = applyHyperlinkFormatting(response as AIMessage);

  const duration = Date.now() - startTime;

  return {
    response: processedResponse,
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

  // Format tool results - handle both raw content and structured JSON responses
  const toolResults = toolMessages
    .map((msg, index) => {
      let content: string;

      if (typeof msg.content === 'string') {
        try {
          // Try to parse as JSON to extract formatted content
          const parsed = JSON.parse(msg.content);

          // If it's a structured tool response, use formatted_list or appropriate display field
          if (parsed.formatted_list) {
            content = parsed.formatted_list;
          } else if (parsed.success && parsed.available_documents) {
            // Handle document listing responses
            content = `Found ${parsed.total_count || parsed.available_documents.length} documents:\n${parsed.formatted_list || 'Document list available'}`;
          } else if (parsed.content) {
            // Handle document content responses
            content = parsed.content;
          } else if (parsed.result) {
            // Handle general tool results
            content =
              typeof parsed.result === 'string'
                ? parsed.result
                : JSON.stringify(parsed.result, null, 2);
          } else {
            // Fallback to the full response, but format it nicely
            content = JSON.stringify(parsed, null, 2);
          }
        } catch (e) {
          // If not JSON, use as-is
          content = msg.content;
        }
      } else {
        content = JSON.stringify(msg.content, null, 2);
      }

      return `## Tool Result ${index + 1}
${content}`;
    })
    .join('\n\n---\n\n');

  // Use our enhanced reference building system from loader.ts
  const referencesContext = buildReferencesContext(state);

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

/**
 * Apply hyperlink formatting to the final AI response
 */
function applyHyperlinkFormatting(response: AIMessage): AIMessage {
  if (typeof response.content !== 'string') {
    return response;
  }

  // Use the universal hyperlink converter from StandardizedResponseFormatter
  const processedContent = StandardizedResponseFormatter.convertToHyperlinks(
    response.content,
  );

  return new AIMessage({
    content: processedContent,
    additional_kwargs: response.additional_kwargs,
    response_metadata: response.response_metadata,
  });
}
