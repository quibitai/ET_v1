/**
 * Google Workspace Tool Adapter
 *
 * Provides Google Workspace tools (Gmail, Drive, Calendar) through the unified tool registry.
 * Handles OAuth authentication and integrates with the Google Workspace MCP client.
 */

import type { Tool, ToolContext, ToolResult } from '../registry/types';
import { ToolCategory } from '../registry/types';
import { GoogleWorkspaceMCPClient } from '@/lib/ai/mcp/GoogleWorkspaceMCPClient';
import { GoogleWorkspaceOAuthBridge } from '../../../services/googleWorkspaceOAuthBridge';

export class GoogleWorkspaceToolAdapter {
  private tools: Tool[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(
      '[GoogleWorkspaceAdapter] Initializing Google Workspace tools...',
    );

    try {
      // Create all Google Workspace tools
      this.tools = [
        // Gmail Tools
        this.createGmailSearchTool(),
        this.createGmailListTool(),
        this.createGmailSendTool(),
        this.createGmailGetMessageContentTool(),
        this.createGmailGetThreadContentTool(),
        this.createGmailListLabelsTool(),
        this.createGmailManageLabelTool(),

        // Drive Tools
        this.createDriveSearchTool(),
        this.createDriveListTool(),
        this.createDriveUploadTool(),
        this.createDriveGetContentTool(),

        // Calendar Tools
        this.createCalendarListTool(),
        this.createCalendarEventsTool(),
        this.createCalendarCreateEventTool(),
        this.createCalendarModifyEventTool(),
        this.createCalendarDeleteEventTool(),
        this.createCalendarGetEventTool(),

        // Docs Tools
        this.createDocsSearchTool(),
        this.createDocsGetContentTool(),
        this.createDocsCreateTool(),
        this.createDocsListTool(),

        // Sheets Tools
        this.createSheetsListTool(),
        this.createSheetsGetInfoTool(),
        this.createSheetsReadValuesTool(),
        this.createSheetsModifyValuesTool(),
        this.createSheetsCreateTool(),

        // Forms Tools
        this.createFormsCreateTool(),
        this.createFormsGetTool(),
        this.createFormsGetResponseTool(),
        this.createFormsListResponsesTool(),

        // Chat Tools
        this.createChatListSpacesTool(),
        this.createChatGetMessagesTool(),
        this.createChatSendMessageTool(),
        this.createChatSearchMessagesTool(),
        this.createChatGetParticipantsTool(),
      ];

      this.initialized = true;
      console.log(
        `[GoogleWorkspaceAdapter] Initialized ${this.tools.length} Google Workspace tools`,
      );
    } catch (error) {
      console.error('[GoogleWorkspaceAdapter] Failed to initialize:', error);
      throw error;
    }
  }

  getTools(): Tool[] {
    return this.tools;
  }

  private createClient(
    options: { userEmail?: string } = {},
  ): GoogleWorkspaceMCPClient {
    return new GoogleWorkspaceMCPClient({
      serverUrl: 'http://127.0.0.1:8000',
      userEmail: options.userEmail,
    });
  }

  /**
   * Create authenticated client using OAuth bridge
   */
  private async createAuthenticatedClient(
    context: ToolContext,
  ): Promise<GoogleWorkspaceMCPClient> {
    if (!context.user?.email) {
      throw new Error(
        'User email is required for Google Workspace authentication',
      );
    }

    const oauthBridge = GoogleWorkspaceOAuthBridge.getInstance();
    return await oauthBridge.createAuthenticatedClient(context.user.email);
  }

  // Gmail Tools
  private createGmailSearchTool(): Tool {
    return {
      name: 'search_gmail_messages',
      displayName: 'Search Gmail Messages',
      description: 'Search Gmail messages using query terms',
      usage: 'Use when user wants to search for specific emails',
      examples: [
        'search my emails for',
        'find emails from',
        'look for messages about',
        'search gmail for',
      ],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description:
            'Gmail search query (e.g., "from:john", "subject:meeting")',
          required: true,
        },
        {
          name: 'page_size',
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
          default: 10,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Gmail search');
          }

          // Execute Gmail tool - let MCP server handle OAuth flow
          const result = await client.executeGmailTool(
            'search_gmail_messages',
            {
              query: params.query,
              page_size: params.page_size || 10,
              user_google_email: context.user.email,
            },
          );

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'search_gmail_messages',
              },
            };
          } else {
            // Return the error message from MCP server (which should include OAuth URL)
            return {
              success: false,
              error: result.error || 'Gmail search failed',
              metadata: {
                toolName: 'search_gmail_messages',
              },
            };
          }
        } catch (error: any) {
          // If it's a connection error, provide helpful message
          if (error.message?.includes('ECONNREFUSED')) {
            return {
              success: false,
              error:
                'Unable to connect to Google Workspace service. Please ensure the service is running.',
              metadata: {
                toolName: 'search_gmail_messages',
              },
            };
          }

          return {
            success: false,
            error: error.message || 'Gmail search failed',
            metadata: {
              toolName: 'search_gmail_messages',
            },
          };
        }
      },
    };
  }

  private createGmailListTool(): Tool {
    return {
      name: 'list_gmail_messages',
      displayName: 'List Gmail Messages',
      description: 'List recent Gmail messages',
      usage: 'Use when user wants to see recent emails',
      examples: ['show my recent emails', 'list my messages'],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'page_size',
          type: 'number',
          description: 'Maximum number of messages to return',
          required: false,
          default: 10,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Gmail access');
          }

          // Use search with empty query to get recent messages
          const result = await client.executeGmailTool(
            'search_gmail_messages',
            {
              query: 'in:inbox',
              page_size: params.page_size || 10,
              user_google_email: context.user.email,
            },
          );

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'list_gmail_messages',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to list Gmail messages',
              metadata: {
                toolName: 'list_gmail_messages',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list Gmail messages',
            metadata: {
              toolName: 'list_gmail_messages',
            },
          };
        }
      },
    };
  }

  private createGmailSendTool(): Tool {
    return {
      name: 'send_gmail_message',
      displayName: 'Send Gmail Message',
      description: 'Send an email message through Gmail',
      usage: 'Use when user wants to send an email',
      examples: ['send email to', 'compose and send message'],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'to',
          type: 'string',
          description: 'Recipient email address',
          required: true,
        },
        {
          name: 'subject',
          type: 'string',
          description: 'Email subject',
          required: true,
        },
        {
          name: 'body',
          type: 'string',
          description: 'Email body content (plain text)',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error(
              'User email is required for sending Gmail messages',
            );
          }

          const result = await client.executeGmailTool('send_gmail_message', {
            to: params.to,
            subject: params.subject,
            body: params.body,
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'send_gmail_message',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to send Gmail message',
              metadata: {
                toolName: 'send_gmail_message',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to send Gmail message',
            metadata: {
              toolName: 'send_gmail_message',
            },
          };
        }
      },
    };
  }

  // Drive Tools
  private createDriveSearchTool(): Tool {
    return {
      name: 'search_drive_files',
      displayName: 'Search Drive Files',
      description: 'Search for files and folders in Google Drive',
      usage: 'Use when user wants to find specific files in Drive',
      examples: [
        'find document about',
        'search for file named',
        'look for spreadsheet',
      ],
      category: ToolCategory.FILES,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description:
            'Search query for Drive files (supports Drive search operators)',
          required: true,
        },
        {
          name: 'page_size',
          type: 'number',
          description: 'Maximum number of files to return',
          required: false,
          default: 10,
        },
        {
          name: 'drive_id',
          type: 'string',
          description: 'Optional shared drive ID to search in',
          required: false,
        },
        {
          name: 'include_items_from_all_drives',
          type: 'boolean',
          description: 'Whether to include items from all drives',
          required: false,
          default: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Drive search');
          }

          const result = await client.executeDriveTool('search_drive_files', {
            query: params.query,
            page_size: params.page_size || 10,
            drive_id: params.drive_id,
            include_items_from_all_drives:
              params.include_items_from_all_drives ?? true,
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'search_drive_files',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Drive search failed',
              metadata: {
                toolName: 'search_drive_files',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Drive search failed',
            metadata: {
              toolName: 'search_drive_files',
            },
          };
        }
      },
    };
  }

  private createDriveListTool(): Tool {
    return {
      name: 'list_drive_items',
      displayName: 'List Drive Items',
      description: 'List files and folders in a Google Drive folder',
      usage: 'Use when user wants to browse Drive folder contents',
      examples: ['list files in folder', 'show folder contents'],
      category: ToolCategory.FILES,
      parameters: [
        {
          name: 'folder_id',
          type: 'string',
          description: 'Folder ID to list contents of (default: root)',
          required: false,
          default: 'root',
        },
        {
          name: 'page_size',
          type: 'number',
          description: 'Maximum number of items to return',
          required: false,
          default: 100,
        },
        {
          name: 'drive_id',
          type: 'string',
          description: 'Optional shared drive ID',
          required: false,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Drive access');
          }

          const result = await client.executeDriveTool('list_drive_items', {
            folder_id: params.folder_id || 'root',
            page_size: params.page_size || 100,
            drive_id: params.drive_id,
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'list_drive_items',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to list Drive items',
              metadata: {
                toolName: 'list_drive_items',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list Drive items',
            metadata: {
              toolName: 'list_drive_items',
            },
          };
        }
      },
    };
  }

  private createDriveUploadTool(): Tool {
    return {
      name: 'create_drive_file',
      displayName: 'Create Drive File',
      description: 'Create a new file in Google Drive',
      usage: 'Use when user wants to create a new file in Drive',
      examples: ['create document', 'upload file to Drive'],
      category: ToolCategory.FILES,
      parameters: [
        {
          name: 'file_name',
          type: 'string',
          description: 'Name for the new file',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Content for the file (optional)',
          required: false,
        },
        {
          name: 'folder_id',
          type: 'string',
          description: 'Folder ID to create file in (default: root)',
          required: false,
          default: 'root',
        },
        {
          name: 'mime_type',
          type: 'string',
          description: 'MIME type of the file (default: text/plain)',
          required: false,
          default: 'text/plain',
        },
        {
          name: 'fileUrl',
          type: 'string',
          description: 'Optional URL to fetch content from',
          required: false,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Drive file creation');
          }

          const result = await client.executeDriveTool('create_drive_file', {
            file_name: params.file_name,
            content: params.content,
            folder_id: params.folder_id || 'root',
            mime_type: params.mime_type || 'text/plain',
            fileUrl: params.fileUrl,
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'create_drive_file',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to create Drive file',
              metadata: {
                toolName: 'create_drive_file',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create Drive file',
            metadata: {
              toolName: 'create_drive_file',
            },
          };
        }
      },
    };
  }

  private createDriveGetContentTool(): Tool {
    return {
      name: 'get_drive_file_content',
      displayName: 'Get Drive File Content',
      description: 'Retrieve the content of a specific Google Drive file',
      usage: 'Use when user wants to read the contents of a Drive file',
      examples: [
        'read file content',
        'get document text',
        'show file contents',
      ],
      category: ToolCategory.FILES,
      parameters: [
        {
          name: 'file_id',
          type: 'string',
          description: 'Google Drive file ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });

          if (!context.user?.email) {
            throw new Error('User email is required for Drive file access');
          }

          const result = await client.executeDriveTool(
            'get_drive_file_content',
            {
              file_id: params.file_id,
              user_google_email: context.user.email,
            },
          );

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'get_drive_file_content',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to get Drive file content',
              metadata: {
                toolName: 'get_drive_file_content',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get Drive file content',
            metadata: {
              toolName: 'get_drive_file_content',
            },
          };
        }
      },
    };
  }

  // Calendar Tools
  private createCalendarListTool(): Tool {
    return {
      name: 'list_calendars',
      displayName: 'List Google Calendars',
      description: 'List available Google Calendars',
      usage: 'Use when user wants to see their calendars',
      examples: [
        'list my calendars',
        'show my google calendars',
        'what calendars do I have',
        'available calendars',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          if (!context.user?.email) {
            throw new Error('User email is required for calendar access');
          }

          const result = await client.executeCalendarTool('list_calendars', {
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'list_calendars',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to list calendars',
              metadata: {
                toolName: 'list_calendars',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list calendars',
            metadata: {
              toolName: 'list_calendars',
            },
          };
        }
      },
    };
  }

  private createCalendarEventsTool(): Tool {
    return {
      name: 'get_events',
      displayName: 'Get Calendar Events',
      description: 'Retrieve events from Google Calendar within a time range',
      usage: 'Use when user wants to see their calendar events or schedule',
      examples: [
        'show my calendar events',
        'what do I have today',
        'my schedule for',
        'calendar events',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [
        {
          name: 'calendar_id',
          type: 'string',
          description: 'Calendar ID (default: primary)',
          required: false,
          default: 'primary',
        },
        {
          name: 'time_min',
          type: 'string',
          description: 'Start time (ISO format)',
          required: false,
        },
        {
          name: 'time_max',
          type: 'string',
          description: 'End time (ISO format)',
          required: false,
        },
        {
          name: 'max_results',
          type: 'number',
          description: 'Maximum number of events',
          required: false,
          default: 10,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          if (!context.user?.email) {
            throw new Error('User email is required for calendar access');
          }

          const result = await client.executeCalendarTool('get_events', {
            calendar_id: params.calendar_id || 'primary',
            time_min: params.time_min,
            time_max: params.time_max,
            max_results: params.max_results || 25,
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'get_events',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to get calendar events',
              metadata: {
                toolName: 'get_events',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get calendar events',
            metadata: {
              toolName: 'get_events',
            },
          };
        }
      },
    };
  }

  private createCalendarCreateEventTool(): Tool {
    return {
      name: 'create_event',
      displayName: 'Create Calendar Event',
      description: 'Create a new event in Google Calendar',
      usage: 'Use when user wants to create or schedule an event',
      examples: [
        'create a meeting',
        'schedule an event',
        'add to my calendar',
        'create calendar event',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [
        {
          name: 'summary',
          type: 'string',
          description: 'Event title/summary',
          required: true,
        },
        {
          name: 'start_time',
          type: 'string',
          description: 'Start time (ISO format)',
          required: true,
        },
        {
          name: 'end_time',
          type: 'string',
          description: 'End time (ISO format)',
          required: true,
        },
        {
          name: 'description',
          type: 'string',
          description: 'Event description',
          required: false,
        },
        {
          name: 'location',
          type: 'string',
          description: 'Event location',
          required: false,
        },
        {
          name: 'calendar_id',
          type: 'string',
          description: 'Calendar ID (default: primary)',
          required: false,
          default: 'primary',
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          if (!context.user?.email) {
            throw new Error('User email is required for calendar access');
          }

          const result = await client.executeCalendarTool('create_event', {
            summary: params.summary,
            start_time: params.start_time,
            end_time: params.end_time,
            description: params.description,
            location: params.location,
            calendar_id: params.calendar_id || 'primary',
            user_google_email: context.user.email,
          });

          if (result.success) {
            return {
              success: true,
              data: result.result,
              metadata: {
                source: 'google-workspace',
                toolName: 'create_event',
              },
            };
          } else {
            return {
              success: false,
              error: result.error || 'Failed to create calendar event',
              metadata: {
                toolName: 'create_calendar_event',
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create calendar event',
            metadata: {
              toolName: 'create_calendar_event',
            },
          };
        }
      },
    };
  }

  private createCalendarModifyEventTool(): Tool {
    return {
      name: 'modify_calendar_event',
      displayName: 'Modify Calendar Event',
      description: 'Modify an existing event in Google Calendar',
      usage: 'Use when user wants to update an event in their calendar',
      examples: [
        'modify a meeting',
        'update an event',
        'edit calendar event',
        'modify calendar event',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [
        {
          name: 'event_id',
          type: 'string',
          description: 'Google Calendar event ID',
          required: true,
        },
        {
          name: 'summary',
          type: 'string',
          description: 'Event title/summary',
          required: false,
        },
        {
          name: 'start_time',
          type: 'string',
          description: 'Start time (ISO format)',
          required: false,
        },
        {
          name: 'end_time',
          type: 'string',
          description: 'End time (ISO format)',
          required: false,
        },
        {
          name: 'description',
          type: 'string',
          description: 'Event description',
          required: false,
        },
        {
          name: 'location',
          type: 'string',
          description: 'Event location',
          required: false,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeCalendarTool(
            'modify_calendar_event',
            {
              event_id: params.event_id,
              summary: params.summary,
              start_time: params.start_time,
              end_time: params.end_time,
              description: params.description,
              location: params.location,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'modify_calendar_event',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to modify calendar event',
            metadata: {
              toolName: 'modify_calendar_event',
            },
          };
        }
      },
    };
  }

  private createCalendarDeleteEventTool(): Tool {
    return {
      name: 'delete_calendar_event',
      displayName: 'Delete Calendar Event',
      description: 'Delete an event from Google Calendar',
      usage: 'Use when user wants to remove an event from their calendar',
      examples: [
        'delete a meeting',
        'remove an event',
        'cancel calendar event',
        'delete calendar event',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [
        {
          name: 'event_id',
          type: 'string',
          description: 'Google Calendar event ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeCalendarTool(
            'delete_calendar_event',
            {
              event_id: params.event_id,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'delete_calendar_event',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to delete calendar event',
            metadata: {
              toolName: 'delete_calendar_event',
            },
          };
        }
      },
    };
  }

  private createCalendarGetEventTool(): Tool {
    return {
      name: 'get_calendar_event',
      displayName: 'Get Calendar Event',
      description: 'Get details of a specific event in Google Calendar',
      usage:
        'Use when user wants to retrieve information about a calendar event',
      examples: [
        'get event details',
        'show event information',
        'get event info',
        'get calendar event',
      ],
      category: ToolCategory.CALENDAR,
      parameters: [
        {
          name: 'event_id',
          type: 'string',
          description: 'Google Calendar event ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeCalendarTool(
            'get_calendar_event',
            {
              event_id: params.event_id,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_calendar_event',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get calendar event',
            metadata: {
              toolName: 'get_calendar_event',
            },
          };
        }
      },
    };
  }

  // Docs Tools
  private createDocsSearchTool(): Tool {
    return {
      name: 'search_docs',
      displayName: 'Search Google Docs',
      description: 'Search for documents in Google Docs',
      usage: 'Use when user wants to search for documents in Docs',
      examples: [
        'search my docs for',
        'find documents named',
        'look for documents',
        'search google docs',
      ],
      category: ToolCategory.DOCS,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query for Docs documents',
          required: true,
        },
        {
          name: 'max_results',
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
          default: 10,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeDocsTool('search_docs', {
            query: params.query,
            page_size: params.max_results || 10,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'search_docs',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Docs search failed',
            metadata: {
              toolName: 'search_docs',
            },
          };
        }
      },
    };
  }

  private createDocsGetContentTool(): Tool {
    return {
      name: 'get_docs_content',
      displayName: 'Get Google Docs Content',
      description: 'Get the content of a Google Docs document',
      usage:
        'Use when user wants to retrieve the content of a document in Docs',
      examples: [
        'get content of',
        'retrieve document content',
        'show document content',
        'get docs content',
      ],
      category: ToolCategory.DOCS,
      parameters: [
        {
          name: 'document_id',
          type: 'string',
          description: 'Google Docs document ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeDocsTool('get_docs_content', {
            document_id: params.document_id,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_docs_content',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get document content',
            metadata: {
              toolName: 'get_docs_content',
            },
          };
        }
      },
    };
  }

  private createDocsCreateTool(): Tool {
    return {
      name: 'create_docs',
      displayName: 'Create Google Docs Document',
      description: 'Create a new document in Google Docs',
      usage: 'Use when user wants to create or write a document in Docs',
      examples: [
        'create a document',
        'write a document',
        'create docs document',
        'write docs document',
      ],
      category: ToolCategory.DOCS,
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Document title',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Document content',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeDocsTool('create_docs', {
            title: params.title,
            content: params.content,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'create_docs',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create document',
            metadata: {
              toolName: 'create_docs',
            },
          };
        }
      },
    };
  }

  private createDocsListTool(): Tool {
    return {
      name: 'list_docs',
      displayName: 'List Google Docs Documents',
      description: 'List recent documents in Google Docs',
      usage: 'Use when user wants to see their Docs documents',
      examples: [
        'list my docs',
        'show my google docs',
        'recent docs',
        'my documents in docs',
      ],
      category: ToolCategory.DOCS,
      parameters: [
        {
          name: 'max_results',
          type: 'number',
          description: 'Maximum number of documents to return',
          required: false,
          default: 10,
        },
        {
          name: 'folder_id',
          type: 'string',
          description: 'Folder ID to list documents from (default: root)',
          required: false,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeDocsTool('list_docs', {
            folder_id: params.folder_id || 'root',
            page_size: params.max_results || 10,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'list_docs',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list documents',
            metadata: {
              toolName: 'list_docs',
            },
          };
        }
      },
    };
  }

  // Sheets Tools
  private createSheetsListTool(): Tool {
    return {
      name: 'list_sheets',
      displayName: 'List Google Sheets',
      description: 'List available Google Sheets',
      usage: 'Use when user wants to see their Sheets',
      examples: [
        'list my sheets',
        'show my google sheets',
        'what sheets do I have',
        'available sheets',
      ],
      category: ToolCategory.SHEETS,
      parameters: [],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeSheetsTool('list_sheets', {});

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'list_sheets',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list sheets',
            metadata: {
              toolName: 'list_sheets',
            },
          };
        }
      },
    };
  }

  private createSheetsGetInfoTool(): Tool {
    return {
      name: 'get_sheets_info',
      displayName: 'Get Google Sheets Info',
      description: 'Get information about a Google Sheets spreadsheet',
      usage:
        'Use when user wants to retrieve information about a Sheets spreadsheet',
      examples: [
        'get sheets info',
        'show sheets info',
        'get sheets spreadsheet info',
        'sheets spreadsheet info',
      ],
      category: ToolCategory.SHEETS,
      parameters: [
        {
          name: 'spreadsheet_id',
          type: 'string',
          description: 'Google Sheets spreadsheet ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeSheetsTool('get_sheets_info', {
            spreadsheet_id: params.spreadsheet_id,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_sheets_info',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get sheets info',
            metadata: {
              toolName: 'get_sheets_info',
            },
          };
        }
      },
    };
  }

  private createSheetsReadValuesTool(): Tool {
    return {
      name: 'read_sheets_values',
      displayName: 'Read Google Sheets Values',
      description: 'Read values from a Google Sheets spreadsheet',
      usage: 'Use when user wants to retrieve data from a Sheets spreadsheet',
      examples: [
        'read sheets values',
        'get sheets values',
        'read sheets data',
        'sheets values',
      ],
      category: ToolCategory.SHEETS,
      parameters: [
        {
          name: 'spreadsheet_id',
          type: 'string',
          description: 'Google Sheets spreadsheet ID',
          required: true,
        },
        {
          name: 'range',
          type: 'string',
          description: 'Range of cells to read (e.g., "A1:C10")',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeSheetsTool('read_sheets_values', {
            spreadsheet_id: params.spreadsheet_id,
            range: params.range,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'read_sheets_values',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to read sheets values',
            metadata: {
              toolName: 'read_sheets_values',
            },
          };
        }
      },
    };
  }

  private createSheetsModifyValuesTool(): Tool {
    return {
      name: 'modify_sheets_values',
      displayName: 'Modify Google Sheets Values',
      description: 'Modify values in a Google Sheets spreadsheet',
      usage: 'Use when user wants to update data in a Sheets spreadsheet',
      examples: [
        'modify sheets values',
        'update sheets data',
        'modify sheets spreadsheet',
        'sheets spreadsheet modify',
      ],
      category: ToolCategory.SHEETS,
      parameters: [
        {
          name: 'spreadsheet_id',
          type: 'string',
          description: 'Google Sheets spreadsheet ID',
          required: true,
        },
        {
          name: 'range',
          type: 'string',
          description: 'Range of cells to modify (e.g., "A1:C10")',
          required: true,
        },
        {
          name: 'values',
          type: 'string',
          description: 'New values to set in the specified range',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeSheetsTool(
            'modify_sheets_values',
            {
              spreadsheet_id: params.spreadsheet_id,
              range: params.range,
              values: params.values,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'modify_sheets_values',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to modify sheets values',
            metadata: {
              toolName: 'modify_sheets_values',
            },
          };
        }
      },
    };
  }

  private createSheetsCreateTool(): Tool {
    return {
      name: 'create_sheets',
      displayName: 'Create Google Sheets Spreadsheet',
      description: 'Create a new Google Sheets spreadsheet',
      usage: 'Use when user wants to create a new Sheets spreadsheet',
      examples: [
        'create sheets spreadsheet',
        'new sheets spreadsheet',
        'sheets spreadsheet create',
        'sheets spreadsheet new',
      ],
      category: ToolCategory.SHEETS,
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Spreadsheet title',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeSheetsTool('create_sheets', {
            title: params.title,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'create_sheets',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create sheets spreadsheet',
            metadata: {
              toolName: 'create_sheets',
            },
          };
        }
      },
    };
  }

  // Forms Tools
  private createFormsCreateTool(): Tool {
    return {
      name: 'create_forms',
      displayName: 'Create Google Forms Survey',
      description: 'Create a new Google Forms survey',
      usage: 'Use when user wants to create a new Forms survey',
      examples: [
        'create forms survey',
        'new forms survey',
        'forms survey create',
        'forms survey new',
      ],
      category: ToolCategory.FORMS,
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Survey title',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeFormsTool('create_forms', {
            title: params.title,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'create_forms',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to create forms survey',
            metadata: {
              toolName: 'create_forms',
            },
          };
        }
      },
    };
  }

  private createFormsGetTool(): Tool {
    return {
      name: 'get_forms',
      displayName: 'Get Google Forms Survey',
      description: 'Get information about a Google Forms survey',
      usage: 'Use when user wants to retrieve information about a Forms survey',
      examples: [
        'get forms info',
        'show forms info',
        'forms survey info',
        'forms info',
      ],
      category: ToolCategory.FORMS,
      parameters: [
        {
          name: 'form_id',
          type: 'string',
          description: 'Google Forms survey ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeFormsTool('get_forms', {
            form_id: params.form_id,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_forms',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get forms info',
            metadata: {
              toolName: 'get_forms',
            },
          };
        }
      },
    };
  }

  private createFormsGetResponseTool(): Tool {
    return {
      name: 'get_forms_response',
      displayName: 'Get Google Forms Survey Response',
      description: 'Get a response from a Google Forms survey',
      usage: 'Use when user wants to retrieve a response from a Forms survey',
      examples: [
        'get forms response',
        'show forms response',
        'forms survey response',
        'forms response',
      ],
      category: ToolCategory.FORMS,
      parameters: [
        {
          name: 'form_id',
          type: 'string',
          description: 'Google Forms survey ID',
          required: true,
        },
        {
          name: 'response_id',
          type: 'string',
          description: 'Google Forms response ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeFormsTool('get_forms_response', {
            form_id: params.form_id,
            response_id: params.response_id,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_forms_response',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get forms response',
            metadata: {
              toolName: 'get_forms_response',
            },
          };
        }
      },
    };
  }

  private createFormsListResponsesTool(): Tool {
    return {
      name: 'list_forms_responses',
      displayName: 'List Google Forms Survey Responses',
      description: 'List responses from a Google Forms survey',
      usage: 'Use when user wants to see all responses to a Forms survey',
      examples: [
        'list forms responses',
        'show forms responses',
        'forms survey responses',
        'forms responses',
      ],
      category: ToolCategory.FORMS,
      parameters: [
        {
          name: 'form_id',
          type: 'string',
          description: 'Google Forms survey ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeFormsTool('list_forms_responses', {
            form_id: params.form_id,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'list_forms_responses',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list forms responses',
            metadata: {
              toolName: 'list_forms_responses',
            },
          };
        }
      },
    };
  }

  // Chat Tools
  private createChatListSpacesTool(): Tool {
    return {
      name: 'list_chat_spaces',
      displayName: 'List Google Chat Spaces',
      description: 'List available Google Chat spaces',
      usage: 'Use when user wants to see their Chat spaces',
      examples: [
        'list my chat spaces',
        'show my google chat spaces',
        'what chat spaces do I have',
        'available chat spaces',
      ],
      category: ToolCategory.CHAT,
      parameters: [],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeChatTool('list_spaces', {
            user_google_email: context.user?.email,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'list_chat_spaces',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list chat spaces',
            metadata: {
              toolName: 'list_chat_spaces',
            },
          };
        }
      },
    };
  }

  private createChatGetMessagesTool(): Tool {
    return {
      name: 'get_chat_messages',
      displayName: 'Get Google Chat Messages',
      description: 'Get messages from a Google Chat space',
      usage: 'Use when user wants to retrieve messages from a Chat space',
      examples: [
        'get chat messages',
        'show chat messages',
        'chat messages',
        'get chat space messages',
      ],
      category: ToolCategory.CHAT,
      parameters: [
        {
          name: 'space_id',
          type: 'string',
          description: 'Google Chat space ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeChatTool('get_messages', {
            space_id: params.space_id,
            user_google_email: context.user?.email,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_chat_messages',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get chat messages',
            metadata: {
              toolName: 'get_chat_messages',
            },
          };
        }
      },
    };
  }

  private createChatSendMessageTool(): Tool {
    return {
      name: 'send_chat_message',
      displayName: 'Send Google Chat Message',
      description: 'Send a message to a Google Chat space',
      usage: 'Use when user wants to send a message to a Chat space',
      examples: [
        'send chat message',
        'send a message to chat',
        'chat message send',
        'send chat space message',
      ],
      category: ToolCategory.CHAT,
      parameters: [
        {
          name: 'space_id',
          type: 'string',
          description: 'Google Chat space ID',
          required: true,
        },
        {
          name: 'message',
          type: 'string',
          description: 'Message content',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeChatTool('send_message', {
            space_id: params.space_id,
            message_text: params.message,
            user_google_email: context.user?.email,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'send_chat_message',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to send chat message',
            metadata: {
              toolName: 'send_chat_message',
            },
          };
        }
      },
    };
  }

  private createChatSearchMessagesTool(): Tool {
    return {
      name: 'search_chat_messages',
      displayName: 'Search Google Chat Messages',
      description: 'Search for messages in Google Chat',
      usage: 'Use when user wants to search for messages in a Chat space',
      examples: [
        'search chat messages',
        'search chat space messages',
        'chat messages search',
        'search chat space messages',
      ],
      category: ToolCategory.CHAT,
      parameters: [
        {
          name: 'space_id',
          type: 'string',
          description: 'Google Chat space ID',
          required: true,
        },
        {
          name: 'query',
          type: 'string',
          description: 'Search query for chat messages',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeChatTool('search_messages', {
            space_id: params.space_id,
            query: params.query,
            user_google_email: context.user?.email,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'search_chat_messages',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to search chat messages',
            metadata: {
              toolName: 'search_chat_messages',
            },
          };
        }
      },
    };
  }

  private createChatGetParticipantsTool(): Tool {
    return {
      name: 'get_chat_space_participants',
      displayName: 'Get Google Chat Space Participants',
      description: 'Get participants/members of a Google Chat space',
      usage: 'Use when user wants to see who is in a Chat space',
      examples: [
        'get chat space participants',
        'show chat space members',
        'who is in this chat space',
        'list chat space participants',
      ],
      category: ToolCategory.CHAT,
      parameters: [
        {
          name: 'space_id',
          type: 'string',
          description: 'Google Chat space ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeChatTool(
            'get_space_participants',
            {
              space_id: params.space_id,
              user_google_email: context.user?.email,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_chat_space_participants',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get chat space participants',
            metadata: {
              toolName: 'get_chat_space_participants',
            },
          };
        }
      },
    };
  }

  // Gmail Tools (expand)
  private createGmailGetMessageContentTool(): Tool {
    return {
      name: 'get_gmail_message_content',
      displayName: 'Get Gmail Message Content',
      description: 'Get the content of a Gmail message',
      usage: 'Use when user wants to retrieve the content of a Gmail message',
      examples: [
        'get gmail message content',
        'retrieve gmail message content',
        'show gmail message content',
        'gmail message content',
      ],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'message_id',
          type: 'string',
          description: 'Gmail message ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeGmailTool(
            'get_gmail_message_content',
            {
              message_id: params.message_id,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_gmail_message_content',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get Gmail message content',
            metadata: {
              toolName: 'get_gmail_message_content',
            },
          };
        }
      },
    };
  }

  private createGmailGetThreadContentTool(): Tool {
    return {
      name: 'get_gmail_thread_content',
      displayName: 'Get Gmail Thread Content',
      description: 'Get the content of a Gmail thread',
      usage: 'Use when user wants to retrieve the content of a Gmail thread',
      examples: [
        'get gmail thread content',
        'retrieve gmail thread content',
        'show gmail thread content',
        'gmail thread content',
      ],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'thread_id',
          type: 'string',
          description: 'Gmail thread ID',
          required: true,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeGmailTool(
            'get_gmail_thread_content',
            {
              thread_id: params.thread_id,
            },
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'get_gmail_thread_content',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to get Gmail thread content',
            metadata: {
              toolName: 'get_gmail_thread_content',
            },
          };
        }
      },
    };
  }

  private createGmailListLabelsTool(): Tool {
    return {
      name: 'list_gmail_labels',
      displayName: 'List Gmail Labels',
      description: 'List available Gmail labels',
      usage: 'Use when user wants to see their Gmail labels',
      examples: [
        'list my gmail labels',
        'show my google gmail labels',
        'what gmail labels do I have',
        'available gmail labels',
      ],
      category: ToolCategory.EMAIL,
      parameters: [],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeGmailTool('list_gmail_labels', {});

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'list_gmail_labels',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list Gmail labels',
            metadata: {
              toolName: 'list_gmail_labels',
            },
          };
        }
      },
    };
  }

  private createGmailManageLabelTool(): Tool {
    return {
      name: 'manage_gmail_label',
      displayName: 'Manage Gmail Label',
      description: 'Manage a Gmail label',
      usage: 'Use when user wants to create, rename, or delete a Gmail label',
      examples: [
        'manage gmail label',
        'create gmail label',
        'rename gmail label',
        'delete gmail label',
      ],
      category: ToolCategory.EMAIL,
      parameters: [
        {
          name: 'label_id',
          type: 'string',
          description: 'Gmail label ID',
          required: true,
        },
        {
          name: 'action',
          type: 'string',
          description:
            'Action to perform on the label (e.g., "create", "rename", "delete")',
          required: true,
        },
        {
          name: 'new_label_name',
          type: 'string',
          description: 'New label name (required for "rename" action)',
          required: false,
        },
      ],
      source: 'google-workspace',
      isEnabled: true,
      requiresAuth: true,
      execute: async (
        params: Record<string, any>,
        context: ToolContext,
      ): Promise<ToolResult> => {
        try {
          const client = this.createClient({ userEmail: context.user?.email });
          const result = await client.executeGmailTool('manage_gmail_label', {
            label_id: params.label_id,
            action: params.action,
            new_label_name: params.new_label_name,
          });

          return {
            success: true,
            data: result,
            metadata: {
              source: 'google-workspace',
              toolName: 'manage_gmail_label',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to manage Gmail label',
            metadata: {
              toolName: 'manage_gmail_label',
            },
          };
        }
      },
    };
  }
}
