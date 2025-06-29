/**
 * Unified Tool Registry Types
 *
 * This module defines the core interfaces for a simple, modular tool system
 * that works with both standard tools and MCP tools.
 */

export interface ToolContext {
  userId?: string;
  sessionId?: string;
  clientId?: string;
  specialistId?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    source?: string;
    toolName?: string;
  };
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface Tool {
  // Core identification
  name: string;
  description: string;
  category: ToolCategory;

  // LLM-friendly metadata
  displayName: string;
  usage: string; // When to use this tool
  examples: string[]; // Example queries that should trigger this tool

  // Parameters
  parameters: ToolParameter[];

  // Execution
  execute: (
    params: Record<string, any>,
    context: ToolContext,
  ) => Promise<ToolResult>;

  // Metadata
  source: 'standard' | 'mcp' | 'google-workspace';
  mcpServer?: string;
  isEnabled: boolean;
  requiresAuth?: boolean;
}

export enum ToolCategory {
  // Productivity
  TASK_MANAGEMENT = 'task_management',
  PROJECT_MANAGEMENT = 'project_management',
  CALENDAR = 'calendar',
  EMAIL = 'email',
  PRODUCTIVITY = 'productivity',

  // Information
  SEARCH = 'search',
  DOCUMENTS = 'documents',
  KNOWLEDGE = 'knowledge',
  FILES = 'files',

  // Communication
  MESSAGING = 'messaging',
  COLLABORATION = 'collaboration',

  // Utilities
  FILE_OPERATIONS = 'file_operations',
  DATA_ANALYSIS = 'data_analysis',

  // Google Workspace
  DOCS = 'docs',
  SHEETS = 'sheets',
  FORMS = 'forms',
  CHAT = 'chat',

  // Other
  GENERAL = 'general',
}

export interface ToolFilter {
  categories?: ToolCategory[];
  source?: 'standard' | 'mcp' | 'google-workspace' | 'all';
  requiresAuth?: boolean;
  isEnabled?: boolean;
  specialistId?: string;
}

export interface ToolRegistryConfig {
  enableMcp?: boolean;
  mcpServers?: string[];
  defaultTimeout?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  watchForChanges?: boolean;
  validateOnLoad?: boolean;
  manifestPath?: string;
}

// === MANIFEST TYPES ===

export interface ToolManifest {
  id: string;
  service: string;
  streamingSupported: boolean;
  category:
    | 'project_management'
    | 'task_management'
    | 'team_operations'
    | 'analytics'
    | 'communication'
    | 'general';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedDuration?: number;
  batchCompatible?: boolean;
  tags?: string[];
  requiredScopes?: string[];
  manifestVersion?: string;
}

export interface ManifestCollection {
  [service: string]: {
    [toolId: string]: ToolManifest;
  };
}

export interface ManifestValidationResult {
  isValid: boolean;
  errors?: string[];
}
