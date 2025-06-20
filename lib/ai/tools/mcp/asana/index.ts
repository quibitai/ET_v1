/**
 * Asana MCP Integration
 *
 * HTTP-based Asana tool integration using the containerized MCP server.
 * This uses direct HTTP calls to the Docker container with simplified auto-detection.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';

/**
 * Create Asana tools using simplified HTTP API to Docker container
 */
export async function createAsanaTools(
  userId: string,
  sessionId: string,
  logger?: RequestLogger,
): Promise<DynamicStructuredTool[]> {
  try {
    // Create client with auto-detection
    const client = await AsanaMCPClient.create();

    // Check if server is available
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      const validation = await client.validateConfiguration();
      logger?.error('Asana MCP server not available', {
        serverUrl: validation.serverUrl,
        serverStatus: validation.serverStatus,
        errors: validation.errors,
      });
      console.warn(
        `[AsanaMCP] Server not available: ${validation.errors.join(', ')}`,
      );
      return [];
    }

    logger?.info('Asana MCP server validated successfully', {
      serverUrl: client.configuration.serverUrl,
    });

    // Define the tools with proper schemas
    const tools: DynamicStructuredTool[] = [
      // Workspace tools
      new DynamicStructuredTool({
        name: 'asana_list_workspaces',
        description: 'List all available workspaces in Asana',
        schema: z.object({
          opt_fields: z
            .string()
            .optional()
            .describe('Comma-separated list of optional fields to include'),
        }),
        func: async (args) => {
          const result = await client.listWorkspaces();
          return JSON.stringify(result);
        },
      }),

      // Project tools
      new DynamicStructuredTool({
        name: 'asana_list_projects',
        description: 'List all projects in a workspace',
        schema: z.object({
          workspace: z
            .string()
            .optional()
            .describe('The workspace to list projects from'),
          team: z
            .string()
            .optional()
            .describe('The team to filter projects on'),
          archived: z
            .boolean()
            .optional()
            .describe('Only return archived projects'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .optional()
            .describe('Results per page'),
          offset: z.string().optional().describe('Pagination offset token'),
          opt_fields: z
            .string()
            .optional()
            .describe('Comma-separated list of optional fields'),
        }),
        func: async (args) => {
          const result = await client.listProjects(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_search_projects',
        description: 'Search for projects in Asana using name pattern matching',
        schema: z.object({
          name_pattern: z
            .string()
            .describe('Regular expression pattern to match project names'),
          workspace: z
            .string()
            .optional()
            .describe('The workspace to search in'),
          team: z
            .string()
            .optional()
            .describe('The team to filter projects on'),
          archived: z
            .boolean()
            .optional()
            .describe('Only return archived projects'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .optional()
            .describe('Results per page'),
        }),
        func: async (args) => {
          const result = await client.searchProjects(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_project',
        description: 'Get detailed information about a specific project',
        schema: z.object({
          project_id: z.string().describe('The project ID to retrieve'),
          opt_fields: z
            .string()
            .optional()
            .describe('Comma-separated list of optional fields'),
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
        description: 'Create a new project in a workspace',
        schema: z.object({
          workspace_id: z
            .string()
            .describe('The workspace ID to create the project in'),
          name: z.string().describe('Name of the project'),
          team_id: z
            .string()
            .optional()
            .describe('The team GID to share the project with'),
          public: z
            .boolean()
            .optional()
            .describe('Whether the project is public'),
          archived: z
            .boolean()
            .optional()
            .describe('Whether the project is archived'),
          color: z.string().optional().describe('Color of the project'),
          layout: z.string().optional().describe('Layout of the project'),
          notes: z.string().optional().describe('Description of the project'),
        }),
        func: async (args) => {
          const result = await client.createProject(args);
          return JSON.stringify(result);
        },
      }),

      // Task tools
      new DynamicStructuredTool({
        name: 'asana_search_tasks',
        description:
          'Search tasks in a workspace with advanced filtering options',
        schema: z.object({
          workspace: z
            .string()
            .optional()
            .describe('The workspace to search in'),
          text: z
            .string()
            .optional()
            .describe('Text to search for in task names and descriptions'),
          completed: z
            .boolean()
            .optional()
            .describe('Filter for completed tasks'),
          assignee: z.string().optional().describe('Filter by assignee'),
          project: z.string().optional().describe('Filter by project'),
          limit: z
            .number()
            .min(1)
            .max(100)
            .optional()
            .describe('Results per page'),
        }),
        func: async (args) => {
          const result = await client.searchTasks(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_get_task',
        description: 'Get detailed information about a specific task',
        schema: z.object({
          task_id: z.string().describe('The task ID to retrieve'),
          opt_fields: z
            .string()
            .optional()
            .describe('Comma-separated list of optional fields'),
        }),
        func: async (args) => {
          const result = await client.getTask(args.task_id, args.opt_fields);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_create_task',
        description: 'Create a new task in a project',
        schema: z.object({
          project_id: z.string().describe('The project to create the task in'),
          name: z.string().describe('Name of the task'),
          notes: z.string().optional().describe('Description of the task'),
          due_on: z
            .string()
            .optional()
            .describe('Due date in YYYY-MM-DD format'),
          assignee: z.string().optional().describe('Assignee user ID or "me"'),
          custom_fields: z
            .record(z.any())
            .optional()
            .describe('Custom field values'),
        }),
        func: async (args) => {
          const result = await client.createTask(args);
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'asana_update_task',
        description: 'Update an existing task',
        schema: z.object({
          task_id: z.string().describe('The task ID to update'),
          name: z.string().optional().describe('New name for the task'),
          notes: z.string().optional().describe('New description for the task'),
          due_on: z
            .string()
            .optional()
            .describe('New due date in YYYY-MM-DD format'),
          assignee: z
            .string()
            .optional()
            .describe('New assignee user ID or "me"'),
          completed: z.boolean().optional().describe('Mark task as completed'),
          custom_fields: z
            .record(z.any())
            .optional()
            .describe('Custom field values'),
        }),
        func: async (args) => {
          const { task_id, ...updateParams } = args;
          const result = await client.updateTask(task_id, updateParams);
          return JSON.stringify(result);
        },
      }),
    ];

    logger?.info(`Created ${tools.length} Asana tools via HTTP API`, {
      serverUrl: client.configuration.serverUrl,
      toolNames: tools.map((t) => t.name),
    });

    console.log(
      `[AsanaMCP] Created ${tools.length} Asana tools for user ${userId} via HTTP API`,
    );
    return tools;
  } catch (error) {
    logger?.error('Failed to create Asana tools', {
      error: error instanceof Error ? error.message : error,
    });
    console.error(
      `[AsanaMCP] Failed to create Asana tools for user ${userId}:`,
      error,
    );
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

/**
 * Legacy compatibility function
 * @deprecated Use createAsanaTools instead
 */
export function createAsanaToolsLegacy(
  sessionId: string,
): DynamicStructuredTool[] {
  console.warn(
    '[AsanaMCP] Legacy createAsanaTools called - requires userId for MCP. Returning empty array.',
  );
  return [];
}

export default createAsanaTools;
