/**
 * WorkflowPlanner - Decomposes complex queries into executable workflow steps
 *
 * This class takes a detected multi-step workflow and breaks it down into
 * individual steps with proper dependencies, parameter extraction, and
 * execution planning. It creates an optimized execution plan that can
 * handle sequential and parallel operations.
 */

import type { WorkflowStep, ExecutionPlan, ExecutionPhase } from './types';
import { WorkflowStepType, WorkflowComplexity } from './types';

interface StepTemplate {
  type: WorkflowStepType;
  tool: string;
  description: string;
  parameterExtraction: (query: string, context?: any) => Record<string, any>;
  outputs: string[];
  dependencies?: string[];
  canParallelize: boolean;
}

export class WorkflowPlanner {
  private stepTemplates: Map<string, StepTemplate[]> = new Map();

  constructor() {
    this.initializeStepTemplates();
  }

  /**
   * Plan a workflow based on the detected patterns and query
   */
  public planWorkflow(
    query: string,
    detectedPatterns: string[],
    complexity: WorkflowComplexity,
  ): ExecutionPlan {
    const steps = this.generateSteps(query, detectedPatterns);
    const phases = this.organizePhasesWithDependencies(steps);

    return {
      phases,
      totalSteps: steps.length,
      estimatedDuration: this.estimateDuration(steps, complexity),
      riskLevel: this.assessRiskLevel(steps, complexity),
    };
  }

  /**
   * Generate workflow steps based on patterns and query analysis
   */
  private generateSteps(query: string, patterns: string[]): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    let stepCounter = 1;

    // Process each detected pattern
    for (const pattern of patterns) {
      const templates = this.stepTemplates.get(pattern) || [];

      for (const template of templates) {
        const step: WorkflowStep = {
          id: `step_${stepCounter++}`,
          type: template.type,
          tool: template.tool,
          description: template.description,
          parameters: template.parameterExtraction(query),
          dependencies: template.dependencies || [],
          outputs: template.outputs,
          canParallelize: template.canParallelize,
          timeout: this.getTimeoutForStepType(template.type),
        };

        steps.push(step);
      }
    }

    // If no pattern-based steps, create a fallback plan
    if (steps.length === 0) {
      steps.push(this.createFallbackStep(query));
    }

    // Resolve dependencies and variable references
    return this.resolveDependencies(steps);
  }

  /**
   * Organize steps into execution phases based on dependencies
   */
  private organizePhasesWithDependencies(
    steps: WorkflowStep[],
  ): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];
    const processedSteps = new Set<string>();
    let phaseCounter = 1;

    while (processedSteps.size < steps.length) {
      const currentPhaseSteps: WorkflowStep[] = [];

      // Find steps that can execute in this phase
      for (const step of steps) {
        if (processedSteps.has(step.id)) continue;

        // Check if all dependencies are satisfied
        const dependenciesSatisfied = step.dependencies.every(
          (dep) =>
            processedSteps.has(dep) ||
            steps.find((s) => s.id === dep) === undefined,
        );

        if (dependenciesSatisfied) {
          currentPhaseSteps.push(step);
        }
      }

      if (currentPhaseSteps.length === 0) {
        // Break circular dependencies or unresolved dependencies
        const remainingSteps = steps.filter((s) => !processedSteps.has(s.id));
        if (remainingSteps.length > 0) {
          currentPhaseSteps.push(remainingSteps[0]);
        }
      }

      // Determine if phase can run in parallel
      const canRunInParallel =
        currentPhaseSteps.length > 1 &&
        currentPhaseSteps.every((step) => step.canParallelize);

      phases.push({
        id: `phase_${phaseCounter++}`,
        steps: currentPhaseSteps,
        parallel: canRunInParallel,
        description: this.generatePhaseDescription(currentPhaseSteps),
      });

      // Mark steps as processed
      currentPhaseSteps.forEach((step) => processedSteps.add(step.id));
    }

    return phases;
  }

  /**
   * Initialize step templates for different workflow patterns
   */
  private initializeStepTemplates(): void {
    // Project creation workflows
    this.stepTemplates.set('create_and_add', [
      {
        type: WorkflowStepType.CREATE,
        tool: 'asana_create_project',
        description: 'Create new project',
        parameterExtraction: (query) => this.extractProjectParameters(query),
        outputs: ['project_id', 'project_gid'],
        canParallelize: false,
      },
      {
        type: WorkflowStepType.CREATE,
        tool: 'asana_create_task',
        description: 'Create tasks for project',
        parameterExtraction: (query) => this.extractTaskParameters(query),
        outputs: ['task_ids'],
        dependencies: ['step_1'],
        canParallelize: true,
      },
      {
        type: WorkflowStepType.RELATE,
        tool: 'asana_add_project_members',
        description: 'Add team members to project',
        parameterExtraction: (query) => this.extractMemberParameters(query),
        outputs: ['member_assignments'],
        dependencies: ['step_1'],
        canParallelize: true,
      },
    ]);

    // Find and update workflows
    this.stepTemplates.set('find_then_update', [
      {
        type: WorkflowStepType.QUERY,
        tool: 'asana_search_tasks',
        description: 'Find tasks matching criteria',
        parameterExtraction: (query) => this.extractSearchParameters(query),
        outputs: ['found_tasks'],
        canParallelize: false,
      },
      {
        type: WorkflowStepType.UPDATE,
        tool: 'asana_update_task',
        description: 'Update found tasks',
        parameterExtraction: (query) => this.extractUpdateParameters(query),
        outputs: ['updated_tasks'],
        dependencies: ['step_1'],
        canParallelize: true,
      },
    ]);

    // Bulk operations
    this.stepTemplates.set('bulk_operations', [
      {
        type: WorkflowStepType.QUERY,
        tool: 'asana_search_tasks',
        description: 'Find all items for bulk operation',
        parameterExtraction: (query) => this.extractBulkSearchParameters(query),
        outputs: ['bulk_items'],
        canParallelize: false,
      },
      {
        type: WorkflowStepType.BATCH,
        tool: 'asana_batch_update',
        description: 'Perform bulk updates',
        parameterExtraction: (query) => this.extractBulkUpdateParameters(query),
        outputs: ['batch_results'],
        dependencies: ['step_1'],
        canParallelize: false,
      },
    ]);

    // Analysis workflows
    this.stepTemplates.set('analysis_workflow', [
      {
        type: WorkflowStepType.QUERY,
        tool: 'asana_search_projects',
        description: 'Get projects for analysis',
        parameterExtraction: (query) => this.extractAnalysisParameters(query),
        outputs: ['projects_data'],
        canParallelize: false,
      },
      {
        type: WorkflowStepType.ANALYZE,
        tool: 'analyze_project_metrics',
        description: 'Analyze project data',
        parameterExtraction: (query) => this.extractMetricsParameters(query),
        outputs: ['analysis_results'],
        dependencies: ['step_1'],
        canParallelize: false,
      },
      {
        type: WorkflowStepType.CREATE,
        tool: 'create_report',
        description: 'Generate analysis report',
        parameterExtraction: (query) => this.extractReportParameters(query),
        outputs: ['report'],
        dependencies: ['step_2'],
        canParallelize: false,
      },
    ]);
  }

  /**
   * Parameter extraction methods for different workflow types
   */
  private extractProjectParameters(query: string): Record<string, any> {
    const projectNameMatch = query.match(
      /create\s+(?:project\s+)?['"]?([^'"]+)['"]?/i,
    );
    const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

    return {
      name: projectNameMatch?.[1] || 'New Project',
      workspace: workspaceId,
      notes: `Created via workflow: ${query}`,
    };
  }

  private extractTaskParameters(query: string): Record<string, any> {
    const taskMatches = query.match(
      /(?:add|create)\s+(\d+)\s+(?:tasks?|items?)/i,
    );
    const taskCount = taskMatches ? Number.parseInt(taskMatches[1]) : 3;

    return {
      count: taskCount,
      project: '${project_gid}', // Will be substituted at runtime
      names: this.generateDefaultTaskNames(taskCount),
    };
  }

  private extractMemberParameters(query: string): Record<string, any> {
    const memberMatches = query.match(/(?:add|assign)\s+(?:to\s+)?([^,]+)/i);
    const members = memberMatches?.[1]?.split(/\s+and\s+|\s*,\s*/) || [];

    return {
      project: '${project_gid}',
      members: members.filter((m) => m.trim().length > 0),
    };
  }

  private extractSearchParameters(query: string): Record<string, any> {
    const workspace = process.env.DEFAULT_WORKSPACE_ID;

    // Extract search criteria
    const overdueMatch = query.match(/overdue/i);
    const assignedMatch = query.match(/assigned\s+to\s+me/i);
    const dueDateMatch = query.match(/due\s+(today|this\s+week|next\s+week)/i);

    return {
      workspace,
      completed: false,
      assignee: assignedMatch ? 'me' : undefined,
      due_on_before: overdueMatch
        ? new Date().toISOString().split('T')[0]
        : undefined,
      text: this.extractSearchText(query),
    };
  }

  private extractUpdateParameters(query: string): Record<string, any> {
    const dueDateMatch = query.match(
      /(?:extend|set|update)\s+due\s+dates?\s+to\s+([^,]+)/i,
    );
    const commentMatch = query.match(/add\s+comment[s]?\s+['"]([^'"]+)['"]?/i);

    return {
      tasks: '${found_tasks}',
      due_on: dueDateMatch?.[1] || 'next Friday',
      notes: commentMatch?.[1] || 'Updated via workflow',
    };
  }

  private extractBulkSearchParameters(query: string): Record<string, any> {
    const workspace = process.env.DEFAULT_WORKSPACE_ID;
    const allMatch = query.match(/all\s+([^,]+)/i);

    return {
      workspace,
      text: allMatch?.[1] || '',
      limit: 100,
    };
  }

  private extractBulkUpdateParameters(query: string): Record<string, any> {
    return {
      items: '${bulk_items}',
      operation: this.extractBulkOperation(query),
    };
  }

  private extractAnalysisParameters(query: string): Record<string, any> {
    const workspace = process.env.DEFAULT_WORKSPACE_ID;
    const teamMatch = query.match(/(?:in\s+)?([^,]+)\s+(?:workspace|team)/i);

    return {
      workspace,
      team: teamMatch?.[1],
      limit: 50,
    };
  }

  private extractMetricsParameters(query: string): Record<string, any> {
    return {
      projects: '${projects_data}',
      metrics: ['completion_rate', 'task_count', 'overdue_count'],
    };
  }

  private extractReportParameters(query: string): Record<string, any> {
    return {
      data: '${analysis_results}',
      format: 'summary',
      title: 'Project Analysis Report',
    };
  }

  /**
   * Helper methods
   */
  private generateDefaultTaskNames(count: number): string[] {
    const baseNames = [
      'Planning',
      'Research',
      'Development',
      'Testing',
      'Review',
      'Documentation',
    ];
    return Array.from(
      { length: count },
      (_, i) => baseNames[i] || `Task ${i + 1}`,
    );
  }

  private extractSearchText(query: string): string {
    // Remove common workflow words to get search text
    return query
      .replace(/find|search|get|show|list/gi, '')
      .replace(/then|and|also/gi, '')
      .replace(/update|modify|change/gi, '')
      .trim();
  }

  private extractBulkOperation(query: string): string {
    if (query.includes('delete')) return 'delete';
    if (query.includes('archive')) return 'archive';
    if (query.includes('assign')) return 'assign';
    if (query.includes('move')) return 'move';
    if (query.includes('update')) return 'update';
    return 'update';
  }

  private resolveDependencies(steps: WorkflowStep[]): WorkflowStep[] {
    // Update dependency references to use actual step IDs
    return steps.map((step) => ({
      ...step,
      dependencies: step.dependencies.filter((dep) =>
        steps.some((s) => s.id === dep),
      ),
    }));
  }

  private createFallbackStep(query: string): WorkflowStep {
    return {
      id: 'step_1',
      type: WorkflowStepType.QUERY,
      tool: 'asana_search_tasks',
      description: 'Execute query as single step',
      parameters: { text: query, workspace: process.env.DEFAULT_WORKSPACE_ID },
      dependencies: [],
      outputs: ['results'],
      canParallelize: false,
    };
  }

  private generatePhaseDescription(steps: WorkflowStep[]): string {
    if (steps.length === 1) {
      return steps[0].description;
    }

    const types = [...new Set(steps.map((s) => s.type))];
    return `Execute ${steps.length} ${types.join('/')} operations`;
  }

  private getTimeoutForStepType(type: WorkflowStepType): number {
    const timeouts = {
      [WorkflowStepType.QUERY]: 15000,
      [WorkflowStepType.CREATE]: 10000,
      [WorkflowStepType.UPDATE]: 10000,
      [WorkflowStepType.RELATE]: 8000,
      [WorkflowStepType.BATCH]: 30000,
      [WorkflowStepType.ANALYZE]: 20000,
      [WorkflowStepType.NOTIFY]: 5000,
    };

    return timeouts[type] || 15000;
  }

  private estimateDuration(
    steps: WorkflowStep[],
    complexity: WorkflowComplexity,
  ): number {
    const baseTime = steps.reduce(
      (total, step) => total + (step.timeout || 15000),
      0,
    );

    const complexityMultiplier = {
      [WorkflowComplexity.SIMPLE]: 1,
      [WorkflowComplexity.MODERATE]: 1.2,
      [WorkflowComplexity.COMPLEX]: 1.5,
    };

    return Math.ceil(baseTime * complexityMultiplier[complexity]);
  }

  private assessRiskLevel(
    steps: WorkflowStep[],
    complexity: WorkflowComplexity,
  ): 'low' | 'medium' | 'high' {
    const hasDestructiveOps = steps.some(
      (s) =>
        s.type === WorkflowStepType.UPDATE || s.type === WorkflowStepType.BATCH,
    );

    if (complexity === WorkflowComplexity.COMPLEX || hasDestructiveOps) {
      return 'high';
    }

    if (complexity === WorkflowComplexity.MODERATE || steps.length > 3) {
      return 'medium';
    }

    return 'low';
  }
}
