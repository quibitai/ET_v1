/**
 * Asana MCP Client
 *
 * HTTP client for communicating with the containerized Asana MCP server.
 * Extends BaseMCPClient to leverage common functionality while providing
 * Asana-specific type-safe methods and interfaces.
 */

import {
  BaseMCPClient,
  type MCPClientConfig,
  type MCPToolRequest,
  type MCPToolResponse,
  type MCPBatchRequest,
  type MCPBatchResponse,
  type ValidationResult,
} from './BaseMCPClient';

// Re-export base types for backward compatibility
export type AsanaMCPConfig = MCPClientConfig;
export type {
  MCPToolRequest,
  MCPToolResponse,
  MCPBatchRequest,
  MCPBatchResponse,
};

// Asana-specific types
export interface AsanaWorkspace {
  gid: string;
  name: string;
  resource_type: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  assignee?: {
    gid: string;
    name: string;
  };
  projects?: Array<{
    gid: string;
    name: string;
  }>;
  due_on?: string;
  notes?: string;
  resource_type: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  archived: boolean;
  created_at: string;
  owner?: {
    gid: string;
    name: string;
  };
  team?: {
    gid: string;
    name: string;
  };
  resource_type: string;
}

/**
 * Asana-specific MCP client implementation
 */
export class AsanaMCPClient extends BaseMCPClient {
  readonly serviceName = 'asana';
  readonly defaultServerUrl = 'http://localhost:8080';
  readonly supportedTools = [
    'asana_list_workspaces',
    'asana_list_projects',
    'asana_search_projects',
    'asana_get_project',
    'asana_create_project',
    'asana_update_project',
    'asana_delete_project',
    'asana_search_tasks',
    'asana_get_task',
    'asana_create_task',
    'asana_update_task',
    'asana_delete_task',
    'asana_add_task_comment',
    'asana_get_task_comments',
    'asana_create_subtask',
    'asana_get_teams_for_workspace',
    'asana_list_workspace_users',
    'asana_get_user',
    'asana_get_project_hierarchy',
    'asana_batch_operations',
    'asana_upload_attachment',
    'asana_get_task_attachments',
    'asana_create_section',
    'asana_move_task_to_section',
    'asana_set_custom_field',
    'asana_get_custom_fields',
    'asana_create_tag',
    'asana_add_tag_to_task',
    'asana_remove_tag_from_task',
    'asana_duplicate_project',
    'asana_create_project_from_template',
    'asana_get_task_dependencies',
    'asana_add_task_dependency',
  ];

  /**
   * Create a simplified client instance with auto-detection
   */
  static async create(config: AsanaMCPConfig = {}): Promise<AsanaMCPClient> {
    const client = new AsanaMCPClient(config);

    // Ensure configuration is complete after inheritance
    client.ensureConfigured();

    // Validate configuration if auto-detect is enabled
    if (client.configuration.autoDetect) {
      const validation = await client.validateConfiguration();

      if (!validation.isValid) {
        console.warn(
          '[AsanaMCPClient] Configuration issues detected:',
          validation.errors,
        );

        // In development, provide helpful error messages
        if (process.env.NODE_ENV === 'development') {
          console.warn('\n🔧 AsanaMCP Setup Help:');
          console.warn(
            '1. Ensure the MCP server is running: cd mcp-server-asana && docker-compose -f docker-compose.dev.yml up',
          );
          console.warn('2. Set ASANA_ACCESS_TOKEN in your .env file');
          console.warn(
            '3. Verify ASANA_MCP_SERVER_URL points to the correct server\n',
          );
        }

        // Set short timeout to prevent hanging
        client.config.timeout = 2000; // 2 seconds for unhealthy services
      }
    }

    return client;
  }

  /**
   * Service-specific validation
   */
  protected async validateServiceSpecific(): Promise<{
    errors: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if Asana token is configured (for the MCP server)
    if (!process.env.ASANA_ACCESS_TOKEN) {
      errors.push(
        'ASANA_ACCESS_TOKEN environment variable is not set. The MCP server requires this to authenticate with Asana.',
      );
    }

    return { errors, warnings };
  }

  /**
   * Override executeTool to handle Asana-specific path
   */
  async executeTool(
    toolName: string,
    args: MCPToolRequest = {},
  ): Promise<MCPToolResponse> {
    // For Asana, tools are under /tools/asana/ path
    const response = await this.makeRequest(`/tools/asana/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    const result = await response.json();

    return {
      success: true,
      tool: toolName,
      result: result.result || result,
      timestamp: new Date().toISOString(),
      error: result.error,
    };
  }

  /**
   * Override executeBatch for Asana-specific batch endpoint
   */
  async executeBatch(request: MCPBatchRequest): Promise<MCPBatchResponse> {
    const response = await this.makeRequest('/tools/asana/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return response.json();
  }

  // Typed methods for common Asana operations

  /**
   * List workspaces
   */
  async listWorkspaces(): Promise<AsanaWorkspace[]> {
    const response = await this.executeTool('asana_list_workspaces');
    return response.result;
  }

  /**
   * Search tasks
   */
  async searchTasks(params: {
    workspace?: string;
    text?: string;
    completed?: boolean;
    assignee?: string;
    project?: string;
    limit?: number;
  }): Promise<AsanaTask[]> {
    const response = await this.executeTool('asana_search_tasks', {
      arguments: params,
    });
    return response.result;
  }

  /**
   * Get task details
   */
  async getTask(taskId: string, optFields?: string): Promise<AsanaTask> {
    const response = await this.executeTool('asana_get_task', {
      arguments: { task_id: taskId, opt_fields: optFields },
    });
    return response.result;
  }

  /**
   * Create task
   */
  async createTask(params: {
    project_id: string;
    name: string;
    notes?: string;
    due_on?: string;
    assignee?: string;
    custom_fields?: Record<string, any>;
  }): Promise<AsanaTask> {
    const response = await this.executeTool('asana_create_task', {
      arguments: params,
    });
    return response.result;
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    params: {
      name?: string;
      notes?: string;
      due_on?: string;
      assignee?: string;
      completed?: boolean;
      custom_fields?: Record<string, any>;
    },
  ): Promise<AsanaTask> {
    const response = await this.executeTool('asana_update_task', {
      arguments: { task_id: taskId, ...params },
    });
    return response.result;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.executeTool('asana_delete_task', {
      arguments: { task_id: taskId },
    });
  }

  /**
   * Search projects
   */
  async searchProjects(params: {
    name_pattern: string;
    workspace?: string;
    team?: string;
    archived?: boolean;
    limit?: number;
  }): Promise<AsanaProject[]> {
    const response = await this.executeTool('asana_search_projects', {
      arguments: params,
    });
    return response.result;
  }

  /**
   * List all projects in a workspace
   */
  async listProjects(
    params: {
      workspace?: string;
      team?: string;
      archived?: boolean;
      limit?: number;
      offset?: string;
      opt_fields?: string;
    } = {},
  ): Promise<AsanaProject[]> {
    const response = await this.executeTool('asana_list_projects', {
      arguments: params,
    });
    return response.result;
  }

  /**
   * Get project details
   */
  async getProject(
    projectId: string,
    optFields?: string,
  ): Promise<AsanaProject> {
    const response = await this.executeTool('asana_get_project', {
      arguments: { project_id: projectId, opt_fields: optFields },
    });
    return response.result;
  }

  /**
   * Create project
   */
  async createProject(params: {
    workspace_id: string;
    name: string;
    team_id?: string;
    public?: boolean;
    archived?: boolean;
    color?: string;
    layout?: string;
    notes?: string;
  }): Promise<AsanaProject> {
    const response = await this.executeTool('asana_create_project', {
      arguments: params,
    });
    return response.result;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    params: {
      name?: string;
      notes?: string;
      archived?: boolean;
      color?: string;
      public?: boolean;
    },
  ): Promise<AsanaProject> {
    const response = await this.executeTool('asana_update_project', {
      arguments: { project_id: projectId, ...params },
    });
    return response.result;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.executeTool('asana_delete_project', {
      arguments: { project_id: projectId },
    });
  }

  /**
   * Add comment to task
   */
  async addTaskComment(taskId: string, text: string): Promise<any> {
    const response = await this.executeTool('asana_add_task_comment', {
      arguments: { task_id: taskId, text: text },
    });
    return response.result;
  }

  /**
   * Get task comments
   */
  async getTaskComments(taskId: string, limit?: number): Promise<any[]> {
    const response = await this.executeTool('asana_get_task_comments', {
      arguments: { task_id: taskId, limit: limit },
    });
    return response.result;
  }

  /**
   * Create subtask
   */
  async createSubtask(
    parentTaskId: string,
    params: {
      name: string;
      notes?: string;
      assignee?: string;
      due_on?: string;
    },
  ): Promise<AsanaTask> {
    const response = await this.executeTool('asana_create_subtask', {
      arguments: { parent_task_id: parentTaskId, ...params },
    });
    return response.result;
  }

  /**
   * Get teams for workspace
   */
  async getTeamsForWorkspace(workspaceId: string): Promise<any[]> {
    const response = await this.executeTool('asana_get_teams_for_workspace', {
      arguments: { workspace_id: workspaceId },
    });
    return response.result;
  }

  /**
   * List workspace users
   */
  async listWorkspaceUsers(
    workspaceId: string,
    limit?: number,
  ): Promise<any[]> {
    const response = await this.executeTool('asana_list_workspace_users', {
      arguments: { workspace_id: workspaceId, limit: limit },
    });
    return response.result;
  }

  /**
   * Get user details
   */
  async getUser(userId: string): Promise<any> {
    const response = await this.executeTool('asana_get_user', {
      arguments: { user_id: userId },
    });
    return response.result;
  }

  /**
   * Get current user information
   * This uses the "me" identifier which should resolve to the authenticated user
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.executeTool('asana_get_user', {
      arguments: { user_id: 'me' },
    });
    return response.result;
  }

  /**
   * Get project hierarchy
   */
  async getProjectHierarchy(projectId: string): Promise<any> {
    const response = await this.executeTool('asana_get_project_hierarchy', {
      arguments: { project_id: projectId },
    });
    return response.result;
  }

  /**
   * Upload attachment to task
   */
  async uploadAttachment(
    taskId: string,
    file: {
      name: string;
      data: string; // Base64 encoded
      mimeType: string;
    },
  ): Promise<any> {
    const response = await this.executeTool('asana_upload_attachment', {
      arguments: {
        task_id: taskId,
        file_name: file.name,
        file_data: file.data,
        mime_type: file.mimeType,
      },
    });
    return response.result;
  }

  /**
   * Get task attachments
   */
  async getTaskAttachments(taskId: string): Promise<any[]> {
    const response = await this.executeTool('asana_get_task_attachments', {
      arguments: { task_id: taskId },
    });
    return response.result;
  }
}
