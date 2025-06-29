/**
 * Simple Graph Implementation - Enhanced with Proper StateGraph and Real-Time Streaming
 * Following Development Roadmap v6.0.0 with Single Trace Architecture
 *
 * This restores the proper StateGraph pattern to fix trace fragmentation
 * while maintaining the simplified architecture goals.
 *
 * STREAMING FIX: Implements v5.5.0 real-time token streaming using streamEvents
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { ChatOpenAI } from '@langchain/openai';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import {
  type BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { createSystemMessage } from './prompts/simple';
import { buildReferencesContext } from './prompts/loader';
import { getToolMessages } from './state';
import { StandardizedResponseFormatter } from '../services/StandardizedResponseFormatter';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

// Modern LangGraph best practice: Use Annotation.Root() for consistent type handling
const SimpleGraphStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[] = [], y: BaseMessage[] = []) => x.concat(y),
    default: () => [],
  }),
  input: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),
  response_mode: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? 'synthesis',
    default: () => 'synthesis',
  }),
  specialist_id: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),
  metadata: Annotation<{
    fileContext?: {
      filename: string;
      contentType: string;
      url: string;
      extractedText?: string;
    };
    brainRequest?: any;
    processedContext?: any;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Extract type from annotation for consistent typing
export type SimpleGraphState = typeof SimpleGraphStateAnnotation.State;

/**
 * Enhanced SimpleGraph with proper StateGraph implementation and real-time streaming
 * This ensures all tool calls happen within a single LangSmith trace
 */
export class SimpleGraph {
  private compiledGraph: any;
  private llm: ChatOpenAI;
  private tools: DynamicStructuredTool[];
  private toolVectorStore?: MemoryVectorStore;

  constructor(llm: ChatOpenAI, tools: DynamicStructuredTool[]) {
    this.llm = llm;
    this.tools = tools;
    this.compiledGraph = this.createCompiledGraph();
  }

  /**
   * Create the proper StateGraph for single trace execution
   */
  private createCompiledGraph() {
    const graph = new StateGraph(SimpleGraphStateAnnotation)
      // Agent node - makes decisions and calls tools
      .addNode('agent', async (state) => {
        console.log('[SimpleGraph] Agent node executing');

        // ENHANCED: LangGraph best practices for state management
        // 1. Always preserve existing context and tool results
        // 2. Never isolate context when tool results are present
        // 3. Ensure proper message flow for tool result processing

        const currentQuery = this.extractCurrentQuery(state.messages);

        // Check if we have tool results that need processing
        const hasUnprocessedToolResults = state.messages.some(
          (msg) =>
            msg instanceof ToolMessage ||
            (msg instanceof AIMessage &&
              msg.additional_kwargs?.tool_calls &&
              msg.additional_kwargs.tool_calls.length > 0 &&
              // Check if the tool results haven't been properly processed yet
              !state.messages
                .slice(state.messages.indexOf(msg) + 1)
                .some(
                  (laterMsg) =>
                    laterMsg instanceof AIMessage &&
                    laterMsg.content &&
                    (laterMsg.content
                      .toString()
                      .includes('**EXTRACTED CONTENT:**') ||
                      laterMsg.content
                        .toString()
                        .includes('**Search Results:**') ||
                      laterMsg.content.toString().includes('based on') ||
                      laterMsg.content.toString().includes('according to')),
                )),
        );

        // Enhanced topic change detection with tool result awareness
        const shouldIsolateContext =
          !hasUnprocessedToolResults &&
          this.detectTopicChange(state.messages, currentQuery);

        // Normalize state to ensure required properties are present
        const normalizedState = {
          ...state,
          input: state.input ?? currentQuery,
          response_mode: state.response_mode ?? 'synthesis',
          specialist_id: state.specialist_id ?? '',
          metadata: state.metadata ?? {},
        };

        let workingState = normalizedState;
        if (shouldIsolateContext) {
          console.log(
            '[SimpleGraph] Topic change detected, isolating context for new query',
          );
          workingState = this.isolateContextForNewTopic(
            normalizedState,
            currentQuery,
          );
        } else if (hasUnprocessedToolResults) {
          console.log(
            '[SimpleGraph] Unprocessed tool results detected - preserving full context',
          );
        }

        // Ensure we have system message
        let messages = [...workingState.messages];
        if (messages.length === 0 || !(messages[0] instanceof SystemMessage)) {
          const toolNames = this.tools.map((t) => t.name);
          const systemPrompt = await createSystemMessage(
            toolNames,
            new Date().toISOString(),
          );
          messages = [new SystemMessage(systemPrompt), ...messages];
          console.log(
            '[SimpleGraph] Added system message with tools:',
            toolNames.join(', '),
          );
        }

        // DEBUG: Log the metadata to see what's being passed
        console.log('[SimpleGraph] DEBUG: Checking metadata for fileContext', {
          hasMetadata: !!workingState.metadata,
          metadataKeys: workingState.metadata
            ? Object.keys(workingState.metadata)
            : [],
          hasFileContext: !!workingState.metadata?.fileContext,
          fileContextKeys: workingState.metadata?.fileContext
            ? Object.keys(workingState.metadata.fileContext)
            : [],
          hasExtractedText: !!workingState.metadata?.fileContext?.extractedText,
          extractedTextLength:
            workingState.metadata?.fileContext?.extractedText?.length || 0,
        });

        // CRITICAL FIX: Process fileContext from uploaded documents
        if (workingState.metadata?.fileContext?.extractedText) {
          console.log('[SimpleGraph] Processing uploaded document content', {
            filename: workingState.metadata.fileContext.filename,
            contentType: workingState.metadata.fileContext.contentType,
            extractedTextLength:
              workingState.metadata.fileContext.extractedText.length,
          });

          // Add file content directly to the system message
          const fileContextSection = `

=== UPLOADED DOCUMENT CONTENT ===
Filename: ${workingState.metadata.fileContext.filename}
Content Type: ${workingState.metadata.fileContext.contentType}

IMPORTANT: The user has uploaded a document. When they ask to "summarize this document" or make similar requests, you should process the content below directly without using external tools like listDocuments.

DOCUMENT CONTENT:
${workingState.metadata.fileContext.extractedText}
=== END DOCUMENT CONTENT ===`;

          // Update the system message to include the file content
          const enhancedSystemPrompt = `${messages[0].content}${fileContextSection}`;
          messages[0] = new SystemMessage(enhancedSystemPrompt);

          console.log(
            '[SimpleGraph] Enhanced system message with uploaded document content',
          );
        }

        // Enhanced context building for tool results
        const graphState = {
          messages,
          input: '',
          agent_outcome: undefined,
          ui: [],
          _lastToolExecutionResults: [],
          toolForcingCount: 0,
          iterationCount: 0,
          needsSynthesis: true,
          response_mode: 'synthesis' as const,
          node_execution_trace: [],
          tool_workflow_state: {
            documentsListed: false,
            documentsRetrieved: [],
            webSearchCompleted: false,
            extractionCompleted: false,
            multiDocAnalysisCompleted: false,
          },
          metadata: {},
        };

        const toolMessages = getToolMessages(graphState);
        const hasToolResults = toolMessages.length > 0;

        console.log('[SimpleGraph] Enhanced tool results analysis:', {
          hasToolResults,
          hasUnprocessedToolResults,
          toolMessageCount: toolMessages.length,
          toolNames: toolMessages.map((msg) => msg.name),
          messageFlow: messages.slice(-3).map((m) => ({
            type: m.constructor.name,
            hasContent: !!m.content,
          })),
        });

        // Enhanced references context building
        if (hasToolResults) {
          console.log(
            '[SimpleGraph] Building enhanced references context for tool results',
          );

          const referencesContext = buildReferencesContext(graphState);

          console.log('[SimpleGraph] Enhanced references context built:', {
            contextLength: referencesContext.length,
            hasReferences: referencesContext.length > 0,
            preview: `${referencesContext.substring(0, 300)}...`,
          });

          // Enhanced system message with tool result processing instructions
          if (referencesContext.length > 0) {
            const enhancedSystemPrompt = `${messages[0].content}

${referencesContext}

CRITICAL INSTRUCTIONS FOR TOOL RESULT PROCESSING:
- You have successfully extracted content from web sources
- Process and present this information to the user in a clear, organized manner
- Include proper source attribution with URLs
- For synthesis responses, use numbered citations [1], [2] with a References section
- For conversational responses, use inline hyperlinks [Title](URL)
- Never respond with generic greetings when tool results are available
- Always acknowledge and process the extracted content`;

            messages[0] = new SystemMessage(enhancedSystemPrompt);
            console.log(
              '[SimpleGraph] Enhanced system message with tool result processing instructions',
            );
          }
        }

        // Bind tools and invoke with enhanced configuration
        const modelWithTools =
          this.tools.length > 0
            ? this.llm.bindTools(this.tools).withConfig({
                tags: [
                  'final_response',
                  'streaming_enabled',
                  'tool_result_processing',
                ],
                metadata: {
                  streaming: true,
                  streamMode: 'token',
                  enableTokenStreaming: true,
                  hasToolResults,
                  hasUnprocessedToolResults,
                  contextPreserved: !shouldIsolateContext,
                },
              })
            : this.llm.withConfig({
                tags: [
                  'final_response',
                  'streaming_enabled',
                  'tool_result_processing',
                ],
                metadata: {
                  streaming: true,
                  streamMode: 'token',
                  enableTokenStreaming: true,
                  hasToolResults,
                  hasUnprocessedToolResults,
                  contextPreserved: !shouldIsolateContext,
                },
              });

        const response = await modelWithTools.invoke(messages);

        // Apply hyperlink formatting to the final response
        const processedResponse = this.applyHyperlinkFormatting(response);

        console.log(
          `[SimpleGraph] Agent response: ${response.additional_kwargs?.tool_calls?.length || 0} tool calls, ${response.content?.toString().length || 0} chars`,
        );

        return { messages: [processedResponse] };
      })

      // Tools node - executes ALL tool calls in sequence within single trace
      .addNode('tools', async (state) => {
        console.log('[SimpleGraph] Tools node executing');

        const lastMessage = state.messages[
          state.messages.length - 1
        ] as AIMessage;
        const toolCalls = lastMessage.additional_kwargs?.tool_calls || [];

        if (toolCalls.length === 0) {
          console.log('[SimpleGraph] No tool calls found');
          return { messages: [] };
        }

        console.log(
          `[SimpleGraph] Processing ${toolCalls.length} tool calls: ${toolCalls.map((tc) => tc.function?.name).join(', ')}`,
        );

        const toolMessages: ToolMessage[] = [];

        // Execute ALL tools within this single node (maintaining single trace)
        for (const toolCall of toolCalls) {
          const startTime = Date.now();

          const tool = this.tools.find(
            (t) => t.name === toolCall.function?.name,
          );

          if (tool && toolCall.function?.arguments) {
            try {
              const toolInput = JSON.parse(toolCall.function.arguments);
              const result = await tool.invoke(toolInput);
              const duration = Date.now() - startTime;

              console.log(
                `[SimpleGraph] ${tool.name} completed (${duration}ms, ${typeof result === 'string' ? result.length : 'N/A'} chars)`,
              );

              const toolMessage = new ToolMessage({
                content:
                  typeof result === 'string' ? result : JSON.stringify(result),
                tool_call_id: toolCall.id,
                name: tool.name,
              });

              toolMessages.push(toolMessage);
            } catch (error) {
              const duration = Date.now() - startTime;
              const errorMessage = `Error executing tool ${tool.name}: ${error instanceof Error ? error.message : String(error)}`;

              console.error(
                `[SimpleGraph] ${tool.name} failed (${duration}ms):`,
                error instanceof Error ? error.message : error,
              );

              const errorToolMessage = new ToolMessage({
                content: errorMessage,
                tool_call_id: toolCall.id,
                name: tool.name,
              });

              toolMessages.push(errorToolMessage);
            }
          } else {
            console.error(
              `[SimpleGraph] Tool not found: ${toolCall.function?.name}`,
            );
          }
        }

        console.log(
          `[SimpleGraph] Tools completed: ${toolMessages.length} results, ${toolMessages.reduce((sum, tm) => sum + (typeof tm.content === 'string' ? tm.content.length : 0), 0)} total chars`,
        );

        return { messages: toolMessages };
      })

      // Add edges for proper flow
      .addEdge(START, 'agent')

      // Conditional routing from agent
      .addConditionalEdges(
        'agent',
        (state) => {
          const lastMessage = state.messages[
            state.messages.length - 1
          ] as AIMessage;
          const hasToolCalls =
            !!lastMessage.additional_kwargs?.tool_calls?.length;

          console.log(
            `[SimpleGraph] Routing decision: ${hasToolCalls ? 'tools' : 'end'}`,
          );
          return hasToolCalls ? 'tools' : '__end__';
        },
        {
          tools: 'tools',
          __end__: END,
        },
      )

      // CRITICAL: Tools return to agent (proper ReAct pattern)
      .addEdge('tools', 'agent');

    return graph.compile();
  }

  /**
   * Real-time token streaming implementation based on v5.5.0
   * Uses streamEvents to capture tokens during LLM execution
   * FIXED: Better separation of progress indicators from AI content
   */
  async *stream(state: SimpleGraphState): AsyncGenerator<string> {
    console.log('[SimpleGraph] Starting real-time token streaming');

    // Prepare initial state for StateGraph
    let messages = [...state.messages];

    // Add specialist context if provided
    if (
      state.specialist_id &&
      (messages.length === 0 || !(messages[0] instanceof SystemMessage))
    ) {
      const toolNames = this.tools.map((t) => t.name);
      const systemPrompt = await createSystemMessage(
        toolNames,
        new Date().toISOString(),
        state.specialist_id,
      );

      messages = [new SystemMessage(systemPrompt), ...messages];
      console.log(
        `[SimpleGraph] Added specialist system message: ${state.specialist_id}`,
      );
    }

    try {
      // FIXED: Pass the full state including metadata to streamEvents
      const fullState = {
        messages,
        input: state.input || '',
        response_mode: state.response_mode || 'synthesis',
        specialist_id: state.specialist_id,
        metadata: state.metadata, // CRITICAL: Include metadata for fileContext
      };

      console.log(
        '[SimpleGraph] DEBUG: Full state being passed to streamEvents',
        {
          hasMetadata: !!fullState.metadata,
          metadataKeys: fullState.metadata
            ? Object.keys(fullState.metadata)
            : [],
          hasFileContext: !!fullState.metadata?.fileContext,
          fileContextKeys: fullState.metadata?.fileContext
            ? Object.keys(fullState.metadata.fileContext)
            : [],
        },
      );

      // Use streamEvents for real-time token capture (v5.5.0 approach)
      const eventStream = this.compiledGraph.streamEvents(
        fullState, // FIXED: Pass full state instead of just { messages }
        {
          version: 'v2',
          includeNames: ['agent'], // Include agent node for token streaming
          includeTags: ['final_response', 'streaming_enabled'],
        },
      );

      let hasStreamedContent = false;
      let tokenCount = 0;
      const toolProgressShown = new Set<string>(); // Track shown progress indicators
      const startTime = Date.now();

      for await (const event of eventStream) {
        // Capture tokens during LLM execution (real-time streaming)
        if (
          event.event === 'on_chat_model_stream' &&
          event.data?.chunk?.content
        ) {
          const token = event.data.chunk.content;
          tokenCount++;
          hasStreamedContent = true;

          // Log every 20th token to avoid spam but provide feedback
          if (tokenCount % 100 === 0) {
            const elapsed = Date.now() - startTime;
            const rate = ((tokenCount / elapsed) * 1000).toFixed(1);
            console.log(`[SimpleGraph] ${tokenCount} tokens (${rate}/s)`);
          }

          // Yield the token directly for real-time streaming
          yield token;
        }

        // Handle tool progress updates - WITH DEDUPLICATION
        if (event.event === 'on_tool_start') {
          const toolName = event.name;

          // Only show progress indicator once per tool per request
          if (!toolProgressShown.has(toolName)) {
            toolProgressShown.add(toolName);
            console.log(
              `[SimpleGraph] Tool starting: ${toolName} (showing progress indicator)`,
            );

            // Yield progress indicator for tool execution
            const progressMessages: Record<string, string> = {
              listDocuments: '📚 Retrieving documents...\n',
              getDocumentContents: '📄 Loading document content...\n',
              tavilySearch: '🔍 Searching the web...\n',
              searchInternalKnowledgeBase: '🔍 Searching knowledge base...\n',
            };

            const progressMessage = progressMessages[toolName];
            if (progressMessage) {
              yield progressMessage;
            }
          } else {
            console.log(
              `[SimpleGraph] Tool ${toolName} already shown progress, skipping duplicate`,
            );
          }
        }
      }

      // Fallback: If no streaming occurred, execute and yield result
      if (!hasStreamedContent) {
        console.log(
          '[SimpleGraph] No streaming events captured, executing for final result...',
        );

        const result = await this.compiledGraph.invoke(fullState);
        const finalMessage = result.messages[result.messages.length - 1];

        if (finalMessage?.content) {
          // Stream the content character by character for smooth UX
          const content = finalMessage.content;
          for (let i = 0; i < content.length; i += 3) {
            const chunk = content.slice(i, i + 3);
            yield chunk;
            // Small delay for smooth streaming effect
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `[SimpleGraph] Streaming completed: ${tokenCount} tokens in ${totalTime}ms`,
      );
    } catch (error) {
      console.error('[SimpleGraph] Streaming error:', error);
      yield '⚠️ An error occurred during processing. Please try again.';
    }
  }

  /**
   * Extract the current user query from the message history
   */
  private extractCurrentQuery(messages: BaseMessage[]): string {
    // Find the last human message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] instanceof HumanMessage) {
        return messages[i].content.toString();
      }
    }
    return '';
  }

  /**
   * Detect if the current query represents a topic change from previous conversation
   * CRITICAL: Following LangGraph best practices for context preservation
   */
  private detectTopicChange(
    messages: BaseMessage[],
    currentQuery: string,
  ): boolean {
    if (messages.length <= 2) return false; // Not enough history to detect change

    // CRITICAL FIX: NEVER isolate context if ANY tool activity is detected
    // Following LangGraph best practices: preserve context when tools are involved

    // Check for any tool-related messages in the entire conversation
    const hasAnyToolActivity = messages.some(
      (msg) =>
        msg instanceof ToolMessage ||
        (msg instanceof AIMessage &&
          msg.additional_kwargs?.tool_calls &&
          msg.additional_kwargs.tool_calls.length > 0),
    );

    // Check for tool-related content patterns in AI messages
    const hasToolRelatedContent = messages.some(
      (msg) =>
        msg instanceof AIMessage &&
        msg.content &&
        (msg.content.toString().includes('**EXTRACTED CONTENT:**') ||
          msg.content.toString().includes('**Search Results:**') ||
          msg.content.toString().includes('**Content Extraction Results**') ||
          msg.content.toString().includes('No URLs found with score') ||
          msg.content.toString().includes('Tavily') ||
          msg.content.toString().includes('extracted') ||
          msg.content.toString().includes('search results') ||
          msg.content.toString().includes('Source 1:') ||
          msg.content.toString().includes('Content Length:')),
    );

    // Check for follow-up patterns that should maintain context
    const isFollowUpQuery =
      /^(yes|no|continue|more|details|summary|tell me more|what about|and|also)/i.test(
        currentQuery.trim(),
      );

    if (hasAnyToolActivity || hasToolRelatedContent || isFollowUpQuery) {
      console.log(
        '[SimpleGraph] Context preservation enforced - NO topic change detected',
        {
          hasAnyToolActivity,
          hasToolRelatedContent,
          isFollowUpQuery,
          currentQuery: `${currentQuery.substring(0, 100)}...`,
          messageTypes: messages.slice(-5).map((m) => m.constructor.name),
          reason: hasAnyToolActivity
            ? 'tool_activity'
            : hasToolRelatedContent
              ? 'tool_content'
              : 'follow_up',
        },
      );
      return false; // NEVER isolate context when tools are involved
    }

    // Only allow topic change for completely new, unrelated queries
    // Get previous human messages to analyze topic continuity
    const humanMessages = messages
      .filter((msg) => msg instanceof HumanMessage)
      .map((msg) => msg.content.toString());

    if (humanMessages.length <= 1) return false; // Only current message

    const previousQuery = humanMessages[humanMessages.length - 2] || '';
    const current = currentQuery.toLowerCase();
    const previous = previousQuery.toLowerCase();

    // Very strict topic change indicators - only for completely different domains
    const strongTopicChangeIndicators = [
      /^(completely different|new topic|change subject|forget about)/,
      /^(let's talk about something else|different question)/,
    ];

    // Check for explicit strong topic change indicators
    const hasStrongTopicChangeIndicator = strongTopicChangeIndicators.some(
      (pattern) => pattern.test(current),
    );

    // Check for topic similarity using keyword overlap - much more conservative threshold
    const currentKeywords = this.extractKeywords(current);
    const previousKeywords = this.extractKeywords(previous);
    const keywordOverlap = this.calculateKeywordOverlap(
      currentKeywords,
      previousKeywords,
    );

    // Much more conservative topic change detection - only for very different topics
    const isTopicChange = hasStrongTopicChangeIndicator || keywordOverlap < 0.1;

    console.log('[SimpleGraph] Conservative topic change analysis:', {
      currentQuery: `${current.substring(0, 50)}...`,
      previousQuery: `${previous.substring(0, 50)}...`,
      hasStrongTopicChangeIndicator,
      keywordOverlap: Math.round(keywordOverlap * 100) / 100,
      isTopicChange,
      decision: 'PRESERVE_CONTEXT', // Default to preserving context
    });

    return isTopicChange;
  }

  /**
   * Extract meaningful keywords from a query
   */
  private extractKeywords(query: string): Set<string> {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'can',
      'you',
      'please',
      'tell',
      'me',
      'about',
      'what',
      'how',
      'when',
      'where',
      'why',
      'search',
      'find',
      'look',
      'get',
      'give',
      'show',
      'help',
      'need',
      'want',
      'would',
      'could',
    ]);

    return new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word)),
    );
  }

  /**
   * Calculate keyword overlap between two sets
   */
  private calculateKeywordOverlap(
    keywords1: Set<string>,
    keywords2: Set<string>,
  ): number {
    if (keywords1.size === 0 && keywords2.size === 0) return 1;
    if (keywords1.size === 0 || keywords2.size === 0) return 0;

    const intersection = new Set(
      [...keywords1].filter((x) => keywords2.has(x)),
    );
    const union = new Set([...keywords1, ...keywords2]);

    return intersection.size / union.size;
  }

  /**
   * Isolate context for a new topic by keeping only essential system context
   */
  private isolateContextForNewTopic(
    state: SimpleGraphState,
    currentQuery: string,
  ): SimpleGraphState {
    // Keep only the system message and the current human message
    const systemMessage = state.messages.find(
      (msg) => msg instanceof SystemMessage,
    );
    const currentHumanMessage = [...state.messages]
      .reverse()
      .find((msg) => msg instanceof HumanMessage);

    const isolatedMessages: BaseMessage[] = [];

    if (systemMessage) {
      isolatedMessages.push(systemMessage);
    }

    if (currentHumanMessage) {
      isolatedMessages.push(currentHumanMessage);
    }

    console.log('[SimpleGraph] Context isolated:', {
      originalMessageCount: state.messages.length,
      isolatedMessageCount: isolatedMessages.length,
      currentQuery: `${currentQuery.substring(0, 100)}...`,
    });

    return {
      ...state,
      messages: isolatedMessages,
      // Ensure input is always a string (fixes TypeScript error)
      input: state.input ?? currentQuery,
    };
  }

  /**
   * Apply hyperlink formatting to the final AI response
   */
  private applyHyperlinkFormatting(response: AIMessage): AIMessage {
    if (typeof response.content !== 'string') {
      console.log(
        '[SimpleGraph] Hyperlink formatting skipped: content is not string',
      );
      return response;
    }

    console.log(
      '[SimpleGraph] Applying hyperlink formatting to response:',
      `${response.content.substring(0, 100)}...`,
    );

    // Use the universal hyperlink converter from StandardizedResponseFormatter
    const processedContent = StandardizedResponseFormatter.convertToHyperlinks(
      response.content,
    );

    console.log(
      '[SimpleGraph] Hyperlink formatting result:',
      `${processedContent.substring(0, 100)}...`,
    );
    console.log(
      '[SimpleGraph] Contains hyperlinks:',
      processedContent.includes('[spaces/'),
    );

    return new AIMessage({
      content: processedContent,
      additional_kwargs: response.additional_kwargs,
      response_metadata: response.response_metadata,
    });
  }
}

/**
 * Create a simple configured graph
 */
export function createConfiguredGraph(
  llm: ChatOpenAI,
  tools: DynamicStructuredTool[],
) {
  const graph = new SimpleGraph(llm, tools);

  return {
    graph,
    config: {},
  };
}

// Legacy compatibility function
export function createGraph() {
  throw new Error(
    'createGraph() is deprecated. Use createConfiguredGraph() instead.',
  );
}

/**
 * CRITICAL: LangGraph with Proper Tool Selection Node
 *
 * This implements the official LangChain best practice for handling large numbers of tools:
 * 1. START → select_tools → agent → tools → agent → END
 * 2. Uses semantic search over tool descriptions to select relevant tools
 * 3. Prevents LLM confusion by limiting tools to relevant subset
 *
 * Research Source: https://langchain-ai.github.io/langgraph/how-tos/many-tools/
 */
export class ToolSelectionGraph {
  private llm: ChatOpenAI;
  private allTools: any[];
  private toolVectorStore?: MemoryVectorStore;
  private logger: RequestLogger;
  private toolRegistry: Map<string, any>;

  constructor(llm: ChatOpenAI, tools: any[], logger: RequestLogger) {
    this.llm = llm;
    this.allTools = tools;
    this.logger = logger;
    this.toolRegistry = new Map();

    // Initialize tool vector store for semantic search
    this.initializeToolVectorStore();
  }

  private async initializeToolVectorStore() {
    try {
      const toolDocuments = this.allTools.map((tool, index) => {
        const toolId = `tool_${index}`;
        this.toolRegistry.set(toolId, tool);

        return new Document({
          pageContent: tool.description || tool.name,
          metadata: {
            toolId,
            toolName: tool.name,
            category: this.getToolCategory(tool.name),
          },
        });
      });

      this.toolVectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
      await this.toolVectorStore.addDocuments(toolDocuments);

      this.logger.info(
        `🔍 Tool vector store initialized with ${toolDocuments.length} tools`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize tool vector store:', error);
      throw error;
    }
  }

  private getToolCategory(toolName: string): string {
    if (
      [
        'listDocuments',
        'getDocumentContents',
        'searchInternalKnowledgeBase',
      ].includes(toolName)
    ) {
      return 'KNOWLEDGE_BASE';
    }
    if (toolName.startsWith('get_gmail') || toolName.startsWith('list_gmail')) {
      return 'GMAIL';
    }
    if (toolName.startsWith('get_drive') || toolName.startsWith('list_drive')) {
      return 'GOOGLE_DRIVE';
    }
    if (toolName.startsWith('get_docs') || toolName.startsWith('search_docs')) {
      return 'GOOGLE_DOCS';
    }
    if (
      toolName.startsWith('get_sheets') ||
      toolName.startsWith('list_sheets')
    ) {
      return 'GOOGLE_SHEETS';
    }
    if (toolName.startsWith('asana_')) {
      return 'ASANA';
    }
    if (toolName === 'tavilySearch') {
      return 'RESEARCH';
    }
    return 'OTHER';
  }

  /**
   * CRITICAL: Tool Selection Node
   *
   * This node runs BEFORE the agent and selects relevant tools based on:
   * 1. Semantic similarity to user query
   * 2. Query intent analysis (internal vs external)
   * 3. Tool category filtering
   */
  private async selectTools(state: typeof SimpleGraphStateAnnotation.State) {
    try {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];

      const query = (() => {
        if (lastMessage.getType() === 'human') {
          return (lastMessage as HumanMessage).content as string;
        } else if (lastMessage.getType() === 'tool') {
          // For tool messages, generate a query for additional tools
          return `Additional tools needed for: ${(lastMessage as ToolMessage).content}`;
        }
        return '';
      })();

      this.logger.info(`🎯 TOOL SELECTION: Analyzing query: "${query}"`);

      // Analyze query intent
      const queryIntent = this.analyzeQueryIntent(query);
      this.logger.info(`🧠 Query intent detected: ${queryIntent}`);

      // Semantic search for relevant tools
      const similarDocs = await this.toolVectorStore?.similaritySearch(
        query,
        8,
      );

      // Apply contextual filtering based on intent
      const selectedToolIds = this.applyContextualFiltering(
        similarDocs || [],
        queryIntent,
      );

      // Map tool IDs back to actual tools
      const selectedTools = selectedToolIds
        .map((id) => this.toolRegistry.get(id))
        .filter(Boolean);

      this.logger.info(
        `🔧 TOOL SELECTION RESULT: Selected ${selectedTools.length} tools:`,
        {
          totalAvailable: this.allTools.length,
          selectedTools: selectedTools.map((t) => t.name),
          queryIntent,
          filtering: 'SEMANTIC_SEARCH + CONTEXTUAL_FILTERING',
        },
      );

      return {
        selectedTools: selectedToolIds,
        messages: state.messages,
      };
    } catch (error) {
      this.logger.error('Tool selection failed:', error);
      // Fallback: select knowledge base tools
      const fallbackTools = this.allTools
        .filter((tool) =>
          [
            'listDocuments',
            'getDocumentContents',
            'searchInternalKnowledgeBase',
          ].includes(tool.name),
        )
        .slice(0, 5);

      const fallbackIds = Array.from(this.toolRegistry.entries())
        .filter(([_, tool]) => fallbackTools.includes(tool))
        .map(([id, _]) => id);

      return {
        selectedTools: fallbackIds,
        messages: state.messages,
      };
    }
  }

  private analyzeQueryIntent(
    query: string,
  ): 'INTERNAL_KNOWLEDGE_BASE' | 'EXTERNAL_RESEARCH' | 'MIXED' {
    const queryLower = query.toLowerCase();

    const internalIndicators = [
      'echo tango',
      'core values',
      'company',
      'our',
      'internal',
      'knowledge base',
      'document contents',
      'complete contents',
      'policy',
      'guideline',
    ];

    const externalIndicators = [
      'research',
      'current',
      'latest',
      'news',
      'market',
      'trends',
      'external',
      'google',
      'search',
      'web',
      'internet',
    ];

    const hasInternal = internalIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );
    const hasExternal = externalIndicators.some((indicator) =>
      queryLower.includes(indicator),
    );

    if (hasInternal && !hasExternal) return 'INTERNAL_KNOWLEDGE_BASE';
    if (hasExternal && !hasInternal) return 'EXTERNAL_RESEARCH';
    return 'MIXED';
  }

  private applyContextualFiltering(
    similarDocs: Document[],
    queryIntent: string,
  ): string[] {
    const toolIds = similarDocs.map((doc) => doc.metadata.toolId);

    if (queryIntent === 'INTERNAL_KNOWLEDGE_BASE') {
      // For internal queries, filter out conflicting external tools
      const conflictingCategories = [
        'GMAIL',
        'GOOGLE_DRIVE',
        'GOOGLE_DOCS',
        'GOOGLE_SHEETS',
      ];

      const filtered = toolIds.filter((toolId) => {
        const doc = similarDocs.find((d) => d.metadata.toolId === toolId);
        return doc && !conflictingCategories.includes(doc.metadata.category);
      });

      this.logger.info(
        `🚫 CONTEXTUAL FILTERING: Removed ${toolIds.length - filtered.length} conflicting external tools for internal query`,
      );
      return filtered;
    }

    // For external or mixed queries, keep all semantically relevant tools
    return toolIds;
  }

  /**
   * Agent Node: Now receives only selected tools
   */
  private async agent(state: typeof SimpleGraphStateAnnotation.State) {
    try {
      const selectedTools = state.selectedTools
        .map((id) => this.toolRegistry.get(id))
        .filter(Boolean);

      this.logger.info(
        `🤖 AGENT: Received ${selectedTools.length} selected tools:`,
        {
          tools: selectedTools.map((t) => t.name),
        },
      );

      const llmWithTools = this.llm.bindTools(selectedTools);
      const response = await llmWithTools.invoke(state.messages);

      return {
        messages: [...state.messages, response],
        selectedTools: state.selectedTools,
      };
    } catch (error) {
      this.logger.error('Agent execution failed:', error);
      throw error;
    }
  }

  /**
   * Routing function: Decides next step after agent
   */
  private shouldContinue(
    state: typeof SimpleGraphStateAnnotation.State,
  ): string {
    const lastMessage = state.messages[state.messages.length - 1];

    if (
      lastMessage.getType() === 'ai' &&
      (lastMessage as AIMessage).tool_calls?.length
    ) {
      return 'tools';
    }
    return END;
  }

  /**
   * Create the complete graph with tool selection
   */
  createGraph() {
    // Enhanced state to include selected tools
    const StateAnnotation = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      selectedTools: Annotation<string[]>({
        reducer: (x, y) => y ?? x ?? [],
      }),
    });

    const graph = new StateGraph(StateAnnotation)
      .addNode('select_tools', this.selectTools.bind(this))
      .addNode('agent', this.agent.bind(this))
      .addNode('tools', new ToolNode(this.allTools))
      .addEdge(START, 'select_tools')
      .addEdge('select_tools', 'agent')
      .addConditionalEdges('agent', this.shouldContinue.bind(this))
      .addEdge('tools', 'select_tools') // Re-select tools after tool execution
      .compile();

    this.logger.info(
      `✅ TOOL SELECTION GRAPH: Created with proper tool selection architecture`,
    );
    return graph;
  }
}
