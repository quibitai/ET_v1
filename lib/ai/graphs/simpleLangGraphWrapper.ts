/**
 * Simple LangGraph Wrapper - PROPERLY IMPLEMENTED WITH LANGGRAPH API
 *
 * Provides a true LangGraph implementation with proper state management,
 * node definitions, and TypeScript compatibility.
 */

import type { ChatOpenAI } from '@langchain/openai';
import {
  type AIMessage,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { RequestLogger } from '../../services/observabilityService';
import { ContextWindowManager } from '../core/contextWindowManager';

import {
  RunnableSequence,
  RunnableLambda,
  type Runnable,
} from '@langchain/core/runnables';
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
 * SimpleLangGraphWrapper - Proper LangGraph Implementation
 */
export class SimpleLangGraphWrapper {
  private config: LangGraphWrapperConfig;
  private llm: ChatOpenAI;
  private tools: any[];
  private logger: RequestLogger;
  private graph: any; // Use any for the compiled graph to avoid complex type issues
  private contextManager: ContextWindowManager;

  constructor(config: LangGraphWrapperConfig) {
    this.config = config;
    this.llm = config.llm;
    this.tools = config.tools;
    this.logger = config.logger;
    this.contextManager = new ContextWindowManager(config.logger, {
      enableAutoUpgrade: true,
    });

    // Fix memory leak warnings by increasing max listeners
    if (typeof process !== 'undefined' && process.setMaxListeners) {
      process.setMaxListeners(20);
    }

    // Initialize and compile the LangGraph immediately
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

      // Bind tools to LLM for structured tool calling
      let llmWithTools = currentLLM.bindTools(this.tools);

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

      if (currentIterationCount > MAX_ITERATIONS) {
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

        if (toolChoiceOption) {
          // Re-bind tools with tool_choice option
          // Try different formats to see which one works
          this.logger.info(
            `[LangGraph Agent] Attempting to bind tools with tool_choice: ${toolChoiceOption}`,
          );

          try {
            // First try: just the tool name (as per docs)
            llmWithTools = this.llm.bindTools(this.tools, {
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
              llmWithTools = this.llm.bindTools(this.tools, {
                tool_choice: {
                  type: 'function',
                  function: { name: toolChoiceOption },
                },
              });
              this.logger.info(
                '[LangGraph Agent] ✅ Successfully bound tools with tool_choice (OpenAI format)',
              );
            } else {
              llmWithTools = this.llm.bindTools(this.tools, {
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
    return RunnableLambda.from((state: GraphState): Partial<GraphState> => {
      this.logger.info(
        '[LangGraph Conversational] Processing existing conversational response',
      );

      // The AI response is already in the state from the agent node
      // Just pass it through - no need to call LLM again
      return {};
    }).withConfig({ tags: ['final_node', 'conversational'] }) as Runnable<
      GraphState,
      Partial<GraphState>
    >;
  }

  /**
   * Simple Response Node
   * Formats tool results for direct output without synthesis
   */
  private simpleResponseNode(): Runnable<GraphState, Partial<GraphState>> {
    const simpleResponseChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.logger.info(
          '[LangGraph Simple Response] Formatting tool results for direct output',
        );

        // Find tool messages
        const toolMessages = state.messages.filter(
          (msg) => msg._getType() === 'tool',
        );

        if (toolMessages.length === 0) {
          // No tool results, provide a simple acknowledgment
          return [
            new SystemMessage({
              content:
                'Provide a brief acknowledgment that the request was processed.',
            }),
          ];
        }

        // Check if we have document content results - prioritize these for content requests
        let hasDocumentContent = false;
        let documentContentResult = null;

        for (const toolMsg of toolMessages) {
          const content =
            typeof toolMsg.content === 'string'
              ? toolMsg.content
              : JSON.stringify(toolMsg.content) || 'No content';

          try {
            const parsed = JSON.parse(content);
            if (
              parsed.success &&
              parsed.document &&
              parsed.content &&
              String(parsed.content).length > 500
            ) {
              hasDocumentContent = true;
              documentContentResult = parsed;
              break;
            }
          } catch {
            // Not JSON, continue
          }
        }

        // If we have substantial document content, show only that (for content requests)
        if (hasDocumentContent && documentContentResult) {
          return [
            new SystemMessage({
              content: `Present the following document content clearly to the user. This is the complete content they requested:\n\n${documentContentResult.content}`,
            }),
            new HumanMessage({
              content:
                'Please present this document content in a clean, readable format.',
            }),
          ];
        }

        // Otherwise, format tool results into a clean response
        let formattedContent = '📋 **Results:**\n\n';

        for (const toolMsg of toolMessages) {
          const content =
            typeof toolMsg.content === 'string'
              ? toolMsg.content
              : JSON.stringify(toolMsg.content) || 'No content';

          try {
            // Try to parse and format JSON content
            const parsed = JSON.parse(content);

            // Handle different response structures
            if (
              parsed.success &&
              parsed.available_documents &&
              Array.isArray(parsed.available_documents)
            ) {
              // This is a document list response
              const cleanContent = parsed.available_documents
                .map((item: any, index: number) => {
                  if (
                    item &&
                    typeof item === 'object' &&
                    item.title &&
                    item.url
                  ) {
                    const title = String(item.title).replace(
                      /[^\w\s\-\.]/g,
                      '',
                    );
                    const createdAt = item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : 'Unknown';
                    const url = String(item.url);
                    return `${index + 1}. **${title}**\n   - Created: ${createdAt}\n   - URL: ${url}`;
                  }
                  return `${index + 1}. ${String(item).substring(0, 200)}...`;
                })
                .join('\n');
              formattedContent += `${cleanContent}\n\n`;
            } else if (parsed.success && parsed.document && parsed.content) {
              // This is a document content response - show ONLY the content for content requests
              // Check if this appears to be a content request by looking at the full content length
              const fullContent = String(parsed.content);

              // If we have substantial content (>500 chars), this is likely a full content request
              // Show only the content without metadata
              if (fullContent.length > 500) {
                formattedContent = fullContent; // Replace the entire formatted content with just the document content
              } else {
                // Short content - treat as preview
                const doc = parsed.document;
                const title = String(doc.title || 'Untitled').replace(
                  /[^\w\s\-\.]/g,
                  '',
                );
                const createdAt = doc.created_at
                  ? new Date(doc.created_at).toLocaleDateString()
                  : 'Unknown';
                const url = String(doc.url || '');
                formattedContent += `**${title}**\n- Created: ${createdAt}\n- URL: ${url}\n\n`;
                formattedContent += `**Content Preview:**\n${fullContent}\n\n`;
              }
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              // Handle direct array responses
              const cleanContent = parsed
                .map((item: any, index: number) => {
                  if (
                    item &&
                    typeof item === 'object' &&
                    item.title &&
                    item.url
                  ) {
                    const title = String(item.title).replace(
                      /[^\w\s\-\.]/g,
                      '',
                    );
                    const createdAt = item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : 'Unknown';
                    const url = String(item.url);
                    return `${index + 1}. **${title}**\n   - Created: ${createdAt}\n   - URL: ${url}`;
                  }
                  return `${index + 1}. ${String(item).substring(0, 200)}...`;
                })
                .join('\n');
              formattedContent += `${cleanContent}\n\n`;
            } else {
              // Generic object or other structure
              formattedContent += `${String(content).substring(0, 1000)}\n\n`;
            }
          } catch {
            // Not JSON, use as-is
            formattedContent += `${String(content).substring(0, 1000)}\n\n`;
          }
        }

        return [
          new SystemMessage({
            content: `You are a helpful assistant. Please format and present the following information in a clean, readable way for the user. Do not include any JSON or raw data - just present the information clearly:\n\n${formattedContent.trim()}`,
          }),
          new HumanMessage({
            content:
              'Please present this information in a clean, user-friendly format.',
          }),
        ];
      }),
      this.llm,
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.logger.info(
          '[LangGraph Simple Response] Simple response completed',
        );
        return { messages: [aiMessage] };
      }),
    ]);

    return simpleResponseChain.withConfig({ tags: ['final_node'] }) as Runnable<
      GraphState,
      Partial<GraphState>
    >;
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

        // Extract knowledge base document references from tool results
        const knowledgeBaseRefs: Array<{ name: string; url?: string }> = [];
        const documentUrls = new Map<string, string>(); // Map document names to URLs

        state.messages
          .filter((msg) => msg._getType() === 'tool')
          .forEach((msg) => {
            const toolName = (msg as any)?.name;
            const content = msg.content;

            // First pass: collect all document URLs from listDocuments
            if (toolName === 'listDocuments' && typeof content === 'string') {
              try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                  parsed.forEach((doc: any) => {
                    if (doc?.title && doc?.url) {
                      // Store the URL mapping for later use
                      documentUrls.set(doc.title.toLowerCase(), doc.url);
                      documentUrls.set(doc.title, doc.url); // Also store exact case
                    }
                  });
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          });

        // Second pass: identify documents that were actually used
        state.messages
          .filter((msg) => msg._getType() === 'tool')
          .forEach((msg) => {
            const toolName = (msg as any)?.name;
            const content = msg.content;

            // Check for getDocumentContents results - these are documents that were actually used
            if (
              toolName === 'getDocumentContents' &&
              typeof content === 'string'
            ) {
              // Extract document name from the content
              const docNameMatch =
                content.match(/Document:\s*([^\n]+)/i) ||
                content.match(/File:\s*([^\n]+)/i) ||
                content.match(/Title:\s*([^\n]+)/i) ||
                content.match(/^([^:\n]+):/m); // Fallback: first line with colon

              if (docNameMatch?.[1]) {
                const docName = docNameMatch[1].trim();

                // Try to find the URL from our collected URLs
                let docUrl =
                  documentUrls.get(docName) ||
                  documentUrls.get(docName.toLowerCase());

                // If no exact match, try partial matching
                if (!docUrl) {
                  for (const [
                    storedName,
                    storedUrl,
                  ] of documentUrls.entries()) {
                    if (
                      storedName
                        .toLowerCase()
                        .includes(docName.toLowerCase()) ||
                      docName.toLowerCase().includes(storedName.toLowerCase())
                    ) {
                      docUrl = storedUrl;
                      break;
                    }
                  }
                }

                // Add to references if not already present
                if (!knowledgeBaseRefs.some((ref) => ref.name === docName)) {
                  knowledgeBaseRefs.push({
                    name: docName,
                    url: docUrl,
                  });
                }
              }
            }
          });

        const userQuery = state.messages
          .filter((msg) => msg._getType() === 'human')
          .map((msg) => msg.content)
          .join(' ');

        // Determine the appropriate response type based on user query
        let responseType = 'comprehensive response';
        let responseInstructions =
          'Create a well-structured, professional response';

        const queryLower = userQuery.toLowerCase();

        if (queryLower.includes('report')) {
          responseType = 'research report';
          responseInstructions =
            'Create a comprehensive research report with clear sections, analysis, and findings';
        } else if (
          queryLower.includes('brief') ||
          queryLower.includes('creative brief')
        ) {
          responseType = 'creative brief';
          responseInstructions =
            'Create a professional creative brief with project overview, objectives, target audience, key messages, and creative direction';
        } else if (queryLower.includes('proposal')) {
          responseType = 'proposal';
          responseInstructions =
            'Create a professional proposal with clear recommendations, scope, and next steps';
        } else if (queryLower.includes('summary')) {
          responseType = 'summary';
          responseInstructions =
            'Create a concise summary highlighting the key points and findings';
        } else if (
          queryLower.includes('analysis') ||
          queryLower.includes('analyze')
        ) {
          responseType = 'analysis';
          responseInstructions =
            'Create a detailed analysis with insights, patterns, and strategic recommendations';
        }

        // Prepare knowledge base references for inclusion
        let kbReferencesText = '';
        if (knowledgeBaseRefs.length > 0) {
          kbReferencesText = `

Knowledge Base Documents Referenced:
${knowledgeBaseRefs
  .map((ref) => (ref.url ? `- [${ref.name}](${ref.url})` : `- ${ref.name}`))
  .join('\n')}`;
        }

        const synthesisSystemMessage = new SystemMessage({
          content: `You are a professional content specialist. Your task is to create a ${responseType} based on the provided tool results and user request.

CRITICAL RULES:
- Your response MUST start immediately with an appropriate title using markdown heading 1 (e.g., "# Creative Brief: ..." or "# Analysis: ..." or "# Proposal: ...").
- You MUST NOT include any conversational phrases, greetings, introductions, or any text like "Here is the..." or "How can I assist...".
- Your entire response must be the requested content itself.
- Use ONLY the tool results provided. Do not add outside information.
- Format with clear markdown headings, lists, and tables for readability.
- ${responseInstructions}
- IMPORTANT: Include a "## References" section at the end that lists both web sources AND knowledge base documents that were used.
- DO NOT include "End of Report", "End of Document", or any closing statements after the References section.
- Format Knowledge Base documents as clickable links when URLs are provided: [Document Name](URL)

Current date: ${new Date().toISOString()}`,
        });

        const synthesisInstruction = new HumanMessage({
          content: `User Request: "${userQuery}"

Tool Results Available:
---
${toolResults}
---${kbReferencesText}

Create the ${responseType} now. Make sure to include both web sources and knowledge base documents in your References section.`,
        });

        this.logger.info('[LangGraph Synthesis] Invoking LLM for synthesis.', {
          toolResultsLength: toolResults.length,
          userQueryLength: userQuery.length,
          responseType,
          knowledgeBaseRefsCount: knowledgeBaseRefs.length,
        });

        return [synthesisSystemMessage, synthesisInstruction];
      }),
      this.llm,
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

    return synthesisChain.withConfig({
      tags: ['final_node', 'synthesis'],
    }) as Runnable<GraphState, Partial<GraphState>>;
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

    this.logger.info('[LangGraph Tools] Found tool calls:', {
      tool_calls: lastMessage.tool_calls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        id: tc.id,
      })),
    });

    try {
      const toolNode = new ToolNode(this.tools);
      // ToolNode.invoke expects the messages array directly
      const toolMessages = await toolNode.invoke(state.messages, config);

      this.logger.info('[LangGraph Tools] Tool execution completed', {
        toolMessageCount: Array.isArray(toolMessages) ? toolMessages.length : 1,
      });

      // Return the tool messages to be added to the state
      return {
        messages: Array.isArray(toolMessages) ? toolMessages : [toolMessages],
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

    // 1. If the last AI message has tool calls, route to the tool executor
    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      this.logger.info('[LangGraph Router] Decision: Route to tools node.');
      return 'use_tools';
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
      const needsSynthesis = state.needsSynthesis ?? true; // Default to true for backward compatibility

      this.logger.info(
        '[LangGraph Router] Tool results exist, checking synthesis requirement',
        {
          needsSynthesis,
          defaultedToTrue: state.needsSynthesis === undefined,
          circuitBreakerHit: toolForcingCount >= MAX_TOOL_FORCING,
        },
      );

      // RESPECT needsSynthesis flag regardless of circuit breaker
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
      // Check if the last message is an AI response without tool calls (conversational response)
      if (
        lastMessage &&
        lastMessage._getType() === 'ai' &&
        lastMessage.content
      ) {
        this.logger.info(
          '[LangGraph Router] Decision: AI provided conversational response. Finishing graph.',
        );
        return 'conversational_response';
      }

      this.logger.warn(
        '[LangGraph Router] Decision: No tool calls and no results. Finishing graph to prevent loops.',
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
   */
  async *stream(
    inputMessages: BaseMessage[],
    config?: RunnableConfig,
    needsSynthesis = true,
  ): AsyncGenerator<Uint8Array> {
    this.logger.info('Streaming LangGraph execution with real-time events.', {
      inputMessageCount: inputMessages.length,
      needsSynthesis,
    });

    const initialState = {
      messages: inputMessages,
      iterationCount: 0,
      toolForcingCount: 0,
      needsSynthesis,
    };
    const encoder = new TextEncoder();

    // Use streamEvents to get real-time updates from the graph
    const eventStream = this.graph.streamEvents(initialState, {
      ...config,
      version: 'v2',
    });

    let hasStreamedSynthesis = false;
    let hasStreamedConversational = false;
    let finalState: any = null;
    const toolResults: any[] = [];

    try {
      yield encoder.encode('🔍 Analyzing your request...\n\n');

      for await (const event of eventStream) {
        if (event.event === 'on_chain_start') {
          // A node is starting to run
          const nodeName = event.name;
          if (nodeName === 'execute_tools') {
            yield encoder.encode('🛠️ Gathering information...\n');
          } else if (nodeName === 'simple_response') {
            yield encoder.encode('\n📋 Formatting results...\n\n');
          } else if (nodeName === 'conversational_response') {
            yield encoder.encode('\n💬 Preparing response...\n\n');
          } else if (nodeName === 'synthesis') {
            yield encoder.encode('\n📝 Generating your research report...\n\n');
          }
        }

        if (event.event === 'on_tool_start') {
          // A specific tool is starting
          const toolName = event.data.input.tool;
          const query = event.data.input.tool_input?.query;
          if (toolName === 'tavilySearch') {
            yield encoder.encode(`🌐 Searching the web for "${query}"...\n`);
          } else if (toolName === 'searchInternalKnowledgeBase') {
            yield encoder.encode(
              `📚 Searching knowledge base for "${query}"...\n`,
            );
          }
        }

        if (event.event === 'on_tool_end') {
          // Capture tool results for non-synthesis cases
          const toolName = event.name;
          const toolOutput = event.data.output;
          if (toolOutput) {
            toolResults.push({
              name: toolName,
              content: toolOutput.content || toolOutput,
            });
          }
        }

        if (
          event.event === 'on_chat_model_stream' &&
          event.tags?.includes('final_node')
        ) {
          // This is a token from a final node's LLM (synthesis or conversational)
          const content = event.data?.chunk?.content;
          if (typeof content === 'string') {
            // Check if this is from synthesis or conversational response
            if (event.tags?.includes('synthesis')) {
              hasStreamedSynthesis = true;
            } else if (event.tags?.includes('conversational')) {
              hasStreamedConversational = true;
            }
            yield encoder.encode(content);
          }
        }

        // Capture the final state for simple queries
        if (event.event === 'on_chain_end' && event.name === 'LangGraph') {
          finalState = event.data.output;
        }
      }

      // If no synthesis or conversational response was streamed, handle accordingly
      if (
        !hasStreamedSynthesis &&
        !hasStreamedConversational &&
        !needsSynthesis
      ) {
        this.logger.info(
          '[LangGraph Stream] No synthesis or conversational response streamed, outputting results directly',
        );

        // Use captured tool results or fall back to final state
        const toolMessages =
          toolResults.length > 0
            ? toolResults
            : finalState?.messages?.filter(
                (msg: any) => msg._getType() === 'tool',
              ) || [];

        if (toolMessages.length > 0) {
          yield encoder.encode('\n📋 **Results:**\n\n');

          for (const toolMsg of toolMessages) {
            const toolName = toolMsg.name || 'Tool';
            const content = toolMsg.content || 'No content';

            // Safely handle content formatting
            let cleanContent = '';
            try {
              // First, ensure content is a string
              const contentStr =
                typeof content === 'string' ? content : JSON.stringify(content);

              // Try to parse as JSON
              const parsed = JSON.parse(contentStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                cleanContent = parsed
                  .map((item, index) => {
                    if (
                      item &&
                      typeof item === 'object' &&
                      item.title &&
                      item.url
                    ) {
                      const title = String(item.title).replace(
                        /[^\w\s\-\.]/g,
                        '',
                      ); // Clean title
                      const createdAt = item.created_at || 'Unknown';
                      const url = String(item.url);
                      return `${index + 1}. **${title}**\n   - Created: ${createdAt}\n   - URL: ${url}\n`;
                    }
                    return `${index + 1}. ${String(item).substring(0, 200)}...\n`;
                  })
                  .join('\n');
              } else if (parsed && typeof parsed === 'object') {
                cleanContent = JSON.stringify(parsed, null, 2).substring(
                  0,
                  1000,
                );
              } else {
                cleanContent = String(parsed).substring(0, 1000);
              }
            } catch (parseError) {
              // Not JSON or parsing failed, use content as-is but safely
              cleanContent = String(content).substring(0, 1000);
            }

            // Ensure clean content is safe for streaming
            cleanContent = cleanContent.trim();

            // Don't show tool name if it's obvious from context
            if (
              toolName.toLowerCase().includes('search') ||
              toolName.toLowerCase().includes('list')
            ) {
              yield encoder.encode(`${cleanContent}\n\n`);
            } else {
              yield encoder.encode(`**${toolName}:**\n${cleanContent}\n\n`);
            }
          }
        } else {
          // No tool results - check if there's a conversational AI response
          const aiMessages =
            finalState?.messages?.filter(
              (msg: any) => msg._getType() === 'ai',
            ) || [];

          if (aiMessages.length > 0) {
            const lastAiMessage = aiMessages[aiMessages.length - 1];
            const aiContent = lastAiMessage.content;

            if (aiContent && typeof aiContent === 'string') {
              this.logger.info(
                '[LangGraph Stream] Streaming conversational AI response from final state',
              );
              // Stream the content token by token to simulate real-time streaming
              const words = aiContent.split(' ');
              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const isLastWord = i === words.length - 1;
                yield encoder.encode(word + (isLastWord ? '' : ' '));
                // Small delay to simulate streaming
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
              yield encoder.encode('\n');
            } else {
              yield encoder.encode(
                '\n✅ **Request completed successfully.**\n',
              );
            }
          } else {
            yield encoder.encode('\n✅ **Request completed successfully.**\n');
          }
        }
      }

      this.logger.info('LangGraph event stream completed.');
    } catch (error) {
      this.logger.error('Error in LangGraph event streaming', { error });

      // If we have tool results but streaming failed, try to output them
      if (
        !hasStreamedSynthesis &&
        !hasStreamedConversational &&
        !needsSynthesis &&
        toolResults.length > 0
      ) {
        this.logger.info(
          '[LangGraph Stream] Streaming failed but tool results available, outputting directly',
        );
        try {
          yield encoder.encode('\n📋 **Results:**\n\n');

          for (const toolMsg of toolResults) {
            const content = toolMsg.content || 'No content';

            // Safely handle content formatting
            let cleanContent = '';
            try {
              // First, ensure content is a string
              const contentStr =
                typeof content === 'string' ? content : JSON.stringify(content);

              // Try to parse as JSON
              const parsed = JSON.parse(contentStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                cleanContent = parsed
                  .map((item, index) => {
                    if (
                      item &&
                      typeof item === 'object' &&
                      item.title &&
                      item.url
                    ) {
                      const title = String(item.title).replace(
                        /[^\w\s\-\.]/g,
                        '',
                      ); // Clean title
                      const createdAt = item.created_at || 'Unknown';
                      const url = String(item.url);
                      return `${index + 1}. **${title}**\n   - Created: ${createdAt}\n   - URL: ${url}\n`;
                    }
                    return `${index + 1}. ${String(item).substring(0, 200)}...\n`;
                  })
                  .join('\n');
              } else if (parsed && typeof parsed === 'object') {
                cleanContent = JSON.stringify(parsed, null, 2).substring(
                  0,
                  1000,
                );
              } else {
                cleanContent = String(parsed).substring(0, 1000);
              }
            } catch (parseError) {
              // Not JSON or parsing failed, use content as-is but safely
              cleanContent = String(content).substring(0, 1000);
            }

            // Ensure clean content is safe for streaming
            cleanContent = cleanContent.trim();

            yield encoder.encode(`${cleanContent}\n\n`);
          }
        } catch (fallbackError) {
          this.logger.error('Error in fallback tool result output', {
            fallbackError,
          });
          yield encoder.encode('\n❌ **Error:** Unable to display results.\n');
        }
      } else {
        yield encoder.encode(
          '\n❌ **Error:** An unexpected error occurred during processing.\n',
        );
      }
    }
  }

  /**
   * Get configuration for compatibility with existing code
   */
  getConfig(): LangGraphWrapperConfig {
    return this.config;
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
