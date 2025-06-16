import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { McpServer as McpServerType } from '@/lib/db/schema';

/**
 * Production-grade MCP Service
 *
 * Manages MCP client connections with proper lifecycle management,
 * error handling, and LangChain integration.
 *
 * Based on @modelcontextprotocol/sdk version 1.12.3
 */

// MCP Tool interface from the SDK
interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface McpClientConnection {
  client: Client;
  lastUsed: Date;
  isConnected: boolean;
  connectionAttempts: number;
}

interface McpConnectionConfig {
  maxConnectionAttempts: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxIdleConnections: number;
}

const DEFAULT_CONFIG: McpConnectionConfig = {
  maxConnectionAttempts: 3,
  connectionTimeout: 30000, // 30 seconds
  idleTimeout: 300000, // 5 minutes
  maxIdleConnections: 10,
};

export class McpService {
  private connections: Map<string, McpClientConnection> = new Map();
  private config: McpConnectionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<McpConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Connects to an MCP server for a specific user
   *
   * For Asana: Will use stdio transport for now, needs SSE transport implementation
   * Based on the official SDK client example
   */
  public async connectToServer(
    serverConfig: McpServerType,
    userId: string,
    accessToken: string,
  ): Promise<Client | null> {
    const clientKey = `${serverConfig.id}-${userId}`;

    // Return existing connection if valid
    const existingConnection = this.connections.get(clientKey);
    if (existingConnection?.isConnected) {
      existingConnection.lastUsed = new Date();
      return existingConnection.client;
    }

    // Clean up failed connection
    if (existingConnection && !existingConnection.isConnected) {
      this.connections.delete(clientKey);
    }

    // Create new connection
    try {
      const client = await this.createMcpClient(serverConfig, accessToken);
      if (!client) return null;

      this.connections.set(clientKey, {
        client,
        lastUsed: new Date(),
        isConnected: true,
        connectionAttempts: 1,
      });

      console.log(
        `[McpService] Successfully connected user ${userId} to MCP server: ${serverConfig.name}`,
      );
      return client;
    } catch (error) {
      console.error(
        `[McpService] Failed to connect user ${userId} to MCP server ${serverConfig.name}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Creates a new MCP client with proper configuration
   * Based on the TypeScript SDK examples from the documentation
   */
  private async createMcpClient(
    serverConfig: McpServerType,
    accessToken: string,
  ): Promise<Client | null> {
    try {
      console.log(
        `[McpService] Attempting to connect to ${serverConfig.name} at ${serverConfig.url}`,
      );
      console.log(`[McpService] Using protocol: ${serverConfig.protocol}`);
      console.log(`[McpService] Access token available: ${!!accessToken}`);

      // Create HTTP transport for Asana's SSE endpoint
      const transport = new StreamableHTTPClientTransport(
        new URL(serverConfig.url),
        {
          requestInit: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        },
      );

      // Create and connect the client
      const client = new Client(
        { name: 'quibit-assistant', version: '1.0.0' },
        { capabilities: {} },
      );

      console.log(`[McpService] Connecting to ${serverConfig.url}...`);
      await client.connect(transport);

      console.log(
        `[McpService] Successfully connected to ${serverConfig.name}`,
      );
      return client;
    } catch (error) {
      console.error(
        `[McpService] Failed to create MCP client for ${serverConfig.name}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Converts MCP tools to LangChain tools with enhanced error handling
   */
  public convertToLangChainTools(
    mcpTools: McpTool[],
    client: Client,
    serverName = 'unknown',
  ): DynamicStructuredTool[] {
    return mcpTools.map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.name,
          description: `${tool.description || ''} (via ${serverName} MCP server)`,
          schema: this.buildToolSchema(tool),
          func: async (input: any) => {
            try {
              console.log(
                `[McpService] Executing MCP tool ${tool.name} with input:`,
                input,
              );

              const startTime = Date.now();
              const result = await client.callTool({
                name: tool.name,
                arguments: input || {},
              });
              const duration = Date.now() - startTime;

              console.log(
                `[McpService] Tool ${tool.name} completed in ${duration}ms`,
              );

              return this.formatToolResult(result, tool.name);
            } catch (error: any) {
              console.error(
                `[McpService] Error executing MCP tool ${tool.name}:`,
                error,
              );
              return this.formatToolError(error, tool.name);
            }
          },
        }),
    );
  }

  /**
   * Builds a Zod schema for an MCP tool
   */
  private buildToolSchema(tool: McpTool): z.ZodSchema {
    if (tool.inputSchema) {
      try {
        return this.jsonSchemaToZod(tool.inputSchema);
      } catch (error) {
        console.warn(
          `[McpService] Failed to convert schema for tool ${tool.name}, using fallback`,
        );
      }
    }

    // Fallback schema
    return z.object({
      input: z.any().optional().describe('Input parameters for the tool'),
    });
  }

  /**
   * Simplified JSON Schema to Zod conversion
   */
  private jsonSchemaToZod(schema: any): z.ZodSchema {
    if (schema.type === 'object' && schema.properties) {
      const shape: Record<string, z.ZodSchema> = {};

      for (const [key, prop] of Object.entries(schema.properties)) {
        const propSchema = prop as any;

        let zodType: z.ZodSchema;
        switch (propSchema.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          default:
            zodType = z.any();
        }

        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }

        if (!schema.required?.includes(key)) {
          zodType = zodType.optional();
        }

        shape[key] = zodType;
      }

      return z.object(shape);
    }

    return z.any();
  }

  /**
   * Formats MCP tool results for LangChain
   */
  private formatToolResult(result: any, toolName: string): string {
    try {
      if (result.content) {
        if (Array.isArray(result.content)) {
          return result.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.type === 'text') return item.text;
              return JSON.stringify(item);
            })
            .join('\n');
        }

        if (typeof result.content === 'string') {
          return result.content;
        }

        return JSON.stringify(result.content, null, 2);
      }

      if (result.toolResult) {
        return JSON.stringify(result.toolResult, null, 2);
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      console.error(
        `[McpService] Error formatting result for tool ${toolName}:`,
        error,
      );
      return `Tool ${toolName} completed successfully but result formatting failed.`;
    }
  }

  /**
   * Formats MCP tool errors for LangChain
   */
  private formatToolError(error: any, toolName: string): string {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // Check for common MCP error patterns
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return `Authentication failed for ${toolName}. Please reconnect your account.`;
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return `Resource not found when using ${toolName}. Please check the parameters.`;
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return `Rate limit exceeded for ${toolName}. Please try again later.`;
    }

    return `Error executing ${toolName}: ${errorMessage}`;
  }

  /**
   * Gets available tools from an MCP server
   */
  public async getAvailableTools(
    client: Client,
    serverName = 'unknown',
  ): Promise<McpTool[]> {
    try {
      const result = await client.listTools();
      console.log(
        `[McpService] Retrieved ${result.tools?.length || 0} tools from ${serverName}`,
      );
      return result.tools || [];
    } catch (error) {
      console.error(
        `[McpService] Failed to list tools from ${serverName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Disconnects from an MCP server
   */
  public async disconnect(
    serverConfig: McpServerType,
    userId: string,
  ): Promise<void> {
    const clientKey = `${serverConfig.id}-${userId}`;
    const connection = this.connections.get(clientKey);

    if (connection) {
      try {
        // The Client class from SDK should have a close method
        if (
          'close' in connection.client &&
          typeof connection.client.close === 'function'
        ) {
          await connection.client.close();
        }
      } catch (error) {
        console.error(
          `[McpService] Error closing connection for ${clientKey}:`,
          error,
        );
      }

      this.connections.delete(clientKey);
      console.log(
        `[McpService] Disconnected from MCP server: ${serverConfig.name} for user ${userId}`,
      );
    }
  }

  /**
   * Cleanup idle connections
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute
  }

  /**
   * Removes idle connections
   */
  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToRemove: string[] = [];

    for (const [key, connection] of this.connections.entries()) {
      const idleTime = now.getTime() - connection.lastUsed.getTime();

      if (idleTime > this.config.idleTimeout) {
        connectionsToRemove.push(key);
      }
    }

    for (const key of connectionsToRemove) {
      const connection = this.connections.get(key);
      if (connection) {
        try {
          if (
            'close' in connection.client &&
            typeof connection.client.close === 'function'
          ) {
            connection.client.close();
          }
        } catch (error) {
          console.error(
            `[McpService] Error closing idle connection ${key}:`,
            error,
          );
        }
        this.connections.delete(key);
        console.log(`[McpService] Cleaned up idle connection: ${key}`);
      }
    }

    if (connectionsToRemove.length > 0) {
      console.log(
        `[McpService] Cleaned up ${connectionsToRemove.length} idle connections`,
      );
    }
  }

  /**
   * Shutdown all connections
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const disconnectPromises = Array.from(this.connections.entries()).map(
      async ([key, connection]) => {
        try {
          if (
            'close' in connection.client &&
            typeof connection.client.close === 'function'
          ) {
            await connection.client.close();
          }
        } catch (error) {
          console.error(
            `[McpService] Error closing connection ${key} during shutdown:`,
            error,
          );
        }
      },
    );

    await Promise.allSettled(disconnectPromises);
    this.connections.clear();
    console.log('[McpService] Shutdown completed');
  }
}

// Singleton instance
export const mcpService = new McpService();
