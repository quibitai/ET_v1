-- Phase 2.1: Specialist Configuration Update SQL
-- Execute this in Supabase SQL Editor to complete specialist tool configurations
-- Generated: 2025-01-29

-- Update echo-tango-specialist with full Google Workspace + Asana MCP tools (38 tools total)
UPDATE specialists 
SET default_tools = '[
  "tavilySearch",
  "tavilyExtract", 
  "searchInternalKnowledgeBase",
  "listDocuments",
  "getFileContents",
  "getDocumentContents",
  "search_gmail_messages",
  "list_gmail_messages",
  "send_gmail_message",
  "get_gmail_message_content",
  "get_gmail_thread_content",
  "search_drive_files",
  "list_drive_items",
  "create_drive_file",
  "get_drive_file_content",
  "list_calendars",
  "get_events",
  "create_event",
  "modify_calendar_event",
  "delete_calendar_event",
  "search_docs",
  "get_docs_content",
  "create_docs",
  "list_docs",
  "list_sheets",
  "get_sheets_info",
  "read_sheets_values",
  "modify_sheets_values",
  "create_sheets",
  "create_forms",
  "get_forms",
  "list_chat_spaces",
  "get_chat_messages",
  "send_chat_message",
  "asana_get_user_info",
  "asana_list_workspaces",
  "asana_list_projects",
  "asana_get_project_details",
  "asana_search_projects",
  "asana_list_tasks",
  "asana_search_tasks",
  "asana_get_task_details",
  "asana_create_task",
  "asana_update_task",
  "asana_delete_task",
  "asana_add_task_comment",
  "asana_list_task_comments",
  "asana_create_project"
]'::jsonb
WHERE name = 'Echo Tango';

-- Update chat-model (General Chat) with essential tools (22 tools)
UPDATE specialists 
SET default_tools = '[
  "tavilySearch",
  "searchInternalKnowledgeBase", 
  "listDocuments",
  "getFileContents",
  "getDocumentContents",
  "search_gmail_messages",
  "list_gmail_messages",
  "send_gmail_message",
  "get_gmail_message_content",
  "search_drive_files",
  "list_drive_items",
  "get_drive_file_content",
  "list_calendars",
  "get_events",
  "create_event",
  "search_docs",
  "get_docs_content",
  "list_sheets",
  "read_sheets_values",
  "asana_list_tasks",
  "asana_get_task_details",
  "asana_create_task"
]'::jsonb
WHERE name = 'General Chat';

-- Update test-model with basic tool set (10 tools)
UPDATE specialists 
SET default_tools = '[
  "tavilySearch",
  "searchInternalKnowledgeBase",
  "listDocuments", 
  "getFileContents",
  "getDocumentContents",
  "list_gmail_messages",
  "get_gmail_message_content",
  "list_drive_items",
  "get_events",
  "asana_list_tasks"
]'::jsonb
WHERE name = 'Test';

-- Verification query - run this after the updates to confirm
SELECT 
  name,
  jsonb_array_length(default_tools) as tool_count,
  default_tools
FROM specialists 
ORDER BY name;

-- Expected results:
-- Echo Tango: 48 tools
-- General Chat: 22 tools  
-- Test: 10 tools 