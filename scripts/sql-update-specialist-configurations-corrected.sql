-- Phase 2.1: Specialist Configuration Update SQL (CORRECTED)
-- Execute this in Supabase SQL Editor to complete specialist tool configurations
-- Generated: 2025-01-29 - Matches actual system tool names

-- First, let's see current configurations
SELECT name, jsonb_array_length(default_tools) as current_tool_count FROM specialists ORDER BY name;

-- Update echo-tango-specialist with comprehensive MCP tools (48 tools total)
-- Keep existing working tools + add missing MCP tools
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

-- Update General Chat with essential tools (25 tools)
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
  "asana_create_task",
  "asana_list_workspaces",
  "asana_list_projects",
  "asana_get_user_info"
]'::jsonb
WHERE name = 'General Chat';

-- Update Test specialist with basic tools (12 tools) 
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
  "asana_list_tasks",
  "asana_get_task_details",
  "asana_get_user_info"
]'::jsonb
WHERE name = 'Test';

-- Verification query - run this after updates
SELECT 
  name,
  jsonb_array_length(default_tools) as tool_count,
  CASE 
    WHEN name = 'Echo Tango' AND jsonb_array_length(default_tools) = 48 THEN '✅ COMPLETE'
    WHEN name = 'General Chat' AND jsonb_array_length(default_tools) = 25 THEN '✅ COMPLETE'  
    WHEN name = 'Test' AND jsonb_array_length(default_tools) = 12 THEN '✅ COMPLETE'
    ELSE '❌ NEEDS_UPDATE'
  END as status
FROM specialists 
ORDER BY name;

-- Expected results after update:
-- Echo Tango: 48 tools ✅ COMPLETE
-- General Chat: 25 tools ✅ COMPLETE
-- Test: 12 tools ✅ COMPLETE 