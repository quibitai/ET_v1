import { z } from 'zod';
import type { RequestLogger } from '../../../services/observabilityService';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Execution Plan Schema - Defines the structured output for LLM-powered planning
 * This schema ensures reliable, parseable JSON output from the planning LLM
 */
export const ExecutionPlanSchema = z.object({
  task_type: z
    .enum(['simple_qa', 'research_only', 'template_only', 'hybrid'])
    .describe('The primary type of task identified based on query analysis.'),
  required_internal_documents: z
    .array(z.string())
    .describe(
      'Specific internal document names the agent should retrieve from knowledge base.',
    ),
  external_research_topics: z
    .array(z.string())
    .describe(
      'Topics or entities requiring external web research via tavilySearch.',
    ),
  final_output_format: z
    .string()
    .describe(
      'Expected final output format, e.g., "research report", "simple answer", "comparison table".',
    ),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

/**
 * PlannerService - LLM-powered strategic planning for query execution
 *
 * Provides semantic understanding and strategic planning capabilities that go beyond
 * simple pattern matching. Creates structured execution plans that guide the agent
 * in making better strategic decisions about tool usage and research approaches.
 *
 * Key Features:
 * - LLM-powered semantic query analysis
 * - Structured JSON output with Zod validation
 * - Fallback planning for LLM failures
 * - Performance monitoring and logging
 * - Integration with existing observability infrastructure
 */
export class PlannerService {
  private readonly performanceMetrics: {
    totalPlans: number;
    successfulPlans: number;
    averageDuration: number;
    fallbackUsage: number;
  };

  constructor(
    private readonly logger: RequestLogger,
    private readonly llm: ChatOpenAI,
  ) {
    this.performanceMetrics = {
      totalPlans: 0,
      successfulPlans: 0,
      averageDuration: 0,
      fallbackUsage: 0,
    };
  }

  /**
   * Creates a strategic execution plan for the given user query
   * Uses LLM-powered semantic analysis to determine optimal execution strategy
   */
  async createPlan(
    userQuery: string,
    context?: {
      conversationHistory?: string[];
      availableDocuments?: string[];
    },
  ): Promise<ExecutionPlan> {
    const startTime = performance.now();
    this.performanceMetrics.totalPlans++;

    try {
      const planningPrompt = await this.buildPlanningPrompt(userQuery, context);

      this.logger.info('Creating execution plan', {
        queryLength: userQuery.length,
        hasContext: !!context,
        availableDocs: context?.availableDocuments?.length || 0,
      });

      const response = await this.llm.invoke([
        { role: 'system', content: planningPrompt },
      ]);

      // Parse and validate the LLM response
      const responseContent =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      const planJson = this.extractJsonFromResponse(responseContent);
      const plan = ExecutionPlanSchema.parse(planJson);

      const duration = performance.now() - startTime;
      this.updatePerformanceMetrics(duration, true);

      this.logger.info('Execution plan created successfully', {
        taskType: plan.task_type,
        internalDocs: plan.required_internal_documents.length,
        externalTopics: plan.external_research_topics.length,
        outputFormat: plan.final_output_format,
        duration: Math.round(duration),
      });

      return plan;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updatePerformanceMetrics(duration, false);

      this.logger.error('Planning failed, using fallback strategy', {
        error: error instanceof Error ? error.message : String(error),
        queryPreview: userQuery.substring(0, 100),
        duration: Math.round(duration),
      });

      return this.createFallbackPlan(userQuery);
    }
  }

  /**
   * Builds the planning prompt with context and instructions
   */
  private async buildPlanningPrompt(
    userQuery: string,
    context?: {
      conversationHistory?: string[];
      availableDocuments?: string[];
    },
  ): Promise<string> {
    const { plannerPromptTemplate } = await import('../prompts/planner.prompt');

    const contextInfo = context
      ? {
          hasHistory:
            context.conversationHistory &&
            context.conversationHistory.length > 0,
          availableDocuments: context.availableDocuments || [],
          historyLength: context.conversationHistory?.length || 0,
        }
      : null;

    return plannerPromptTemplate.format({
      user_query: userQuery,
      current_date: new Date().toISOString(),
      schema: JSON.stringify(ExecutionPlanSchema.shape, null, 2),
      context_info: contextInfo
        ? JSON.stringify(contextInfo, null, 2)
        : 'No additional context available',
      available_documents:
        context?.availableDocuments?.join(', ') || 'Document list not provided',
    });
  }

  /**
   * Extracts JSON from LLM response, handling various response formats
   */
  private extractJsonFromResponse(content: string): any {
    try {
      // Try to parse the entire response as JSON
      return JSON.parse(content);
    } catch {
      // Look for JSON within code blocks or other formatting
      const jsonMatch =
        content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      throw new Error('No valid JSON found in LLM response');
    }
  }

  /**
   * Creates a fallback plan when LLM planning fails
   * Uses simple heuristics to provide basic planning functionality
   */
  private createFallbackPlan(userQuery: string): ExecutionPlan {
    this.performanceMetrics.fallbackUsage++;

    const query = userQuery.toLowerCase();

    // Simple heuristic-based planning
    const hasTemplateIndicators =
      /using|template|example|based on|according to/.test(query);
    const hasResearchIndicators =
      /research|analyze|compare|investigate|study/.test(query);
    const hasExternalEntities =
      /company|organization|person|[A-Z][a-z]+ [A-Z][a-z]+/.test(userQuery);

    let taskType: ExecutionPlan['task_type'] = 'simple_qa';
    const externalTopics: string[] = [];
    const internalDocs: string[] = [];

    if (hasTemplateIndicators && hasResearchIndicators) {
      taskType = 'hybrid';
    } else if (hasResearchIndicators && hasExternalEntities) {
      taskType = 'research_only';
    } else if (hasTemplateIndicators) {
      taskType = 'template_only';
    }

    // Extract potential external research topics
    const entityMatches = userQuery.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (entityMatches && taskType !== 'simple_qa') {
      externalTopics.push(...entityMatches.slice(0, 3)); // Limit to 3 topics
    }

    // Common document patterns
    if (hasTemplateIndicators) {
      if (query.includes('client') || query.includes('profile')) {
        internalDocs.push('ideal client profile');
      }
      if (query.includes('research') || query.includes('analysis')) {
        internalDocs.push('client research example');
      }
    }

    return {
      task_type: taskType,
      required_internal_documents: internalDocs,
      external_research_topics: externalTopics,
      final_output_format: hasResearchIndicators
        ? 'research report'
        : 'direct answer',
    };
  }

  /**
   * Updates performance metrics for monitoring and optimization
   */
  private updatePerformanceMetrics(duration: number, success: boolean): void {
    if (success) {
      this.performanceMetrics.successfulPlans++;
    }

    // Update rolling average duration
    const totalDuration =
      this.performanceMetrics.averageDuration *
      (this.performanceMetrics.totalPlans - 1);
    this.performanceMetrics.averageDuration =
      (totalDuration + duration) / this.performanceMetrics.totalPlans;
  }

  /**
   * Returns current performance metrics for monitoring
   */
  getPerformanceMetrics() {
    const successRate =
      this.performanceMetrics.totalPlans > 0
        ? (this.performanceMetrics.successfulPlans /
            this.performanceMetrics.totalPlans) *
          100
        : 0;

    const fallbackRate =
      this.performanceMetrics.totalPlans > 0
        ? (this.performanceMetrics.fallbackUsage /
            this.performanceMetrics.totalPlans) *
          100
        : 0;

    return {
      ...this.performanceMetrics,
      successRate: Math.round(successRate * 100) / 100,
      fallbackRate: Math.round(fallbackRate * 100) / 100,
      averageDuration: Math.round(this.performanceMetrics.averageDuration),
    };
  }
}
