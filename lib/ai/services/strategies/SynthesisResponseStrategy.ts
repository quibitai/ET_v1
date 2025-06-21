/**
 * Synthesis Response Strategy
 *
 * Handles complex synthesis responses that combine multiple tool results into comprehensive analyses.
 * Extracted from SimpleLangGraphWrapper synthesisNode method.
 *
 * @module SynthesisResponseStrategy
 */

import {
  HumanMessage,
  SystemMessage,
  type AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import type { Runnable } from '@langchain/core/runnables';
import type {
  IResponseStrategy,
  ResponseStrategyConfig,
  ResponseStrategyType,
} from '../ResponseStrategyFactory';
import type { GraphState } from '../QueryIntentAnalyzer';
import {
  ContentFormatter,
  type ToolResult,
} from '../../formatting/ContentFormatter';

/**
 * Strategy for handling complex synthesis responses
 */
export class SynthesisResponseStrategy implements IResponseStrategy {
  private config: ResponseStrategyConfig;

  constructor(config: ResponseStrategyConfig) {
    this.config = config;
  }

  /**
   * Get the strategy type
   */
  getStrategyType(): ResponseStrategyType {
    return 'synthesis';
  }

  /**
   * Check if this strategy can handle the given state
   */
  canHandle(state: GraphState): boolean {
    // This strategy handles cases requiring synthesis
    const hasToolResults =
      state.messages?.some((m) => m._getType() === 'tool') || false;
    const needsSynthesis = state.needsSynthesis ?? true; // Default to true for backward compatibility

    // Can handle if we need synthesis (regardless of tool results)
    return needsSynthesis || hasToolResults;
  }

  /**
   * Create the synthesis response node
   */
  createNode(): Runnable<GraphState, Partial<GraphState>> {
    const synthesisChain = RunnableSequence.from([
      RunnableLambda.from((state: GraphState): BaseMessage[] => {
        this.config.logger.info(
          '[SynthesisResponseStrategy] Starting comprehensive synthesis',
        );

        // Extract all tool results and organize them
        const toolMessages =
          state.messages?.filter((msg) => msg._getType() === 'tool') || [];

        // Extract the original user query
        const userMessages =
          state.messages?.filter((msg) => msg._getType() === 'human') || [];
        const originalQuery =
          userMessages.length > 0
            ? typeof userMessages[0].content === 'string'
              ? userMessages[0].content
              : JSON.stringify(userMessages[0].content)
            : state.input || '';

        this.config.logger.info(
          '[SynthesisResponseStrategy] Synthesis context',
          {
            originalQuery: originalQuery.substring(0, 100),
            toolResultsCount: toolMessages.length,
            synthesisRequired: state.needsSynthesis,
          },
        );

        // Build comprehensive synthesis prompt
        const synthesisPrompt = this.buildSynthesisPrompt(
          originalQuery,
          toolMessages,
          state,
        );

        // Create synthesis instruction
        const synthesisInstruction = this.buildSynthesisInstruction(
          originalQuery,
          toolMessages,
        );

        return [synthesisPrompt, synthesisInstruction];
      }),
      // ENHANCED STREAMING FIX: Configure LLM with advanced streaming capabilities
      this.config.llm.withConfig({
        tags: ['synthesis_llm', 'streaming_enabled', 'token_streaming'],
        metadata: {
          streaming: true,
          streamMode: 'token',
          node_type: 'synthesis',
          enableAdvancedSynthesis: true,
        },
        callbacks: [
          {
            handleLLMNewToken: (token: string) => {
              // Token streaming handled by parent coordinator
            },
          },
        ],
      }),
      RunnableLambda.from((aiMessage: AIMessage): Partial<GraphState> => {
        this.config.logger.info(
          '[SynthesisResponseStrategy] Synthesis completed',
          {
            responseLength:
              typeof aiMessage.content === 'string'
                ? aiMessage.content.length
                : 0,
            synthesisComplete: true,
          },
        );

        // Mark synthesis as completed and validate quality
        this.markSynthesisCompleted(aiMessage);

        return {
          messages: [aiMessage],
          needsSynthesis: false, // Mark synthesis as completed
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
        synthesisMode: true,
      },
    }) as Runnable<GraphState, Partial<GraphState>>;
  }

  /**
   * Build comprehensive synthesis system prompt
   */
  private buildSynthesisPrompt(
    originalQuery: string,
    toolMessages: any[],
    state: GraphState,
  ): SystemMessage {
    // Analyze the data landscape for synthesis
    const dataAnalysis = this.analyzeDataLandscape(toolMessages);

    // Get enhanced synthesis instructions
    const synthesisInstructions = this.getSynthesisInstructions(
      originalQuery,
      dataAnalysis,
    );

    // Build context-aware prompt
    let synthesisPrompt = `${this.config.systemPrompt}\n\n`;
    synthesisPrompt += synthesisInstructions;

    // Add data quality context
    if (dataAnalysis.qualityMetrics.totalSources > 0) {
      synthesisPrompt += `\n\n## Data Quality Context
- **Total Sources**: ${dataAnalysis.qualityMetrics.totalSources}
- **Source Types**: ${dataAnalysis.qualityMetrics.sourceTypes.join(', ')}
- **Information Density**: ${dataAnalysis.qualityMetrics.informationDensity}
- **Synthesis Complexity**: ${dataAnalysis.synthesisComplexity}

Use this context to inform your synthesis approach and confidence levels.`;
    }

    this.config.logger.info(
      '[SynthesisResponseStrategy] Built synthesis prompt',
      {
        promptLength: synthesisPrompt.length,
        dataAnalysis,
      },
    );

    return new SystemMessage({
      content: synthesisPrompt,
    });
  }

  /**
   * Build synthesis instruction with formatted tool results
   */
  private buildSynthesisInstruction(
    originalQuery: string,
    toolMessages: any[],
  ): HumanMessage {
    // Convert tool messages to ToolResult format
    const toolResults: ToolResult[] = toolMessages.map((msg) => ({
      name: (msg as any)?.name || 'tool',
      content: msg.content,
    }));

    // Use centralized formatter for consistency
    const formattedContent = ContentFormatter.formatToolResults(
      toolResults,
      originalQuery,
    );

    // Build comprehensive synthesis instruction
    let instruction = `Based on the following information, provide a comprehensive synthesis addressing: "${originalQuery}"\n\n`;
    instruction += formattedContent;

    // Add synthesis guidelines
    instruction += `\n\n## Synthesis Guidelines:
1. **Integrate** all relevant information from the available sources
2. **Analyze** relationships and patterns across different data points
3. **Synthesize** insights that go beyond simple summarization
4. **Provide** actionable recommendations where appropriate
5. **Acknowledge** any limitations or gaps in the available data
6. **Structure** your response for clarity and comprehensiveness

Please provide your comprehensive synthesis now.`;

    return new HumanMessage({
      content: instruction,
    });
  }

  /**
   * Analyze the data landscape for synthesis planning
   */
  private analyzeDataLandscape(toolMessages: any[]): {
    qualityMetrics: {
      totalSources: number;
      sourceTypes: string[];
      informationDensity: 'high' | 'medium' | 'low';
    };
    synthesisComplexity: 'high' | 'medium' | 'low';
    dataTypes: string[];
  } {
    const sourceTypes = [
      ...new Set(toolMessages.map((msg) => (msg as any)?.name || 'unknown')),
    ];
    const totalContent = toolMessages.reduce((acc, msg) => {
      return acc + (typeof msg.content === 'string' ? msg.content.length : 0);
    }, 0);

    // Determine information density
    let informationDensity: 'high' | 'medium' | 'low' = 'low';
    if (totalContent > 5000) informationDensity = 'high';
    else if (totalContent > 1000) informationDensity = 'medium';

    // Determine synthesis complexity
    let synthesisComplexity: 'high' | 'medium' | 'low' = 'low';
    if (sourceTypes.length > 3 && totalContent > 3000)
      synthesisComplexity = 'high';
    else if (sourceTypes.length > 1 || totalContent > 1000)
      synthesisComplexity = 'medium';

    return {
      qualityMetrics: {
        totalSources: toolMessages.length,
        sourceTypes,
        informationDensity,
      },
      synthesisComplexity,
      dataTypes: sourceTypes,
    };
  }

  /**
   * Get synthesis instructions based on query and data analysis
   */
  private getSynthesisInstructions(
    originalQuery: string,
    dataAnalysis: any,
  ): string {
    const queryLower = originalQuery.toLowerCase();

    // Determine synthesis type based on query patterns
    if (
      /\b(?:analyz[ei]|analysis|compar[ei]|contrast)\b/i.test(originalQuery)
    ) {
      return this.getAnalyticalSynthesisInstructions(dataAnalysis);
    } else if (/\b(?:research|report|brief|overview)\b/i.test(originalQuery)) {
      return this.getResearchSynthesisInstructions(dataAnalysis);
    } else if (/\b(?:recommend|suggest|advice|should)\b/i.test(originalQuery)) {
      return this.getRecommendationSynthesisInstructions(dataAnalysis);
    } else {
      return this.getGeneralSynthesisInstructions(dataAnalysis);
    }
  }

  private getAnalyticalSynthesisInstructions(dataAnalysis: any): string {
    return `## Analytical Synthesis Mode
You are in analytical synthesis mode. Focus on:
- **Deep Analysis**: Examine patterns, relationships, and correlations
- **Critical Evaluation**: Assess strengths, weaknesses, and implications
- **Comparative Insights**: Highlight similarities, differences, and trade-offs
- **Evidence-Based Conclusions**: Support all claims with specific data points
- **Structured Reasoning**: Present logical progression of analysis`;
  }

  private getResearchSynthesisInstructions(dataAnalysis: any): string {
    return `## Research Synthesis Mode
You are in research synthesis mode. Focus on:
- **Comprehensive Coverage**: Address all aspects of the research question
- **Source Integration**: Weave together insights from multiple sources
- **Knowledge Gaps**: Identify areas needing further investigation
- **Research Quality**: Evaluate the reliability and relevance of sources
- **Scholarly Presentation**: Use clear, professional, and well-structured format`;
  }

  private getRecommendationSynthesisInstructions(dataAnalysis: any): string {
    return `## Recommendation Synthesis Mode
You are in recommendation synthesis mode. Focus on:
- **Actionable Advice**: Provide specific, implementable recommendations
- **Risk Assessment**: Identify potential challenges and mitigation strategies
- **Prioritization**: Rank recommendations by importance and feasibility
- **Implementation Guidance**: Suggest concrete next steps
- **Success Metrics**: Define how to measure progress and outcomes`;
  }

  private getGeneralSynthesisInstructions(dataAnalysis: any): string {
    return `## General Synthesis Mode
You are in general synthesis mode. Focus on:
- **Holistic Integration**: Combine all available information coherently
- **Insight Generation**: Identify non-obvious connections and implications
- **Balanced Perspective**: Present multiple viewpoints where relevant
- **Clear Communication**: Use accessible language and logical structure
- **Value Addition**: Go beyond summarization to provide meaningful insights`;
  }

  /**
   * Mark synthesis as completed and perform quality validation
   */
  private markSynthesisCompleted(aiMessage: AIMessage): void {
    // Mark content as streamed to prevent duplication
    this.config.streamingCoordinator?.markContentStreamed('synthesis');

    // Validate synthesis quality
    if (this.config.qualityValidator) {
      const qualityMetrics =
        this.config.qualityValidator.assessResponse(aiMessage);
      this.config.logger.info(
        '[SynthesisResponseStrategy] Quality assessment',
        {
          qualityMetrics,
        },
      );
    }

    // Update progress indicators
    if (this.config.progressIndicator) {
      this.config.progressIndicator.markCompleted('synthesis');
    }
  }
}
