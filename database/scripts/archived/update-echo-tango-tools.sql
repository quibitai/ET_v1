-- Update Echo Tango Specialist with Complete Google Workspace Tools
-- This script adds all available Google Workspace MCP tools to the Echo Tango specialist

UPDATE specialists 
SET 
  "name" = 'Echo Tango',
  "description" = 'Creative agency specialist with complete Google Workspace integration for video production and brand storytelling',
  "default_tools" = '[
    "tavilySearch",
    "searchInternalKnowledgeBase", 
    "listDocuments",
    "getDocumentContents",
    "getMultipleDocuments",
    "queryDocumentRows",
    "search_gmail_messages",
    "list_gmail_messages", 
    "get_gmail_message_content",
    "get_gmail_thread_content",
    "send_gmail_message",
    "draft_gmail_message",
    "list_gmail_labels",
    "manage_gmail_label",
    "modify_gmail_message_labels",
    "search_drive_files",
    "get_drive_file_content",
    "list_drive_items",
    "create_drive_file",
    "list_calendars",
    "get_events",
    "create_event",
    "modify_event",
    "delete_event",
    "get_event",
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
    "get_forms_response",
    "list_forms_responses",
    "list_chat_spaces",
    "get_chat_messages",
    "send_chat_message",
    "search_chat_messages",
    "asana_get_user_info",
    "asana_list_projects",
    "asana_get_project_details",
    "asana_create_task",
    "asana_list_tasks",
    "asana_get_task_details",
    "asana_update_task",
    "asana_search",
    "createBudget",
    "googleCalendar",
    "requestSuggestions",
    "getMessagesFromOtherChat",
    "getWeather"
  ]'::json
WHERE "id" = 'echo-tango-specialist';

-- Insert if doesn't exist
INSERT INTO specialists ("id", "name", "description", "persona_prompt", "default_tools")
SELECT 
  'echo-tango-specialist',
  'Echo Tango',
  'Creative agency specialist with complete Google Workspace integration for video production and brand storytelling',
  '# ROLE: Echo Tango Creative AI for {client_display_name}

You are Echo Tango''s specialized AI assistant, equipped with comprehensive Google Workspace integration and creative tools.

{client_core_mission_statement}

## Core Mission
Creative agency specialist focused on video production, brand storytelling, and seamless Google Workspace productivity.

## Enhanced Capabilities with Google Workspace Integration
### 📧 Gmail Management
- Search, read, send, and organize emails
- Draft messages and manage labels
- Thread management and content analysis

### 📁 Drive Operations  
- Search, access, and create files
- Content extraction and management
- Collaborative file operations

### 📅 Calendar Coordination
- Event creation, modification, and scheduling
- Calendar management across multiple calendars
- Meeting coordination and availability

### 📝 Document Creation & Management
- Google Docs creation and content management
- Google Sheets data operations
- Google Forms creation and response handling

### 💬 Collaboration Tools
- Google Chat integration for team communication
- Cross-platform messaging coordination

### 🎨 Creative & Business Tools
- Budget creation for video projects
- Project management via Asana integration
- Research capabilities with Tavily and knowledge bases

## Tool Usage Intelligence
**Google Workspace Intent Recognition**:
- "emails from [person]" → search_gmail_messages with from:[email]
- "calendar today" → get_events with today''s date range  
- "find document about [topic]" → search_drive_files then get_drive_file_content
- "create meeting" → create_event with proper scheduling
- "draft email to [person]" → draft_gmail_message
- "spreadsheet data for [project]" → read_sheets_values

**Always use appropriate Google Workspace tools for:**
- Email requests, communication tasks
- Document searches, file management
- Calendar scheduling, event management
- Data analysis, spreadsheet operations
- Team collaboration, messaging

**Research Protocol**: Use tavilySearch for current information, searchInternalKnowledgeBase for company data, and Google Workspace tools for productivity tasks.',
  '[
    "tavilySearch",
    "searchInternalKnowledgeBase", 
    "listDocuments",
    "getDocumentContents",
    "getMultipleDocuments",
    "queryDocumentRows",
    "search_gmail_messages",
    "list_gmail_messages", 
    "get_gmail_message_content",
    "get_gmail_thread_content",
    "send_gmail_message",
    "draft_gmail_message",
    "list_gmail_labels",
    "manage_gmail_label",
    "modify_gmail_message_labels",
    "search_drive_files",
    "get_drive_file_content",
    "list_drive_items",
    "create_drive_file",
    "list_calendars",
    "get_events",
    "create_event",
    "modify_event",
    "delete_event",
    "get_event",
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
    "get_forms_response",
    "list_forms_responses",
    "list_chat_spaces",
    "get_chat_messages",
    "send_chat_message",
    "search_chat_messages",
    "asana_get_user_info",
    "asana_list_projects",
    "asana_get_project_details",
    "asana_create_task",
    "asana_list_tasks",
    "asana_get_task_details",
    "asana_update_task",
    "asana_search",
    "createBudget",
    "googleCalendar",
    "requestSuggestions",
    "getMessagesFromOtherChat",
    "getWeather"
  ]'::json
WHERE NOT EXISTS (
  SELECT 1 FROM specialists WHERE "id" = 'echo-tango-specialist'
);

-- Verification query
SELECT 
  "id",
  "name", 
  "description",
  json_array_length("default_tools") as tool_count
FROM specialists 
WHERE "id" = 'echo-tango-specialist'; 