/**
 * Response Strategy Factory
 *
 * Implements the Strategy pattern for different response types (synthesis, simple, conversational).
 * Manages the creation and coordination of response strategies based on query intent and context.
 *
 * @module ResponseStrategyFactory
 */

import type { Runnable } from '@langchain/core/runnables';
import type { RequestLogger } from '../../services/observabilityService';
import type { GraphState } from './QueryIntentAnalyzer';
import type { ChatOpenAI } from '@langchain/openai';

/**
 * Common interface for all response strategies
 */
export interface IResponseStrategy {
  /**
   * Create a LangChain Runnable node for this response strategy
   */
  createNode(): Runnable<GraphState, Partial<GraphState>>;

  /**
   * Get the strategy type for identification
   */
  getStrategyType(): ResponseStrategyType;

  /**
   * Validate if this strategy can handle the given state
   */
  canHandle(state: GraphState): boolean;
}

/**
 * Types of response strategies available
 */
export type ResponseStrategyType =
  | 'synthesis'
  | 'simple_response'
  | 'conversational_response';

/**
 * Configuration for response strategies
 */
export interface ResponseStrategyConfig {
  systemPrompt: string;
  llm: ChatOpenAI;
  logger: RequestLogger;
  // Additional dependencies for strategies
  streamingCoordinator: any;
  contentFormatter: any;
  contextManager: any;
  documentOrchestrator: any;
  synthesisValidator: any;
  progressIndicator: any;
  routingDisplay: any;
  qualityValidator: any;
}

/**
 * Factory for creating and managing response strategies
 */
export class ResponseStrategyFactory {
  private logger: RequestLogger;
  private config: ResponseStrategyConfig;
  private strategies: Map<ResponseStrategyType, IResponseStrategy> = new Map();

  constructor(config: ResponseStrategyConfig) {
    this.logger = config.logger;
    this.config = config;
    this.initializeStrategies();
  }

  /**
   * Get a response strategy by type
   */
  getStrategy(type: ResponseStrategyType): IResponseStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No strategy found for type: ${type}`);
    }
    return strategy;
  }

  /**
   * Create a strategy based on analysis of the current state
   */
  createStrategyForState(state: GraphState): IResponseStrategy {
    // Try strategies in order of specificity
    const strategyTypes: ResponseStrategyType[] = [
      'synthesis',
      'simple_response',
      'conversational_response',
    ];

    for (const type of strategyTypes) {
      const strategy = this.strategies.get(type);
      if (strategy && strategy.canHandle(state)) {
        this.logger.info(
          `[ResponseStrategyFactory] Selected strategy: ${type}`,
          {
            messageCount: state.messages?.length || 0,
            hasToolResults:
              state.messages?.some((m) => m._getType() === 'tool') || false,
            needsSynthesis: state.needsSynthesis,
          },
        );
        return strategy;
      }
    }

    // Fallback to conversational response
    this.logger.warn(
      '[ResponseStrategyFactory] No specific strategy matched, using conversational fallback',
    );
    return this.getStrategy('conversational_response');
  }

  /**
   * Initialize all available strategies
   */
  private initializeStrategies(): void {
    // Import strategy classes dynamically to avoid circular dependencies
    const SynthesisResponseStrategy =
      require('./strategies/SynthesisResponseStrategy').SynthesisResponseStrategy;
    const SimpleResponseStrategy =
      require('./strategies/SimpleResponseStrategy').SimpleResponseStrategy;
    const ConversationalResponseStrategy =
      require('./strategies/ConversationalResponseStrategy').ConversationalResponseStrategy;

    this.strategies.set(
      'synthesis',
      new SynthesisResponseStrategy(this.config),
    );
    this.strategies.set(
      'simple_response',
      new SimpleResponseStrategy(this.config),
    );
    this.strategies.set(
      'conversational_response',
      new ConversationalResponseStrategy(this.config),
    );

    this.logger.info(
      '[ResponseStrategyFactory] Initialized response strategies',
      {
        strategiesCount: this.strategies.size,
        availableStrategies: Array.from(this.strategies.keys()),
      },
    );
  }

  /**
   * Get all available strategy types
   */
  getAvailableStrategies(): ResponseStrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Reset all strategies (useful for testing)
   */
  reset(): void {
    this.strategies.clear();
    this.initializeStrategies();
  }
}
