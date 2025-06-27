/**
 * Google Workspace MCP Client
 *
 * HTTP client for communicating with the FastMCP-based Google Workspace MCP server.
 * Uses the server's built-in OAuth authentication flow instead of token injection.
 */

import {
  BaseMCPClient,
  type MCPClientConfig,
  type MCPToolRequest,
  type MCPToolResponse,
  type MCPBatchRequest,
  type MCPBatchResponse,
  type ValidationResult,
  type HealthStatus,
} from './BaseMCPClient';

// Re-export base types for backward compatibility
export type GoogleWorkspaceMCPConfig = MCPClientConfig & {
  /** Maximum time to wait for server initialization (ms) */
  initializationTimeout?: number;
  /** User's Google email address */
  userEmail?: string;
};

// Tool categories for Google Workspace
export const GMAIL_TOOLS = [
  'search_gmail_messages',
  'get_gmail_message_content',
  'get_gmail_messages_content_batch',
  'send_gmail_message',
  'draft_gmail_message',
  'get_gmail_thread_content',
  'list_gmail_labels',
  'manage_gmail_label',
  'modify_gmail_message_labels',
] as const;

export const DRIVE_TOOLS = [
  'search_drive_files',
  'list_drive_files',
  'upload_drive_file',
  'get_drive_file_content',
] as const;

export const CALENDAR_TOOLS = [
  'list_calendars',
  'list_calendar_events',
  'create_calendar_event',
  'update_calendar_event',
  'delete_calendar_event',
  'get_calendar_event',
] as const;

export const DOCS_TOOLS = [
  'create_docs_document',
  'get_docs_document',
  'update_docs_document',
  'export_docs_document',
] as const;

export const SHEETS_TOOLS = [
  'create_sheets_spreadsheet',
  'get_sheets_values',
  'update_sheets_values',
  'append_sheets_values',
  'clear_sheets_values',
  'get_sheets_metadata',
] as const;

export const FORMS_TOOLS = [
  'create_form',
  'get_form',
  'set_publish_settings',
  'get_form_response',
  'list_form_responses',
] as const;

export const CHAT_TOOLS = [
  'list_spaces',
  'get_messages',
  'send_message',
  'search_messages',
] as const;

export const SLIDES_TOOLS = [
  'create_slides_presentation',
  'get_slides_presentation',
  'update_slides_presentation',
  'export_slides_presentation',
  'batch_update_slides_presentation',
] as const;

// Authentication tool
export const AUTH_TOOLS = ['start_google_auth'] as const;

/**
 * Google Workspace-specific MCP client implementation using FastMCP
 */
export class GoogleWorkspaceMCPClient extends BaseMCPClient {
  readonly serviceName = 'google-workspace';
  readonly defaultServerUrl = 'http://127.0.0.1:8000';
  readonly supportedTools = [
    ...AUTH_TOOLS,
    ...GMAIL_TOOLS,
    ...DRIVE_TOOLS,
    ...CALENDAR_TOOLS,
    ...DOCS_TOOLS,
    ...SHEETS_TOOLS,
    ...FORMS_TOOLS,
    ...CHAT_TOOLS,
    ...SLIDES_TOOLS,
  ];

  private initializationTimeout: number;
  private isInitialized = false;
  private initializationAttempts = 0;
  private readonly maxInitializationAttempts = 5;
  private initializationInProgress = false;
  private sessionId: string | undefined;
  private userEmail?: string;

  constructor(config: GoogleWorkspaceMCPConfig = {}) {
    super({
      ...config,
      serverUrl:
        process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL ||
        config.serverUrl ||
        'http://127.0.0.1:8000',
    });

    this.initializationTimeout = config.initializationTimeout || 30000;
    this.userEmail = config.userEmail;
  }

  /**
   * Initialize session with FastMCP server
   */
  private async initializeSession(): Promise<void> {
    if (this.isInitialized || this.initializationInProgress) {
      return;
    }

    this.initializationInProgress = true;

    try {
      const initBody = {
        jsonrpc: '2.0',
        id: 'initialize',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'google-workspace-client',
            version: '1.0.0',
          },
        },
      };

      const response = await this.makeRequest('/mcp/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(initBody),
      });

      if (response.ok) {
        // Extract session ID from response headers
        const sessionIdHeader =
          response.headers.get('Mcp-Session-Id') ||
          response.headers.get('mcp-session-id') ||
          response.headers.get('X-Session-Id');

        if (sessionIdHeader) {
          this.sessionId = sessionIdHeader;
          console.log(
            '[GoogleWorkspaceMCP] Session initialized:',
            this.sessionId,
          );
        } else {
          throw new Error('No session ID received from server');
        }

        // Send initialized notification as required by MCP protocol
        const initializedBody = {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        };

        const initResponse = await this.makeRequest('/mcp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Mcp-Session-Id': this.sessionId,
          },
          body: JSON.stringify(initializedBody),
        });

        if (!initResponse.ok) {
          console.warn(
            '[GoogleWorkspaceMCP] Initialized notification failed, but continuing...',
          );
        }

        this.isInitialized = true;
        this.initializationAttempts = 0;

        // Add a small delay to ensure server is ready for requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } else {
        throw new Error(
          `Initialization failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error(
        '[GoogleWorkspaceMCP] Session initialization failed:',
        error,
      );
      this.initializationAttempts++;

      if (this.initializationAttempts < this.maxInitializationAttempts) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.initializationInProgress = false;
        return this.initializeSession();
      } else {
        throw new Error(
          `Failed to initialize after ${this.maxInitializationAttempts} attempts`,
        );
      }
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * Execute tool with proper FastMCP format
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    try {
      // Ensure session is initialized
      await this.initializeSession();

      if (!this.sessionId) {
        throw new Error('No active session');
      }

      // Add user email to args if available and not already present
      if (this.userEmail && !args.user_google_email) {
        args.user_google_email = this.userEmail;
      }

      // FastMCP expects parameters spread directly in the params object
      // Use traditional MCP protocol format (not JSON-RPC)
      const requestBody = {
        jsonrpc: '2.0',
        id: Math.random().toString(36).substring(2, 15),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': this.sessionId,
      };

      console.log('[GoogleWorkspaceMCP] Tool call request:', {
        tool: toolName,
        params: Object.keys(args),
        sessionId: this.sessionId,
      });

      const response = await this.makeRequest('/mcp/', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[GoogleWorkspaceMCP] ${response.status} ${response.statusText}:`,
          errorText,
        );

        return {
          success: false,
          tool: toolName,
          result: undefined,
          error: `Request failed: ${response.status} ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse FastMCP response (Server-Sent Events format)
      const responseText = await response.text();
      const lines = responseText.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data: '));

      if (dataLine) {
        const responseData = JSON.parse(dataLine.substring(6));

        // Check for errors in both error field and result field with isError flag
        let errorMessage = '';
        let isAuthError = false;

        if (responseData.error) {
          errorMessage = responseData.error.message || 'Tool execution failed';
        } else if (
          responseData.result?.isError &&
          responseData.result?.content
        ) {
          // Extract error message from content array
          errorMessage = responseData.result.content
            .map((item: any) => item.text || '')
            .join('\n');
        }

        if (errorMessage) {
          // Check if this is an authentication error that requires OAuth
          isAuthError =
            errorMessage.includes('credentials do not contain') ||
            errorMessage.includes('refresh the access token') ||
            errorMessage.includes('necessary fields need to refresh');

          if (isAuthError) {
            // Trigger authentication flow
            console.log(
              '[GoogleWorkspaceMCP] Authentication required, starting OAuth flow...',
            );
            if (this.userEmail) {
              const authResponse = await this.startAuthentication(
                this.userEmail,
                'gmail',
              );
              console.log('[GoogleWorkspaceMCP] Auth response:', authResponse);
              if (authResponse.result) {
                // Extract the OAuth URL from the result
                let authContent = '';
                if (
                  authResponse.result.content &&
                  Array.isArray(authResponse.result.content)
                ) {
                  authContent = authResponse.result.content
                    .map((item: any) => item.text || '')
                    .join('\n');
                } else if (typeof authResponse.result === 'string') {
                  authContent = authResponse.result;
                }

                // Return the authentication URL to the user
                return {
                  success: false,
                  tool: toolName,
                  result: authContent,
                  error:
                    'Authentication required. Please follow the provided link to authorize access.',
                  timestamp: new Date().toISOString(),
                };
              }
            }
          }

          return {
            success: false,
            tool: toolName,
            result: undefined,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: true,
            tool: toolName,
            result: responseData.result,
            error: undefined,
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('[GoogleWorkspaceMCP] Tool execution failed:', error);
      return {
        success: false,
        tool: toolName,
        result: undefined,
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Start Google authentication flow
   */
  async startAuthentication(
    userEmail: string,
    serviceName: string,
  ): Promise<MCPToolResponse> {
    this.userEmail = userEmail;
    return this.executeTool('start_google_auth', {
      user_google_email: userEmail,
      service_name: serviceName,
    });
  }

  /**
   * Execute Gmail-specific tool with OAuth flow handling
   */
  async executeGmailTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!GMAIL_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Gmail tool`);
    }

    try {
      // First try to execute the tool
      const result = await this.executeTool(toolName, args);

      // Check if authentication is required - the executeTool method should handle this automatically
      if (
        !result.success &&
        result.error?.includes('Authentication required')
      ) {
        // The OAuth URL should already be in the result from executeTool
        return result;
      }

      return result;
    } catch (error) {
      console.error('[GoogleWorkspaceMCP] Gmail tool execution failed:', error);
      return {
        success: false,
        tool: toolName,
        result: undefined,
        error: `**Google Workspace Authentication Required**

To access Gmail, please complete the Google Workspace authentication process. Once that's done, I can search your Gmail for emails from chantel@echotango.co as requested.

Let me know if you need guidance on how to authenticate or if you'd like to try another task!`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute Drive-specific tool
   */
  async executeDriveTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!DRIVE_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Drive tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Docs-specific tool
   */
  async executeDocsTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!DOCS_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Docs tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Sheets-specific tool
   */
  async executeSheetsTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!SHEETS_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Sheets tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Forms-specific tool
   */
  async executeFormsTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!FORMS_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Forms tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Chat-specific tool
   */
  async executeChatTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!CHAT_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Chat tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Calendar-specific tool
   */
  async executeCalendarTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPToolResponse> {
    if (!CALENDAR_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Calendar tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Health check for FastMCP server
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
        };
      } else {
        return {
          status: 'error',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          error: `Health check failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        error: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Reset session state
   */
  resetSession(): void {
    this.isInitialized = false;
    this.sessionId = undefined;
    this.initializationAttempts = 0;
    this.initializationInProgress = false;
    console.log('[GoogleWorkspaceMCP] Session reset');
  }

  /**
   * Service-specific validation implementation
   */
  protected async validateServiceSpecific(): Promise<{
    errors: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const healthResponse = await this.healthCheck();
      if (healthResponse.status !== 'healthy') {
        errors.push('Google Workspace MCP server health check failed');
      }
    } catch (error) {
      errors.push(
        `Cannot connect to Google Workspace MCP server at ${this.config.serverUrl}. Ensure the server is running.`,
      );
    }

    return { errors, warnings };
  }
}
