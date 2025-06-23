/**
 * Graph Assembly and Compilation
 *
 * This module assembles the complete LangGraph with proper dependency injection,
 * corrected routing logic, and all node implementations.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphStateAnnotation } from './state';
import { routeNextStep, validateRouterLogic } from './router';
import { agentNode, type AgentNodeDependencies } from './nodes/agent';
import { toolsNode, type ToolsNodeDependencies } from './nodes/tools';
import {
  generateResponseNode,
  type GenerateResponseNodeDependencies,
} from './nodes/generateResponse';
import type { ChatOpenAI } from '@langchain/openai';
import type { RequestLogger } from '../../services/observabilityService';
import { DocumentAnalysisService } from './services/DocumentAnalysisService';
import { ContextService } from './services/ContextService';
import { QueryAnalysisService } from './services/QueryAnalysisService';

/**
 * Complete set of dependencies for the graph
 */
export interface GraphDependencies {
  llm: ChatOpenAI;
  tools: any[];
  logger: RequestLogger;
  currentDateTime?: string;
  clientConfig?: {
    client_display_name?: string;
    client_core_mission?: string;
  };
}

/**
 * Graph configuration options
 */
export interface GraphConfig {
  enableValidation?: boolean;
  enableTracing?: boolean;
  toolTimeout?: number;
}

/**
 * Compiled graph with metadata
 */
export interface CompiledGraph {
  graph: any;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    validationPassed: boolean;
    compileTime: number;
  };
}

/**
 * Create and compile the complete LangGraph with all nodes and routing
 */
export function createGraph(
  dependencies: GraphDependencies,
  config: GraphConfig = {},
): CompiledGraph {
  const startTime = Date.now();
  const {
    enableValidation = true,
    enableTracing = false,
    toolTimeout = 30000,
  } = config;

  const { llm, tools, logger, currentDateTime, clientConfig } = dependencies;

  logger.info('[Graph] Starting graph compilation', {
    toolCount: tools.length,
    enableValidation,
    enableTracing,
    toolTimeout,
  });

  // Validate router logic if enabled
  let validationPassed = true;
  if (enableValidation) {
    const routerValidation = validateRouterLogic();
    if (!routerValidation.isValid) {
      logger.error('[Graph] Router validation failed', {
        issues: routerValidation.issues,
      });
      validationPassed = false;
    }
  }

  // Create services for business logic extraction
  const documentService = new DocumentAnalysisService(logger);
  const contextService = new ContextService(logger);
  const queryService = new QueryAnalysisService(logger);

  // Prepare node dependencies with services
  const agentDeps: AgentNodeDependencies = {
    llm,
    tools,
    logger,
    currentDateTime,
    clientConfig,
    // NEW: Inject services for business logic
    documentService,
    contextService,
    queryService,
  };

  const toolsDeps: ToolsNodeDependencies = {
    tools,
    logger,
    timeout: toolTimeout,
  };

  const responseDeps: GenerateResponseNodeDependencies = {
    llm,
    logger,
    currentDateTime,
    clientConfig,
  };

  // Create the state graph
  const graph = new StateGraph(GraphStateAnnotation)
    // Add nodes with dependency injection
    .addNode('agent', (state) => {
      if (enableTracing) {
        logger.info('[Graph] Executing agent node', {
          iteration: state.iterationCount || 0,
          messageCount: state.messages.length,
        });
      }
      return agentNode(state, agentDeps);
    })

    .addNode('tools', (state) => {
      if (enableTracing) {
        logger.info('[Graph] Executing tools node', {
          toolCallsCount:
            (state.messages[state.messages.length - 1] as any)?.tool_calls
              ?.length || 0,
        });
      }
      return toolsNode(state, toolsDeps);
    })

    .addNode('generate_response', (state) => {
      if (enableTracing) {
        logger.info('[Graph] Executing response generation node', {
          responseMode: state.response_mode || 'auto-detect',
          toolResultsCount: state.messages.filter(
            (m) => m._getType?.() === 'tool',
          ).length,
        });
      }
      return generateResponseNode(state, responseDeps);
    })

    // Set entry point
    .addEdge(START, 'agent')

    // Add conditional edges from agent node
    .addConditionalEdges('agent', routeNextStep, {
      agent: 'agent', // For self-loops (shouldn't happen with corrected logic)
      tools: 'tools', // Agent wants to use tools
      generate_response: 'generate_response', // Agent ready for final response
      __end__: END, // Early termination
    })

    // CRITICAL: Tools ALWAYS return to agent (corrected ReAct pattern)
    .addEdge('tools', 'agent')

    // Response generation leads to end
    .addEdge('generate_response', END);

  // Compile the graph
  const compiledGraph = graph.compile();

  const compileTime = Date.now() - startTime;

  const metadata = {
    nodeCount: 3, // agent, tools, generate_response
    edgeCount: 4, // START->agent, tools->agent, generate_response->END, conditional edges
    validationPassed,
    compileTime,
  };

  logger.info('[Graph] Graph compilation completed', metadata);

  return {
    graph: compiledGraph,
    metadata,
  };
}

/**
 * Create a simplified wrapper around the compiled graph
 */
export class ModularLangGraphWrapper {
  private compiledGraph: CompiledGraph;
  private dependencies: GraphDependencies;
  private config: GraphConfig;

  constructor(dependencies: GraphDependencies, config: GraphConfig = {}) {
    this.dependencies = dependencies;
    this.config = config;
    this.compiledGraph = createGraph(dependencies, config);

    // Log initialization
    dependencies.logger.info('[ModularWrapper] Initialized', {
      nodeCount: this.compiledGraph.metadata.nodeCount,
      validationPassed: this.compiledGraph.metadata.validationPassed,
      compileTime: this.compiledGraph.metadata.compileTime,
    });
  }

  /**
   * Invoke the graph with input messages
   */
  async invoke(inputMessages: any[], config?: any): Promise<any> {
    const startTime = Date.now();

    this.dependencies.logger.info('[ModularWrapper] Invoking graph', {
      inputMessageCount: inputMessages.length,
      hasConfig: !!config,
    });

    try {
      const result = await this.compiledGraph.graph.invoke(
        {
          messages: inputMessages,
          input: inputMessages[0]?.content || '',
          needsSynthesis: this.determineIfSynthesisNeeded(
            inputMessages[0]?.content || '',
          ),
        },
        config,
      );

      const duration = Date.now() - startTime;

      this.dependencies.logger.info(
        '[ModularWrapper] Graph invocation completed',
        {
          duration,
          finalMessageCount: result.messages?.length || 0,
          responseMode: result.response_mode,
          executionTrace: result.node_execution_trace?.join(' → ') || 'none',
        },
      );

      return result.messages[result.messages.length - 1];
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.dependencies.logger.error(
        '[ModularWrapper] Graph invocation failed',
        {
          error: errorMessage,
          duration,
        },
      );

      throw error;
    }
  }

  /**
   * Stream the graph execution
   */
  async *stream(
    inputMessages: any[],
    config?: any,
  ): AsyncGenerator<Uint8Array> {
    this.dependencies.logger.info('[ModularWrapper] Starting graph stream', {
      inputMessageCount: inputMessages.length,
    });

    try {
      const events = this.compiledGraph.graph.streamEvents(
        {
          messages: inputMessages,
          input: inputMessages[0]?.content || '',
          needsSynthesis: this.determineIfSynthesisNeeded(
            inputMessages[0]?.content || '',
          ),
        },
        config,
      );

      for await (const event of events) {
        // Stream chat model responses
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk?.content) {
            yield new TextEncoder().encode(chunk.content);
          }
        }

        // Log important events
        if (
          event.event === 'on_chain_start' ||
          event.event === 'on_chain_end'
        ) {
          this.dependencies.logger.info('[ModularWrapper] Graph event', {
            event: event.event,
            name: event.name,
          });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.dependencies.logger.error(
        '[ModularWrapper] Graph streaming failed',
        {
          error: errorMessage,
        },
      );
      throw error;
    }
  }

  /**
   * Get graph metadata and statistics
   */
  getMetadata(): {
    compilation: CompiledGraph['metadata'];
    configuration: GraphConfig;
    dependencies: {
      toolCount: number;
      hasLLM: boolean;
      hasLogger: boolean;
    };
  } {
    return {
      compilation: this.compiledGraph.metadata,
      configuration: this.config,
      dependencies: {
        toolCount: this.dependencies.tools.length,
        hasLLM: !!this.dependencies.llm,
        hasLogger: !!this.dependencies.logger,
      },
    };
  }

  /**
   * Validate the current graph configuration
   */
  validate(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!this.dependencies.llm) {
      issues.push('LLM is required');
    }

    if (!this.dependencies.tools || this.dependencies.tools.length === 0) {
      issues.push('At least one tool is required');
    }

    if (!this.dependencies.logger) {
      issues.push('Logger is required');
    }

    if (!this.compiledGraph.metadata.validationPassed) {
      issues.push('Graph validation failed during compilation');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Determine if synthesis is needed based on input
   */
  private determineIfSynthesisNeeded(input: string): boolean {
    const synthesisKeywords = [
      'analyze',
      'research',
      'compare',
      'evaluate',
      'report',
      'summarize',
      'investigation',
      'assessment',
      'review',
      'comprehensive',
      'detailed',
      'thorough',
    ];

    const inputLower = input.toLowerCase();
    return synthesisKeywords.some((keyword) => inputLower.includes(keyword));
  }
}

/**
 * Factory function to create a configured wrapper
 */
export function createLangGraphWrapper(
  dependencies: GraphDependencies,
  config: GraphConfig = {},
): ModularLangGraphWrapper {
  return new ModularLangGraphWrapper(dependencies, config);
}

/**
 * Development helper to visualize the graph structure
 */
export function visualizeGraph(): {
  nodes: string[];
  edges: Array<{ from: string; to: string; condition?: string }>;
  flow: string;
} {
  return {
    nodes: ['START', 'agent', 'tools', 'generate_response', 'END'],
    edges: [
      { from: 'START', to: 'agent' },
      { from: 'agent', to: 'tools', condition: 'has_tool_calls' },
      { from: 'agent', to: 'generate_response', condition: 'no_tool_calls' },
      { from: 'tools', to: 'agent' }, // CRITICAL: Always return to agent
      { from: 'generate_response', to: 'END' },
    ],
    flow: 'START → agent ⇄ tools → agent → generate_response → END',
  };
}
