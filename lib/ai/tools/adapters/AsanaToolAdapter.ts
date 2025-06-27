/**
 * Asana Tool Adapter
 *
 * Converts Asana MCP tools to the unified tool interface with clear,
 * LLM-friendly descriptions to improve tool selection.
 */

import type { Tool, ToolContext, ToolResult } from '../registry/types';
import { ToolCategory } from '../registry/types';
import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';

export class AsanaToolAdapter {
  private mcpClient: AsanaMCPClient | null = null;

  async initialize(): Promise<void> {
    try {
      this.mcpClient = await AsanaMCPClient.create();
    } catch (error) {
      console.error(
        '[AsanaToolAdapter] Failed to initialize MCP client:',
        error,
      );
    }
  }

  /**
   * Get all Asana tools in unified format
   */
  getTools(): Tool[] {
    if (!this.mcpClient) {
      console.warn('[AsanaToolAdapter] MCP client not initialized');
      return [];
    }

    return [
      this.createListProjectsTool(),
      this.createListTasksTool(),
      this.createSearchProjectsTool(),
      this.createSearchTasksTool(),
      this.createGetProjectDetailsTool(),
      this.createGetTaskDetailsTool(),
      this.createCreateTaskTool(),
      this.createCreateProjectTool(),
      this.createListWorkspacesTool(),
    ];
  }

  private createListProjectsTool(): Tool {
    return {
      name: 'asana_list_projects',
      displayName: 'List Asana Projects',
      description: 'List all projects in Asana workspace',
      usage:
        'Use when user asks to see their projects, list projects, or get an overview of work',
      examples: [
        'list my projects',
        'show me my asana projects',
        'what projects do I have',
        'list active projects on asana',
      ],
      category: ToolCategory.PROJECT_MANAGEMENT,
      parameters: [
        {
          name: 'workspace_gid',
          type: 'string',
          description:
            'Workspace ID (optional, will use default if not provided)',
          required: false,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.listProjects(
            params.workspace_gid,
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_list_projects',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list projects',
            metadata: {
              source: 'asana',
              toolName: 'asana_list_projects',
            },
          };
        }
      },
    };
  }

  private createListTasksTool(): Tool {
    return {
      name: 'asana_list_tasks',
      displayName: 'List Asana Tasks',
      description: 'List tasks in Asana project or assigned to user',
      usage:
        'Use when user asks to see their tasks, list tasks, or get task overview',
      examples: [
        'list my tasks',
        'show me my asana tasks',
        'what tasks do I have',
        'list tasks in project',
      ],
      category: ToolCategory.TASK_MANAGEMENT,
      parameters: [
        {
          name: 'project_gid',
          type: 'string',
          description: 'Project ID to list tasks from (optional)',
          required: false,
        },
        {
          name: 'assignee',
          type: 'string',
          description: 'User ID to filter tasks by assignee (optional)',
          required: false,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.searchTasks({
            project: params.project_gid,
            assignee: params.assignee,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_list_tasks',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list tasks',
            metadata: {
              source: 'asana',
              toolName: 'asana_list_tasks',
            },
          };
        }
      },
    };
  }

  private createSearchProjectsTool(): Tool {
    return {
      name: 'asana_search_projects',
      displayName: 'Search Asana Projects',
      description: 'Search for projects in Asana by name or keyword',
      usage:
        'Use when user wants to find specific projects by name or search term',
      examples: [
        'find project named website',
        'search for marketing projects',
        'look for projects containing design',
      ],
      category: ToolCategory.PROJECT_MANAGEMENT,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search term to find projects',
          required: true,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.searchProjects({
            name_pattern: params.query,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_search_projects',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to search projects',
            metadata: {
              source: 'asana',
              toolName: 'asana_search_projects',
            },
          };
        }
      },
    };
  }

  private createSearchTasksTool(): Tool {
    return {
      name: 'asana_search_tasks',
      displayName: 'Search Asana Tasks',
      description: 'Search for tasks in Asana by name or keyword',
      usage:
        'Use when user wants to find specific tasks by name or search term',
      examples: [
        'find task about website',
        'search for urgent tasks',
        'look for tasks containing bug',
      ],
      category: ToolCategory.TASK_MANAGEMENT,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search term to find tasks',
          required: true,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.searchTasks(params.query);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_search_tasks',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to search tasks',
            metadata: {
              source: 'asana',
              toolName: 'asana_search_tasks',
            },
          };
        }
      },
    };
  }

  private createGetProjectDetailsTool(): Tool {
    return {
      name: 'asana_get_project_details',
      displayName: 'Get Asana Project Details',
      description: 'Get detailed information about a specific Asana project',
      usage:
        'Use when user wants detailed information about a specific project',
      examples: [
        'tell me about the website project',
        'get details for project ID 123',
        'show me project information',
      ],
      category: ToolCategory.PROJECT_MANAGEMENT,
      parameters: [
        {
          name: 'project_gid',
          type: 'string',
          description: 'Project ID to get details for',
          required: true,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.getProject(params.project_gid);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_get_project_details',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get project details',
            metadata: {
              source: 'asana',
              toolName: 'asana_get_project_details',
            },
          };
        }
      },
    };
  }

  private createGetTaskDetailsTool(): Tool {
    return {
      name: 'asana_get_task_details',
      displayName: 'Get Asana Task Details',
      description: 'Get detailed information about a specific Asana task',
      usage: 'Use when user wants detailed information about a specific task',
      examples: [
        'tell me about task ID 456',
        'get details for the bug fix task',
        'show me task information',
      ],
      category: ToolCategory.TASK_MANAGEMENT,
      parameters: [
        {
          name: 'task_gid',
          type: 'string',
          description: 'Task ID to get details for',
          required: true,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.getTaskDetails(params.task_gid);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_get_task_details',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get task details',
            metadata: {
              source: 'asana',
              toolName: 'asana_get_task_details',
            },
          };
        }
      },
    };
  }

  private createCreateTaskTool(): Tool {
    return {
      name: 'asana_create_task',
      displayName: 'Create Asana Task',
      description: 'Create a new task in Asana project',
      usage: 'Use when user wants to create a new task or add work item',
      examples: [
        'create a task to fix the bug',
        'add a task for website update',
        'make a new task in the project',
      ],
      category: ToolCategory.TASK_MANAGEMENT,
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Task name/title',
          required: true,
        },
        {
          name: 'notes',
          type: 'string',
          description: 'Task description/notes',
          required: false,
        },
        {
          name: 'projects',
          type: 'array',
          description: 'Array of project IDs to add task to',
          required: false,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.createTask(params);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_create_task',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create task',
            metadata: {
              source: 'asana',
              toolName: 'asana_create_task',
            },
          };
        }
      },
    };
  }

  private createCreateProjectTool(): Tool {
    return {
      name: 'asana_create_project',
      displayName: 'Create Asana Project',
      description: 'Create a new project in Asana workspace',
      usage: 'Use when user wants to create a new project or work area',
      examples: [
        'create a project for the website',
        'make a new marketing project',
        'start a project called design system',
      ],
      category: ToolCategory.PROJECT_MANAGEMENT,
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Project name/title',
          required: true,
        },
        {
          name: 'notes',
          type: 'string',
          description: 'Project description/notes',
          required: false,
        },
        {
          name: 'team',
          type: 'string',
          description: 'Team ID to create project in',
          required: false,
        },
      ],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.createProject(params);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_create_project',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create project',
            metadata: {
              source: 'asana',
              toolName: 'asana_create_project',
            },
          };
        }
      },
    };
  }

  private createListWorkspacesTool(): Tool {
    return {
      name: 'asana_list_workspaces',
      displayName: 'List Asana Workspaces',
      description: 'List all available Asana workspaces for the user',
      usage:
        'Use when user wants to see available workspaces or switch context',
      examples: [
        'list my workspaces',
        'show me available workspaces',
        'what workspaces do I have access to',
      ],
      category: ToolCategory.PROJECT_MANAGEMENT,
      parameters: [],
      source: 'mcp',
      mcpServer: 'asana',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          if (!this.mcpClient) {
            throw new Error('Asana MCP client not initialized');
          }

          const result = await this.mcpClient.listWorkspaces();

          return {
            success: true,
            data: result,
            metadata: {
              source: 'asana',
              toolName: 'asana_list_workspaces',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list workspaces',
            metadata: {
              source: 'asana',
              toolName: 'asana_list_workspaces',
            },
          };
        }
      },
    };
  }
}
