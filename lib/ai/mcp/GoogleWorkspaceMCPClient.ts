/**
 * Google Workspace MCP Client
 *
 * HTTP client for communicating with the containerized Google Workspace MCP server.
 * Extends BaseMCPClient to leverage common functionality while providing
 * Google Workspace-specific type-safe methods and interfaces.
 *
 * Supports OAuth credential injection via Authorization header for request-scoped authentication.
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
  /** OAuth access token for request-scoped authentication */
  accessToken?: string;
  /** User email for Google Workspace operations */
  userEmail?: string;
};

// Google Workspace-specific types
export interface GoogleWorkspaceEmailRequest extends MCPToolRequest {
  user_google_email: string;
  [key: string]: any;
}

export interface GoogleWorkspaceDriveRequest extends MCPToolRequest {
  user_google_email: string;
  [key: string]: any;
}

export interface GoogleWorkspaceCalendarRequest extends MCPToolRequest {
  user_google_email: string;
  [key: string]: any;
}

// Service-specific tool groups for better organization
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
  'get_drive_file_content',
  'list_drive_items',
  'create_drive_file',
] as const;

export const CALENDAR_TOOLS = [
  'list_calendars',
  'get_events',
  'get_event',
  'create_event',
  'modify_event',
  'delete_event',
] as const;

export const DOCS_TOOLS = [
  'search_docs',
  'get_doc_content',
  'list_docs_in_folder',
  'create_doc',
] as const;

export const SHEETS_TOOLS = [
  'list_spreadsheets',
  'get_spreadsheet_info',
  'read_sheet_values',
  'modify_sheet_values',
  'create_spreadsheet',
  'create_sheet',
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

/**
 * Google Workspace-specific MCP client implementation
 */
export class GoogleWorkspaceMCPClient extends BaseMCPClient {
  readonly serviceName = 'google-workspace';
  readonly defaultServerUrl = 'http://localhost:8000';
  readonly supportedTools = [
    ...GMAIL_TOOLS,
    ...DRIVE_TOOLS,
    ...CALENDAR_TOOLS,
    ...DOCS_TOOLS,
    ...SHEETS_TOOLS,
    ...FORMS_TOOLS,
    ...CHAT_TOOLS,
  ];

  /** OAuth access token for request-scoped authentication */
  private accessToken?: string;
  /** User email for Google Workspace operations */
  private userEmail?: string;

  constructor(config: GoogleWorkspaceMCPConfig = {}) {
    super({
      ...config,
      serverUrl:
        process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL || config.serverUrl,
    });

    // Store OAuth credentials for request-scoped authentication
    this.accessToken = config.accessToken;
    this.userEmail = config.userEmail;
  }

  /**
   * Set OAuth credentials for request-scoped authentication
   */
  setCredentials(accessToken: string, userEmail?: string): void {
    this.accessToken = accessToken;
    this.userEmail = userEmail;
  }

  /**
   * Clear OAuth credentials
   */
  clearCredentials(): void {
    this.accessToken = undefined;
    this.userEmail = undefined;
  }

  /**
   * Check if OAuth credentials are available
   */
  hasCredentials(): boolean {
    return !!this.accessToken;
  }

  /**
   * Create a simplified client instance with auto-detection
   */
  static async create(
    config: GoogleWorkspaceMCPConfig = {},
  ): Promise<GoogleWorkspaceMCPClient> {
    const client = new GoogleWorkspaceMCPClient(config);

    // Ensure configuration is complete after inheritance
    client.ensureConfigured();

    // Validate configuration if auto-detect is enabled
    if (client.configuration.autoDetect) {
      const validation = await client.validateConfiguration();

      if (!validation.isValid) {
        console.warn(
          '[GoogleWorkspaceMCPClient] Configuration issues detected:',
          validation.errors,
        );

        // In development, provide helpful error messages
        if (process.env.NODE_ENV === 'development') {
          console.warn('\n🔧 Google Workspace MCP Setup Help:');
          console.warn(
            '1. Ensure the MCP server is running: docker-compose -f docker-compose.dev.yml up google-workspace-mcp',
          );
          console.warn(
            '2. Place your client_secret.json in mcp-server-google-workspace/ directory',
          );
          console.warn(
            '3. Verify GOOGLE_WORKSPACE_MCP_SERVER_URL points to the correct server (default: http://localhost:8000/mcp/)',
          );
          console.warn('4. Complete OAuth authentication on first tool use\n');
        }
      }
    }

    return client;
  }

  /**
   * Service-specific validation
   */
  protected async validateServiceSpecific(): Promise<{
    errors: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if Google credentials are configured
    if (
      !process.env.GOOGLE_CLIENT_SECRETS &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      warnings.push(
        'Neither GOOGLE_CLIENT_SECRETS nor GOOGLE_APPLICATION_CREDENTIALS environment variables are set. The MCP server will use the client_secret.json file in its directory.',
      );
    }

    // Check if server URL is accessible
    try {
      const healthResponse = await this.healthCheck();
      if (healthResponse.status !== 'ok') {
        errors.push('Google Workspace MCP server health check failed');
      }
    } catch (error) {
      errors.push(
        `Cannot connect to Google Workspace MCP server at ${this.configuration.serverUrl}. Ensure the Docker container is running.`,
      );
    }

    return { errors, warnings };
  }

  /**
   * Execute Gmail-specific tool
   */
  async executeGmailTool(
    toolName: string,
    args: GoogleWorkspaceEmailRequest,
  ): Promise<MCPToolResponse> {
    if (!GMAIL_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Gmail tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Drive-specific tool
   */
  async executeDriveTool(
    toolName: string,
    args: GoogleWorkspaceDriveRequest,
  ): Promise<MCPToolResponse> {
    if (!DRIVE_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Drive tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Execute Calendar-specific tool
   */
  async executeCalendarTool(
    toolName: string,
    args: GoogleWorkspaceCalendarRequest,
  ): Promise<MCPToolResponse> {
    if (!CALENDAR_TOOLS.includes(toolName as any)) {
      throw new Error(`Tool ${toolName} is not a valid Calendar tool`);
    }
    return this.executeTool(toolName, args);
  }

  /**
   * Override health check to handle FastMCP requirements
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await fetch(`${this.configuration.serverUrl}/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: 'ok',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...data,
      };
    } catch (error) {
      return {
        status: 'error',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Override executeTool to handle Google Workspace-specific FastMCP JSON-RPC format and OAuth injection
   */
  /** Cached session ID for the current client instance */
  private sessionId?: string;

  /**
   * Initialize a session with the FastMCP server
   */
  private async initializeSession(): Promise<void> {
    try {
      const initHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };

      // Add OAuth credentials for initialization
      if (this.accessToken) {
        initHeaders.Authorization = `Bearer ${this.accessToken}`;
        if (this.userEmail) {
          initHeaders['x-user-email'] = this.userEmail;
        }
      }

      // Send proper MCP initialization
      const initBody = {
        jsonrpc: '2.0',
        id: 'initialize',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'google-workspace-client',
            version: '1.0.0',
          },
        },
      };

      const response = await this.makeRequest('/mcp/', {
        method: 'POST',
        headers: initHeaders,
        body: JSON.stringify(initBody),
      });

      if (response.ok) {
        // Parse the initialization response to extract session information
        const initResponseText: string = await response.text();

        // FastMCP responds with Server-Sent Events format
        const lines: string[] = initResponseText.split('\n');
        const dataLine: string | undefined = lines.find((line) =>
          line.startsWith('data: '),
        );
        if (dataLine) {
          const initResult: any = JSON.parse(dataLine.substring(6));
          console.log(
            '[GoogleWorkspaceMCP] Initialization response:',
            initResult,
          );
        }

        // Extract session ID from response headers or generate a compatible one
        const sessionIdHeader: string | null =
          response.headers.get('Mcp-Session-Id') ||
          response.headers.get('mcp-session-id') ||
          response.headers.get('X-Session-Id');
        if (sessionIdHeader) {
          this.sessionId = sessionIdHeader;
          console.log(
            '[GoogleWorkspaceMCP] Extracted session ID from headers:',
            this.sessionId,
          );
        } else {
          // Generate a session ID compatible with FastMCP format (32-character hex string)
          this.sessionId = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join('');
          console.log(
            '[GoogleWorkspaceMCP] Generated FastMCP-compatible session ID:',
            this.sessionId,
          );
        }
      } else {
        throw new Error(
          `Session initialization failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error(
        '[GoogleWorkspaceMCP] Session initialization failed:',
        error,
      );
      // Generate a fallback session ID
      this.sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.warn(
        '[GoogleWorkspaceMCP] Using fallback session ID:',
        this.sessionId,
      );
    }
  }

  async executeTool(
    toolName: string,
    args: MCPToolRequest = {},
  ): Promise<MCPToolResponse> {
    // Ensure we have a session before making the tool call
    if (!this.sessionId) {
      await this.initializeSession();
    }

    // The Google Workspace MCP server uses standard MCP protocol format
    const requestBody = {
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(2, 15), // Generate random ID
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: {
          ...args,
          user_google_email: (args as any).user_google_email || this.userEmail,
        },
      },
    };

    // Prepare headers for OAuth credential injection and streaming support
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream', // Required for Google Workspace MCP server
    };

    // Add session ID if we have one (FastMCP requires explicit session management)
    if (this.sessionId && this.sessionId !== 'auto') {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    // Add OAuth credentials if available (request-scoped authentication)
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;

      // Add user email header if available (note: header name is lowercase with dashes)
      if (this.userEmail) {
        headers['x-user-email'] = this.userEmail;
      }
    }

    let response;
    try {
      response = await this.makeRequest('/mcp/', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error('[GoogleWorkspaceMCP] Request failed:', error);
      return {
        success: false,
        tool: toolName,
        result: null,
        error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[GoogleWorkspaceMCP] ${response.status} ${response.statusText}:`,
        errorText,
      );
      console.error('[GoogleWorkspaceMCP] Request headers:', headers);
      console.error(
        '[GoogleWorkspaceMCP] Request body:',
        JSON.stringify(requestBody, null, 2),
      );

      return {
        success: false,
        tool: toolName,
        result: null,
        error: `HTTP ${response.status}: ${errorText}`,
        timestamp: new Date().toISOString(),
      };
    }

    // Handle streaming response
    const responseText: string = await response.text();

    // Parse streaming response (FastMCP sends event-stream format)
    let result: any;
    try {
      if (responseText.includes('event: message')) {
        // Extract JSON from the streaming response
        const lines = responseText.split('\n');
        const dataLine = lines.find((line) => line.startsWith('data: '));
        if (dataLine) {
          result = JSON.parse(dataLine.substring(6)); // Remove 'data: ' prefix
        } else {
          throw new Error('Invalid streaming response format');
        }
      } else {
        result = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error(
        '[GoogleWorkspaceMCP] Failed to parse response:',
        responseText,
      );
      return {
        success: false,
        tool: toolName,
        result: null,
        error: `Response parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: !result.error,
      tool: toolName,
      result: result.result || result,
      error: result.error,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Override executeBatch for consistency with OAuth credential injection
   */
  async executeBatch(request: MCPBatchRequest): Promise<MCPBatchResponse> {
    // Prepare headers for OAuth credential injection and streaming support
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream', // Required for Google Workspace MCP server
      'Mcp-Session-Id': Math.random().toString(36).substring(2, 15), // Generate session ID
    };

    // Add OAuth credentials if available (request-scoped authentication)
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;

      // Add user email header if available (note: header name is lowercase with dashes)
      if (this.userEmail) {
        headers['x-user-email'] = this.userEmail;
      }
    }

    const response = await this.makeRequest('/tools/batch', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    return response.json();
  }

  /**
   * Helper method to search Gmail with user email validation
   */
  async searchGmail(
    query: string,
    userEmail: string,
    pageSize = 10,
  ): Promise<MCPToolResponse> {
    return this.executeGmailTool('search_gmail_messages', {
      user_google_email: userEmail,
      query,
      page_size: pageSize,
    });
  }

  /**
   * Helper method to search Drive files with user email validation
   */
  async searchDriveFiles(
    query: string,
    userEmail: string,
    pageSize = 10,
  ): Promise<MCPToolResponse> {
    return this.executeDriveTool('search_drive_files', {
      user_google_email: userEmail,
      query,
      page_size: pageSize,
    });
  }

  /**
   * Helper method to list calendars with user email validation
   */
  async listCalendars(userEmail: string): Promise<MCPToolResponse> {
    return this.executeCalendarTool('list_calendars', {
      user_google_email: userEmail,
    });
  }

  /**
   * Create a client instance with OAuth credentials from NextAuth session
   */
  static async createWithSession(
    session: any,
    config: Omit<GoogleWorkspaceMCPConfig, 'accessToken' | 'userEmail'> = {},
  ): Promise<GoogleWorkspaceMCPClient> {
    // Extract access token from NextAuth session
    const accessToken = session?.accessToken;
    const userEmail = session?.user?.email;

    if (!accessToken) {
      throw new Error(
        'No access token found in session. User may need to re-authenticate.',
      );
    }

    if (!userEmail) {
      throw new Error('No user email found in session.');
    }

    return GoogleWorkspaceMCPClient.create({
      ...config,
      accessToken,
      userEmail,
    });
  }
}
