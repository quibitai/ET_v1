/**
 * Core Type Definitions for Asana Tool
 *
 * Comprehensive type safety for all Asana operations
 * Based on Asana API v1.0 specifications
 */

// === CORE ASANA ENTITIES ===

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  assignee?: AsanaUser;
  assignee_status?: 'inbox' | 'later' | 'today' | 'upcoming';
  due_on?: string; // YYYY-MM-DD format
  due_at?: string; // ISO 8601 datetime
  projects?: AsanaProject[];
  parent?: AsanaTask;
  subtasks?: AsanaTask[];
  tags?: AsanaTag[];
  created_at: string;
  modified_at: string;
  permalink_url: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  color?: string;
  public: boolean;
  archived: boolean;
  team?: AsanaTeam;
  workspace: AsanaWorkspace;
  sections?: AsanaSection[];
  created_at: string;
  modified_at: string;
  permalink_url: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  photo?: {
    image_128x128?: string;
    image_21x21?: string;
  };
  workspaces?: AsanaWorkspace[];
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
  is_organization: boolean;
}

export interface AsanaTeam {
  gid: string;
  name: string;
  description?: string;
  organization?: AsanaWorkspace;
}

export interface AsanaSection {
  gid: string;
  name: string;
  project: AsanaProject;
  created_at: string;
}

export interface AsanaTag {
  gid: string;
  name: string;
  color?: string;
  notes?: string;
}

// === API RESPONSE TYPES ===

export interface AsanaApiResponse<T> {
  data: T;
}

export interface AsanaApiCollectionResponse<T> {
  data: T[];
  next_page?: {
    offset: string;
    path: string;
    uri: string;
  };
}

export interface AsanaApiError {
  message: string;
  phrase: string;
  status_code: number;
  error_code: number;
}

// === OPERATION PARAMETER TYPES ===

export interface CreateTaskParams {
  name: string;
  notes?: string;
  assignee?: string; // GID or email
  projects?: string[]; // Array of project GIDs
  due_on?: string; // YYYY-MM-DD
  due_at?: string; // ISO 8601
  parent?: string; // Parent task GID
  tags?: string[]; // Array of tag GIDs
}

export interface UpdateTaskParams {
  name?: string;
  notes?: string;
  assignee?: string;
  completed?: boolean;
  due_on?: string;
  due_at?: string;
}

export interface ListTasksParams {
  assignee?: string; // 'me' or user GID
  project?: string; // Project GID
  section?: string; // Section GID
  workspace?: string; // Workspace GID
  completed_since?: string; // ISO 8601
  modified_since?: string; // ISO 8601
  opt_fields?: string[];
  limit?: number;
  offset?: string;
}

export interface CreateProjectParams {
  name: string;
  notes?: string;
  team?: string; // Team GID
  workspace?: string; // Workspace GID
  public?: boolean;
  color?: string;
  layout?: 'board' | 'list' | 'timeline' | 'calendar';
}

// === TOOL EXECUTION TYPES ===

export interface ExecutionContext {
  sessionId: string;
  requestId?: string;
  userIntent?: string;
  conversationContext?: Record<string, any>;
  features?: {
    workflows?: boolean;
    semanticResolution?: boolean;
    errorRecovery?: boolean;
    responseEnhancement?: boolean;
  };
}

/**
 * Standardized result format for tool operations
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T; // Data is optional for operations that might not return data
  error?: string;
  message?: string; // Optional user-facing message
  metadata: {
    operation: string;
    duration: number;
    requestId?: string;
    errorRecoveryUsed?: boolean;
    semanticResolutionUsed?: boolean;
    workflowExecuted?: boolean;
  };
}

export interface EnhancedResponse {
  summary: string;
  formattedData?: string;
  suggestions?: string[];
  relatedActions?: string[];
  followUpQuestions?: string[];
}

// === INTENT PROCESSING TYPES ===

export interface AsanaIntent {
  operation: AsanaOperation;
  parameters: Record<string, any>;
  complexity: 'simple' | 'complex';
  confidence: number;
  originalQuery: string;
  sessionId?: string;
}

export type AsanaOperation =
  | 'list_tasks'
  | 'create_task'
  | 'update_task'
  | 'complete_task'
  | 'delete_task'
  | 'get_task_details'
  | 'list_projects'
  | 'create_project'
  | 'get_project_details'
  | 'list_users'
  | 'get_user_info'
  | 'search'
  | 'execute_workflow';

// === ERROR TYPES ===

export class AsanaToolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AsanaToolError';
  }
}

export interface ErrorRecoveryStrategy {
  name: string;
  description: string;
  execute: (
    error: AsanaToolError,
    context: ExecutionContext,
  ) => Promise<OperationResult>;
}

// === UTILITY TYPES ===

export type OptionalFields =
  | 'name'
  | 'notes'
  | 'assignee'
  | 'assignee.name'
  | 'completed'
  | 'due_on'
  | 'due_at'
  | 'projects'
  | 'projects.name'
  | 'parent'
  | 'parent.name'
  | 'tags'
  | 'tags.name'
  | 'created_at'
  | 'modified_at'
  | 'permalink_url';

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}
