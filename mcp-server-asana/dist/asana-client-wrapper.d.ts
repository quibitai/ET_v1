export interface AsanaClientConfig {
    accessToken: string;
    defaultWorkspaceId?: string;
    readOnlyMode?: boolean;
}
export declare class AsanaClientWrapper {
    private client;
    private config;
    constructor(config: AsanaClientConfig);
    private initializeClient;
    private withErrorHandling;
    listWorkspaces(optFields?: string): Promise<any>;
    searchTasks(params: any): Promise<any>;
    getTask(taskId: string, optFields?: string): Promise<any>;
    createTask(params: any): Promise<any>;
    updateTask(taskId: string, params: any): Promise<any>;
    deleteTask(taskId: string): Promise<any>;
    getTasks(params: any): Promise<any>;
    getTaskStories(taskId: string, optFields?: string): Promise<any>;
    createTaskStory(taskId: string, params: any): Promise<any>;
    createSubtask(parentTaskId: string, params: any): Promise<any>;
    addTaskDependencies(taskId: string, dependencies: string[]): Promise<any>;
    addTaskDependents(taskId: string, dependents: string[]): Promise<any>;
    addFollowersToTask(taskId: string, followers: string[]): Promise<any>;
    setParentForTask(taskId: string, params: any): Promise<any>;
    searchProjects(params: any): Promise<any>;
    listProjects(params?: any): Promise<any>;
    getProject(projectId: string, optFields?: string): Promise<any>;
    createProject(params: any): Promise<any>;
    getProjectTaskCounts(projectId: string, optFields?: string): Promise<any>;
    getProjectSections(projectId: string, optFields?: string): Promise<any>;
    createProjectStatus(projectId: string, params: any): Promise<any>;
    getProjectStatuses(projectId: string, params?: any): Promise<any>;
    getProjectStatus(projectStatusId: string, optFields?: string): Promise<any>;
    deleteProjectStatus(projectStatusId: string): Promise<any>;
    createSectionForProject(projectId: string, params: any): Promise<any>;
    addTaskToSection(sectionId: string, taskId: string, optFields?: string): Promise<any>;
    getTeamsForUser(userGid: string, optFields?: string): Promise<any>;
    getTeamsForWorkspace(workspaceGid?: string, optFields?: string): Promise<any>;
    listWorkspaceUsers(workspaceId?: string, params?: any): Promise<any>;
    getUser(userId: string, params?: any): Promise<any>;
    getTagsForWorkspace(workspaceGid?: string, params?: any): Promise<any>;
    getTasksForTag(tagGid: string, params?: any): Promise<any>;
    getAttachmentsForObject(objectGid: string, params?: any): Promise<any>;
    getMultipleTasksByGid(taskIds: string[], optFields?: string): Promise<any>;
    getProjectHierarchy(projectId: string, params?: any): Promise<any>;
}
