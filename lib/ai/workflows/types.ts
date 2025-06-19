/**
 * Multi-Step Workflow Intelligence Types
 * Defines core types and interfaces for the workflow system
 */

export enum WorkflowStepType {
  QUERY = 'query', // Get data (search, list, get)
  CREATE = 'create', // Create new resources
  UPDATE = 'update', // Modify existing resources
  RELATE = 'relate', // Link resources (dependencies, assignments)
  BATCH = 'batch', // Bulk operations
  ANALYZE = 'analyze', // Process and summarize data
  NOTIFY = 'notify', // Send notifications
}

export enum WorkflowComplexity {
  SIMPLE = 'simple', // 1-2 steps
  MODERATE = 'moderate', // 3-5 steps
  COMPLEX = 'complex', // 6+ steps
}

export interface WorkflowDetection {
  isWorkflow: boolean;
  confidence: number;
  complexity: WorkflowComplexity;
  estimatedSteps: number;
  detectedPatterns: string[];
  reasoning: string;
}

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  tool: string;
  description: string;
  parameters: Record<string, any>;
  dependencies: string[]; // Step IDs this step depends on
  outputs: string[]; // Variable names this step produces
  canParallelize: boolean;
  timeout?: number; // Optional timeout in milliseconds
  retryCount?: number; // Number of retries on failure
}

export interface WorkflowVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'object' | 'array' | 'boolean';
  source: string; // Step ID that produced this variable
  description?: string;
}

export interface WorkflowContext {
  variables: Map<string, WorkflowVariable>;
  stepResults: Map<string, any>;
  executionHistory: WorkflowExecution[];
  metadata: {
    startTime: Date;
    userId?: string;
    sessionId?: string;
    originalQuery: string;
  };
}

export interface WorkflowExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: Error;
  retryAttempt?: number;
}

export interface ExecutionPhase {
  id: string;
  steps: WorkflowStep[];
  parallel: boolean;
  description: string;
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalSteps: number;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface WorkflowResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  results: any[];
  summary: string;
  executionTime: number;
  errors: Error[];
  context: WorkflowContext;
}

export interface WorkflowPattern {
  name: string;
  regex: RegExp;
  confidence: number;
  complexity: WorkflowComplexity;
  stepTypes: WorkflowStepType[];
  description: string;
}

export interface BatchOperation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  data?: any;
  headers?: Record<string, string>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  steps: Omit<WorkflowStep, 'id'>[];
  variables: string[];
  examples: string[];
}

export interface WorkflowCheckpoint {
  stepId: string;
  data: any;
  timestamp: Date;
  context: Partial<WorkflowContext>;
}

export interface RecoveryStrategy {
  type: 'retry' | 'skip' | 'rollback' | 'manual';
  maxAttempts?: number;
  rollbackSteps?: string[];
  userPrompt?: string;
}

export interface ProgressUpdate {
  stepId: string;
  stepDescription: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  eta?: number;
  message: string;
}

// Error types for workflow system
export class WorkflowError extends Error {
  constructor(
    message: string,
    public stepId?: string,
    public stepType?: WorkflowStepType,
    public recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class WorkflowTimeoutError extends WorkflowError {
  constructor(stepId: string, timeout: number) {
    super(
      `Step ${stepId} timed out after ${timeout}ms`,
      stepId,
      undefined,
      true,
    );
    this.name = 'WorkflowTimeoutError';
  }
}

export class WorkflowDependencyError extends WorkflowError {
  constructor(stepId: string, missingDependency: string) {
    super(
      `Step ${stepId} missing dependency: ${missingDependency}`,
      stepId,
      undefined,
      false,
    );
    this.name = 'WorkflowDependencyError';
  }
}

// Configuration interfaces
export interface WorkflowConfig {
  maxStepsPerWorkflow: number;
  defaultTimeout: number;
  maxRetries: number;
  enableParallelExecution: boolean;
  batchSize: number;
  enableCheckpoints: boolean;
  progressUpdateInterval: number;
}

export const DEFAULT_WORKFLOW_CONFIG = {
  maxStepsPerWorkflow: 20,
  defaultTimeout: 30000,
  maxRetries: 3,
  enableParallelExecution: true,
  batchSize: 10,
  enableCheckpoints: true,
  progressUpdateInterval: 1000,
} as const;
