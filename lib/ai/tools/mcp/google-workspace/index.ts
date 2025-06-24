/**
 * Google Workspace MCP Tools Integration
 *
 * This module provides LangChain-compatible tools that connect to the
 * Google Workspace MCP server for Drive, Gmail, Calendar operations.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  GoogleWorkspaceMCPClient,
  DRIVE_TOOLS,
  GMAIL_TOOLS,
  CALENDAR_TOOLS,
} from '../../../mcp/GoogleWorkspaceMCPClient';
import type { RequestLogger } from '@/lib/services/observabilityService';

// Define locally for development
export interface ExtendedDynamicStructuredTool extends DynamicStructuredTool {
  responseType?: string;
}

/**
 * Creates Google Workspace tools for use with LangChain agents
 */
export async function createGoogleWorkspaceTools(
  userId: string,
  sessionId: string,
  accessToken: string,
  userEmail: string,
  logger?: RequestLogger,
): Promise<DynamicStructuredTool[]> {
  try {
    // Create client with OAuth credentials
    const client = await GoogleWorkspaceMCPClient.create({
      accessToken,
      userEmail,
    });

    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      const validation = await client.validateConfiguration();
      const warningMessage =
        'Google Workspace MCP health check failed, but attempting to create tools anyway. This may indicate a configuration issue with the MCP server.';
      logger?.warn(warningMessage, {
        serverUrl: validation.serverUrl,
        serverStatus: validation.serverStatus,
        errors: validation.errors,
      });
      console.warn(`[GoogleWorkspaceMCP] ${warningMessage}`);
    } else {
      logger?.info('Google Workspace MCP server validated successfully.', {
        serverUrl: client.configuration.serverUrl,
      });
    }

    const tools: DynamicStructuredTool[] = [];

    // Google Drive Tools
    const searchDriveFilesTool = new DynamicStructuredTool({
      name: 'search_drive_files',
      description:
        'Search for specific files in Google Drive using search queries. Use this when you need to find files by name, content, or specific criteria. Requires a search query.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'Search query for Drive files. Examples: "modified_time > \'2023-01-01\'" (recent files), "name contains \'document\'", "type:pdf", or file name to search for.',
          ),
        page_size: z
          .number()
          .optional()
          .nullable()
          .default(10)
          .describe('Maximum number of files to return'),
        drive_id: z
          .string()
          .optional()
          .nullable()
          .describe('ID of shared drive to search'),
        include_items_from_all_drives: z
          .boolean()
          .optional()
          .nullable()
          .default(true)
          .describe('Include items from shared drives'),
      }),
      func: async (args) => {
        const result = await client.executeDriveTool('search_drive_files', {
          user_google_email: userEmail,
          ...args,
        });
        return JSON.stringify(result);
      },
    });
    (searchDriveFilesTool as ExtendedDynamicStructuredTool).responseType =
      'search';
    tools.push(searchDriveFilesTool as ExtendedDynamicStructuredTool);

    const getDriveFileContentTool = new DynamicStructuredTool({
      name: 'get_drive_file_content',
      description:
        'Get the content of a specific Google Drive file by ID. Supports Google Docs, Sheets, Slides, and other file types.',
      schema: z.object({
        file_id: z.string().describe('Google Drive file ID'),
      }),
      func: async (args) => {
        const result = await client.executeDriveTool('get_drive_file_content', {
          user_google_email: userEmail,
          ...args,
        });
        return JSON.stringify(result);
      },
    });
    (getDriveFileContentTool as ExtendedDynamicStructuredTool).responseType =
      'artifact';
    tools.push(getDriveFileContentTool as ExtendedDynamicStructuredTool);

    const listDriveItemsTool = new DynamicStructuredTool({
      name: 'list_drive_items',
      description:
        'List recent files and folders in Google Drive. Use this to browse or list files without needing a specific search query. Perfect for "show my files" or "list recent files" requests.',
      schema: z.object({
        folder_id: z
          .string()
          .optional()
          .nullable()
          .default('root')
          .describe('Folder ID to list (default: root)'),
        page_size: z
          .number()
          .optional()
          .nullable()
          .default(100)
          .describe('Maximum number of items to return'),
        drive_id: z.string().optional().nullable().describe('ID of shared drive'),
        include_items_from_all_drives: z
          .boolean()
          .optional()
          .nullable()
          .default(true)
          .describe('Include items from shared drives'),
      }),
      func: async (args) => {
        const result = await client.executeDriveTool('list_drive_items', {
          user_google_email: userEmail,
          ...args,
        });
        return JSON.stringify(result);
      },
    });
    (listDriveItemsTool as ExtendedDynamicStructuredTool).responseType = 'list';
    tools.push(listDriveItemsTool as ExtendedDynamicStructuredTool);

    const createDriveFileTool = new DynamicStructuredTool({
      name: 'create_drive_file',
      description: 'Create a new file in Google Drive.',
      schema: z.object({
        file_name: z.string().describe('Name for the new file'),
        content: z.string().optional().nullable().describe('Content for the file'),
        folder_id: z
          .string()
          .optional()
          .nullable()
          .default('root')
          .describe('Folder ID to create file in'),
        mime_type: z
          .string()
          .optional()
          .nullable()
          .default('text/plain')
          .describe('MIME type of the file'),
      }),
      func: async (args) => {
        const result = await client.executeDriveTool('create_drive_file', {
          user_google_email: userEmail,
          ...args,
        });
        return JSON.stringify(result);
      },
    });
    (createDriveFileTool as ExtendedDynamicStructuredTool).responseType =
      'action';
    tools.push(createDriveFileTool as ExtendedDynamicStructuredTool);

    // Gmail Tools
    tools.push(
      new DynamicStructuredTool({
        name: 'search_gmail_messages',
        description:
          'Search for Gmail messages using search criteria. Use this for finding emails by sender, subject, content, or dates. For recent emails, use queries like "newer_than:1d" (last day) or "is:unread" (unread emails).',
        schema: z.object({
          query: z
            .string()
            .describe(
              'Gmail search query. Examples: "newer_than:1d" (last day), "is:unread" (unread), "from:someone@example.com", "subject:meeting", or "" (empty string for recent emails)',
            ),
          max_results: z
            .number()
            .optional()
            .nullable()
            .default(10)
            .describe('Maximum number of messages to return'),
        }),
        func: async (args) => {
          const result = await client.executeGmailTool(
            'search_gmail_messages',
            {
              user_google_email: userEmail,
              ...args,
            },
          );
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,

      new DynamicStructuredTool({
        name: 'get_gmail_message_content',
        description: 'Get the content of a specific Gmail message by ID.',
        schema: z.object({
          message_id: z.string().describe('Gmail message ID'),
        }),
        func: async (args) => {
          const result = await client.executeGmailTool(
            'get_gmail_message_content',
            {
              user_google_email: userEmail,
              ...args,
            },
          );
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,

      new DynamicStructuredTool({
        name: 'send_gmail_message',
        description: 'Send a Gmail message.',
        schema: z.object({
          to: z.string().describe('Recipient email address'),
          subject: z.string().describe('Email subject'),
          body: z.string().describe('Email body content'),
          cc: z.string().optional().nullable().describe('CC recipients (comma-separated)'),
          bcc: z
            .string()
            .optional()
            .nullable()
            .describe('BCC recipients (comma-separated)'),
        }),
        func: async (args) => {
          const result = await client.executeGmailTool('send_gmail_message', {
            user_google_email: userEmail,
            ...args,
          });
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,
    );

    // Calendar Tools
    tools.push(
      new DynamicStructuredTool({
        name: 'list_calendars',
        description: 'List all calendars available to the user.',
        schema: z.object({}),
        func: async (args) => {
          const result = await client.executeCalendarTool('list_calendars', {
            user_google_email: userEmail,
            ...args,
          });
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,

      new DynamicStructuredTool({
        name: 'get_calendar_events',
        description: 'Get events from a calendar within a date range.',
        schema: z.object({
          calendar_id: z
            .string()
            .optional()
            .nullable()
            .default('primary')
            .describe('Calendar ID (default: primary)'),
          time_min: z.string().optional().nullable().describe('Start time (ISO format)'),
          time_max: z.string().optional().nullable().describe('End time (ISO format)'),
          max_results: z
            .number()
            .optional()
            .nullable()
            .default(50)
            .describe('Maximum number of events'),
        }),
        func: async (args) => {
          const result = await client.executeCalendarTool('get_events', {
            user_google_email: userEmail,
            ...args,
          });
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,

      new DynamicStructuredTool({
        name: 'create_calendar_event',
        description: 'Create a new calendar event.',
        schema: z.object({
          summary: z.string().describe('Event title/summary'),
          start_time: z.string().describe('Start time (ISO format)'),
          end_time: z.string().describe('End time (ISO format)'),
          description: z.string().optional().nullable().describe('Event description'),
          location: z.string().optional().nullable().describe('Event location'),
          calendar_id: z
            .string()
            .optional()
            .nullable()
            .default('primary')
            .describe('Calendar ID'),
        }),
        func: async (args) => {
          const result = await client.executeCalendarTool('create_event', {
            user_google_email: userEmail,
            ...args,
          });
          return JSON.stringify(result);
        },
      }) as ExtendedDynamicStructuredTool,
    );

    logger?.info(
      `Successfully created ${tools.length} Google Workspace tools`,
      {
        userId,
        sessionId,
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
      },
    );

    console.log(
      `[GoogleWorkspaceMCP] Successfully loaded ${tools.length} Google Workspace tools`,
    );

    return tools;
  } catch (error) {
    logger?.error('Failed to create Google Workspace tools', {
      userId,
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[GoogleWorkspaceMCP] Failed to create tools:', error);
    return [];
  }
}
