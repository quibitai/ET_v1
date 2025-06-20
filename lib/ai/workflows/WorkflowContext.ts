/**
 * WorkflowContext - Manages state and variables between workflow steps
 *
 * This class handles the execution context for multi-step workflows,
 * including variable storage, result aggregation, and context cleanup.
 * It provides a way to pass data between workflow steps and maintain
 * execution state throughout the workflow lifecycle.
 */

import type {
  WorkflowContext as IWorkflowContext,
  WorkflowVariable,
  WorkflowExecution,
  WorkflowCheckpoint,
} from './types';

export class WorkflowContext implements IWorkflowContext {
  public variables: Map<string, WorkflowVariable> = new Map();
  public stepResults: Map<string, any> = new Map();
  public executionHistory: WorkflowExecution[] = [];
  public metadata: {
    startTime: Date;
    userId?: string;
    sessionId?: string;
    originalQuery: string;
  };

  private checkpoints: WorkflowCheckpoint[] = [];

  constructor(originalQuery: string, userId?: string, sessionId?: string) {
    this.metadata = {
      startTime: new Date(),
      userId,
      sessionId,
      originalQuery,
    };
  }

  /**
   * Set a variable in the workflow context
   */
  public setVariable(
    name: string,
    value: any,
    source: string,
    type?: 'string' | 'number' | 'object' | 'array' | 'boolean',
    description?: string,
  ): void {
    const detectedType = type || this.detectType(value);

    const variable: WorkflowVariable = {
      name,
      value,
      type: detectedType,
      source,
      description,
    };

    this.variables.set(name, variable);
  }

  /**
   * Get a variable from the workflow context
   */
  public getVariable(name: string): WorkflowVariable | undefined {
    return this.variables.get(name);
  }

  /**
   * Get variable value directly
   */
  public getVariableValue(name: string): any {
    return this.variables.get(name)?.value;
  }

  /**
   * Check if a variable exists
   */
  public hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Set step result
   */
  public setStepResult(stepId: string, result: any): void {
    this.stepResults.set(stepId, result);

    // Auto-extract variables from step results
    this.extractVariablesFromResult(stepId, result);
  }

  /**
   * Get step result
   */
  public getStepResult(stepId: string): any {
    return this.stepResults.get(stepId);
  }

  /**
   * Add execution record
   */
  public addExecution(execution: WorkflowExecution): void {
    this.executionHistory.push(execution);
  }

  /**
   * Update execution status
   */
  public updateExecution(
    stepId: string,
    updates: Partial<WorkflowExecution>,
  ): void {
    const execution = this.executionHistory.find((e) => e.stepId === stepId);
    if (execution) {
      Object.assign(execution, updates);
    }
  }

  /**
   * Get execution by step ID
   */
  public getExecution(stepId: string): WorkflowExecution | undefined {
    return this.executionHistory.find((e) => e.stepId === stepId);
  }

  /**
   * Substitute variables in parameters
   */
  public substituteVariables(
    parameters: Record<string, any>,
  ): Record<string, any> {
    const substituted: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      substituted[key] = this.substituteValue(value);
    }

    return substituted;
  }

  /**
   * Create a checkpoint for rollback purposes
   */
  public createCheckpoint(stepId: string, data: any): void {
    const checkpoint: WorkflowCheckpoint = {
      stepId,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: new Date(),
      context: {
        variables: new Map(this.variables),
        stepResults: new Map(this.stepResults),
        executionHistory: [...this.executionHistory],
      },
    };

    this.checkpoints.push(checkpoint);

    // Keep only last 5 checkpoints to prevent memory issues
    if (this.checkpoints.length > 5) {
      this.checkpoints.shift();
    }
  }

  /**
   * Restore from a checkpoint
   */
  public restoreFromCheckpoint(stepId: string): boolean {
    const checkpoint = this.checkpoints
      .reverse()
      .find((cp) => cp.stepId === stepId);

    if (!checkpoint || !checkpoint.context) {
      return false;
    }

    // Restore context state
    this.variables = checkpoint.context.variables || new Map();
    this.stepResults = checkpoint.context.stepResults || new Map();
    this.executionHistory = checkpoint.context.executionHistory || [];

    return true;
  }

  /**
   * Get execution summary
   */
  public getExecutionSummary(): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    runningSteps: number;
    pendingSteps: number;
    duration: number;
  } {
    const completed = this.executionHistory.filter(
      (e) => e.status === 'completed',
    ).length;
    const failed = this.executionHistory.filter(
      (e) => e.status === 'failed',
    ).length;
    const running = this.executionHistory.filter(
      (e) => e.status === 'running',
    ).length;
    const pending = this.executionHistory.filter(
      (e) => e.status === 'pending',
    ).length;

    const duration = Date.now() - this.metadata.startTime.getTime();

    return {
      totalSteps: this.executionHistory.length,
      completedSteps: completed,
      failedSteps: failed,
      runningSteps: running,
      pendingSteps: pending,
      duration,
    };
  }

  /**
   * Get all variables as a plain object
   */
  public getAllVariables(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, variable] of this.variables) {
      result[name] = variable.value;
    }

    return result;
  }

  /**
   * Get workflow results aggregated from all steps
   */
  public getAggregatedResults(): any[] {
    const results: any[] = [];

    for (const [stepId, result] of this.stepResults) {
      results.push({
        stepId,
        result,
        execution: this.getExecution(stepId),
      });
    }

    return results;
  }

  /**
   * Clear all context data
   */
  public cleanup(): void {
    this.variables.clear();
    this.stepResults.clear();
    this.executionHistory.length = 0;
    this.checkpoints.length = 0;
  }

  /**
   * Export context for debugging or logging
   */
  public export(): {
    metadata: {
      startTime: Date;
      userId?: string;
      sessionId?: string;
      originalQuery: string;
    };
    variables: Array<[string, WorkflowVariable]>;
    stepResults: Array<[string, any]>;
    executionHistory: WorkflowExecution[];
    summary: {
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      runningSteps: number;
      pendingSteps: number;
      duration: number;
    };
  } {
    return {
      metadata: this.metadata,
      variables: Array.from(this.variables.entries()),
      stepResults: Array.from(this.stepResults.entries()),
      executionHistory: this.executionHistory,
      summary: this.getExecutionSummary(),
    };
  }

  /**
   * Private helper methods
   */
  private detectType(
    value: any,
  ): 'string' | 'number' | 'object' | 'array' | 'boolean' {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'object'; // fallback
  }

  private substituteValue(value: any): any {
    if (
      typeof value === 'string' &&
      value.startsWith('${') &&
      value.endsWith('}')
    ) {
      // Variable substitution: ${variable_name}
      const variableName = value.slice(2, -1);
      const variable = this.getVariable(variableName);

      if (variable) {
        return variable.value;
      }

      // Try to find in step results
      const stepResult = this.stepResults.get(variableName);
      if (stepResult !== undefined) {
        return stepResult;
      }

      // Return original value if no substitution found
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.substituteValue(item));
    }

    if (typeof value === 'object' && value !== null) {
      const substituted: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        substituted[key] = this.substituteValue(val);
      }
      return substituted;
    }

    return value;
  }

  private extractVariablesFromResult(stepId: string, result: any): void {
    // Auto-extract common variable patterns from results
    if (result && typeof result === 'object') {
      // Extract IDs
      if (result.gid) {
        this.setVariable(
          `${stepId}_gid`,
          result.gid,
          stepId,
          'string',
          'Auto-extracted GID',
        );
      }

      if (result.id) {
        this.setVariable(
          `${stepId}_id`,
          result.id,
          stepId,
          'string',
          'Auto-extracted ID',
        );
      }

      // Extract arrays of items
      if (Array.isArray(result)) {
        this.setVariable(
          `${stepId}_items`,
          result,
          stepId,
          'array',
          'Auto-extracted items array',
        );
        this.setVariable(
          `${stepId}_count`,
          result.length,
          stepId,
          'number',
          'Auto-extracted count',
        );

        // Extract IDs from array items
        const ids = result.map((item) => item?.gid || item?.id).filter(Boolean);
        if (ids.length > 0) {
          this.setVariable(
            `${stepId}_ids`,
            ids,
            stepId,
            'array',
            'Auto-extracted IDs',
          );
        }
      }

      // Extract data array from paginated results
      if (result.data && Array.isArray(result.data)) {
        this.setVariable(
          `${stepId}_data`,
          result.data,
          stepId,
          'array',
          'Auto-extracted data array',
        );
        this.setVariable(
          `${stepId}_count`,
          result.data.length,
          stepId,
          'number',
          'Auto-extracted data count',
        );
      }

      // Extract project/task specific fields
      if (result.name) {
        this.setVariable(
          `${stepId}_name`,
          result.name,
          stepId,
          'string',
          'Auto-extracted name',
        );
      }

      if (result.permalink_url) {
        this.setVariable(
          `${stepId}_url`,
          result.permalink_url,
          stepId,
          'string',
          'Auto-extracted URL',
        );
      }
    }
  }
}
