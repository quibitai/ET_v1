/**
 * LangChain Integration Bridge
 *
 * Connects our modern BrainOrchestrator architecture with existing LangChain
 * tools, agents, and enhanced executor while adding observability and performance monitoring.
 * Now supports optional LangGraph integration for complex multi-step reasoning.
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { modelMapping } from '@/lib/ai/models';
import { createLangChainToolService } from './langchainToolService';

// Import LangGraph support with UI capabilities
import { createLangGraphWrapper } from '@/lib/ai/graphs';
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
  forceToolCall?: { name: string } | 'required' | null;
}

/**
 * LangChain agent and executor wrapper
 */
export interface LangChainAgent {
  langGraphWrapper: SimpleLangGraphWrapper;
  tools: any[];
  llm: ChatOpenAI;
  executionType: 'langgraph';
}

/**
 * Create LangChain agent with tools and prompt
 * Now supports only the LangGraph execution path.
 */
export async function createLangChainAgent(
  systemPrompt: string,
  config: LangChainBridgeConfig,
  logger: RequestLogger,
): Promise<LangChainAgent> {
  const startTime = performance.now();
  logger.info('Creating LangChain agent with config', { ...config });

  // Determine the correct model
  let selectedModel: string;
  if (config.contextId && modelMapping[config.contextId]) {
    selectedModel = modelMapping[config.contextId];
  } else if (
    config.selectedChatModel &&
    modelMapping[config.selectedChatModel]
  ) {
    selectedModel = modelMapping[config.selectedChatModel];
  } else {
    selectedModel = modelMapping.default;
  }

  const llm = new ChatOpenAI({
    modelName: selectedModel,
    temperature: 0.7,
    maxRetries: 2,
    verbose: config.verbose || false,
    streaming: true,
  });

  // Select tools
  const tools =
    config.enableToolExecution !== false ? selectTools(config, logger) : [];

  // Always use LangGraph
  const langGraphConfig: LangGraphWrapperConfig = {
    systemPrompt,
    llm,
    tools,
    logger,
    forceToolCall: config.forceToolCall,
  };
  const langGraphWrapper = createLangGraphWrapper(langGraphConfig);

  const duration = performance.now() - startTime;
  logger.info('LangChain agent created successfully', {
    duration: `${duration.toFixed(2)}ms`,
    executionType: 'langgraph',
    toolCount: tools.length,
    model: selectedModel,
  });

  return {
    langGraphWrapper,
    tools,
    llm,
    executionType: 'langgraph',
  };
}

/**
 * Simplified stream function for the new architecture.
 * It sets up the conversation and returns the raw stream from the LangGraph wrapper.
 * The responsibility of creating a Response object is now delegated to the API route.
 */
export async function streamLangChainAgent(
  agent: LangChainAgent,
  input: string,
  chatHistory: any[],
  logger: RequestLogger,
  brainRequest?: BrainRequest,
  queryClassification?: any,
): Promise<AsyncGenerator<Uint8Array>> {
  // DEBUGGING: Add console.log to ensure this is being called
  console.log('🔍 [DEBUG] streamLangChainAgent called with input:', {
    input: input,
    inputLength: input.length,
    queryClassification: queryClassification ? 'provided' : 'not provided',
  });

  logger.info(
    '[LangGraph] LangGraph raw streaming path selected in streamLangChainAgent',
    { input: input.substring(0, 100) },
  );

  const messages = chatHistory.map((msg) => {
    if (msg.role === 'user') return new HumanMessage(msg.content);
    if (msg.role === 'assistant') return new AIMessage(msg.content);
    return new SystemMessage(msg.content);
  });

  const wrapperConfig = agent.langGraphWrapper.getConfig();
  const fullConversation: BaseMessage[] = [
    new SystemMessage(wrapperConfig.systemPrompt),
    ...messages,
    new HumanMessage(input),
  ];

  // Determine if synthesis is needed based on query classification
  const needsSynthesis = determineIfSynthesisNeeded(
    input,
    queryClassification,
    logger,
  );

  // Directly return the raw stream from the graph with synthesis preference
  const stream = agent.langGraphWrapper.stream(
    fullConversation,
    undefined,
    needsSynthesis,
  );

  // Note: We are no longer saving the message here.
  // This responsibility will be moved to a separate mechanism,
  // potentially triggered after the stream completes on the client side
  // or via a webhook/callback system. This decouples saving from streaming.

  return stream;
}

/**
 * Determine if a query needs synthesis based on patterns and complexity
 */
function determineIfSynthesisNeeded(
  input: string,
  queryClassification?: any,
  logger?: RequestLogger,
): boolean {
  // DEBUGGING: Add console.log to trace pattern matching
  console.log('🔍 [DEBUG] determineIfSynthesisNeeded called:', {
    input: input,
    cleanInput: input.trim().toLowerCase(),
  });

  logger?.info('[Query Classification] Analyzing query for synthesis need', {
    input: input.substring(0, 200),
    inputLength: input.length,
    queryClassification: queryClassification
      ? {
          shouldUseLangChain: queryClassification.shouldUseLangChain,
          complexityScore: queryClassification.complexityScore,
          detectedPatterns: queryClassification.detectedPatterns,
        }
      : 'not provided',
  });

  // Clean the input for pattern matching
  const cleanInput = input.trim().toLowerCase();

  // ONLY synthesize when explicitly asked for these types of outputs
  const synthesisRequiredPatterns = [
    /\breport\b/i,
    /\bresearch\b/i,
    /\banalyz[ei]/i,
    /\bcompare\b/i,
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
  ];

  // DEBUGGING: Test synthesis patterns
  console.log('🔍 [DEBUG] Testing synthesis-required patterns:');
  synthesisRequiredPatterns.forEach((pattern, index) => {
    const matches = pattern.test(cleanInput);
    console.log(
      `  Synthesis Pattern ${index}: ${pattern.toString()} -> ${matches}`,
    );
  });

  // Check if synthesis is explicitly requested
  const needsSynthesis = synthesisRequiredPatterns.some((pattern) =>
    pattern.test(cleanInput),
  );

  if (needsSynthesis) {
    console.log('🔍 [DEBUG] SYNTHESIS EXPLICITLY REQUESTED');
    logger?.info('[Query Classification] Synthesis explicitly requested', {
      input: input.substring(0, 100),
      decision: 'SYNTHESIS_NEEDED',
    });
    return true;
  }

  // For everything else, NO synthesis - just return tool results directly
  console.log(
    '🔍 [DEBUG] NO SYNTHESIS NEEDED - returning tool results directly',
  );
  logger?.info(
    '[Query Classification] No synthesis needed, returning tool results directly',
    {
      input: input.substring(0, 100),
      decision: 'NO_SYNTHESIS',
    },
  );
  return false;
}

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
  return toolService.selectTools().tools;
}
