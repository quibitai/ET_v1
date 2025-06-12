/**
 * Asana Task Operations
 *
 * Core CRUD operations for Asana tasks
 * Modular design with comprehensive error handling
 */

import type { AsanaApiClient } from '../core/client';
import type {
  AsanaTask,
  CreateTaskParams,
  UpdateTaskParams,
  ListTasksParams,
  AsanaApiResponse,
  AsanaApiCollectionResponse,
  OperationResult,
  ExecutionContext,
} from '../core/types';
import { AsanaToolError } from '../core/types';
import { log } from '../integration/tool-factory-simple';

export class TaskOperations {
  constructor(private client: AsanaApiClient) {}

  /**
   * List tasks with filtering and pagination
   */
  async listTasks(
    params: ListTasksParams,
    context: ExecutionContext,
  ): Promise<OperationResult<AsanaTask[]>> {
    const startTime = Date.now();

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      if (params.assignee) {
        queryParams.append('assignee', params.assignee);
      }
      if (params.project) {
        queryParams.append('project', params.project);
      }
      if (params.workspace) {
        queryParams.append('workspace', params.workspace);
      }
      if (params.completed_since) {
        queryParams.append('completed_since', params.completed_since);
      }
      if (params.opt_fields) {
        queryParams.append('opt_fields', params.opt_fields.join(','));
      }
      if (params.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      if (params.offset) {
        queryParams.append('offset', params.offset);
      }

      const response = (await this.client.get<AsanaTask[]>(
        `/tasks?${queryParams.toString()}`,
      )) as AsanaApiCollectionResponse<AsanaTask>;

      if (!response || response.data.length === 0) {
        log.info('No tasks found for criteria', { params });
        return {
          success: true,
          data: [],
          message: 'No tasks found for the given criteria.',
          metadata: {
            operation: 'list_tasks',
            duration: Date.now() - startTime,
            requestId: context.requestId,
          },
        };
      }

      log.info(`Found ${response.data.length} tasks`, { context });
      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'list_tasks',
          duration: Date.now() - startTime,
          requestId: context.requestId,
        },
      };
    } catch (error: any) {
      return this.handleError(error, 'list_tasks', startTime, context);
    }
  }

  /**
   * Create a new task
   */
  async createTask(
    params: CreateTaskParams,
    context: ExecutionContext,
  ): Promise<OperationResult<AsanaTask>> {
    const startTime = Date.now();

    try {
      const response = (await this.client.post<AsanaTask>('/tasks', {
        data: params,
      })) as AsanaApiResponse<AsanaTask>;

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'create_task',
          duration: Date.now() - startTime,
          requestId: context.requestId,
        },
      };
    } catch (error) {
      return this.handleError(error, 'create_task', startTime, context);
    }
  }

  /**
   * Get task details by GID
   */
  async getTask(
    taskGid: string,
    optFields?: string[],
    context?: ExecutionContext,
  ): Promise<OperationResult<AsanaTask>> {
    const startTime = Date.now();

    try {
      const queryParams = optFields ? `?opt_fields=${optFields.join(',')}` : '';

      const response = (await this.client.get<AsanaTask>(
        `/tasks/${taskGid}${queryParams}`,
      )) as AsanaApiResponse<AsanaTask>;

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_task',
          duration: Date.now() - startTime,
          requestId: context?.requestId,
        },
      };
    } catch (error) {
      return this.handleError(error, 'get_task', startTime, context);
    }
  }

  /**
   * Update task
   */
  async updateTask(
    taskGid: string,
    params: UpdateTaskParams,
    context: ExecutionContext,
  ): Promise<OperationResult<AsanaTask>> {
    const startTime = Date.now();

    try {
      const response = (await this.client.put<AsanaTask>(`/tasks/${taskGid}`, {
        data: params,
      })) as AsanaApiResponse<AsanaTask>;

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'update_task',
          duration: Date.now() - startTime,
          requestId: context.requestId,
        },
      };
    } catch (error) {
      return this.handleError(error, 'update_task', startTime, context);
    }
  }

  /**
   * Complete task (convenience method)
   */
  async completeTask(
    taskGid: string,
    context: ExecutionContext,
  ): Promise<OperationResult<AsanaTask>> {
    return this.updateTask(taskGid, { completed: true }, context);
  }

  /**
   * Delete task
   */
  async deleteTask(
    taskGid: string,
    context: ExecutionContext,
  ): Promise<OperationResult<{ success: boolean }>> {
    const startTime = Date.now();

    try {
      await this.client.delete(`/tasks/${taskGid}`);

      return {
        success: true,
        data: { success: true },
        metadata: {
          operation: 'delete_task',
          duration: Date.now() - startTime,
          requestId: context.requestId,
        },
      };
    } catch (error) {
      return this.handleError(error, 'delete_task', startTime, context);
    }
  }

  /**
   * Get task subtasks
   */
  async getSubtasks(
    taskGid: string,
    context: ExecutionContext,
  ): Promise<OperationResult<AsanaTask[]>> {
    const startTime = Date.now();

    try {
      const response = (await this.client.get<AsanaTask[]>(
        `/tasks/${taskGid}/subtasks`,
      )) as AsanaApiCollectionResponse<AsanaTask>;

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_subtasks',
          duration: Date.now() - startTime,
          requestId: context.requestId,
        },
      };
    } catch (error) {
      return this.handleError(error, 'get_subtasks', startTime, context);
    }
  }

  /**
   * Error handling helper
   */
  private handleError(
    error: unknown,
    operation: string,
    startTime: number,
    context?: ExecutionContext,
  ): OperationResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
      metadata: {
        operation,
        duration: Date.now() - startTime,
        requestId: context?.requestId,
      },
    };
  }
}
