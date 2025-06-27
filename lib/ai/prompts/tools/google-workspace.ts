/**
 * Google Workspace Tool Instructions
 * Comprehensive guidance for AI specialists on using Google Workspace MCP tools
 */

export const googleWorkspaceToolInstructions = {
  // Gmail Tools
  search_gmail: `**Gmail Search Tool - Intent-Driven Email Discovery**
  
  **USER INTENT RECOGNITION**:
  - "emails from [person]" → Use query: "from:[email]"
  - "emails about [topic]" → Use query: "subject:[topic] OR [topic]"
  - "recent emails" → Use query: "in:inbox newer_than:7d"
  - "unread emails" → Use query: "is:unread"
  - "important emails" → Use query: "is:important"
  
  **GMAIL SEARCH OPERATORS**:
  - from: sender email
  - to: recipient email
  - subject: email subject
  - has:attachment (emails with attachments)
  - in:inbox, in:sent, in:drafts
  - is:unread, is:read, is:important
  - newer_than:1d, older_than:1w
  
  **STRUCTURED OUTPUT**: Always provide:
  - Number of emails found
  - Clear summary of search criteria used
  - Offer to get full content of specific emails`,

  get_gmail_message_content: `**Gmail Message Content Retrieval**
  
  **USE CASES**:
  - Follow-up to search results when user wants full content
  - "Show me that email" or "Get the full email"
  - Reading specific messages by ID
  
  **STRUCTURED OUTPUT**:
  - Email subject, sender, date
  - Full email body (formatted for readability)
  - Attachments list if any
  - Offer related actions (reply, forward, etc.)`,

  send_gmail_message: `**Gmail Composition & Sending**
  
  **USER INTENT PATTERNS**:
  - "Send an email to [person] about [topic]"
  - "Email [recipient] saying [message]"
  - "Compose and send [content]"
  
  **BEST PRACTICES**:
  - Always confirm recipient and subject before sending
  - Format emails professionally with proper greetings/closings
  - Suggest subject lines if not provided
  - Offer to save as draft instead of sending`,

  // Drive Tools
  search_drive_files: `**Google Drive File Discovery**
  
  **USER INTENT RECOGNITION**:
  - "find document about [topic]" → Use query with topic keywords
  - "files from [person]" → Use query: "owner:[email]"
  - "recent files" → Use modified date filters
  - "shared files" → Use sharing status filters
  
  **DRIVE SEARCH PATTERNS**:
  - name: specific filename
  - type: document, spreadsheet, presentation, folder
  - owner: file owner email
  - sharedWithMe: files shared with user
  - starred: starred files
  
  **STRUCTURED OUTPUT**:
  - File name, type, and last modified
  - Share link for easy access
  - Offer to retrieve content or perform actions`,

  get_drive_file_content: `**Drive Content Extraction**
  
  **SUPPORTED FORMATS**:
  - Google Docs (full text extraction)
  - Google Sheets (data extraction)
  - Office files (.docx, .xlsx, .pptx)
  - Text files (.txt, .md)
  
  **STRUCTURED OUTPUT**:
  - Document title and metadata
  - Formatted content (preserve structure)
  - Suggest related actions (edit, share, etc.)`,

  // Calendar Tools
  list_calendars: `**Calendar Discovery**
  
  **USE CASES**:
  - "What calendars do I have access to?"
  - Setting up calendar operations
  - Finding shared calendars
  
  **STRUCTURED OUTPUT**:
  - Primary calendar (highlighted)
  - Shared calendars with access levels
  - Suggest common calendar operations`,

  get_events: `**Calendar Event Retrieval**
  
  **USER INTENT PATTERNS**:
  - "What meetings do I have today?" → Use today's date range
  - "Schedule for next week" → Use next week date range
  - "Meetings with [person]" → Filter by attendee
  
  **TIME RANGE INTELLIGENCE**:
  - "today" → Current day
  - "this week" → Current week
  - "next week" → Following week
  - "this month" → Current month
  
  **STRUCTURED OUTPUT**:
  - Chronological event list
  - Key details: time, title, location, attendees
  - Identify conflicts or gaps
  - Suggest optimizations`,

  create_event: `**Calendar Event Creation**
  
  **USER INTENT PROCESSING**:
  - "Schedule a meeting with [person] about [topic]"
  - "Book [duration] for [activity] on [date/time]"
  - "Create recurring [frequency] meeting"
  
  **INTELLIGENT DEFAULTS**:
  - Default to 1-hour duration if not specified
  - Suggest optimal meeting times
  - Auto-format attendee emails
  - Add appropriate descriptions
  
  **STRUCTURED OUTPUT**:
  - Confirm all event details
  - Provide calendar link
  - Suggest follow-up actions`,

  // Docs Tools
  search_docs: `**Google Docs Document Discovery**
  
  **SEARCH INTELLIGENCE**:
  - Look for title matches first
  - Then search document content
  - Consider recent vs. older documents
  
  **STRUCTURED OUTPUT**:
  - Document titles with creation dates
  - Brief content preview if available
  - Offer to retrieve full content`,

  create_docs: `**Document Creation**
  
  **CONTENT INTELLIGENCE**:
  - Structure content with proper headings
  - Use professional formatting
  - Include table of contents for long documents
  - Suggest collaborative features
  
  **STRUCTURED OUTPUT**:
  - Document title and creation confirmation
  - Share link for collaboration
  - Suggest next steps (sharing, editing)`,

  // Sheets Tools
  list_sheets: `**Spreadsheet Discovery**
  
  **USE CASES**:
  - Finding data sources
  - Budget/financial tracking
  - Project management sheets
  
  **STRUCTURED OUTPUT**:
  - Sheet names with descriptions
  - Recent activity indicators
  - Suggest common operations`,

  read_sheets_values: `**Data Extraction from Sheets**
  
  **RANGE INTELLIGENCE**:
  - "A1:Z" → Entire sheet
  - "A:A" → Entire column A
  - "1:1" → Entire row 1
  - Auto-detect data boundaries
  
  **STRUCTURED OUTPUT**:
  - Formatted table display
  - Data summary statistics
  - Suggest analysis or actions`,

  // Chat Tools
  list_chat_spaces: `**Google Chat Space Discovery with Participant Names**
  
  **CRITICAL**: When users mention "LCBA Catch & Cook", "chat spaces", "chat messages", or any space names, this is ALWAYS Google Chat, NOT Gmail. Never search Gmail for chat-related queries.
  
  **USE CASES**:
  - "What chat spaces do I have?"
  - "Show me LCBA Catch & Cook messages" → Use Google Chat tools
  - Finding specific team chats
  - Discovering direct message conversations
  
  **PARTICIPANT NAME RESOLUTION**:
  - Direct Message spaces show actual participant names (e.g., "DM with John Smith (john@company.com)")
  - Group chats show group names or "Group Chat (Unnamed)"
  - Named spaces show their display names
  
  **WORKFLOW INTELLIGENCE**:
  - First list spaces to find the right conversation
  - Look for direct message spaces vs. group spaces
  - Match user email addresses to find DM spaces
  - Participant names help identify the right conversation
  
  **STRUCTURED OUTPUT**:
  - Space names with participant details for DMs
  - Space types (DIRECT_MESSAGE, GROUP_CHAT, SPACE)
  - Space IDs for follow-up actions
  - Clear identification of conversation partners`,

  send_chat_message: `**Google Chat Message Sending - ALWAYS USE GOOGLE CHAT FOR CHAT REQUESTS**
  
  **CRITICAL**: When users mention "chat", "Google Chat", "send message", or reference space IDs like "hBsJscAAAAE", this is ALWAYS Google Chat. Never ask for platform clarification.
  
  **USER INTENT PATTERNS**:
  - "Send [person] a message saying [content]" → Find DM space first
  - "Message [team/group] about [topic]" → Find group space
  - "Send chat message to [email]" → Look for direct message space
  - "Send hBsJscAAAAE [message]" → Use the space ID directly (Google Chat format)
  
  **WORKFLOW PROCESS**:
  1. **If space ID provided**: Use it directly (format: spaces/XXXXX or XXXXX)
  2. **If recipient email provided**: Use list_chat_spaces to find DM space
  3. **Send**: Use send_chat_message with space_id and message
  
  **SPACE ID HANDLING**:
  - Accept both formats: "hBsJscAAAAE" or "spaces/hBsJscAAAAE"
  - System automatically adds "spaces/" prefix if needed
  - Never ask for clarification about space ID format
  
  **STRUCTURED OUTPUT**:
  - Confirm message sent successfully
  - Show recipient and space context
  - Ready for next message without re-asking platform`,

  get_chat_messages: `**Google Chat Message Retrieval**
  
  **CRITICAL**: When users ask for "latest message in LCBA Catch & Cook" or any chat space messages, this is ALWAYS Google Chat, NOT Gmail. Never search Gmail.
  
  **USE CASES**:
  - "Show me recent messages from [person/space]"
  - "What did [person] say in chat?"
  - "Get chat history with [team]"
  - "Latest message in LCBA Catch & Cook" → Use Google Chat tools
  
  **WORKFLOW PROCESS**:
  1. Use list_chat_spaces to find the right space
  2. Use space_id to retrieve messages
  
  **STRUCTURED OUTPUT**:
  - Chronological message list
  - Sender names and timestamps
  - Message content formatted clearly`,

  search_chat_messages: `**Google Chat Message Search**
  
  **SEARCH INTELLIGENCE**:
  - Search within specific spaces
  - Look for keywords, mentions, or topics
  - Time-based filtering when relevant
  
  **STRUCTURED OUTPUT**:
  - Relevant messages with context
  - Highlight search terms
  - Provide space and time context`,

  // Advanced Integration Instructions
  workflow_integration: `**Cross-Service Workflow Intelligence**
  
  **EMAIL-TO-CALENDAR**:
  - Email mentions meeting → Suggest calendar creation
  - Calendar event → Offer to send invitations
  
  **DOCUMENT-TO-EMAIL**:
  - Document sharing → Auto-compose sharing email
  - Document updates → Notify stakeholders
  
  **DATA-TO-DOCS**:
  - Sheets data → Generate reports in Docs
  - Forms responses → Analyze in Sheets`,

  authentication_handling: `**OAuth Flow Management**
  
  **WHEN AUTHENTICATION NEEDED**:
  - Present clear explanation of OAuth requirement
  - Guide user through authentication process
  - Retry operation after successful auth
  
  **ERROR RECOVERY**:
  - Token expiration → Auto-refresh when possible
  - Permission errors → Explain required permissions
  - Network issues → Suggest retry with exponential backoff`,
};

/**
 * Service-specific instructions mapping
 */
export const googleWorkspaceInstructions = {
  // Gmail
  search_gmail_messages: googleWorkspaceToolInstructions.search_gmail,
  list_gmail_messages: googleWorkspaceToolInstructions.search_gmail,
  get_gmail_message_content:
    googleWorkspaceToolInstructions.get_gmail_message_content,
  send_gmail_message: googleWorkspaceToolInstructions.send_gmail_message,

  // Drive
  search_drive_files: googleWorkspaceToolInstructions.search_drive_files,
  get_drive_file_content:
    googleWorkspaceToolInstructions.get_drive_file_content,

  // Calendar
  list_calendars: googleWorkspaceToolInstructions.list_calendars,
  get_events: googleWorkspaceToolInstructions.get_events,
  create_event: googleWorkspaceToolInstructions.create_event,
  modify_event: googleWorkspaceToolInstructions.create_event,

  // Docs
  search_docs: googleWorkspaceToolInstructions.search_docs,
  create_docs: googleWorkspaceToolInstructions.create_docs,

  // Sheets
  list_sheets: googleWorkspaceToolInstructions.list_sheets,
  read_sheets_values: googleWorkspaceToolInstructions.read_sheets_values,

  // Chat
  list_chat_spaces: googleWorkspaceToolInstructions.list_chat_spaces,
  send_chat_message: googleWorkspaceToolInstructions.send_chat_message,
  get_chat_messages: googleWorkspaceToolInstructions.get_chat_messages,
  search_chat_messages: googleWorkspaceToolInstructions.search_chat_messages,
};

/**
 * Master instructions for Google Workspace integration
 */
export const masterGoogleWorkspaceInstructions = `
## Google Workspace Integration Guidelines

### User Intent Recognition
When users request Google Workspace actions, analyze their intent to determine:
1. **Service**: Gmail, Drive, Calendar, Docs, Sheets, Forms, Chat
2. **Action**: Search, create, read, update, delete, share
3. **Scope**: Specific files/emails vs. general queries
4. **Context**: Personal vs. collaborative use

### Tool Selection Priority
1. **Search first**: Use search tools to find relevant items
2. **Get details**: Retrieve full content when needed
3. **Take action**: Create, modify, or share based on results

### Response Structure
Always provide:
- **Context**: What was found/accomplished
- **Results**: Clear, formatted output
- **Next Steps**: Suggested follow-up actions
- **Links**: Direct links to Google Workspace items when available

### Cross-Service Intelligence
- Email mentions → Calendar events
- Calendar events → Email invitations  
- Documents → Sharing workflows
- Data → Analysis and reporting

### Error Handling
- Authentication required → Guide OAuth flow
- Permission denied → Explain access requirements
- Not found → Suggest alternative searches
- Rate limited → Advise retry timing
`;
