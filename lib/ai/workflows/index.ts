/**
 * Multi-Step Workflow Intelligence System
 *
 * Main entry point for the workflow system that integrates detection,
 * planning, and execution of multi-step workflows for Asana operations.
 */

export { WorkflowDetector } from './WorkflowDetector';
export { WorkflowPlanner } from './WorkflowPlanner';
export { ToolOrchestrator } from './ToolOrchestrator';

export * from './types';

import { WorkflowDetector } from './WorkflowDetector';
import { WorkflowPlanner } from './WorkflowPlanner';
import { ToolOrchestrator } from './ToolOrchestrator';
import type { WorkflowResult, ProgressUpdate } from './types';

/**
 * Main workflow system class that orchestrates the entire workflow process
 */
export class WorkflowSystem {
  private detector: WorkflowDetector;
  private planner: WorkflowPlanner;
  private orchestrator: ToolOrchestrator;

  constructor(progressCallback?: (update: ProgressUpdate) => void) {
    this.detector = new WorkflowDetector();
    this.planner = new WorkflowPlanner();
    this.orchestrator = new ToolOrchestrator({}, progressCallback);
  }

  /**
   * Process a query through the complete workflow system
   */
  public async processQuery(
    query: string,
    userId?: string,
    sessionId?: string,
  ): Promise<WorkflowResult | null> {
    // Step 1: Detect if this is a workflow
    const detection = this.detector.detectWorkflow(query);

    if (!detection.isWorkflow) {
      // Not a workflow, return null to indicate single-tool processing
      return null;
    }

    // Step 2: Plan the workflow
    const plan = this.planner.planWorkflow(
      query,
      detection.detectedPatterns,
      detection.complexity,
    );

    // Step 3: Execute the workflow
    const result = await this.orchestrator.executeWorkflow(
      plan,
      query,
      userId,
      sessionId,
    );

    return result;
  }

  /**
   * Check if a query should be processed as a workflow
   */
  public shouldProcessAsWorkflow(query: string): boolean {
    const detection = this.detector.detectWorkflow(query);
    return detection.isWorkflow && detection.confidence >= 0.6;
  }

  /**
   * Get workflow detection details without executing
   */
  public analyzeQuery(query: string) {
    const detection = this.detector.detectWorkflow(query);

    if (detection.isWorkflow) {
      const plan = this.planner.planWorkflow(
        query,
        detection.detectedPatterns,
        detection.complexity,
      );

      return {
        detection,
        plan,
        wouldExecute: true,
      };
    }

    return {
      detection,
      plan: null,
      wouldExecute: false,
    };
  }

  /**
   * Add custom workflow patterns
   */
  public addCustomPattern(pattern: any) {
    this.detector.addPattern(pattern);
  }
}
