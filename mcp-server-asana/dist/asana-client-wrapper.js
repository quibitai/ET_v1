import * as Asana from 'asana';
import { logger } from './utils/logger.js';
export class AsanaClientWrapper {
    client;
    config;
    constructor(config) {
        this.config = config;
        this.initializeClient();
    }
    initializeClient() {
        try {
            // Initialize the Asana API client (v3.x structure)
            // @ts-ignore - Type definitions don't match runtime structure
            const client = Asana.ApiClient.instance;
            const token = client.authentications.token;
            token.accessToken = this.config.accessToken;
            // Set default headers
            client.defaultHeaders = {
                'asana-enable': 'new_user_task_lists,new_goal_memberships',
                'User-Agent': 'Quibit-MCP-Server-Asana/1.0.0',
            };
            this.client = client;
            logger.info('Asana client initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize Asana client:', error);
            throw new Error(`Asana client initialization failed: ${error}`);
        }
    }
    // Helper method for error handling
    async withErrorHandling(operation, operationName) {
        try {
            const result = await operation();
            logger.debug(`${operationName} completed successfully`);
            return result;
        }
        catch (error) {
            logger.error(`${operationName} failed:`, error);
            // Transform Asana API errors into more meaningful messages
            if (error.response?.body) {
                const apiError = error.response.body;
                throw new Error(`Asana API Error in ${operationName}: ${apiError.errors?.[0]?.message || apiError.message || 'Unknown error'}`);
            }
            throw new Error(`${operationName} failed: ${error.message || 'Unknown error'}`);
        }
    }
    // Workspace operations
    async listWorkspaces(optFields) {
        return this.withErrorHandling(async () => {
            if (this.config.defaultWorkspaceId) {
                // If default workspace is set, return just that workspace
                // @ts-ignore - Type definitions don't match runtime structure
                const workspacesApi = new Asana.WorkspacesApi();
                const workspace = await workspacesApi.getWorkspace(this.config.defaultWorkspaceId, { opt_fields: optFields });
                return [workspace.data];
            }
            else {
                // Otherwise, fetch all workspaces
                // @ts-ignore - Type definitions don't match runtime structure
                const workspacesApi = new Asana.WorkspacesApi();
                const result = await workspacesApi.getWorkspaces({
                    opt_fields: optFields,
                });
                return result.data;
            }
        }, 'listWorkspaces');
    }
    // Task operations
    async searchTasks(params) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            // Use default workspace if not specified
            if (!params.workspace && this.config.defaultWorkspaceId) {
                params.workspace = this.config.defaultWorkspaceId;
            }
            const result = await tasksApi.searchTasksForWorkspace(params.workspace, params);
            return result.data;
        }, 'searchTasks');
    }
    async getTask(taskId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const result = await tasksApi.getTask(taskId, { opt_fields: optFields });
            return result.data;
        }, 'getTask');
    }
    async createTask(params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: params };
            const result = await tasksApi.createTask(body, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createTask');
    }
    async updateTask(taskId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: params };
            const result = await tasksApi.updateTask(body, taskId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'updateTask');
    }
    async deleteTask(taskId) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task deletion is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const result = await tasksApi.deleteTask(taskId);
            return result.data;
        }, 'deleteTask');
    }
    async getTasks(params) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const result = await tasksApi.getTasks(params);
            return result.data;
        }, 'getTasks');
    }
    async getTaskStories(taskId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const storiesApi = new Asana.StoriesApi();
            const result = await storiesApi.getStoriesForTask(taskId, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getTaskStories');
    }
    async createTaskStory(taskId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Story creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const storiesApi = new Asana.StoriesApi();
            const body = { data: params };
            const result = await storiesApi.createStoryForTask(body, taskId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createTaskStory');
    }
    async createSubtask(parentTaskId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Subtask creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: params };
            const result = await tasksApi.createSubtaskForTask(body, parentTaskId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createSubtask');
    }
    async addTaskDependencies(taskId, dependencies) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task dependency updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: { dependencies } };
            const result = await tasksApi.addDependenciesForTask(body, taskId);
            return result.data;
        }, 'addTaskDependencies');
    }
    async addTaskDependents(taskId, dependents) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task dependent updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: { dependents } };
            const result = await tasksApi.addDependentsForTask(body, taskId);
            return result.data;
        }, 'addTaskDependents');
    }
    async addFollowersToTask(taskId, followers) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task follower updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: { followers } };
            const result = await tasksApi.addFollowersForTask(body, taskId);
            return result.data;
        }, 'addFollowersToTask');
    }
    async setParentForTask(taskId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task parent updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const body = { data: params };
            const result = await tasksApi.setParentForTask(body, taskId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'setParentForTask');
    }
    // Project operations
    async searchProjects(params) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            // Use default workspace if not specified
            if (!params.workspace && this.config.defaultWorkspaceId) {
                params.workspace = this.config.defaultWorkspaceId;
            }
            const result = await projectsApi.getProjects(params);
            return result.data;
        }, 'searchProjects');
    }
    async listProjects(params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            // Use workspace from params or default workspace
            const workspace = params.workspace || this.config.defaultWorkspaceId;
            if (!workspace) {
                throw new Error('Workspace ID is required');
            }
            // Build query parameters
            const queryParams = {
                opt_fields: params.opt_fields,
                limit: params.limit,
                offset: params.offset,
                archived: params.archived,
            };
            // If team is specified, use getProjectsForTeam
            if (params.team) {
                const result = await projectsApi.getProjectsForTeam(params.team, queryParams);
                return result.data;
            }
            else {
                // Otherwise use getProjectsForWorkspace
                const result = await projectsApi.getProjectsForWorkspace(workspace, queryParams);
                return result.data;
            }
        }, 'listProjects');
    }
    async getProject(projectId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            const result = await projectsApi.getProject(projectId, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getProject');
    }
    async createProject(params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Project creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            const body = { data: params };
            const result = await projectsApi.createProject(body, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createProject');
    }
    async getProjectTaskCounts(projectId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            const result = await projectsApi.getTaskCountsForProject(projectId, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getProjectTaskCounts');
    }
    async getProjectSections(projectId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const sectionsApi = new Asana.SectionsApi();
            const result = await sectionsApi.getSectionsForProject(projectId, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getProjectSections');
    }
    async createProjectStatus(projectId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Project status creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const projectStatusesApi = new Asana.ProjectStatusesApi();
            const body = { data: params };
            const result = await projectStatusesApi.createProjectStatusForProject(body, projectId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createProjectStatus');
    }
    async getProjectStatuses(projectId, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectStatusesApi = new Asana.ProjectStatusesApi();
            const result = await projectStatusesApi.getProjectStatusesForProject(projectId, params);
            return result.data;
        }, 'getProjectStatuses');
    }
    async getProjectStatus(projectStatusId, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectStatusesApi = new Asana.ProjectStatusesApi();
            const result = await projectStatusesApi.getProjectStatus(projectStatusId, { opt_fields: optFields });
            return result.data;
        }, 'getProjectStatus');
    }
    async deleteProjectStatus(projectStatusId) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Project status deletion is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const projectStatusesApi = new Asana.ProjectStatusesApi();
            const result = await projectStatusesApi.deleteProjectStatus(projectStatusId);
            return result.data;
        }, 'deleteProjectStatus');
    }
    async createSectionForProject(projectId, params) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Section creation is disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const sectionsApi = new Asana.SectionsApi();
            const body = { data: params };
            const result = await sectionsApi.createSectionForProject(body, projectId, params.opt_fields ? { opt_fields: params.opt_fields } : {});
            return result.data;
        }, 'createSectionForProject');
    }
    async addTaskToSection(sectionId, taskId, optFields) {
        return this.withErrorHandling(async () => {
            if (this.config.readOnlyMode) {
                throw new Error('Task section updates are disabled in read-only mode');
            }
            // @ts-ignore - Type definitions don't match runtime structure
            const sectionsApi = new Asana.SectionsApi();
            const body = { data: { task: taskId } };
            const result = await sectionsApi.addTaskForSection(body, sectionId, optFields ? { opt_fields: optFields } : {});
            return result.data;
        }, 'addTaskToSection');
    }
    // Team operations
    async getTeamsForUser(userGid, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const teamsApi = new Asana.TeamsApi();
            const result = await teamsApi.getTeamsForUser(userGid, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getTeamsForUser');
    }
    async getTeamsForWorkspace(workspaceGid, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const teamsApi = new Asana.TeamsApi();
            const workspace = workspaceGid || this.config.defaultWorkspaceId;
            if (!workspace) {
                throw new Error('Workspace ID is required');
            }
            const result = await teamsApi.getTeamsForWorkspace(workspace, {
                opt_fields: optFields,
            });
            return result.data;
        }, 'getTeamsForWorkspace');
    }
    // User operations
    async listWorkspaceUsers(workspaceId, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const usersApi = new Asana.UsersApi();
            // Use workspace from params or default workspace
            const workspace = workspaceId || this.config.defaultWorkspaceId;
            if (!workspace) {
                throw new Error('Workspace ID is required');
            }
            const result = await usersApi.getUsersForWorkspace(workspace, params);
            return result.data;
        }, 'listWorkspaceUsers');
    }
    async getUser(userId, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const usersApi = new Asana.UsersApi();
            const result = await usersApi.getUser(userId, params);
            return result.data;
        }, 'getUser');
    }
    // Tag operations
    async getTagsForWorkspace(workspaceGid, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tagsApi = new Asana.TagsApi();
            const workspace = workspaceGid || this.config.defaultWorkspaceId;
            if (!workspace) {
                throw new Error('Workspace ID is required');
            }
            const result = await tagsApi.getTagsForWorkspace(workspace, params);
            return result.data;
        }, 'getTagsForWorkspace');
    }
    async getTasksForTag(tagGid, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tagsApi = new Asana.TagsApi();
            const result = await tagsApi.getTasksForTag(tagGid, params);
            return result.data;
        }, 'getTasksForTag');
    }
    // Attachment operations
    async getAttachmentsForObject(objectGid, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const attachmentsApi = new Asana.AttachmentsApi();
            const result = await attachmentsApi.getAttachmentsForObject({
                parent: objectGid,
                ...params,
            });
            return result.data;
        }, 'getAttachmentsForObject');
    }
    // Utility methods
    async getMultipleTasksByGid(taskIds, optFields) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const tasks = await Promise.all(taskIds.map((taskId) => tasksApi.getTask(taskId, { opt_fields: optFields })));
            return tasks.map((task) => task.data);
        }, 'getMultipleTasksByGid');
    }
    async getProjectHierarchy(projectId, params = {}) {
        return this.withErrorHandling(async () => {
            // @ts-ignore - Type definitions don't match runtime structure
            const projectsApi = new Asana.ProjectsApi();
            // @ts-ignore - Type definitions don't match runtime structure
            const sectionsApi = new Asana.SectionsApi();
            // @ts-ignore - Type definitions don't match runtime structure
            const tasksApi = new Asana.TasksApi();
            const project = await projectsApi.getProject(projectId, params);
            const sections = await sectionsApi.getSectionsForProject(projectId);
            const tasks = await tasksApi.getTasksForProject(projectId);
            const hierarchy = {
                project: project.data,
                sections: [],
                tasks: tasks.data,
            };
            // Build section hierarchy
            for (const section of sections.data) {
                const sectionTasks = await tasksApi.getTasksForSection(section.gid);
                const sectionData = {
                    ...section,
                    tasks: sectionTasks.data,
                };
                hierarchy.sections.push(sectionData);
            }
            return hierarchy;
        }, 'getProjectHierarchy');
    }
}
