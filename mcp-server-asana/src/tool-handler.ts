import { z } from 'zod';
import type { AsanaClientWrapper } from './asana-client-wrapper.js';
import { logger } from './utils/logger.js';

// Tool definitions with schemas
export const tools = {
  // Workspace tools
  asana_list_workspaces: {
    name: 'asana_list_workspaces',
    description: 'List all available workspaces in Asana',
    inputSchema: z.object({
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  // Task tools
  asana_search_tasks: {
    name: 'asana_search_tasks',
    description: 'Search tasks in a workspace with advanced filtering options',
    inputSchema: z.object({
      workspace: z
        .string()
        .optional()
        .describe(
          'The workspace to search in (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      text: z
        .string()
        .optional()
        .describe('Text to search for in task names and descriptions'),
      resource_subtype: z
        .string()
        .optional()
        .describe('Filter by task subtype (e.g. milestone)'),
      completed: z.boolean().optional().describe('Filter for completed tasks'),
      is_subtask: z.boolean().optional().describe('Filter for subtasks'),
      has_attachment: z
        .boolean()
        .optional()
        .describe('Filter for tasks with attachments'),
      is_blocked: z
        .boolean()
        .optional()
        .describe('Filter for tasks with incomplete dependencies'),
      is_blocking: z
        .boolean()
        .optional()
        .describe('Filter for incomplete tasks with dependents'),
      assignee: z
        .string()
        .optional()
        .describe('Filter by assignee (user GID or "me")'),
      'assignee.any': z
        .string()
        .optional()
        .describe('Filter by any assignee ("me" for current user)'),
      projects: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Filter by project(s)'),
      sections: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Filter by section(s)'),
      tags: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Filter by tag(s)'),
      teams: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Filter by team(s)'),
      followers: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Filter by follower(s)'),
      created_by: z.string().optional().describe('Filter by creator'),
      modified_since: z
        .string()
        .optional()
        .describe('Filter by modification date (ISO 8601)'),
      completed_since: z
        .string()
        .optional()
        .describe('Filter by completion date (ISO 8601)'),
      due_date: z
        .object({
          before: z.string().optional(),
          after: z.string().optional(),
        })
        .optional()
        .describe('Filter by due date range'),
      sort_by: z
        .enum([
          'due_date',
          'created_at',
          'completed_at',
          'likes',
          'modified_at',
        ])
        .optional()
        .describe('Sort by field (default: modified_at)'),
      sort_ascending: z
        .boolean()
        .optional()
        .describe('Sort in ascending order (default: false)'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
      custom_fields: z
        .record(z.any())
        .optional()
        .describe('Object containing custom field filters'),
    }),
  },

  asana_get_task: {
    name: 'asana_get_task',
    description: 'Get detailed information about a specific task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to retrieve'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_create_task: {
    name: 'asana_create_task',
    description: 'Create a new task in a project',
    inputSchema: z.object({
      project_id: z.string().describe('The project to create the task in'),
      name: z.string().describe('Name of the task'),
      notes: z.string().optional().describe('Description of the task'),
      html_notes: z
        .string()
        .optional()
        .describe('HTML-like formatted description of the task'),
      due_on: z.string().optional().describe('Due date in YYYY-MM-DD format'),
      assignee: z
        .string()
        .optional()
        .describe('Assignee (can be "me" or a user ID)'),
      followers: z
        .array(z.string())
        .optional()
        .describe('Array of user IDs to add as followers'),
      parent: z
        .string()
        .optional()
        .describe('The parent task ID to set this task under'),
      projects: z
        .array(z.string())
        .optional()
        .describe('Array of project IDs to add this task to'),
      resource_subtype: z
        .string()
        .optional()
        .describe('The type of the task (default_task or milestone)'),
      custom_fields: z
        .record(z.any())
        .optional()
        .describe('Object mapping custom field GID strings to their values'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_update_task: {
    name: 'asana_update_task',
    description: "Update an existing task's details",
    inputSchema: z.object({
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
        .describe('New assignee (can be "me" or a user ID)'),
      completed: z
        .boolean()
        .optional()
        .describe('Mark task as completed or not'),
      resource_subtype: z
        .string()
        .optional()
        .describe('The type of the task (default_task or milestone)'),
      custom_fields: z
        .record(z.any())
        .optional()
        .describe('Object mapping custom field GID strings to their values'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_delete_task: {
    name: 'asana_delete_task',
    description: 'Delete a task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to delete'),
    }),
  },

  asana_get_task_stories: {
    name: 'asana_get_task_stories',
    description: 'Get comments and stories for a specific task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to get stories for'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_create_task_story: {
    name: 'asana_create_task_story',
    description: 'Create a comment or story on a task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to add the story to'),
      text: z.string().describe('The text content of the story/comment'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_create_subtask: {
    name: 'asana_create_subtask',
    description: 'Create a new subtask for an existing task',
    inputSchema: z.object({
      parent_task_id: z
        .string()
        .describe('The parent task ID to create the subtask under'),
      name: z.string().describe('Name of the subtask'),
      notes: z.string().optional().describe('Description of the subtask'),
      due_on: z.string().optional().describe('Due date in YYYY-MM-DD format'),
      assignee: z
        .string()
        .optional()
        .describe('Assignee (can be "me" or a user ID)'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_add_task_dependencies: {
    name: 'asana_add_task_dependencies',
    description: 'Set dependencies for a task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to add dependencies to'),
      dependencies: z
        .array(z.string())
        .describe('Array of task IDs that this task depends on'),
    }),
  },

  asana_add_task_dependents: {
    name: 'asana_add_task_dependents',
    description: 'Set dependents for a task (tasks that depend on this task)',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to add dependents to'),
      dependents: z
        .array(z.string())
        .describe('Array of task IDs that depend on this task'),
    }),
  },

  asana_add_followers_to_task: {
    name: 'asana_add_followers_to_task',
    description: 'Add followers to a task',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to add followers to'),
      followers: z
        .array(z.string())
        .describe('Array of user IDs to add as followers to the task'),
    }),
  },

  asana_set_parent_for_task: {
    name: 'asana_set_parent_for_task',
    description:
      'Set the parent of a task and position the subtask within the other subtasks of that parent',
    inputSchema: z.object({
      task_id: z.string().describe('The task ID to operate on'),
      parent: z
        .string()
        .describe('The new parent of the task, or null for no parent'),
      insert_after: z
        .string()
        .optional()
        .describe(
          'A subtask of the parent to insert the task after, or null to insert at the beginning',
        ),
      insert_before: z
        .string()
        .optional()
        .describe(
          'A subtask of the parent to insert the task before, or null to insert at the end',
        ),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_multiple_tasks_by_gid: {
    name: 'asana_get_multiple_tasks_by_gid',
    description:
      'Get detailed information about multiple tasks by their GIDs (maximum 25 tasks)',
    inputSchema: z.object({
      task_ids: z
        .union([z.array(z.string()), z.string()])
        .describe(
          'Task GIDs to retrieve (max 25) - can be array or comma-separated string',
        ),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  // Project tools
  asana_search_projects: {
    name: 'asana_search_projects',
    description: 'Search for projects in Asana using name pattern matching',
    inputSchema: z.object({
      name_pattern: z
        .string()
        .describe('Regular expression pattern to match project names'),
      workspace: z
        .string()
        .optional()
        .describe(
          'The workspace to search in (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      team: z.string().optional().describe('The team to filter projects on'),
      archived: z
        .boolean()
        .optional()
        .describe('Only return archived projects (default: false)'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_list_projects: {
    name: 'asana_list_projects',
    description: 'List all projects in a workspace',
    inputSchema: z.object({
      workspace: z
        .string()
        .optional()
        .describe(
          'The workspace to list projects from (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      team: z.string().optional().describe('The team to filter projects on'),
      archived: z
        .boolean()
        .optional()
        .describe('Only return archived projects (default: false)'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_project: {
    name: 'asana_get_project',
    description: 'Get detailed information about a specific project',
    inputSchema: z.object({
      project_id: z.string().describe('The project ID to retrieve'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_create_project: {
    name: 'asana_create_project',
    description: 'Create a new project in a workspace',
    inputSchema: z.object({
      workspace_id: z
        .string()
        .optional()
        .describe(
          'The workspace ID to create the project in (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      name: z.string().describe('Name of the project to create'),
      team_id: z
        .string()
        .describe(
          'REQUIRED for organization workspaces - The team GID to share the project with',
        ),
      public: z
        .boolean()
        .optional()
        .describe(
          'Whether the project is public to the organization (default: false)',
        ),
      archived: z
        .boolean()
        .optional()
        .describe('Whether the project is archived (default: false)'),
      color: z
        .string()
        .optional()
        .describe(
          'Color of the project (light-green, light-orange, light-blue, etc.)',
        ),
      layout: z
        .string()
        .optional()
        .describe(
          'The layout of the project (board, list, timeline, or calendar)',
        ),
      default_view: z
        .string()
        .optional()
        .describe(
          'The default view of the project (list, board, calendar, timeline, or gantt)',
        ),
      due_on: z
        .string()
        .optional()
        .describe('The date on which this project is due (YYYY-MM-DD format)'),
      start_on: z
        .string()
        .optional()
        .describe(
          'The day on which work for this project begins (YYYY-MM-DD format)',
        ),
      notes: z
        .string()
        .optional()
        .describe('Free-form textual information associated with the project'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_project_task_counts: {
    name: 'asana_get_project_task_counts',
    description: 'Get the number of tasks in a project',
    inputSchema: z.object({
      project_id: z.string().describe('The project ID to get task counts for'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_project_sections: {
    name: 'asana_get_project_sections',
    description: 'Get sections in a project',
    inputSchema: z.object({
      project_id: z.string().describe('The project ID to get sections for'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_project_hierarchy: {
    name: 'asana_get_project_hierarchy',
    description:
      'Get the complete hierarchical structure of an Asana project, including sections, tasks, and subtasks',
    inputSchema: z.object({
      project_id: z.string().describe('The project ID to get hierarchy for'),
      include_completed_tasks: z
        .boolean()
        .optional()
        .describe('Include completed tasks (default: false)'),
      include_subtasks: z
        .boolean()
        .optional()
        .describe('Include subtasks for each task (default: true)'),
      include_completed_subtasks: z
        .boolean()
        .optional()
        .describe(
          'Include completed subtasks (default: follows include_completed_tasks)',
        ),
      max_subtask_depth: z
        .number()
        .optional()
        .describe('Maximum depth of subtasks to retrieve (default: 1)'),
      opt_fields_tasks: z
        .string()
        .optional()
        .describe('Optional fields for tasks'),
      opt_fields_subtasks: z
        .string()
        .optional()
        .describe('Optional fields for subtasks'),
      opt_fields_sections: z
        .string()
        .optional()
        .describe('Optional fields for sections'),
      opt_fields_project: z
        .string()
        .optional()
        .describe('Optional fields for project'),
      limit: z.number().optional().describe('Max results per page (1-100)'),
      offset: z
        .string()
        .optional()
        .describe('Pagination token from previous response'),
      auto_paginate: z
        .boolean()
        .optional()
        .describe('Whether to automatically fetch all pages'),
      max_pages: z
        .number()
        .optional()
        .describe('Maximum pages to fetch when auto_paginate is true'),
    }),
  },

  // Project status tools
  asana_get_project_status: {
    name: 'asana_get_project_status',
    description: 'Get a project status update',
    inputSchema: z.object({
      project_status_gid: z
        .string()
        .describe('The project status GID to retrieve'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_project_statuses: {
    name: 'asana_get_project_statuses',
    description: 'Get all status updates for a project',
    inputSchema: z.object({
      project_gid: z.string().describe('The project GID to get statuses for'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_create_project_status: {
    name: 'asana_create_project_status',
    description: 'Create a new status update for a project',
    inputSchema: z.object({
      project_gid: z
        .string()
        .describe('The project GID to create the status for'),
      text: z.string().describe('The text content of the status update'),
      color: z
        .string()
        .optional()
        .describe('The color of the status (green, yellow, red)'),
      title: z.string().optional().describe('The title of the status update'),
      html_text: z
        .string()
        .optional()
        .describe('HTML formatted text for the status update'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_delete_project_status: {
    name: 'asana_delete_project_status',
    description: 'Delete a project status update',
    inputSchema: z.object({
      project_status_gid: z
        .string()
        .describe('The project status GID to delete'),
    }),
  },

  // Section tools
  asana_create_section_for_project: {
    name: 'asana_create_section_for_project',
    description: 'Create a new section in a project',
    inputSchema: z.object({
      project_id: z
        .string()
        .describe('The project ID to create the section in'),
      name: z.string().describe('Name of the section to create'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_add_task_to_section: {
    name: 'asana_add_task_to_section',
    description: 'Add a task to a specific section in a project',
    inputSchema: z.object({
      section_id: z.string().describe('The section ID to add the task to'),
      task_id: z.string().describe('The task ID to add to the section'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  // Team and user tools
  asana_get_teams_for_user: {
    name: 'asana_get_teams_for_user',
    description: 'Get teams to which the user has access',
    inputSchema: z.object({
      user_gid: z
        .string()
        .describe(
          'The user GID to get teams for. Use "me" to get teams for the current user.',
        ),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_teams_for_workspace: {
    name: 'asana_get_teams_for_workspace',
    description: 'Get teams in a workspace',
    inputSchema: z.object({
      workspace_gid: z
        .string()
        .optional()
        .describe(
          'The workspace GID to get teams for (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_list_workspace_users: {
    name: 'asana_list_workspace_users',
    description: 'Get users in a workspace',
    inputSchema: z.object({
      workspace_id: z
        .string()
        .optional()
        .describe(
          'The workspace ID to get users for (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe(
          'Comma-separated list of optional fields to include (defaults to "name,email")',
        ),
      auto_paginate: z
        .boolean()
        .optional()
        .describe('Whether to automatically fetch all pages'),
      max_pages: z
        .number()
        .optional()
        .describe(
          'Maximum number of pages to fetch when auto_paginate is true',
        ),
    }),
  },

  // Tag tools
  asana_get_tags_for_workspace: {
    name: 'asana_get_tags_for_workspace',
    description: 'Get tags in a workspace',
    inputSchema: z.object({
      workspace_gid: z
        .string()
        .optional()
        .describe(
          'Globally unique identifier for the workspace or organization (optional if DEFAULT_WORKSPACE_ID is set)',
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe(
          'Results per page. The number of objects to return per page. The value must be between 1 and 100.',
        ),
      offset: z
        .string()
        .optional()
        .describe(
          'Offset token. An offset to the next page returned by the API.',
        ),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },

  asana_get_tasks_for_tag: {
    name: 'asana_get_tasks_for_tag',
    description: 'Get tasks for a specific tag',
    inputSchema: z.object({
      tag_gid: z.string().describe('The tag GID to retrieve tasks for'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
      opt_pretty: z
        .boolean()
        .optional()
        .describe('Provides the response in a "pretty" format'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe(
          'The number of objects to return per page. The value must be between 1 and 100.',
        ),
      offset: z
        .string()
        .optional()
        .describe('An offset to the next page returned by the API.'),
    }),
  },

  // Attachment tools
  asana_get_attachments_for_object: {
    name: 'asana_get_attachments_for_object',
    description: 'List attachments for a specific object (task, project, etc.)',
    inputSchema: z.object({
      object_gid: z
        .string()
        .describe('The object GID to retrieve attachments for'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Results per page (1-100)'),
      offset: z.string().optional().describe('Pagination offset token'),
      opt_fields: z
        .string()
        .optional()
        .describe('Comma-separated list of optional fields to include'),
    }),
  },
};

// Export list of all tools for MCP server registration
export const list_of_tools = Object.values(tools);

// Tool handler function
export function createToolHandler(client: AsanaClientWrapper) {
  return async (request: { name: string; arguments?: any }): Promise<any> => {
    const { name, arguments: args = {} } = request;

    try {
      logger.info(`Executing tool: ${name}`, { args });

      switch (name) {
        // Workspace tools
        case 'asana_list_workspaces':
          return await client.listWorkspaces(args.opt_fields);

        // Task tools
        case 'asana_search_tasks':
          return await client.searchTasks(args);

        case 'asana_get_task':
          return await client.getTask(args.task_id, args.opt_fields);

        case 'asana_create_task':
          // Transform project_id to projects array if provided
          if (args.project_id && !args.projects) {
            args.projects = [args.project_id];
          }
          return await client.createTask(args);

        case 'asana_update_task': {
          const { task_id, ...updateParams } = args;
          return await client.updateTask(task_id, updateParams);
        }

        case 'asana_delete_task':
          return await client.deleteTask(args.task_id);

        case 'asana_get_task_stories':
          return await client.getTaskStories(args.task_id, args.opt_fields);

        case 'asana_create_task_story': {
          const { task_id: storyTaskId, ...storyParams } = args;
          return await client.createTaskStory(storyTaskId, storyParams);
        }

        case 'asana_create_subtask': {
          const { parent_task_id, ...subtaskParams } = args;
          return await client.createSubtask(parent_task_id, subtaskParams);
        }

        case 'asana_add_task_dependencies':
          return await client.addTaskDependencies(
            args.task_id,
            args.dependencies,
          );

        case 'asana_add_task_dependents':
          return await client.addTaskDependents(args.task_id, args.dependents);

        case 'asana_add_followers_to_task':
          return await client.addFollowersToTask(args.task_id, args.followers);

        case 'asana_set_parent_for_task': {
          const { task_id: parentTaskId, ...parentParams } = args;
          return await client.setParentForTask(parentTaskId, parentParams);
        }

        case 'asana_get_multiple_tasks_by_gid': {
          // Handle both array and comma-separated string formats
          let taskIds = args.task_ids;
          if (typeof taskIds === 'string') {
            taskIds = taskIds.split(',').map((id: string) => id.trim());
          }
          return await client.getMultipleTasksByGid(taskIds, args.opt_fields);
        }

        // Project tools
        case 'asana_search_projects':
          return await client.searchProjects(args);

        case 'asana_list_projects':
          return await client.listProjects(args);

        case 'asana_get_project':
          return await client.getProject(args.project_id, args.opt_fields);

        case 'asana_create_project':
          // Transform workspace_id to workspace if provided
          if (args.workspace_id && !args.workspace) {
            args.workspace = args.workspace_id;
          }
          return await client.createProject(args);

        case 'asana_get_project_task_counts':
          return await client.getProjectTaskCounts(
            args.project_id,
            args.opt_fields,
          );

        case 'asana_get_project_sections':
          return await client.getProjectSections(
            args.project_id,
            args.opt_fields,
          );

        case 'asana_get_project_hierarchy':
          return await client.getProjectHierarchy(args.project_id, args);

        // Project status tools
        case 'asana_get_project_status':
          return await client.getProjectStatus(
            args.project_status_gid,
            args.opt_fields,
          );

        case 'asana_get_project_statuses': {
          const { project_gid, ...statusParams } = args;
          return await client.getProjectStatuses(project_gid, statusParams);
        }

        case 'asana_create_project_status': {
          const { project_gid: statusProjectGid, ...createStatusParams } = args;
          return await client.createProjectStatus(
            statusProjectGid,
            createStatusParams,
          );
        }

        case 'asana_delete_project_status':
          return await client.deleteProjectStatus(args.project_status_gid);

        // Section tools
        case 'asana_create_section_for_project': {
          const { project_id: sectionProjectId, ...sectionParams } = args;
          return await client.createSectionForProject(
            sectionProjectId,
            sectionParams,
          );
        }

        case 'asana_add_task_to_section':
          return await client.addTaskToSection(
            args.section_id,
            args.task_id,
            args.opt_fields,
          );

        // Team and user tools
        case 'asana_get_teams_for_user':
          return await client.getTeamsForUser(args.user_gid, args.opt_fields);

        case 'asana_get_teams_for_workspace':
          return await client.getTeamsForWorkspace(
            args.workspace_gid,
            args.opt_fields,
          );

        case 'asana_list_workspace_users': {
          const { workspace_id, ...userParams } = args;
          return await client.listWorkspaceUsers(workspace_id, userParams);
        }

        // Tag tools
        case 'asana_get_tags_for_workspace': {
          const { workspace_gid, ...tagParams } = args;
          return await client.getTagsForWorkspace(workspace_gid, tagParams);
        }

        case 'asana_get_tasks_for_tag': {
          const { tag_gid, ...tagTaskParams } = args;
          return await client.getTasksForTag(tag_gid, tagTaskParams);
        }

        // Attachment tools
        case 'asana_get_attachments_for_object': {
          const { object_gid, ...attachmentParams } = args;
          return await client.getAttachmentsForObject(
            object_gid,
            attachmentParams,
          );
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      logger.error(`Tool execution failed for ${name}:`, error);
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  };
}
