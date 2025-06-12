/**
 * LangChain Integration Bridge
 *
 * Connects our modern BrainOrchestrator architecture with existing LangChain
 * tools, agents, and enhanced executor while adding observability and performance monitoring.
 * Now supports optional LangGraph integration for complex multi-step reasoning.
 */

import { ChatOpenAI } from '@langchain/openai';
import { type AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import {
  type ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { modelMapping } from '@/lib/ai/models';
import { createLangChainToolService } from './langchainToolService';
import { createLangChainStreamingService } from './langchainStreamingService';

// Import LangGraph support with UI capabilities
import { createLangGraphWrapper, shouldUseLangGraph } from '@/lib/ai/graphs';
import type { SimpleLangGraphWrapper } from '@/lib/ai/graphs/simpleLangGraphWrapper';

// Import message saving dependencies
import { saveMessages } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { randomUUID } from 'node:crypto';
import type { DBMessage } from '@/lib/db/schema';

// Type imports
import type { RequestLogger } from './observabilityService';
import type { ClientConfig } from '@/lib/db/queries';
import type { LangChainToolConfig } from './langchainToolService';
import type { LangGraphWrapperConfig } from '@/lib/ai/graphs';
import type { BrainRequest } from '@/lib/validation/brainValidation';

/**
 * Configuration for LangChain bridge
 */
export interface LangChainBridgeConfig {
  selectedChatModel?: string;
  contextId?: string | null;
  clientConfig?: ClientConfig | null;
  enableToolExecution?: boolean;
  maxTools?: number;
  maxIterations?: number;
  verbose?: boolean;
  // New LangGraph options
  enableLangGraph?: boolean;
  langGraphPatterns?: string[];
  // NEW: Tool forcing directive from QueryClassifier
  forceToolCall?: { name: string } | 'required' | null;
}

/**
 * LangChain agent and executor wrapper
 * Now supports both AgentExecutor and LangGraph
 */
export interface LangChainAgent {
  agentExecutor?: AgentExecutor;
  langGraphWrapper?: SimpleLangGraphWrapper;
  tools: any[];
  llm: ChatOpenAI;
  prompt?: ChatPromptTemplate;
  executionType: 'agent' | 'langgraph';
}

/**
 * Initialize LangChain LLM with model mapping
 */
function initializeLLM(
  config: LangChainBridgeConfig,
  logger: RequestLogger,
): ChatOpenAI {
  const startTime = performance.now();

  // Use the model mapping to determine the correct model based on contextId
  let selectedModel: string;

  if (config.contextId && modelMapping[config.contextId]) {
    selectedModel = modelMapping[config.contextId];
  } else if (config.selectedChatModel) {
    selectedModel = config.selectedChatModel;
  } else {
    selectedModel = process.env.DEFAULT_MODEL_NAME || modelMapping.default;
  }

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  logger.info('Initializing LLM with model', {
    selectedModel,
    contextId: config.contextId,
    requestedModel: config.selectedChatModel,
  });

  // Initialize OpenAI Chat model
  const llm = new ChatOpenAI({
    modelName: selectedModel,
    temperature: 0.7,
    apiKey: process.env.OPENAI_API_KEY,
    streaming: true,
    callbacks: [],
  });

  const duration = performance.now() - startTime;
  logger.info('LLM initialized successfully', {
    model: selectedModel,
    initTime: `${duration.toFixed(2)}ms`,
  });

  return llm;
}

/**
 * Select and filter tools based on context and configuration
 * Now uses LangChainToolService for better organization
 */
function selectTools(
  config: LangChainBridgeConfig,
  logger: RequestLogger,
): any[] {
  const toolConfig: LangChainToolConfig = {
    contextId: config.contextId,
    clientConfig: config.clientConfig,
    enableToolExecution: config.enableToolExecution,
    maxTools: config.maxTools,
    verbose: config.verbose,
  };

  const toolService = createLangChainToolService(logger, toolConfig);
  const result = toolService.selectTools();

  return result.tools;
}

/**
 * Create LangChain agent with tools and prompt
 * Now supports optional LangGraph integration
 */
export async function createLangChainAgent(
  systemPrompt: string,
  config: LangChainBridgeConfig,
  logger: RequestLogger,
): Promise<LangChainAgent> {
  const startTime = performance.now();
  logger.info('Creating LangChain agent with config', { ...config });

  // Initialize LLM
  const llmStartTime = performance.now();
  // Define llm as 'const' as it is not reassigned
  const llm = new ChatOpenAI({
    modelName: modelMapping[config.selectedChatModel || 'default'],
    temperature: 0.7,
    maxRetries: 2,
    verbose: config.verbose || false,
  });
  const llmDuration = performance.now() - llmStartTime;

  // Select tools using the new LangChainToolService
  const toolStartTime = performance.now();
  const tools =
    config.enableToolExecution !== false ? selectTools(config, logger) : [];
  const toolDuration = performance.now() - toolStartTime;

  // --- ARCHITECTURAL FIX: Force LangGraph for all agentic workflows ---
  // The AgentExecutor's .stream() method does not properly handle multi-step
  // tool use and gets stuck in loops. LangGraph is designed for this.
  logger.info(
    '[Architectural Override] Forcing LangGraph execution path for robustness.',
  );

  const langGraphConfig: LangGraphWrapperConfig = {
    systemPrompt,
    llm,
    tools,
    logger,
    forceToolCall: config.forceToolCall,
  };

  const langGraphWrapper = createLangGraphWrapper(langGraphConfig);

  const totalDuration = performance.now() - startTime;
  logger.info('LangGraph wrapper created successfully', {
    setupTime: `${totalDuration.toFixed(2)}ms`,
    toolCount: tools.length,
    forceToolCall: config.forceToolCall,
  });

  return {
    langGraphWrapper,
    tools,
    llm,
    executionType: 'langgraph',
  };
}

/**
 * Execute LangChain agent with proper error handling
 * Now supports both AgentExecutor and LangGraph
 */
export async function executeLangChainAgent(
  agent: LangChainAgent,
  input: string,
  chatHistory: any[],
  config: LangChainBridgeConfig,
  logger: RequestLogger,
): Promise<any> {
  const startTime = performance.now();

  logger.info('Executing LangChain agent', {
    inputLength: input.length,
    historyLength: chatHistory.length,
    executionType: agent.executionType,
  });

  try {
    let result: any;

    if (agent.executionType === 'langgraph' && agent.langGraphWrapper) {
      // Execute with LangGraph wrapper - convert to BaseMessage[]
      const messages = chatHistory.map((msg) => {
        if (msg.type === 'human' || msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.type === 'ai' || msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else {
          return new SystemMessage(msg.content);
        }
      });

      // Add system prompt and user input
      const wrapperConfig = agent.langGraphWrapper.getConfig();
      const fullConversation = [
        new SystemMessage(wrapperConfig.systemPrompt),
        ...messages,
        new HumanMessage(input),
      ];

      result = await agent.langGraphWrapper.invoke(fullConversation);
    } else if (agent.executionType === 'agent' && agent.agentExecutor) {
      // Execute with traditional AgentExecutor
      result = await agent.agentExecutor.invoke({
        input,
        chat_history: chatHistory,
        activeBitContextId: config.contextId,
      });
    } else {
      throw new Error(`Invalid agent configuration: ${agent.executionType}`);
    }

    const duration = performance.now() - startTime;
    logger.info('LangChain agent execution completed', {
      executionTime: `${duration.toFixed(2)}ms`,
      outputLength: result?.output?.length || 0,
      executionType: agent.executionType,
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('LangChain agent execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: `${duration.toFixed(2)}ms`,
      executionType: agent.executionType,
    });
    throw error;
  }
}

/**
 * Stream LangChain agent execution
 * Uses proper LangChain streaming methods with LangChainAdapter or createDataStreamResponse
 */
export async function streamLangChainAgent(
  agent: LangChainAgent,
  input: string,
  chatHistory: any[],
  config: LangChainBridgeConfig,
  logger: RequestLogger,
  artifactContext: any,
  brainRequest?: BrainRequest,
): Promise<Response> {
  logger.info('Streaming LangChain agent', {
    executionType: agent.executionType,
    toolCount: agent.tools.length,
  });

  if (agent.executionType === 'agent' && agent.agentExecutor) {
    logger.info('Using AgentExecutor execution path for streaming');

    const executorStream = await agent.agentExecutor.stream({
      input,
      chat_history: chatHistory,
    });

    const transformStream = new ReadableStream({
      async start(controller) {
        let finalResponse = '';
        let iterationCount = 0;
        const maxIterations = 15; // Set a hard limit to prevent infinite loops

        logger.info('[AgentExecutor] Starting to process stream...');
        for await (const chunk of executorStream) {
          iterationCount++;
          if (iterationCount > maxIterations) {
            logger.warn(
              '[AgentExecutor] Max iterations reached. Breaking loop.',
              { maxIterations },
            );
            const errorMessage =
              'I seem to be stuck in a loop. I will stop for now. Please try rephrasing your request.';
            finalResponse = errorMessage;
            controller.enqueue(`0:${JSON.stringify(errorMessage)}\n`);
            break;
          }

          const chunkKeys = Object.keys(chunk);
          logger.info('[AgentExecutor] Received stream chunk', {
            keys: chunkKeys,
            iteration: iterationCount,
          });

          // Log intermediate steps for debugging the loop
          if (chunk.intermediate_steps) {
            logger.info('[AgentExecutor] Intermediate step:', {
              steps: JSON.stringify(chunk.intermediate_steps, null, 2),
            });
          }

          // Check for final messages from the agent
          if (chunk.messages) {
            logger.info('[AgentExecutor] Received messages chunk', {
              messageCount: chunk.messages.length,
            });
            const lastMessage = chunk.messages[chunk.messages.length - 1];
            if (lastMessage.content) {
              const content =
                typeof lastMessage.content === 'string'
                  ? lastMessage.content
                  : JSON.stringify(lastMessage.content);
              finalResponse += content;
              controller.enqueue(`0:${JSON.stringify(content)}\n`);
              logger.info('[AgentExecutor] Enqueued final message content', {
                contentLength: content.length,
              });
            }
          }
        }
        logger.info('[AgentExecutor] Stream processing finished.', {
          finalResponseLength: finalResponse.length,
          totalIterations: iterationCount,
        });

        // Save assistant message to database
        if (brainRequest?.id && finalResponse) {
          try {
            const session = await auth();
            if (session?.user?.id) {
              const assistantMessage: DBMessage = {
                id: randomUUID(),
                chatId: brainRequest.id,
                role: 'assistant',
                parts: [{ type: 'text', text: finalResponse }],
                attachments: [],
                createdAt: new Date(),
                clientId: session.user.clientId || 'default',
              };

              await saveMessages({ messages: [assistantMessage] });
              logger.info('Assistant message saved successfully', {
                messageId: assistantMessage.id,
                chatId: assistantMessage.chatId,
                responseLength: finalResponse.length,
              });
            }
          } catch (error) {
            logger.error('Failed to save assistant message', {
              chatId: brainRequest.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        controller.close();
      },
    });

    return new Response(transformStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Execution-Path': 'langchain-agent-executor-manual-stream',
      },
    });
  }

  if (agent.executionType === 'langgraph' && agent.langGraphWrapper) {
    logger.info(
      '[LangGraph] LangGraph streaming path selected in streamLangChainAgent',
    );

    // Convert chat history to BaseMessage format
    const messages = chatHistory.map((msg) => {
      if (msg.type === 'human' || msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.type === 'ai' || msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        return new SystemMessage(msg.content);
      }
    });

    // Add system prompt and user input
    const wrapperConfig = agent.langGraphWrapper.getConfig();
    const fullConversation = [
      new SystemMessage(wrapperConfig.systemPrompt),
      ...messages,
      new HumanMessage(input),
    ];

    // Create a ReadableStream that processes LangGraph streaming events
    const transformStream = new ReadableStream({
      async start(controller) {
        try {
          logger.info('[LangGraph] Starting streaming execution');

          let finalResponse = '';
          let hasStartedStreaming = false;

          // Stream from the LangGraph wrapper
          if (!agent.langGraphWrapper) {
            throw new Error('LangGraph wrapper is not available');
          }

          for await (const event of agent.langGraphWrapper.stream(
            fullConversation,
          )) {
            try {
              // Enhanced logging for all events
              logger.info('[LangGraph] Processing streaming event', {
                eventType: event.event,
                eventName: event.name,
                hasData: !!event.data,
                hasChunk: !!event.data?.chunk,
                chunkContent: event.data?.chunk?.content
                  ? typeof event.data.chunk.content === 'string'
                    ? event.data.chunk.content.substring(0, 100)
                    : 'Non-string content'
                  : 'No chunk content',
                hasOutput: !!event.data?.output,
                outputType: event.data?.output
                  ? typeof event.data.output
                  : 'none',
              });

              // Process different types of streaming events
              if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
                // Handle AI model streaming chunks
                const chunk = event.data.chunk;
                if (chunk.content && typeof chunk.content === 'string') {
                  if (!hasStartedStreaming) {
                    hasStartedStreaming = true;
                    logger.info('[LangGraph] Started streaming AI response');
                  }
                  finalResponse += chunk.content;

                  // Format for Vercel AI SDK streaming (match AgentExecutor format)
                  const formattedChunk = `0:${JSON.stringify(chunk.content)}\n`;
                  controller.enqueue(formattedChunk);

                  logger.info('[LangGraph] Streamed chunk', {
                    chunkLength: chunk.content.length,
                    totalResponseLength: finalResponse.length,
                  });
                }
              } else if (
                event.event === 'on_chain_end' &&
                event.name === 'LangGraph'
              ) {
                // Handle final state from LangGraph completion
                logger.info('[LangGraph] LangGraph chain ended', {
                  hasOutput: !!event.data?.output,
                  outputMessageCount: event.data?.output?.messages?.length || 0,
                });

                const finalState = event.data?.output;
                if (finalState?.messages?.length > 0) {
                  const lastMessage =
                    finalState.messages[finalState.messages.length - 1];
                  logger.info('[LangGraph] Final state last message', {
                    messageType: lastMessage._getType?.() || 'unknown',
                    hasContent: !!lastMessage.content,
                    contentLength:
                      typeof lastMessage.content === 'string'
                        ? lastMessage.content.length
                        : 0,
                    contentPreview:
                      typeof lastMessage.content === 'string'
                        ? lastMessage.content.substring(0, 200)
                        : 'Non-string content',
                  });

                  if (lastMessage.content && !hasStartedStreaming) {
                    // If we haven't streamed anything yet, send the final content
                    finalResponse = lastMessage.content;
                    const formattedChunk = `0:${JSON.stringify(lastMessage.content)}\n`;
                    controller.enqueue(formattedChunk);
                    hasStartedStreaming = true;
                    logger.info(
                      '[LangGraph] Sent final state content as fallback',
                    );
                  }
                }
              } else if (
                event.event === 'on_chain_end' &&
                event.name === 'agent'
              ) {
                // Handle AI agent responses that may not have streaming chunks
                logger.info('[LangGraph] Agent node ended', {
                  hasOutput: !!event.data?.output,
                  outputType: event.data?.output
                    ? typeof event.data.output
                    : 'none',
                });

                const output = event.data?.output;
                if (output?.content) {
                  // Always capture agent responses, whether streaming started or not
                  if (!hasStartedStreaming) {
                    finalResponse = output.content;
                    const formattedChunk = `0:${JSON.stringify(output.content)}\n`;
                    controller.enqueue(formattedChunk);
                    hasStartedStreaming = true;
                    logger.info('[LangGraph] Sent non-streaming AI response', {
                      contentLength: output.content.length,
                    });
                  } else {
                    // If we were already streaming, this might be a follow-up response after tools
                    finalResponse += output.content;
                    const formattedChunk = `0:${JSON.stringify(output.content)}\n`;
                    controller.enqueue(formattedChunk);
                    logger.info(
                      '[LangGraph] Sent follow-up AI response after tools',
                      {
                        contentLength: output.content.length,
                        totalResponseLength: finalResponse.length,
                      },
                    );
                  }
                }
              } else if (event.event === 'on_tool_start') {
                // Handle tool execution start
                logger.info('[LangGraph] Tool execution started', {
                  toolName: event.name,
                });
              } else if (event.event === 'on_tool_end') {
                // Handle tool execution completion
                logger.info('[LangGraph] Tool execution completed', {
                  toolName: event.name,
                });
              }

              // Handle UI events (artifacts, etc.)
              if (
                event.data?.ui &&
                Array.isArray(event.data.ui) &&
                event.data.ui.length > 0
              ) {
                for (const uiEvent of event.data.ui) {
                  if (uiEvent && typeof uiEvent === 'object') {
                    // Send UI events in the proper format for the frontend
                    const uiChunk = `2:${JSON.stringify(uiEvent)}\n`;
                    controller.enqueue(uiChunk);
                  }
                }
              }
            } catch (eventError) {
              logger.warn('[LangGraph] Error processing streaming event', {
                error:
                  eventError instanceof Error
                    ? eventError.message
                    : 'Unknown error',
                eventType: event.event,
              });
            }
          }

          // Ensure we have some response - if streaming didn't capture the final response,
          // invoke the LangGraph directly to get the result
          if (!hasStartedStreaming && !finalResponse) {
            logger.info(
              '[LangGraph] No streaming response captured, invoking directly',
            );
            try {
              const directResult =
                await agent.langGraphWrapper.invoke(fullConversation);
              if (directResult?.messages?.length > 0) {
                const lastMessage =
                  directResult.messages[directResult.messages.length - 1];
                if (lastMessage.content) {
                  finalResponse =
                    typeof lastMessage.content === 'string'
                      ? lastMessage.content
                      : JSON.stringify(lastMessage.content); // Ensure we capture this for message saving
                  const formattedChunk = `0:${JSON.stringify(lastMessage.content)}\n`;
                  controller.enqueue(formattedChunk);
                  hasStartedStreaming = true;
                  logger.info(
                    '[LangGraph] Successfully sent direct invocation result',
                    {
                      contentLength: lastMessage.content.length,
                    },
                  );
                }
              }
            } catch (directError) {
              logger.error('[LangGraph] Direct invocation also failed', {
                error:
                  directError instanceof Error
                    ? directError.message
                    : 'Unknown error',
              });
            }
          }

          // Final fallback if nothing worked
          if (!hasStartedStreaming) {
            const fallbackMessage =
              'I apologize, but I was unable to process your request properly.';
            const formattedChunk = `0:${JSON.stringify(fallbackMessage)}\n`;
            controller.enqueue(formattedChunk);
          }

          logger.info('[LangGraph] Streaming completed successfully', {
            hasStartedStreaming,
            finalResponseLength: finalResponse.length,
            finalResponsePreview: finalResponse.substring(0, 200),
          });

          // Save assistant message to database
          if (brainRequest?.id && finalResponse) {
            logger.info('[LangGraph] Attempting to save assistant message', {
              chatId: brainRequest.id,
              responseLength: finalResponse.length,
            });
            try {
              const session = await auth();
              if (session?.user?.id) {
                const assistantMessage: DBMessage = {
                  id: randomUUID(),
                  chatId: brainRequest.id,
                  role: 'assistant',
                  parts: [{ type: 'text', text: finalResponse }],
                  attachments: [],
                  createdAt: new Date(),
                  clientId: session.user.clientId || 'default',
                };

                await saveMessages({ messages: [assistantMessage] });
                logger.info('Assistant message saved successfully', {
                  messageId: assistantMessage.id,
                  chatId: assistantMessage.chatId,
                  responseLength: finalResponse.length,
                });
              }
            } catch (error) {
              logger.error('Failed to save assistant message', {
                chatId: brainRequest.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          controller.close();
        } catch (error) {
          logger.error('[LangGraph] Error in streaming execution', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Send error message to user
          const errorMessage =
            'I encountered an error while processing your request. Please try again.';
          const errorChunk = `0:${JSON.stringify(errorMessage)}\n`;
          controller.enqueue(errorChunk);
          controller.close();
        }
      },
    });

    return new Response(transformStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Execution-Path': 'langchain-langgraph-streaming',
      },
    });
  }

  // Fallback for invalid configuration
  logger.error('Invalid agent configuration for streaming');
  throw new Error('Invalid agent configuration or missing components');
}

/**
 * Clean up LangChain agent resources
 * Disposes of callbacks, clears any internal state, and performs cleanup operations
 */
export function cleanupLangChainAgent(
  agent: LangChainAgent,
  logger: RequestLogger,
): void {
  try {
    logger.info('Cleaning up LangChain agent resources', {
      executionType: agent.executionType,
      toolCount: agent.tools.length,
    });

    // Clean up LLM callbacks if they exist
    if (agent.llm?.callbacks) {
      agent.llm.callbacks = [];
      logger.info('Cleared LLM callbacks');
    }

    // Clean up agent executor callbacks if present
    if (agent.executionType === 'agent' && agent.agentExecutor) {
      // AgentExecutor cleanup - we know agentExecutor exists here
      agent.agentExecutor.verbose = false;
      logger.info('Cleaned up AgentExecutor resources');
    }

    // Clean up LangGraph wrapper if present
    if (agent.executionType === 'langgraph' && agent.langGraphWrapper) {
      // LangGraph wrapper cleanup - no specific cleanup needed as it's stateless
      logger.info('LangGraph wrapper cleanup completed (stateless)');
    }

    // Clean up tools if they have cleanup methods
    agent.tools.forEach((tool, index) => {
      try {
        // Some tools might have cleanup methods
        if (tool && typeof tool.cleanup === 'function') {
          tool.cleanup();
          logger.info(`Cleaned up tool ${index}: ${tool.name || 'unnamed'}`);
        }
      } catch (toolError) {
        logger.warn(`Failed to cleanup tool ${index}`, {
          error:
            toolError instanceof Error ? toolError.message : 'Unknown error',
        });
      }
    });

    logger.info('LangChain agent cleanup completed successfully');
  } catch (error) {
    logger.error('Error during LangChain agent cleanup', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - cleanup failures shouldn't break the main flow
  }
}
