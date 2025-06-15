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
  private streamingCoordinator: StreamingCoordinator;
  private documentOrchestrator: DocumentOrchestrator;
  private synthesisValidator: SynthesisValidator;
  private progressIndicator: ProgressIndicatorManager;
  private routingDisplay: ResponseRoutingDisplay;
  private qualityValidator: ContentQualityValidator;

  constructor(config: LangGraphWrapperConfig) {
    this.config = config;
    this.llm = config.llm;
    this.tools = config.tools;
    this.logger = config.logger;
    this.contextManager = new ContextWindowManager(config.logger, {
      enableAutoUpgrade: true,
    });
    this.streamingCoordinator = new StreamingCoordinator();
    this.documentOrchestrator = new DocumentOrchestrator(config.logger);
    this.synthesisValidator = new SynthesisValidator(config.logger);
    this.progressIndicator = new ProgressIndicatorManager();
    this.routingDisplay = new ResponseRoutingDisplay(config.logger);
    this.qualityValidator = new ContentQualityValidator(config.logger);

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

        // Enhanced query analysis for response type
        if (
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

        // Build references section
        let referencesContext = '';
        if (knowledgeBaseRefs.length > 0 || webSources.length > 0) {
          referencesContext = `\n\nIMPORTANT REFERENCES TO INCLUDE:
Knowledge Base Documents Used:`;

          knowledgeBaseRefs.forEach((ref) => {
            referencesContext += `\n- ${ref.name}${ref.url ? ` (${ref.url})` : ''}`;
          });

          if (webSources.length > 0) {
            referencesContext += `\n\nWeb Sources Used:`;
            webSources.forEach((source) => {
              referencesContext += `\n- ${source.name}${source.url ? ` (${source.url})` : ''}`;
            });
          }

          referencesContext += `\n\nYou MUST include a "References" section at the end with these sources as clickable links.`;
        }

        const referencesInstructions = `
## References Section Requirements:
- ALWAYS include a "References" section at the end of your response
- List all sources used in the analysis
- Format knowledge base documents as: [Document Name](URL) if URL available
- Format web sources as: [Article Title](URL)
- Group by source type: "Knowledge Base Documents" and "Web Sources"`;

        const synthesisSystemMessage = new SystemMessage({
          content: `You are an expert research analyst creating ${responseType}s. Your task is to synthesize information from multiple sources into a coherent, well-structured analysis.

RESPONSE FORMATTING REQUIREMENTS:
- Use clear markdown formatting with proper headers (##, ###)
- Create well-organized sections with logical flow
- Use bullet points and numbered lists for clarity
- Make all document and source names clickable links using [Name](URL) format
- Use **bold** for key terms and emphasis
- Include specific examples and quotes from sources when relevant

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
- Ensure all links are properly formatted as [Text](URL) - never show raw URLs

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
    const MAX_ITERATIONS = 5;

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
    // PHASE 8 TRUE REAL-TIME STREAMING: Direct token capture during LangGraph execution
    this.logger.info(
      'Using Phase 8 True Real-Time Streaming: Token capture during LangGraph execution',
    );

    // Reset streaming coordinator for new request
    this.streamingCoordinator.reset();

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
      asana_list_tasks: '📋 Fetching tasks...\n',
      asana_create_task: '✅ Creating task...\n',
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

        // Handle progress updates during tool execution
        if (event.event === 'on_tool_start') {
          const toolName = event.name;
          const progressMessage = this.getToolProgressMessage(toolName);
          if (progressMessage) {
            yield encoder.encode(progressMessage);
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
}

/**
 * Factory function to create a SimpleLangGraphWrapper instance
 */
export function createLangGraphWrapper(
  config: LangGraphWrapperConfig,
): SimpleLangGraphWrapper {
  return new SimpleLangGraphWrapper(config);
}
