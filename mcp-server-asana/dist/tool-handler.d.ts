import { z } from 'zod';
import type { AsanaClientWrapper } from './asana-client-wrapper.js';
export declare const tools: {
    asana_list_workspaces: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
        }, {
            opt_fields?: string | undefined;
        }>;
    };
    asana_search_tasks: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace: z.ZodOptional<z.ZodString>;
            text: z.ZodOptional<z.ZodString>;
            resource_subtype: z.ZodOptional<z.ZodString>;
            completed: z.ZodOptional<z.ZodBoolean>;
            is_subtask: z.ZodOptional<z.ZodBoolean>;
            has_attachment: z.ZodOptional<z.ZodBoolean>;
            is_blocked: z.ZodOptional<z.ZodBoolean>;
            is_blocking: z.ZodOptional<z.ZodBoolean>;
            assignee: z.ZodOptional<z.ZodString>;
            'assignee.any': z.ZodOptional<z.ZodString>;
            projects: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            sections: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            tags: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            teams: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            followers: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            created_by: z.ZodOptional<z.ZodString>;
            modified_since: z.ZodOptional<z.ZodString>;
            completed_since: z.ZodOptional<z.ZodString>;
            due_date: z.ZodOptional<z.ZodObject<{
                before: z.ZodOptional<z.ZodString>;
                after: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                before?: string | undefined;
                after?: string | undefined;
            }, {
                before?: string | undefined;
                after?: string | undefined;
            }>>;
            sort_by: z.ZodOptional<z.ZodEnum<["due_date", "created_at", "completed_at", "likes", "modified_at"]>>;
            sort_ascending: z.ZodOptional<z.ZodBoolean>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
            custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            text?: string | undefined;
            resource_subtype?: string | undefined;
            completed?: boolean | undefined;
            is_subtask?: boolean | undefined;
            has_attachment?: boolean | undefined;
            is_blocked?: boolean | undefined;
            is_blocking?: boolean | undefined;
            assignee?: string | undefined;
            'assignee.any'?: string | undefined;
            projects?: string | string[] | undefined;
            sections?: string | string[] | undefined;
            tags?: string | string[] | undefined;
            teams?: string | string[] | undefined;
            followers?: string | string[] | undefined;
            created_by?: string | undefined;
            modified_since?: string | undefined;
            completed_since?: string | undefined;
            due_date?: {
                before?: string | undefined;
                after?: string | undefined;
            } | undefined;
            sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | undefined;
            sort_ascending?: boolean | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            custom_fields?: Record<string, any> | undefined;
        }, {
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            text?: string | undefined;
            resource_subtype?: string | undefined;
            completed?: boolean | undefined;
            is_subtask?: boolean | undefined;
            has_attachment?: boolean | undefined;
            is_blocked?: boolean | undefined;
            is_blocking?: boolean | undefined;
            assignee?: string | undefined;
            'assignee.any'?: string | undefined;
            projects?: string | string[] | undefined;
            sections?: string | string[] | undefined;
            tags?: string | string[] | undefined;
            teams?: string | string[] | undefined;
            followers?: string | string[] | undefined;
            created_by?: string | undefined;
            modified_since?: string | undefined;
            completed_since?: string | undefined;
            due_date?: {
                before?: string | undefined;
                after?: string | undefined;
            } | undefined;
            sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | undefined;
            sort_ascending?: boolean | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            custom_fields?: Record<string, any> | undefined;
        }>;
    };
    asana_get_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | undefined;
        }, {
            task_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_create_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            name: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
            html_notes: z.ZodOptional<z.ZodString>;
            due_on: z.ZodOptional<z.ZodString>;
            assignee: z.ZodOptional<z.ZodString>;
            followers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            parent: z.ZodOptional<z.ZodString>;
            projects: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            resource_subtype: z.ZodOptional<z.ZodString>;
            custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            name: string;
            opt_fields?: string | undefined;
            resource_subtype?: string | undefined;
            assignee?: string | undefined;
            projects?: string[] | undefined;
            followers?: string[] | undefined;
            custom_fields?: Record<string, any> | undefined;
            notes?: string | undefined;
            html_notes?: string | undefined;
            due_on?: string | undefined;
            parent?: string | undefined;
        }, {
            project_id: string;
            name: string;
            opt_fields?: string | undefined;
            resource_subtype?: string | undefined;
            assignee?: string | undefined;
            projects?: string[] | undefined;
            followers?: string[] | undefined;
            custom_fields?: Record<string, any> | undefined;
            notes?: string | undefined;
            html_notes?: string | undefined;
            due_on?: string | undefined;
            parent?: string | undefined;
        }>;
    };
    asana_update_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
            due_on: z.ZodOptional<z.ZodString>;
            assignee: z.ZodOptional<z.ZodString>;
            completed: z.ZodOptional<z.ZodBoolean>;
            resource_subtype: z.ZodOptional<z.ZodString>;
            custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | undefined;
            resource_subtype?: string | undefined;
            completed?: boolean | undefined;
            assignee?: string | undefined;
            custom_fields?: Record<string, any> | undefined;
            name?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
        }, {
            task_id: string;
            opt_fields?: string | undefined;
            resource_subtype?: string | undefined;
            completed?: boolean | undefined;
            assignee?: string | undefined;
            custom_fields?: Record<string, any> | undefined;
            name?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
        }>;
    };
    asana_delete_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
        }, {
            task_id: string;
        }>;
    };
    asana_get_task_stories: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | undefined;
        }, {
            task_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_create_task_story: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            text: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            task_id: string;
            opt_fields?: string | undefined;
        }, {
            text: string;
            task_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_create_subtask: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            parent_task_id: z.ZodString;
            name: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
            due_on: z.ZodOptional<z.ZodString>;
            assignee: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            parent_task_id: string;
            opt_fields?: string | undefined;
            assignee?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
        }, {
            name: string;
            parent_task_id: string;
            opt_fields?: string | undefined;
            assignee?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
        }>;
    };
    asana_add_task_dependencies: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            dependencies: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            dependencies: string[];
        }, {
            task_id: string;
            dependencies: string[];
        }>;
    };
    asana_add_task_dependents: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            dependents: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            dependents: string[];
        }, {
            task_id: string;
            dependents: string[];
        }>;
    };
    asana_add_followers_to_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            followers: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            followers: string[];
            task_id: string;
        }, {
            followers: string[];
            task_id: string;
        }>;
    };
    asana_set_parent_for_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            parent: z.ZodString;
            insert_after: z.ZodOptional<z.ZodString>;
            insert_before: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            parent: string;
            opt_fields?: string | undefined;
            insert_after?: string | undefined;
            insert_before?: string | undefined;
        }, {
            task_id: string;
            parent: string;
            opt_fields?: string | undefined;
            insert_after?: string | undefined;
            insert_before?: string | undefined;
        }>;
    };
    asana_get_multiple_tasks_by_gid: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_ids: z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodString]>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_ids: string | string[];
            opt_fields?: string | undefined;
        }, {
            task_ids: string | string[];
            opt_fields?: string | undefined;
        }>;
    };
    asana_search_projects: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            name_pattern: z.ZodString;
            workspace: z.ZodOptional<z.ZodString>;
            team: z.ZodOptional<z.ZodString>;
            archived: z.ZodOptional<z.ZodBoolean>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name_pattern: string;
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            team?: string | undefined;
            archived?: boolean | undefined;
        }, {
            name_pattern: string;
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            team?: string | undefined;
            archived?: boolean | undefined;
        }>;
    };
    asana_list_projects: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace: z.ZodOptional<z.ZodString>;
            team: z.ZodOptional<z.ZodString>;
            archived: z.ZodOptional<z.ZodBoolean>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            team?: string | undefined;
            archived?: boolean | undefined;
        }, {
            opt_fields?: string | undefined;
            workspace?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            team?: string | undefined;
            archived?: boolean | undefined;
        }>;
    };
    asana_get_project: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | undefined;
        }, {
            project_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_create_project: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            team_id: z.ZodString;
            public: z.ZodOptional<z.ZodBoolean>;
            archived: z.ZodOptional<z.ZodBoolean>;
            color: z.ZodOptional<z.ZodString>;
            layout: z.ZodOptional<z.ZodString>;
            default_view: z.ZodOptional<z.ZodString>;
            due_on: z.ZodOptional<z.ZodString>;
            start_on: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            team_id: string;
            opt_fields?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
            archived?: boolean | undefined;
            workspace_id?: string | undefined;
            public?: boolean | undefined;
            color?: string | undefined;
            layout?: string | undefined;
            default_view?: string | undefined;
            start_on?: string | undefined;
        }, {
            name: string;
            team_id: string;
            opt_fields?: string | undefined;
            notes?: string | undefined;
            due_on?: string | undefined;
            archived?: boolean | undefined;
            workspace_id?: string | undefined;
            public?: boolean | undefined;
            color?: string | undefined;
            layout?: string | undefined;
            default_view?: string | undefined;
            start_on?: string | undefined;
        }>;
    };
    asana_get_project_task_counts: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | undefined;
        }, {
            project_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_project_sections: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | undefined;
        }, {
            project_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_project_hierarchy: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            include_completed_tasks: z.ZodOptional<z.ZodBoolean>;
            include_subtasks: z.ZodOptional<z.ZodBoolean>;
            include_completed_subtasks: z.ZodOptional<z.ZodBoolean>;
            max_subtask_depth: z.ZodOptional<z.ZodNumber>;
            opt_fields_tasks: z.ZodOptional<z.ZodString>;
            opt_fields_subtasks: z.ZodOptional<z.ZodString>;
            opt_fields_sections: z.ZodOptional<z.ZodString>;
            opt_fields_project: z.ZodOptional<z.ZodString>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            auto_paginate: z.ZodOptional<z.ZodBoolean>;
            max_pages: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            limit?: number | undefined;
            offset?: string | undefined;
            include_completed_tasks?: boolean | undefined;
            include_subtasks?: boolean | undefined;
            include_completed_subtasks?: boolean | undefined;
            max_subtask_depth?: number | undefined;
            opt_fields_tasks?: string | undefined;
            opt_fields_subtasks?: string | undefined;
            opt_fields_sections?: string | undefined;
            opt_fields_project?: string | undefined;
            auto_paginate?: boolean | undefined;
            max_pages?: number | undefined;
        }, {
            project_id: string;
            limit?: number | undefined;
            offset?: string | undefined;
            include_completed_tasks?: boolean | undefined;
            include_subtasks?: boolean | undefined;
            include_completed_subtasks?: boolean | undefined;
            max_subtask_depth?: number | undefined;
            opt_fields_tasks?: string | undefined;
            opt_fields_subtasks?: string | undefined;
            opt_fields_sections?: string | undefined;
            opt_fields_project?: string | undefined;
            auto_paginate?: boolean | undefined;
            max_pages?: number | undefined;
        }>;
    };
    asana_get_project_status: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_status_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_status_gid: string;
            opt_fields?: string | undefined;
        }, {
            project_status_gid: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_project_statuses: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_gid: z.ZodString;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
        }, {
            project_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
        }>;
    };
    asana_create_project_status: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_gid: z.ZodString;
            text: z.ZodString;
            color: z.ZodOptional<z.ZodString>;
            title: z.ZodOptional<z.ZodString>;
            html_text: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            project_gid: string;
            opt_fields?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            html_text?: string | undefined;
        }, {
            text: string;
            project_gid: string;
            opt_fields?: string | undefined;
            color?: string | undefined;
            title?: string | undefined;
            html_text?: string | undefined;
        }>;
    };
    asana_delete_project_status: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_status_gid: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            project_status_gid: string;
        }, {
            project_status_gid: string;
        }>;
    };
    asana_create_section_for_project: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            name: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            name: string;
            opt_fields?: string | undefined;
        }, {
            project_id: string;
            name: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_add_task_to_section: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            section_id: z.ZodString;
            task_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            section_id: string;
            opt_fields?: string | undefined;
        }, {
            task_id: string;
            section_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_teams_for_user: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            user_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            user_gid: string;
            opt_fields?: string | undefined;
        }, {
            user_gid: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_teams_for_workspace: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_gid: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
            workspace_gid?: string | undefined;
        }, {
            opt_fields?: string | undefined;
            workspace_gid?: string | undefined;
        }>;
    };
    asana_list_workspace_users: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodString>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            workspace_id?: string | undefined;
        }, {
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            workspace_id?: string | undefined;
        }>;
    };
    asana_get_user: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            user_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            user_id: string;
            opt_fields?: string | undefined;
        }, {
            user_id: string;
            opt_fields?: string | undefined;
        }>;
    };
    asana_get_tags_for_workspace: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_gid: z.ZodOptional<z.ZodString>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            workspace_gid?: string | undefined;
        }, {
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            workspace_gid?: string | undefined;
        }>;
    };
    asana_get_tasks_for_tag: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            tag_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodString>;
            opt_pretty: z.ZodOptional<z.ZodBoolean>;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            tag_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            opt_pretty?: boolean | undefined;
        }, {
            tag_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
            opt_pretty?: boolean | undefined;
        }>;
    };
    asana_get_attachments_for_object: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            object_gid: z.ZodString;
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodString>;
            opt_fields: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            object_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
        }, {
            object_gid: string;
            opt_fields?: string | undefined;
            limit?: number | undefined;
            offset?: string | undefined;
        }>;
    };
};
export declare const list_of_tools: ({
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
    }, {
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        resource_subtype: z.ZodOptional<z.ZodString>;
        completed: z.ZodOptional<z.ZodBoolean>;
        is_subtask: z.ZodOptional<z.ZodBoolean>;
        has_attachment: z.ZodOptional<z.ZodBoolean>;
        is_blocked: z.ZodOptional<z.ZodBoolean>;
        is_blocking: z.ZodOptional<z.ZodBoolean>;
        assignee: z.ZodOptional<z.ZodString>;
        'assignee.any': z.ZodOptional<z.ZodString>;
        projects: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        sections: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        tags: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        teams: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        followers: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        created_by: z.ZodOptional<z.ZodString>;
        modified_since: z.ZodOptional<z.ZodString>;
        completed_since: z.ZodOptional<z.ZodString>;
        due_date: z.ZodOptional<z.ZodObject<{
            before: z.ZodOptional<z.ZodString>;
            after: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            before?: string | undefined;
            after?: string | undefined;
        }, {
            before?: string | undefined;
            after?: string | undefined;
        }>>;
        sort_by: z.ZodOptional<z.ZodEnum<["due_date", "created_at", "completed_at", "likes", "modified_at"]>>;
        sort_ascending: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
        custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        text?: string | undefined;
        resource_subtype?: string | undefined;
        completed?: boolean | undefined;
        is_subtask?: boolean | undefined;
        has_attachment?: boolean | undefined;
        is_blocked?: boolean | undefined;
        is_blocking?: boolean | undefined;
        assignee?: string | undefined;
        'assignee.any'?: string | undefined;
        projects?: string | string[] | undefined;
        sections?: string | string[] | undefined;
        tags?: string | string[] | undefined;
        teams?: string | string[] | undefined;
        followers?: string | string[] | undefined;
        created_by?: string | undefined;
        modified_since?: string | undefined;
        completed_since?: string | undefined;
        due_date?: {
            before?: string | undefined;
            after?: string | undefined;
        } | undefined;
        sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | undefined;
        sort_ascending?: boolean | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        custom_fields?: Record<string, any> | undefined;
    }, {
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        text?: string | undefined;
        resource_subtype?: string | undefined;
        completed?: boolean | undefined;
        is_subtask?: boolean | undefined;
        has_attachment?: boolean | undefined;
        is_blocked?: boolean | undefined;
        is_blocking?: boolean | undefined;
        assignee?: string | undefined;
        'assignee.any'?: string | undefined;
        projects?: string | string[] | undefined;
        sections?: string | string[] | undefined;
        tags?: string | string[] | undefined;
        teams?: string | string[] | undefined;
        followers?: string | string[] | undefined;
        created_by?: string | undefined;
        modified_since?: string | undefined;
        completed_since?: string | undefined;
        due_date?: {
            before?: string | undefined;
            after?: string | undefined;
        } | undefined;
        sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | undefined;
        sort_ascending?: boolean | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        custom_fields?: Record<string, any> | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | undefined;
    }, {
        task_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        name: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        html_notes: z.ZodOptional<z.ZodString>;
        due_on: z.ZodOptional<z.ZodString>;
        assignee: z.ZodOptional<z.ZodString>;
        followers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        parent: z.ZodOptional<z.ZodString>;
        projects: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resource_subtype: z.ZodOptional<z.ZodString>;
        custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        name: string;
        opt_fields?: string | undefined;
        resource_subtype?: string | undefined;
        assignee?: string | undefined;
        projects?: string[] | undefined;
        followers?: string[] | undefined;
        custom_fields?: Record<string, any> | undefined;
        notes?: string | undefined;
        html_notes?: string | undefined;
        due_on?: string | undefined;
        parent?: string | undefined;
    }, {
        project_id: string;
        name: string;
        opt_fields?: string | undefined;
        resource_subtype?: string | undefined;
        assignee?: string | undefined;
        projects?: string[] | undefined;
        followers?: string[] | undefined;
        custom_fields?: Record<string, any> | undefined;
        notes?: string | undefined;
        html_notes?: string | undefined;
        due_on?: string | undefined;
        parent?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        due_on: z.ZodOptional<z.ZodString>;
        assignee: z.ZodOptional<z.ZodString>;
        completed: z.ZodOptional<z.ZodBoolean>;
        resource_subtype: z.ZodOptional<z.ZodString>;
        custom_fields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | undefined;
        resource_subtype?: string | undefined;
        completed?: boolean | undefined;
        assignee?: string | undefined;
        custom_fields?: Record<string, any> | undefined;
        name?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
    }, {
        task_id: string;
        opt_fields?: string | undefined;
        resource_subtype?: string | undefined;
        completed?: boolean | undefined;
        assignee?: string | undefined;
        custom_fields?: Record<string, any> | undefined;
        name?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
    }, {
        task_id: string;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | undefined;
    }, {
        task_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        text: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        task_id: string;
        opt_fields?: string | undefined;
    }, {
        text: string;
        task_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        parent_task_id: z.ZodString;
        name: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        due_on: z.ZodOptional<z.ZodString>;
        assignee: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        parent_task_id: string;
        opt_fields?: string | undefined;
        assignee?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
    }, {
        name: string;
        parent_task_id: string;
        opt_fields?: string | undefined;
        assignee?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        dependencies: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        dependencies: string[];
    }, {
        task_id: string;
        dependencies: string[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        dependents: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        dependents: string[];
    }, {
        task_id: string;
        dependents: string[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        followers: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        followers: string[];
        task_id: string;
    }, {
        followers: string[];
        task_id: string;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        parent: z.ZodString;
        insert_after: z.ZodOptional<z.ZodString>;
        insert_before: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        parent: string;
        opt_fields?: string | undefined;
        insert_after?: string | undefined;
        insert_before?: string | undefined;
    }, {
        task_id: string;
        parent: string;
        opt_fields?: string | undefined;
        insert_after?: string | undefined;
        insert_before?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_ids: z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodString]>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_ids: string | string[];
        opt_fields?: string | undefined;
    }, {
        task_ids: string | string[];
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        name_pattern: z.ZodString;
        workspace: z.ZodOptional<z.ZodString>;
        team: z.ZodOptional<z.ZodString>;
        archived: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name_pattern: string;
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        team?: string | undefined;
        archived?: boolean | undefined;
    }, {
        name_pattern: string;
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        team?: string | undefined;
        archived?: boolean | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace: z.ZodOptional<z.ZodString>;
        team: z.ZodOptional<z.ZodString>;
        archived: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        team?: string | undefined;
        archived?: boolean | undefined;
    }, {
        opt_fields?: string | undefined;
        workspace?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        team?: string | undefined;
        archived?: boolean | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | undefined;
    }, {
        project_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        team_id: z.ZodString;
        public: z.ZodOptional<z.ZodBoolean>;
        archived: z.ZodOptional<z.ZodBoolean>;
        color: z.ZodOptional<z.ZodString>;
        layout: z.ZodOptional<z.ZodString>;
        default_view: z.ZodOptional<z.ZodString>;
        due_on: z.ZodOptional<z.ZodString>;
        start_on: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        team_id: string;
        opt_fields?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
        archived?: boolean | undefined;
        workspace_id?: string | undefined;
        public?: boolean | undefined;
        color?: string | undefined;
        layout?: string | undefined;
        default_view?: string | undefined;
        start_on?: string | undefined;
    }, {
        name: string;
        team_id: string;
        opt_fields?: string | undefined;
        notes?: string | undefined;
        due_on?: string | undefined;
        archived?: boolean | undefined;
        workspace_id?: string | undefined;
        public?: boolean | undefined;
        color?: string | undefined;
        layout?: string | undefined;
        default_view?: string | undefined;
        start_on?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | undefined;
    }, {
        project_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | undefined;
    }, {
        project_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        include_completed_tasks: z.ZodOptional<z.ZodBoolean>;
        include_subtasks: z.ZodOptional<z.ZodBoolean>;
        include_completed_subtasks: z.ZodOptional<z.ZodBoolean>;
        max_subtask_depth: z.ZodOptional<z.ZodNumber>;
        opt_fields_tasks: z.ZodOptional<z.ZodString>;
        opt_fields_subtasks: z.ZodOptional<z.ZodString>;
        opt_fields_sections: z.ZodOptional<z.ZodString>;
        opt_fields_project: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        auto_paginate: z.ZodOptional<z.ZodBoolean>;
        max_pages: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        limit?: number | undefined;
        offset?: string | undefined;
        include_completed_tasks?: boolean | undefined;
        include_subtasks?: boolean | undefined;
        include_completed_subtasks?: boolean | undefined;
        max_subtask_depth?: number | undefined;
        opt_fields_tasks?: string | undefined;
        opt_fields_subtasks?: string | undefined;
        opt_fields_sections?: string | undefined;
        opt_fields_project?: string | undefined;
        auto_paginate?: boolean | undefined;
        max_pages?: number | undefined;
    }, {
        project_id: string;
        limit?: number | undefined;
        offset?: string | undefined;
        include_completed_tasks?: boolean | undefined;
        include_subtasks?: boolean | undefined;
        include_completed_subtasks?: boolean | undefined;
        max_subtask_depth?: number | undefined;
        opt_fields_tasks?: string | undefined;
        opt_fields_subtasks?: string | undefined;
        opt_fields_sections?: string | undefined;
        opt_fields_project?: string | undefined;
        auto_paginate?: boolean | undefined;
        max_pages?: number | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_status_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_status_gid: string;
        opt_fields?: string | undefined;
    }, {
        project_status_gid: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_gid: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
    }, {
        project_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_gid: z.ZodString;
        text: z.ZodString;
        color: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        html_text: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        project_gid: string;
        opt_fields?: string | undefined;
        color?: string | undefined;
        title?: string | undefined;
        html_text?: string | undefined;
    }, {
        text: string;
        project_gid: string;
        opt_fields?: string | undefined;
        color?: string | undefined;
        title?: string | undefined;
        html_text?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_status_gid: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        project_status_gid: string;
    }, {
        project_status_gid: string;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        name: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        name: string;
        opt_fields?: string | undefined;
    }, {
        project_id: string;
        name: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        section_id: z.ZodString;
        task_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        section_id: string;
        opt_fields?: string | undefined;
    }, {
        task_id: string;
        section_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        user_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_gid: string;
        opt_fields?: string | undefined;
    }, {
        user_gid: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_gid: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
        workspace_gid?: string | undefined;
    }, {
        opt_fields?: string | undefined;
        workspace_gid?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        workspace_id?: string | undefined;
    }, {
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        workspace_id?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        user_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_id: string;
        opt_fields?: string | undefined;
    }, {
        user_id: string;
        opt_fields?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_gid: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        workspace_gid?: string | undefined;
    }, {
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        workspace_gid?: string | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        tag_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodString>;
        opt_pretty: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tag_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        opt_pretty?: boolean | undefined;
    }, {
        tag_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
        opt_pretty?: boolean | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        object_gid: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodString>;
        opt_fields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        object_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
    }, {
        object_gid: string;
        opt_fields?: string | undefined;
        limit?: number | undefined;
        offset?: string | undefined;
    }>;
})[];
export declare function createToolHandler(client: AsanaClientWrapper): (request: {
    name: string;
    arguments?: any;
}) => Promise<any>;
