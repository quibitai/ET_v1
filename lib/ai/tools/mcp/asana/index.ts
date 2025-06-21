/**
 * Asana MCP Integration
 *
 * This file defines the LangChain tools for interacting with the Asana MCP server.
 * It uses the AsanaMCPClient to make HTTP calls to the containerized MCP service.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';

/**
 * Creates and configures the full suite of Asana tools for use by the AI agent.
 * This function initializes the connection to the Asana MCP server and returns
 * an array of DynamicStructuredTool instances that LangChain can execute.
 */
export async function createAsanaTools(
  userId: string,
  sessionId: string,
  logger?: RequestLogger,
): Promise<DynamicStructuredTool[]> {
  try {
    const client = await AsanaMCPClient.create();

    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      const validation = await client.validateConfiguration();
      const warningMessage =
        'Asana MCP health check failed, but attempting to create tools anyway. This may indicate a configuration issue with the MCP server.';
      logger?.warn(warningMessage, {
        serverUrl: validation.serverUrl,
        serverStatus: validation.serverStatus,
        errors: validation.errors,
      });
      console.warn(`[AsanaMCP] ${warningMessage}`);
    } else {
      logger?.info('Asana MCP server validated successfully.', {
        serverUrl: client.configuration.serverUrl,
      });
    }

    const tools: DynamicStructuredTool[] = [
      // Workspace Tools
      new DynamicStructuredTool({
        name: 'asana_list_workspaces',
        description:
          'List all available workspaces that the user has access to in Asana. Use this when the user asks about their workspaces, wants to see what organizations they belong to, or needs to identify workspace IDs for other operations. Essential first step before working with projects or tasks.',
        schema: z.object({
          opt_fields: z
            .string()
            .nullish()
            .describe('Comma-separated list of optional fields to include.'),
        }),
        func: async (args) => {
          const result = await client.listWorkspaces();
          return JSON.stringify(result);
        },
      }),

      // Project Tools
      new DynamicStructuredTool({
        name: 'asana_search_projects',
        description:
          'Search for projects in Asana by name pattern when you need to find specific projects. Use this when the user mentions specific project names or wants to find projects matching certain keywords. For listing all available projects without filtering, use asana_list_projects instead.',
        schema: z.object({
          name_pattern: z
            .string()
            .describe('Regular expression pattern to match project names.'),
          workspace: z
            .string()
            .nullish()
            .describe('The workspace to search in.'),
          team: z
            .string()
            .nullish()
            .describe('The team to filter projects on.'),
          archived: z
            .boolean()
            .nullish()
            .describe('Only return archived projects (default: false).'),
          limit: z.number().nullish().describe('Results per page (1-100).'),
          offset: z.string().nullish().describe('Pagination offset token.'),
          opt_fields: z
            .string()
            .nullish()
            .describe('Comma-separated list of optional fields to include.'),
        }),
        func: async (args) => {
          const result = await client.searchProjects(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_list_projects',
        description:
          'List all projects in a workspace without filtering. Use this when the user wants to see all available projects, browse projects, or asks "what projects do I have" or "list my projects". For finding specific projects by name, use asana_search_projects instead.',
        schema: z.object({
          workspace: z
            .string()
            .nullish()
            .describe(
              'The workspace to list projects from (optional if default workspace is configured).',
            ),
          team: z
            .string()
            .nullish()
            .describe('The team to filter projects on.'),
          archived: z
            .boolean()
            .nullish()
            .describe('Include archived projects (default: false).'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .nullish()
            .describe('Number of results per page (1-100, default: 20).'),
          offset: z
            .string()
            .nullish()
            .describe('Pagination offset token for getting next page.'),
          opt_fields: z
            .string()
            .nullish()
            .describe(
              'Comma-separated list of optional fields to include (e.g., "name,archived,team,owner").',
            ),
        }),
        func: async (args) => {
          // Add basic parameter validation
          if (args.limit && (args.limit < 1 || args.limit > 100)) {
            throw new Error('Limit must be between 1 and 100');
          }

          const result = await client.listProjects(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_project',
        description:
          'Get detailed information about a specific project when you have the project GID. Use this to fetch comprehensive project details including description, team, status, and metadata. Requires the exact project GID.',
        schema: z.object({
          project_id: z
            .string()
            .describe('The GID of the project to retrieve.'),
          opt_fields: z
            .string()
            .nullish()
            .describe('Comma-separated list of optional fields to include.'),
        }),
        func: async (args) => {
          const result = await client.getProject(
            args.project_id,
            args.opt_fields,
          );
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_create_project',
        description: 'Create a new project in a workspace.',
        schema: z.object({
          workspace_id: z
            .string()
            .describe('The workspace GID to create the project in.'),
          name: z.string().describe('Name of the project.'),
          team_id: z
            .string()
            .nullish()
            .describe(
              'The team GID to share the project with (required for organization workspaces).',
            ),
          public: z
            .boolean()
            .nullish()
            .describe('Whether the project is public to the organization.'),
          archived: z
            .boolean()
            .nullish()
            .describe('Whether the project is archived.'),
          color: z.string().nullish().describe('Color of the project.'),
          layout: z
            .string()
            .nullish()
            .describe(
              'The layout of the project (board, list, timeline, or calendar).',
            ),
          notes: z
            .string()
            .nullish()
            .describe(
              'Free-form textual information associated with the project.',
            ),
        }),
        func: async (args) => {
          const result = await client.createProject(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_update_project',
        description: 'Update an existing project.',
        schema: z.object({
          project_id: z.string().describe('The GID of the project to update.'),
          name: z.string().nullish().describe('New name for the project.'),
          notes: z
            .string()
            .nullish()
            .describe('New description for the project.'),
          archived: z
            .boolean()
            .nullish()
            .describe('Whether the project is archived.'),
          color: z.string().nullish().describe('Color of the project.'),
          public: z
            .boolean()
            .nullish()
            .describe('Whether the project is public.'),
        }),
        func: async (args) => {
          const projectId = args.project_id;
          const { project_id, ...updateData } = args;
          const result = await client.updateProject(projectId, updateData);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_delete_project',
        description: 'Delete a project.',
        schema: z.object({
          project_id: z.string().describe('The GID of the project to delete.'),
        }),
        func: async (args) => {
          const result = await client.deleteProject(args.project_id);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_project_hierarchy',
        description:
          'Get the complete hierarchical structure of a project, including sections, tasks, and subtasks.',
        schema: z.object({
          project_id: z
            .string()
            .describe('The project GID to get hierarchy for.'),
          include_completed_tasks: z
            .boolean()
            .nullish()
            .describe('Include completed tasks (default: false).'),
          include_subtasks: z
            .boolean()
            .nullish()
            .describe('Include subtasks for each task (default: true).'),
          max_subtask_depth: z
            .number()
            .nullish()
            .describe('Maximum depth of subtasks to retrieve (default: 1).'),
        }),
        func: async (args) => {
          const result = await client.getProjectHierarchy(args.project_id);
          return JSON.stringify(result);
        },
      }),

      // Task Tools
      new DynamicStructuredTool({
        name: 'asana_search_tasks',
        description:
          'Search and list tasks in a workspace with filtering options. Use this when the user wants to see their tasks, find specific tasks, or filter tasks by criteria like assignee, project, completion status, or text content. Examples: "list my tasks", "show completed tasks", "find tasks in project X".',
        schema: z.object({
          text: z
            .string()
            .nullish()
            .describe('Text to search for in task names and descriptions.'),
          assignee: z
            .string()
            .nullish()
            .describe(
              "Filter by assignee's GID or use 'me' for the current user.",
            ),
          project: z
            .string()
            .nullish()
            .describe('Filter by a specific project GID.'),
          workspace: z
            .string()
            .nullish()
            .describe(
              'The workspace GID to search in. Defaults to the configured default.',
            ),
          completed: z
            .boolean()
            .nullish()
            .describe('Filter for completed tasks. Defaults to false.'),
          limit: z
            .number()
            .nullish()
            .describe('Number of tasks to return. Defaults to 20.'),
          opt_fields: z
            .string()
            .nullish()
            .describe(
              'Comma-separated list of optional fields to include in the response.',
            ),
        }),
        func: async (args) => {
          // Add basic parameter validation
          if (args.limit && (args.limit < 1 || args.limit > 100)) {
            throw new Error('Limit must be between 1 and 100');
          }

          // Arguments are passed directly to the MCP client.
          // The MCP server is responsible for applying defaults (assignee: 'me', completed: false).
          const result = await client.searchTasks(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_task',
        description:
          'Get detailed information about a specific task by its GID.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to retrieve.'),
          opt_fields: z
            .string()
            .nullish()
            .describe('Comma-separated list of optional fields to include.'),
        }),
        func: async (args) => {
          const result = await client.getTask(args.task_id, args.opt_fields);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_create_task',
        description:
          'Create a new task in a project when the user wants to add a task, create a to-do item, or assign work. Use this when the user says "create a task", "add a task", "make a task", or similar creation requests. Requires a project ID.',
        schema: z.object({
          project_id: z
            .string()
            .describe('The project GID to create the task in.'),
          name: z.string().describe('Name of the task.'),
          notes: z.string().nullish().describe('Description of the task.'),
          due_on: z
            .string()
            .nullish()
            .describe('Due date in YYYY-MM-DD format.'),
          assignee: z.string().nullish().describe('Assignee user GID or "me".'),
          custom_fields: z
            .record(z.union([z.string(), z.number(), z.boolean()]))
            .nullish()
            .describe(
              'Object mapping custom field GID strings to their values.',
            ),
        }),
        func: async (args) => {
          // Add basic parameter validation
          if (!args.project_id || args.project_id.trim() === '') {
            throw new Error('Project ID is required to create a task');
          }
          if (!args.name || args.name.trim() === '') {
            throw new Error('Task name is required');
          }

          const result = await client.createTask(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_update_task',
        description: 'Update an existing task.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to update.'),
          name: z.string().nullish().describe('New name for the task.'),
          notes: z.string().nullish().describe('New description for the task.'),
          completed: z
            .boolean()
            .nullish()
            .describe('Mark task as completed or not.'),
          assignee: z
            .string()
            .nullish()
            .describe('New assignee user GID or "me".'),
          due_on: z
            .string()
            .nullish()
            .describe('Due date in YYYY-MM-DD format.'),
          custom_fields: z
            .record(z.union([z.string(), z.number(), z.boolean()]))
            .nullish()
            .describe(
              'Object mapping custom field GID strings to their values.',
            ),
        }),
        func: async (args) => {
          const taskId = args.task_id;
          const { task_id, ...updateData } = args;
          const result = await client.updateTask(taskId, updateData);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_delete_task',
        description: 'Delete a task.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to delete.'),
        }),
        func: async (args) => {
          const result = await client.deleteTask(args.task_id);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_create_subtask',
        description: 'Create a new subtask for an existing task.',
        schema: z.object({
          parent_task_id: z
            .string()
            .describe('The parent task GID to create the subtask under.'),
          name: z.string().describe('Name of the subtask.'),
          notes: z.string().nullish().describe('Description of the subtask.'),
          due_on: z
            .string()
            .nullish()
            .describe('Due date in YYYY-MM-DD format.'),
          assignee: z.string().nullish().describe('Assignee user GID or "me".'),
        }),
        func: async (args) => {
          const result = await client.createSubtask(args.parent_task_id, {
            name: args.name,
            notes: args.notes,
            assignee: args.assignee,
            due_on: args.due_on,
          });
          return JSON.stringify(result);
        },
      }),

      // Task Comments/Stories
      new DynamicStructuredTool({
        name: 'asana_add_task_comment',
        description: 'Add a comment to a task.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to comment on.'),
          text: z.string().describe('The text content of the comment.'),
        }),
        func: async (args) => {
          const result = await client.addTaskComment(args.task_id, args.text);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_task_comments',
        description: 'Get comments for a task.',
        schema: z.object({
          task_id: z
            .string()
            .describe('The GID of the task to get comments for.'),
          limit: z.number().nullish().describe('Number of comments to return.'),
        }),
        func: async (args) => {
          const result = await client.getTaskComments(args.task_id, args.limit);
          return JSON.stringify(result);
        },
      }),

      // Team Tools
      new DynamicStructuredTool({
        name: 'asana_get_teams_for_workspace',
        description: 'Get teams in a workspace.',
        schema: z.object({
          workspace_id: z
            .string()
            .describe('The workspace GID to get teams for.'),
        }),
        func: async (args) => {
          const result = await client.getTeamsForWorkspace(args.workspace_id);
          return JSON.stringify(result);
        },
      }),

      // User Tools
      new DynamicStructuredTool({
        name: 'asana_list_workspace_users',
        description: 'Get users in a workspace.',
        schema: z.object({
          workspace_id: z
            .string()
            .describe('The workspace GID to get users for.'),
          limit: z.number().nullish().describe('Results per page (1-100).'),
        }),
        func: async (args) => {
          const result = await client.listWorkspaceUsers(
            args.workspace_id,
            args.limit,
          );
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_user',
        description: 'Get information about a specific user.',
        schema: z.object({
          user_id: z
            .string()
            .describe('The user GID to retrieve, or "me" for current user.'),
        }),
        func: async (args) => {
          const result = await client.getUser(args.user_id);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_current_user',
        description: 'Get information about the current authenticated user.',
        schema: z.object({}),
        func: async () => {
          const result = await client.getCurrentUser();
          return JSON.stringify(result);
        },
      }),

      // Attachment Tools
      new DynamicStructuredTool({
        name: 'asana_upload_attachment',
        description: 'Upload a file as attachment to a task.',
        schema: z.object({
          task_id: z.string().describe('The task GID to attach the file to.'),
          file: z.object({
            name: z.string().describe('Name of the file.'),
            data: z.string().describe('Base64 encoded file data.'),
            mimeType: z.string().describe('MIME type of the file.'),
          }),
        }),
        func: async (args) => {
          const result = await client.uploadAttachment(args.task_id, args.file);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_task_attachments',
        description: 'Get attachments for a task.',
        schema: z.object({
          task_id: z.string().describe('The task GID to get attachments for.'),
        }),
        func: async (args) => {
          const result = await client.getTaskAttachments(args.task_id);
          return JSON.stringify(result);
        },
      }),
    ];

    return tools;
  } catch (error) {
    logger?.error('Failed to create Asana tools', { error });
    console.error('[AsanaMCP] CRITICAL: Failed to create Asana tools:', error);
    // Return an empty array if setup fails to prevent application crash
    return [];
  }
}

/**
 * Check if Asana MCP integration is available for a user
 */
export async function isAsanaMcpAvailable(userId: string): Promise<boolean> {
  try {
    const client = await AsanaMCPClient.create();
    return await client.isAvailable();
  } catch (error) {
    console.warn(`[AsanaMCP] Server not available for user ${userId}:`, error);
    return false;
  }
}
