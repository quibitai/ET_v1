/**
 * ToolOrchestrator - Executes workflow steps with context management
 *
 * This class handles the sequential execution of workflow steps,
 * managing context between steps, handling errors, and providing
 * progress updates. It serves as the main execution engine for
 * multi-step workflows.
 */

import type {
  ExecutionPlan,
  WorkflowResult,
  ProgressUpdate,
  WorkflowConfig,
} from './types';
import {
  WorkflowStepType,
  WorkflowError,
  WorkflowTimeoutError,
  DEFAULT_WORKFLOW_CONFIG,
} from './types';
import { WorkflowContext } from './WorkflowContext';
import { getAvailableTools } from '../tools';

export class ToolOrchestrator {
  private config: typeof DEFAULT_WORKFLOW_CONFIG;
  private progressCallback?: (update: ProgressUpdate) => void;

  constructor(
    config?: Partial<typeof DEFAULT_WORKFLOW_CONFIG>,
    progressCallback?: (update: ProgressUpdate) => void,
  ) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    this.progressCallback = progressCallback;
  }

  /**
   * Execute a complete workflow plan
   */
  public async executeWorkflow(
    plan: ExecutionPlan,
    originalQuery: string,
    userId?: string,
    sessionId?: string,
  ): Promise<WorkflowResult> {
    const context = new WorkflowContext(originalQuery, userId, sessionId);
    const startTime = Date.now();
    const errors: Error[] = [];
    const results: any[] = [];

    try {
      // Initialize all steps as pending
      for (const phase of plan.phases) {
        for (const step of phase.steps) {
          context.addExecution({
            stepId: step.id,
            status: 'pending',
          });
        }
      }

      // Execute phases sequentially
      for (let phaseIndex = 0; phaseIndex < plan.phases.length; phaseIndex++) {
        const phase = plan.phases[phaseIndex];

        this.reportProgress(
          phase.steps[0].id,
          phase.description,
          this.getCompletedStepsCount(context),
          plan.totalSteps,
          `Executing phase ${phaseIndex + 1}/${plan.phases.length}`,
        );

        try {
          if (phase.parallel && this.config.enableParallelExecution) {
            // Execute steps in parallel
            const phaseResults = await this.executePhaseParallel(
              phase,
              context,
            );
            results.push(...phaseResults);
          } else {
            // Execute steps sequentially
            const phaseResults = await this.executePhaseSequential(
              phase,
              context,
            );
            results.push(...phaseResults);
          }
        } catch (error) {
          const workflowError =
            error instanceof WorkflowError
              ? error
              : new WorkflowError(
                  `Phase ${phaseIndex + 1} failed: ${error}`,
                  phase.steps[0].id,
                );

          errors.push(workflowError);

          // Decide whether to continue or abort
          if (!workflowError.recoverable || plan.riskLevel === 'high') {
            break;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const summary = context.getExecutionSummary();

      return {
        success: errors.length === 0 && summary.failedSteps === 0,
        completedSteps: summary.completedSteps,
        totalSteps: plan.totalSteps,
        results,
        summary: this.generateSummary(context, results),
        executionTime,
        errors,
        context,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const summary = context.getExecutionSummary();

      return {
        success: false,
        completedSteps: summary.completedSteps,
        totalSteps: plan.totalSteps,
        results,
        summary: `Workflow failed: ${error}`,
        executionTime,
        errors: [error instanceof Error ? error : new Error(String(error))],
        context,
      };
    }
  }

  /**
   * Execute a phase with steps running in parallel
   */
  private async executePhaseParallel(
    phase: any,
    context: WorkflowContext,
  ): Promise<any[]> {
    const promises = phase.steps.map((step: any) =>
      this.executeStep(step, context),
    );

    const results = await Promise.allSettled(promises);
    const phaseResults: any[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const step = phase.steps[i];

      if (result.status === 'fulfilled') {
        phaseResults.push(result.value);
      } else {
        const error = new WorkflowError(
          `Step ${step.id} failed in parallel execution: ${result.reason}`,
          step.id,
          step.type,
        );
        context.updateExecution(step.id, {
          status: 'failed',
          error,
          endTime: new Date(),
        });
        throw error;
      }
    }

    return phaseResults;
  }

  /**
   * Execute a phase with steps running sequentially
   */
  private async executePhaseSequential(
    phase: any,
    context: WorkflowContext,
  ): Promise<any[]> {
    const phaseResults: any[] = [];

    for (const step of phase.steps) {
      try {
        const result = await this.executeStep(step, context);
        phaseResults.push(result);
      } catch (error) {
        const workflowError =
          error instanceof WorkflowError
            ? error
            : new WorkflowError(
                `Step ${step.id} failed: ${error}`,
                step.id,
                step.type,
              );

        context.updateExecution(step.id, {
          status: 'failed',
          error: workflowError,
          endTime: new Date(),
        });

        // Try recovery if possible
        if (
          workflowError.recoverable &&
          step.retryCount &&
          step.retryCount > 0
        ) {
          const retryResult = await this.retryStep(
            step,
            context,
            step.retryCount,
          );
          if (retryResult) {
            phaseResults.push(retryResult);
            continue;
          }
        }

        throw workflowError;
      }
    }

    return phaseResults;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: any, context: WorkflowContext): Promise<any> {
    const stepExecution = context.getExecution(step.id);
    if (!stepExecution) {
      throw new WorkflowError(
        `Step ${step.id} not found in execution history`,
        step.id,
      );
    }

    // Update step status to running
    context.updateExecution(step.id, {
      status: 'running',
      startTime: new Date(),
    });

    this.reportProgress(
      step.id,
      step.description,
      this.getCompletedStepsCount(context),
      context.executionHistory.length,
      `Executing: ${step.description}`,
    );

    try {
      // Create checkpoint before execution
      if (this.config.enableCheckpoints) {
        context.createCheckpoint(step.id, { step, timestamp: new Date() });
      }

      // Substitute variables in parameters
      const substitutedParameters = context.substituteVariables(
        step.parameters,
      );

      // Get the tool function
      const tools = await getAvailableTools();
      const toolFunction = tools[step.tool];

      if (!toolFunction) {
        throw new WorkflowError(
          `Tool ${step.tool} not found`,
          step.id,
          step.type,
        );
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => toolFunction(substitutedParameters),
        step.timeout || this.config.defaultTimeout,
        step.id,
      );

      // Store result and update context
      context.setStepResult(step.id, result);
      context.updateExecution(step.id, {
        status: 'completed',
        result,
        endTime: new Date(),
      });

      return result;
    } catch (error) {
      const workflowError =
        error instanceof WorkflowError
          ? error
          : new WorkflowError(
              `Step execution failed: ${error}`,
              step.id,
              step.type,
            );

      context.updateExecution(step.id, {
        status: 'failed',
        error: workflowError,
        endTime: new Date(),
      });

      throw workflowError;
    }
  }

  /**
   * Retry a failed step
   */
  private async retryStep(
    step: any,
    context: WorkflowContext,
    maxRetries: number,
  ): Promise<any | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));

        // Update retry attempt
        context.updateExecution(step.id, {
          status: 'running',
          retryAttempt: attempt,
          startTime: new Date(),
        });

        this.reportProgress(
          step.id,
          step.description,
          this.getCompletedStepsCount(context),
          context.executionHistory.length,
          `Retrying: ${step.description} (attempt ${attempt}/${maxRetries})`,
        );

        // Execute step again
        const result = await this.executeStep(step, context);
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          // Final attempt failed
          const finalError = new WorkflowError(
            `Step ${step.id} failed after ${maxRetries} retries: ${error}`,
            step.id,
            step.type,
            false, // Not recoverable after max retries
          );

          context.updateExecution(step.id, {
            status: 'failed',
            error: finalError,
            endTime: new Date(),
          });

          throw finalError;
        }
      }
    }

    return null;
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    stepId: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new WorkflowTimeoutError(stepId, timeout));
      }, timeout);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Report progress to callback if provided
   */
  private reportProgress(
    stepId: string,
    stepDescription: string,
    currentStep: number,
    totalSteps: number,
    message: string,
  ): void {
    if (this.progressCallback) {
      const percentage = Math.round((currentStep / totalSteps) * 100);
      const eta = this.estimateETA(currentStep, totalSteps);

      this.progressCallback({
        stepId,
        stepDescription,
        currentStep,
        totalSteps,
        percentage,
        eta,
        message,
      });
    }
  }

  /**
   * Get count of completed steps
   */
  private getCompletedStepsCount(context: WorkflowContext): number {
    return context.executionHistory.filter((e) => e.status === 'completed')
      .length;
  }

  /**
   * Estimate ETA for remaining steps
   */
  private estimateETA(
    currentStep: number,
    totalSteps: number,
  ): number | undefined {
    if (currentStep === 0) return undefined;

    const remainingSteps = totalSteps - currentStep;
    const avgTimePerStep = 5000; // 5 seconds average

    return remainingSteps * avgTimePerStep;
  }

  /**
   * Generate workflow summary
   */
  private generateSummary(context: WorkflowContext, results: any[]): string {
    const summary = context.getExecutionSummary();
    const successRate = Math.round(
      (summary.completedSteps / summary.totalSteps) * 100,
    );

    let summaryText = `Workflow completed with ${successRate}% success rate. `;
    summaryText += `${summary.completedSteps}/${summary.totalSteps} steps completed. `;

    if (summary.failedSteps > 0) {
      summaryText += `${summary.failedSteps} steps failed. `;
    }

    summaryText += `Execution time: ${Math.round(summary.duration / 1000)}s.`;

    // Add results summary
    if (results.length > 0) {
      const resultTypes = results
        .map((r) => typeof r)
        .reduce(
          (acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

      summaryText += ` Generated ${results.length} results: ${Object.entries(
        resultTypes,
      )
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')}.`;
    }

    return summaryText;
  }
}
