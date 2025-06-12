/**
 * Asana Tool Factory (Simplified)
 *
 * Creates LangChain tools for the Asana integration
 * Simplified version with basic logging for development
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getAsanaConfig } from '../core/config';
import { AsanaApiClient } from '../core/client';
import { TaskOperations } from '../operations/tasks';
import type { ExecutionContext } from '../core/types';

// Simple logging for development
export const log = {
  info: (message: string, data?: any) =>
    console.log(`[AsanaTools] ${message}`, data || ''),
  error: (message: string, data?: any) =>
    console.error(`[AsanaTools] ${message}`, data || ''),
};

/**
 * Schema definitions for tool inputs
 */
const listTasksSchema = z.object({
  workspace: z
    .string()
    .optional()
    .describe('Workspace GID to filter tasks. This is the broadest scope.'),
  project: z
    .string()
    .optional()
    .describe(
      'Project GID to filter tasks. Narrows the search within a workspace.',
    ),
  assignee: z
    .string()
    .optional()
    .describe('User GID or "me" to filter by assignee.'),
  completed_since: z
    .string()
    .optional()
    .describe('ISO 8601 date to filter for tasks completed since that time.'),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of tasks to return.'),
});

const createTaskSchema = z.object({
  name: z.string().describe('Task name/title'),
  notes: z.string().optional().describe('Task description or notes'),
  assignee: z
    .string()
    .optional()
    .describe('User GID or email to assign task to'),
  projects: z.array(z.string()).optional().describe('Array of project GIDs'),
  due_on: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  parent: z.string().optional().describe('Parent task GID for subtasks'),
});

const updateTaskSchema = z.object({
  taskGid: z.string().describe('Task GID to update'),
  name: z.string().optional().describe('New task name'),
  notes: z.string().optional().describe('New task notes'),
  completed: z.boolean().optional().describe('Mark task as completed'),
  assignee: z.string().optional().describe('New assignee GID or email'),
  due_on: z.string().optional().describe('New due date in YYYY-MM-DD format'),
});

const taskDetailsSchema = z.object({
  taskGid: z.string().describe('Task GID to get details for'),
  includeSubtasks: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include subtasks in response'),
});

/**
 * Create Asana tools for LangChain integration
 */
export function createAsanaTools(sessionId: string): DynamicStructuredTool[] {
  const config = getAsanaConfig();
  const client = new AsanaApiClient(config);
  const taskOps = new TaskOperations(client);

  const createContext = (requestId?: string): ExecutionContext => ({
    sessionId,
    requestId:
      requestId ||
      `asana_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    features: config.features,
  });

  const listTasksTool = new DynamicStructuredTool({
    name: 'asana_list_tasks',
    description:
      'Lists tasks from Asana. You can filter by workspace, project, and/or assignee. If no workspace or project is specified, the system will automatically use the default configured workspace.',
    schema: listTasksSchema,
    func: async (input) => {
      const context = createContext();
      try {
        log.info('Executing asana_list_tasks with input:', input);

        // Create a mutable copy of the input to avoid modifying the original
        const effectiveInput = { ...input };

        // If neither workspace nor project is provided by the agent, inject the default workspace GID.
        if (!effectiveInput.workspace && !effectiveInput.project) {
          effectiveInput.workspace = config.workspaceGid;
          log.info(
            'Neither workspace nor project was specified. Defaulting to configured workspace GID.',
            { workspaceGid: config.workspaceGid },
          );
        }

        const result = await taskOps.listTasks(effectiveInput, context);

        if (result.message) {
          return result.message;
        }
        return result.data
          ? JSON.stringify(result.data, null, 2)
          : 'No tasks were found in Asana matching the specified criteria.';
      } catch (error) {
        log.error('Error in asana_list_tasks', error);
        return error instanceof Error
          ? error.message
          : 'An unknown error occurred';
      }
    },
  });

  const createTaskTool = new DynamicStructuredTool({
    name: 'asana_create_task',
    description:
      'Create a new task in Asana with optional assignee, due date, and project',
    schema: createTaskSchema,
    func: async (params) => {
      const context = createContext();

      try {
        log.info('Executing create_task', {
          sessionId,
          taskName: params.name,
        });
        const result = await taskOps.createTask(params, context);

        if (result.success && result.data) {
          return `✅ Task created successfully:
• Name: ${result.data.name}
• GID: ${result.data.gid}
• URL: ${result.data.permalink_url}
${result.data.assignee ? `• Assigned to: ${result.data.assignee.name}` : ''}
${result.data.due_on ? `• Due: ${result.data.due_on}` : ''}`;
        } else {
          throw new Error(result.error || 'Failed to create task');
        }
      } catch (error) {
        log.error('Error in create_task', { error, sessionId });
        throw error;
      }
    },
  });

  const updateTaskTool = new DynamicStructuredTool({
    name: 'asana_update_task',
    description:
      'Update an existing task in Asana (name, notes, completion status, assignee, due date)',
    schema: updateTaskSchema,
    func: async (params) => {
      const context = createContext();

      try {
        log.info('Executing update_task', {
          sessionId,
          taskGid: params.taskGid,
        });
        const { taskGid, ...updateParams } = params;
        const result = await taskOps.updateTask(taskGid, updateParams, context);

        if (result.success && result.data) {
          return `✅ Task updated successfully:
• Name: ${result.data.name}
• Status: ${result.data.completed ? 'Completed' : 'Active'}
• URL: ${result.data.permalink_url}`;
        } else {
          throw new Error(result.error || 'Failed to update task');
        }
      } catch (error) {
        log.error('Error in update_task', { error, sessionId });
        throw error;
      }
    },
  });

  const getTaskDetailsTool = new DynamicStructuredTool({
    name: 'asana_get_task_details',
    description:
      'Get detailed information about a specific task, optionally including subtasks',
    schema: taskDetailsSchema,
    func: async (input: z.infer<typeof taskDetailsSchema>) => {
      const context = createContext();

      try {
        log.info('Executing asana_get_task_details', { input });
        const result = await taskOps.getTask(
          input.taskGid,
          undefined,
          createContext(),
        );
        if (result.success && result.data) {
          return JSON.stringify(result.data, null, 2);
        }
        return (
          result.message ||
          result.error ||
          'Task not found or no data returned.'
        );
      } catch (error) {
        log.error('Error in asana_get_task_details', error);
        return error instanceof Error
          ? error.message
          : 'An unknown error occurred';
      }
    },
  });

  return [listTasksTool, createTaskTool, updateTaskTool, getTaskDetailsTool];
}
