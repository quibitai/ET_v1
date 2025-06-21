import { z } from 'zod';
import type { AsanaClientWrapper } from './asana-client-wrapper.js';
export declare const tools: {
    asana_list_workspaces: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            opt_fields: z.ZodNullable<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_search_tasks: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            is_subtask: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            has_attachment: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            is_blocked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            is_blocking: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            'assignee.any': z.ZodOptional<z.ZodNullable<z.ZodString>>;
            projects: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
            sections: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
            tags: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
            teams: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
            followers: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
            created_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            modified_since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            completed_since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            due_date: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                before: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                after: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            }, "strip", z.ZodTypeAny, {
                before?: string | null | undefined;
                after?: string | null | undefined;
            }, {
                before?: string | null | undefined;
                after?: string | null | undefined;
            }>>>;
            sort_by: z.ZodOptional<z.ZodNullable<z.ZodEnum<["due_date", "created_at", "completed_at", "likes", "modified_at"]>>>;
            sort_ascending: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            text?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            completed?: boolean | null | undefined;
            is_subtask?: boolean | null | undefined;
            has_attachment?: boolean | null | undefined;
            is_blocked?: boolean | null | undefined;
            is_blocking?: boolean | null | undefined;
            assignee?: string | null | undefined;
            'assignee.any'?: string | null | undefined;
            projects?: string | string[] | null | undefined;
            sections?: string | string[] | null | undefined;
            tags?: string | string[] | null | undefined;
            teams?: string | string[] | null | undefined;
            followers?: string | string[] | null | undefined;
            created_by?: string | null | undefined;
            modified_since?: string | null | undefined;
            completed_since?: string | null | undefined;
            due_date?: {
                before?: string | null | undefined;
                after?: string | null | undefined;
            } | null | undefined;
            sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | null | undefined;
            sort_ascending?: boolean | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            text?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            completed?: boolean | null | undefined;
            is_subtask?: boolean | null | undefined;
            has_attachment?: boolean | null | undefined;
            is_blocked?: boolean | null | undefined;
            is_blocking?: boolean | null | undefined;
            assignee?: string | null | undefined;
            'assignee.any'?: string | null | undefined;
            projects?: string | string[] | null | undefined;
            sections?: string | string[] | null | undefined;
            tags?: string | string[] | null | undefined;
            teams?: string | string[] | null | undefined;
            followers?: string | string[] | null | undefined;
            created_by?: string | null | undefined;
            modified_since?: string | null | undefined;
            completed_since?: string | null | undefined;
            due_date?: {
                before?: string | null | undefined;
                after?: string | null | undefined;
            } | null | undefined;
            sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | null | undefined;
            sort_ascending?: boolean | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
        }>;
    };
    asana_get_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | null | undefined;
        }, {
            task_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_create_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            name: z.ZodString;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            html_notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            followers: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
            parent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            projects: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
            resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            name: string;
            opt_fields?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            assignee?: string | null | undefined;
            projects?: string[] | null | undefined;
            followers?: string[] | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
            notes?: string | null | undefined;
            html_notes?: string | null | undefined;
            due_on?: string | null | undefined;
            parent?: string | null | undefined;
        }, {
            project_id: string;
            name: string;
            opt_fields?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            assignee?: string | null | undefined;
            projects?: string[] | null | undefined;
            followers?: string[] | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
            notes?: string | null | undefined;
            html_notes?: string | null | undefined;
            due_on?: string | null | undefined;
            parent?: string | null | undefined;
        }>;
    };
    asana_update_task: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            completed?: boolean | null | undefined;
            assignee?: string | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
            name?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
        }, {
            task_id: string;
            opt_fields?: string | null | undefined;
            resource_subtype?: string | null | undefined;
            completed?: boolean | null | undefined;
            assignee?: string | null | undefined;
            custom_fields?: Record<string, any> | null | undefined;
            name?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
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
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            opt_fields?: string | null | undefined;
        }, {
            task_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_create_task_story: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_id: z.ZodString;
            text: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            task_id: string;
            opt_fields?: string | null | undefined;
        }, {
            text: string;
            task_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_create_subtask: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            parent_task_id: z.ZodString;
            name: z.ZodString;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            parent_task_id: string;
            opt_fields?: string | null | undefined;
            assignee?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
        }, {
            name: string;
            parent_task_id: string;
            opt_fields?: string | null | undefined;
            assignee?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
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
            insert_after: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            insert_before: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            parent: string;
            opt_fields?: string | null | undefined;
            insert_after?: string | null | undefined;
            insert_before?: string | null | undefined;
        }, {
            task_id: string;
            parent: string;
            opt_fields?: string | null | undefined;
            insert_after?: string | null | undefined;
            insert_before?: string | null | undefined;
        }>;
    };
    asana_get_multiple_tasks_by_gid: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            task_ids: z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodString]>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_ids: string | string[];
            opt_fields?: string | null | undefined;
        }, {
            task_ids: string | string[];
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_search_projects: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            name_pattern: z.ZodString;
            workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            name_pattern: string;
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            team?: string | null | undefined;
            archived?: boolean | null | undefined;
        }, {
            name_pattern: string;
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            team?: string | null | undefined;
            archived?: boolean | null | undefined;
        }>;
    };
    asana_list_projects: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            team?: string | null | undefined;
            archived?: boolean | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
            workspace?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            team?: string | null | undefined;
            archived?: boolean | null | undefined;
        }>;
    };
    asana_get_project: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_create_project: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            name: z.ZodString;
            team_id: z.ZodString;
            public: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            layout: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            default_view: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            start_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            team_id: string;
            opt_fields?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
            archived?: boolean | null | undefined;
            workspace_id?: string | null | undefined;
            public?: boolean | null | undefined;
            color?: string | null | undefined;
            layout?: string | null | undefined;
            default_view?: string | null | undefined;
            start_on?: string | null | undefined;
        }, {
            name: string;
            team_id: string;
            opt_fields?: string | null | undefined;
            notes?: string | null | undefined;
            due_on?: string | null | undefined;
            archived?: boolean | null | undefined;
            workspace_id?: string | null | undefined;
            public?: boolean | null | undefined;
            color?: string | null | undefined;
            layout?: string | null | undefined;
            default_view?: string | null | undefined;
            start_on?: string | null | undefined;
        }>;
    };
    asana_get_project_task_counts: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_project_sections: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }, {
            project_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_project_hierarchy: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_id: z.ZodString;
            include_completed_tasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            include_subtasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            include_completed_subtasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            max_subtask_depth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            opt_fields_tasks: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields_subtasks: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields_sections: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields_project: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            auto_paginate: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            max_pages: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            include_completed_tasks?: boolean | null | undefined;
            include_subtasks?: boolean | null | undefined;
            include_completed_subtasks?: boolean | null | undefined;
            max_subtask_depth?: number | null | undefined;
            opt_fields_tasks?: string | null | undefined;
            opt_fields_subtasks?: string | null | undefined;
            opt_fields_sections?: string | null | undefined;
            opt_fields_project?: string | null | undefined;
            auto_paginate?: boolean | null | undefined;
            max_pages?: number | null | undefined;
        }, {
            project_id: string;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            include_completed_tasks?: boolean | null | undefined;
            include_subtasks?: boolean | null | undefined;
            include_completed_subtasks?: boolean | null | undefined;
            max_subtask_depth?: number | null | undefined;
            opt_fields_tasks?: string | null | undefined;
            opt_fields_subtasks?: string | null | undefined;
            opt_fields_sections?: string | null | undefined;
            opt_fields_project?: string | null | undefined;
            auto_paginate?: boolean | null | undefined;
            max_pages?: number | null | undefined;
        }>;
    };
    asana_get_project_status: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_status_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_status_gid: string;
            opt_fields?: string | null | undefined;
        }, {
            project_status_gid: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_project_statuses: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_gid: z.ZodString;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
        }, {
            project_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
        }>;
    };
    asana_create_project_status: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            project_gid: z.ZodString;
            text: z.ZodString;
            color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            html_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            project_gid: string;
            opt_fields?: string | null | undefined;
            color?: string | null | undefined;
            title?: string | null | undefined;
            html_text?: string | null | undefined;
        }, {
            text: string;
            project_gid: string;
            opt_fields?: string | null | undefined;
            color?: string | null | undefined;
            title?: string | null | undefined;
            html_text?: string | null | undefined;
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
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            project_id: string;
            name: string;
            opt_fields?: string | null | undefined;
        }, {
            project_id: string;
            name: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_add_task_to_section: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            section_id: z.ZodString;
            task_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            section_id: string;
            opt_fields?: string | null | undefined;
        }, {
            task_id: string;
            section_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_teams_for_user: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            user_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            user_gid: string;
            opt_fields?: string | null | undefined;
        }, {
            user_gid: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_teams_for_workspace: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_gid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
            workspace_gid?: string | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
            workspace_gid?: string | null | undefined;
        }>;
    };
    asana_list_workspace_users: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            workspace_id?: string | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            workspace_id?: string | null | undefined;
        }>;
    };
    asana_get_user: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            user_id: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            user_id: string;
            opt_fields?: string | null | undefined;
        }, {
            user_id: string;
            opt_fields?: string | null | undefined;
        }>;
    };
    asana_get_tags_for_workspace: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            workspace_gid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            workspace_gid?: string | null | undefined;
        }, {
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            workspace_gid?: string | null | undefined;
        }>;
    };
    asana_get_tasks_for_tag: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            tag_gid: z.ZodString;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_pretty: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            tag_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            opt_pretty?: boolean | null | undefined;
        }, {
            tag_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
            opt_pretty?: boolean | null | undefined;
        }>;
    };
    asana_get_attachments_for_object: {
        name: string;
        description: string;
        inputSchema: z.ZodObject<{
            object_gid: z.ZodString;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            object_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
        }, {
            object_gid: string;
            opt_fields?: string | null | undefined;
            limit?: number | null | undefined;
            offset?: string | null | undefined;
        }>;
    };
};
export declare const list_of_tools: ({
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        opt_fields: z.ZodNullable<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        is_subtask: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        has_attachment: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        is_blocked: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        is_blocking: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        'assignee.any': z.ZodOptional<z.ZodNullable<z.ZodString>>;
        projects: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
        sections: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
        tags: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
        teams: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
        followers: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>>;
        created_by: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        modified_since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed_since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        due_date: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            before: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            after: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            before?: string | null | undefined;
            after?: string | null | undefined;
        }, {
            before?: string | null | undefined;
            after?: string | null | undefined;
        }>>>;
        sort_by: z.ZodOptional<z.ZodNullable<z.ZodEnum<["due_date", "created_at", "completed_at", "likes", "modified_at"]>>>;
        sort_ascending: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        text?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        completed?: boolean | null | undefined;
        is_subtask?: boolean | null | undefined;
        has_attachment?: boolean | null | undefined;
        is_blocked?: boolean | null | undefined;
        is_blocking?: boolean | null | undefined;
        assignee?: string | null | undefined;
        'assignee.any'?: string | null | undefined;
        projects?: string | string[] | null | undefined;
        sections?: string | string[] | null | undefined;
        tags?: string | string[] | null | undefined;
        teams?: string | string[] | null | undefined;
        followers?: string | string[] | null | undefined;
        created_by?: string | null | undefined;
        modified_since?: string | null | undefined;
        completed_since?: string | null | undefined;
        due_date?: {
            before?: string | null | undefined;
            after?: string | null | undefined;
        } | null | undefined;
        sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | null | undefined;
        sort_ascending?: boolean | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        text?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        completed?: boolean | null | undefined;
        is_subtask?: boolean | null | undefined;
        has_attachment?: boolean | null | undefined;
        is_blocked?: boolean | null | undefined;
        is_blocking?: boolean | null | undefined;
        assignee?: string | null | undefined;
        'assignee.any'?: string | null | undefined;
        projects?: string | string[] | null | undefined;
        sections?: string | string[] | null | undefined;
        tags?: string | string[] | null | undefined;
        teams?: string | string[] | null | undefined;
        followers?: string | string[] | null | undefined;
        created_by?: string | null | undefined;
        modified_since?: string | null | undefined;
        completed_since?: string | null | undefined;
        due_date?: {
            before?: string | null | undefined;
            after?: string | null | undefined;
        } | null | undefined;
        sort_by?: "due_date" | "created_at" | "completed_at" | "likes" | "modified_at" | null | undefined;
        sort_ascending?: boolean | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | null | undefined;
    }, {
        task_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        name: z.ZodString;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        html_notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        followers: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        parent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        projects: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        name: string;
        opt_fields?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        assignee?: string | null | undefined;
        projects?: string[] | null | undefined;
        followers?: string[] | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
        notes?: string | null | undefined;
        html_notes?: string | null | undefined;
        due_on?: string | null | undefined;
        parent?: string | null | undefined;
    }, {
        project_id: string;
        name: string;
        opt_fields?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        assignee?: string | null | undefined;
        projects?: string[] | null | undefined;
        followers?: string[] | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
        notes?: string | null | undefined;
        html_notes?: string | null | undefined;
        due_on?: string | null | undefined;
        parent?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completed: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        resource_subtype: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        custom_fields: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        completed?: boolean | null | undefined;
        assignee?: string | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
        name?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
    }, {
        task_id: string;
        opt_fields?: string | null | undefined;
        resource_subtype?: string | null | undefined;
        completed?: boolean | null | undefined;
        assignee?: string | null | undefined;
        custom_fields?: Record<string, any> | null | undefined;
        name?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
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
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        opt_fields?: string | null | undefined;
    }, {
        task_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_id: z.ZodString;
        text: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        task_id: string;
        opt_fields?: string | null | undefined;
    }, {
        text: string;
        task_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        parent_task_id: z.ZodString;
        name: z.ZodString;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        assignee: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        parent_task_id: string;
        opt_fields?: string | null | undefined;
        assignee?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
    }, {
        name: string;
        parent_task_id: string;
        opt_fields?: string | null | undefined;
        assignee?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
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
        insert_after: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        insert_before: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        parent: string;
        opt_fields?: string | null | undefined;
        insert_after?: string | null | undefined;
        insert_before?: string | null | undefined;
    }, {
        task_id: string;
        parent: string;
        opt_fields?: string | null | undefined;
        insert_after?: string | null | undefined;
        insert_before?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        task_ids: z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodString]>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_ids: string | string[];
        opt_fields?: string | null | undefined;
    }, {
        task_ids: string | string[];
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        name_pattern: z.ZodString;
        workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name_pattern: string;
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        team?: string | null | undefined;
        archived?: boolean | null | undefined;
    }, {
        name_pattern: string;
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        team?: string | null | undefined;
        archived?: boolean | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        team?: string | null | undefined;
        archived?: boolean | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
        workspace?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        team?: string | null | undefined;
        archived?: boolean | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        name: z.ZodString;
        team_id: z.ZodString;
        public: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        archived: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        layout: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        default_view: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        due_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        start_on: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        team_id: string;
        opt_fields?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
        archived?: boolean | null | undefined;
        workspace_id?: string | null | undefined;
        public?: boolean | null | undefined;
        color?: string | null | undefined;
        layout?: string | null | undefined;
        default_view?: string | null | undefined;
        start_on?: string | null | undefined;
    }, {
        name: string;
        team_id: string;
        opt_fields?: string | null | undefined;
        notes?: string | null | undefined;
        due_on?: string | null | undefined;
        archived?: boolean | null | undefined;
        workspace_id?: string | null | undefined;
        public?: boolean | null | undefined;
        color?: string | null | undefined;
        layout?: string | null | undefined;
        default_view?: string | null | undefined;
        start_on?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }, {
        project_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_id: z.ZodString;
        include_completed_tasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        include_subtasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        include_completed_subtasks: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        max_subtask_depth: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        opt_fields_tasks: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields_subtasks: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields_sections: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields_project: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        auto_paginate: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        max_pages: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        include_completed_tasks?: boolean | null | undefined;
        include_subtasks?: boolean | null | undefined;
        include_completed_subtasks?: boolean | null | undefined;
        max_subtask_depth?: number | null | undefined;
        opt_fields_tasks?: string | null | undefined;
        opt_fields_subtasks?: string | null | undefined;
        opt_fields_sections?: string | null | undefined;
        opt_fields_project?: string | null | undefined;
        auto_paginate?: boolean | null | undefined;
        max_pages?: number | null | undefined;
    }, {
        project_id: string;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        include_completed_tasks?: boolean | null | undefined;
        include_subtasks?: boolean | null | undefined;
        include_completed_subtasks?: boolean | null | undefined;
        max_subtask_depth?: number | null | undefined;
        opt_fields_tasks?: string | null | undefined;
        opt_fields_subtasks?: string | null | undefined;
        opt_fields_sections?: string | null | undefined;
        opt_fields_project?: string | null | undefined;
        auto_paginate?: boolean | null | undefined;
        max_pages?: number | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_status_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_status_gid: string;
        opt_fields?: string | null | undefined;
    }, {
        project_status_gid: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_gid: z.ZodString;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
    }, {
        project_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        project_gid: z.ZodString;
        text: z.ZodString;
        color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        html_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        project_gid: string;
        opt_fields?: string | null | undefined;
        color?: string | null | undefined;
        title?: string | null | undefined;
        html_text?: string | null | undefined;
    }, {
        text: string;
        project_gid: string;
        opt_fields?: string | null | undefined;
        color?: string | null | undefined;
        title?: string | null | undefined;
        html_text?: string | null | undefined;
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
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        project_id: string;
        name: string;
        opt_fields?: string | null | undefined;
    }, {
        project_id: string;
        name: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        section_id: z.ZodString;
        task_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        section_id: string;
        opt_fields?: string | null | undefined;
    }, {
        task_id: string;
        section_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        user_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        user_gid: string;
        opt_fields?: string | null | undefined;
    }, {
        user_gid: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_gid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
        workspace_gid?: string | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
        workspace_gid?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        workspace_id?: string | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        workspace_id?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        user_id: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        user_id: string;
        opt_fields?: string | null | undefined;
    }, {
        user_id: string;
        opt_fields?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        workspace_gid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        workspace_gid?: string | null | undefined;
    }, {
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        workspace_gid?: string | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        tag_gid: z.ZodString;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_pretty: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        tag_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        opt_pretty?: boolean | null | undefined;
    }, {
        tag_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
        opt_pretty?: boolean | null | undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        object_gid: z.ZodString;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        offset: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        opt_fields: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        object_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
    }, {
        object_gid: string;
        opt_fields?: string | null | undefined;
        limit?: number | null | undefined;
        offset?: string | null | undefined;
    }>;
})[];
export declare function createToolHandler(client: AsanaClientWrapper): (request: {
    name: string;
    arguments?: any;
}) => Promise<any>;
