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

    // PERFORMANCE FIX: Skip health check to avoid delays from failing Asana MCP server
    // The tools will still work if the server is available, but we won't wait for health checks
    logger?.info('Asana MCP tools created (health check skipped for performance)', {
      serverUrl: client.configuration.serverUrl,
    });

    const tools: DynamicStructuredTool[] = [
      // Workspace Tools
      new DynamicStructuredTool({
        name: 'asana_list_workspaces',
        // IMPROVEMENT: More directive description.
        description:
          'List all available workspaces the user has access to. This is the first and most essential tool to use if you do not know the workspace GID, as most other tools require it.',
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
          'Search for projects in Asana by their name. Use this tool specifically when the user asks to "find", "search for", or "look up" a project.',
        schema: z.object({
          name: z.string().describe('The name of the project to search for.'),
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
          const result = await client.searchProjects({
            ...args,
            text: args.name,
          });
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
          'Get detailed information about a single, specific project. Use this tool when you already have the project GID or when the user asks for more details, notes, or information about a project that has just been found or mentioned.',
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
        // IMPROVEMENT: Instruct the AI on prerequisites.
        description:
          'Create a new project in a workspace. Before calling this, you must know the `workspace_id`. If the user has not provided it, use `asana_list_workspaces` first. For organization workspaces, a `team_id` is also often required.',
        schema: z.object({
          workspace_id: z
            .string()
            .describe('The workspace GID to create the project in.'),
          name: z.string().describe('The name for the new project.'),
          team_id: z
            .string()
            .nullish()
            .describe('The team GID to share the project with.'),
          public: z
            .boolean()
            .nullish()
            .describe('Whether the project is public to the organization.'),
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
        // IMPROVEMENT: Guide the AI on how to get the required ID.
        description:
          'Update an existing project. Requires the `project_id`. If you do not have the GID for the project the user is referring to, use `asana_search_projects` to find it first.',
        schema: z.object({
          project_id: z.string().describe('The GID of the project to update.'),
          name: z.string().nullish().describe('New name for the project.'),
          notes: z
            .string()
            .nullish()
            .describe('New description for the project.'),
        }),
        func: async (args) => {
          const { project_id, ...updateData } = args;
          const result = await client.updateProject(project_id, updateData);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_delete_project',
        // IMPROVEMENT: Add a warning.
        description:
          'Deletes a project permanently. This is a destructive action. Requires the `project_id`. Use `asana_search_projects` to find the GID if you do not have it.',
        schema: z.object({
          project_id: z.string().describe('The GID of the project to delete.'),
        }),
        func: async (args) => {
          await client.deleteProject(args.project_id);
          return JSON.stringify({
            success: true,
            message: `Project ${args.project_id} deleted.`,
          });
        },
      }),

      // Task Tools
      new DynamicStructuredTool({
        name: 'asana_search_tasks',
        description:
          'Search for specific work items or tasks within a workspace. Use this only when the user is asking about tasks, not projects.',
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
          const result = await client.searchTasks(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_task',
        description:
          'Get detailed information about a specific task. Requires the `task_id`. If you need details for a task and do not have the GID, use `asana_search_tasks` first.',
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
        // IMPROVEMENT: Critical instruction for the AI to prevent common failures.
        description:
          'Create a new task in a project. CRITICAL: You must know the `project_id` before calling this tool. If the user asks to create a task without specifying a project, you MUST ask for the project name and use `asana_search_projects` to get the GID first.',
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
        }),
        func: async (args) => {
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
        description:
          'Update an existing task. Requires the `task_id` of the task to update.',
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
        }),
        func: async (args) => {
          const { task_id, ...updateData } = args;
          const result = await client.updateTask(task_id, updateData);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_delete_task',
        description:
          'Deletes a task permanently. This is a destructive action. Requires the `task_id`.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to delete.'),
        }),
        func: async (args) => {
          await client.deleteTask(args.task_id);
          return JSON.stringify({
            success: true,
            message: `Task ${args.task_id} deleted.`,
          });
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_add_task_comment',
        description:
          'Add a comment to a task. Requires the `task_id` of the task you want to comment on.',
        schema: z.object({
          task_id: z.string().describe('The GID of the task to comment on.'),
          text: z.string().describe('The text content of the comment.'),
        }),
        func: async (args) => {
          const result = await client.addTaskComment(args.task_id, args.text);
          return JSON.stringify(result);
        },
      }),
    ];

    return tools;
  } catch (error) {
    logger?.error('Failed to create Asana tools', { error });
    console.error('[AsanaMCP] CRITICAL: Failed to create Asana tools:', error);
    return [];
  }
}
