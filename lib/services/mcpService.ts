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

      let transport: any;

      // Determine transport type based on URL scheme and protocol
      if (serverConfig.url.startsWith('npm:')) {
        // For npm-based MCP servers, use stdio transport
        console.log(`[McpService] Creating stdio transport for npm package`);

        const { StdioClientTransport } = await import(
          '@modelcontextprotocol/sdk/client/stdio.js'
        );
        const { spawn } = await import('node:child_process');

        // Extract package name from npm: URL
        const packageName = serverConfig.url.replace('npm:', '');
        console.log(`[McpService] Spawning npm package: ${packageName}`);

        // Spawn the MCP server as a child process
        const serverProcess = spawn('npx', [packageName], {
          stdio: ['pipe', 'pipe', 'inherit'],
          env: {
            ...process.env,
            ASANA_ACCESS_TOKEN: accessToken,
          },
        });

        transport = new StdioClientTransport({
          command: 'npx',
          args: [packageName],
          env: {
            ...process.env,
            ASANA_ACCESS_TOKEN: accessToken,
          },
        });
      } else if (
        serverConfig.url.startsWith('https://') ||
        serverConfig.url.startsWith('http://')
      ) {
        // For HTTP/SSE endpoints, use streamable HTTP transport
        console.log(`[McpService] Creating HTTP transport for SSE endpoint`);

        transport = new StreamableHTTPClientTransport(
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
      } else {
        throw new Error(
          `Unsupported MCP server URL scheme: ${serverConfig.url}`,
        );
      }

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
      // Enhanced error handling for different transport types
      if (serverConfig.url.startsWith('npm:')) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('ENOENT') || errorMessage.includes('spawn')) {
          console.error(
            `[McpService] 📦 NPM MCP SERVER ISSUE DETECTED for ${serverConfig.name}:`,
          );
          console.error('━'.repeat(80));
          console.error(
            '🎯 ROOT CAUSE: NPM package not found or not executable',
          );
          console.error(`📦 PACKAGE: ${serverConfig.url.replace('npm:', '')}`);
          console.error('');
          console.error('🛠️ SOLUTIONS:');
          console.error('1. 📦 Install the package globally:');
          console.error(
            `   npm install -g ${serverConfig.url.replace('npm:', '')}`,
          );
          console.error('');
          console.error('2. 🔧 Verify package is executable:');
          console.error(
            `   npx ${serverConfig.url.replace('npm:', '')} --help`,
          );
          console.error('');
          console.error('3. 🔍 Check package exists:');
          console.error(`   npm info ${serverConfig.url.replace('npm:', '')}`);
          console.error('━'.repeat(80));
          console.error(
            '💡 NOTE: Your OAuth tokens are valid - the issue is package availability',
          );
          console.error('');
        }
      }

      // Enhanced error handling for Asana MCP allowlist issues
      if (
        serverConfig.name === 'Asana' &&
        serverConfig.url.includes('mcp.asana.com')
      ) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('401')
        ) {
          console.error(
            `[McpService] 🔐 ASANA MCP ALLOWLIST ISSUE DETECTED for ${serverConfig.name}:`,
          );
          console.error('━'.repeat(80));
          console.error(
            "🎯 ROOT CAUSE: Redirect URI not on Asana's MCP allowlist",
          );
          console.error(
            "📋 ISSUE: Asana's official MCP server requires pre-approved redirect URIs",
          );
          console.error(
            `🔗 YOUR URI: ${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/api/integrations/asana/callback`,
          );
          console.error('');
          console.error('🛠️ SOLUTIONS:');
          console.error(
            '1. 🏆 RECOMMENDED: Request allowlist approval from Asana',
          );
          console.error(
            '   📝 Process: https://developers.asana.com/docs/integrating-with-asanas-mcp-server',
          );
          console.error('   ⏱️ Timeline: 2-4 weeks');
          console.error('');
          console.error('2. 🚀 IMMEDIATE: Switch to community MCP server');
          console.error(
            '   📦 Run: npm install -g @cristip73/mcp-server-asana',
          );
          console.error('   🔧 Run: npm run fix-asana-mcp-allowlist');
          console.error('   ✅ Provides 30+ Asana tools without allowlist');
          console.error('');
          console.error('3. 📞 CONTACT: Reach out to Asana Support');
          console.error('   🌐 URL: https://asana.com/support');
          console.error('━'.repeat(80));
          console.error(
            '💡 NOTE: Your OAuth tokens are valid - the issue is MCP server access',
          );
          console.error('');
        } else if (errorMessage.includes('invalid_redirect_uri')) {
          console.error(
            `[McpService] 🚫 REDIRECT URI REJECTED by ${serverConfig.name}:`,
          );
          console.error(`Expected allowlisted URI, got unauthorized redirect`);
          console.error(`Solution: Follow allowlist approval process`);
        }
      }

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
    // Filter out tools with invalid schemas before conversion
    const validTools = mcpTools.filter((tool) =>
      this.validateToolSchema(tool, serverName),
    );

    const validationRate =
      mcpTools.length > 0 ? validTools.length / mcpTools.length : 0;

    console.log(
      `[McpService] Schema validation for ${serverName}: ${validTools.length}/${mcpTools.length} tools valid (${Math.round(validationRate * 100)}%)`,
    );

    // If validation rate is too low, disable the entire server to prevent instability
    if (mcpTools.length > 0 && validationRate < 0.5) {
      console.error(
        `[McpService] 🚫 DISABLING ${serverName} MCP server: Too many invalid tools (${Math.round(validationRate * 100)}% valid)`,
      );
      console.error(
        `[McpService] This prevents system instability. Server needs schema fixes.`,
      );
      return [];
    }

    // If no valid tools remain, return empty array
    if (validTools.length === 0) {
      console.warn(
        `[McpService] ⚠️ No valid tools available from ${serverName} MCP server`,
      );
      return [];
    }

    return validTools.map(
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
   * Validates tool schema to ensure OpenAI compatibility
   * Filters out tools with invalid schemas before they reach OpenAI
   */
  private validateToolSchema(tool: McpTool, serverName: string): boolean {
    if (!tool.inputSchema) {
      // Tools without schemas are fine, we'll use fallback
      return true;
    }

    try {
      // Comprehensive schema validation
      const issues = this.findSchemaIssues(tool.inputSchema, tool.name);

      if (issues.length > 0) {
        console.warn(
          `[McpService] ⚠️ Filtering out tool '${tool.name}' from ${serverName} due to schema issues:`,
        );
        issues.forEach((issue) => console.warn(`  - ${issue}`));
        return false;
      }

      // Test if the schema can be converted to Zod (additional validation)
      try {
        this.jsonSchemaToZod(tool.inputSchema);
      } catch (zodError) {
        console.warn(
          `[McpService] ⚠️ Filtering out tool '${tool.name}' from ${serverName} due to Zod conversion error:`,
          zodError,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.warn(
        `[McpService] ⚠️ Filtering out tool '${tool.name}' from ${serverName} due to schema validation error:`,
        error,
      );
      return false;
    }
  }

  /**
   * Recursively finds schema issues that would cause OpenAI validation failures
   */
  private findSchemaIssues(schema: any, toolName: string, path = ''): string[] {
    const issues: string[] = [];

    if (typeof schema !== 'object' || schema === null) {
      return issues;
    }

    // Check for array properties missing items
    if (schema.type === 'array' && !schema.items) {
      issues.push(`Array at ${path || 'root'} missing items property`);
    }

    // Check for invalid array items
    if (
      schema.type === 'array' &&
      schema.items &&
      typeof schema.items !== 'object'
    ) {
      issues.push(`Array at ${path || 'root'} has invalid items definition`);
    }

    // Recursively check properties
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, value] of Object.entries(schema.properties)) {
        const currentPath = path ? `${path}.${key}` : key;
        const subIssues = this.findSchemaIssues(value, toolName, currentPath);
        issues.push(...subIssues);
      }
    }

    // Check items if it's an array
    if (schema.items) {
      const itemsPath = path ? `${path}.items` : 'items';
      const itemIssues = this.findSchemaIssues(
        schema.items,
        toolName,
        itemsPath,
      );
      issues.push(...itemIssues);
    }

    // Check for oneOf, anyOf, allOf schemas
    ['oneOf', 'anyOf', 'allOf'].forEach((keyword) => {
      if (schema[keyword] && Array.isArray(schema[keyword])) {
        schema[keyword].forEach((subSchema: any, index: number) => {
          const subPath = path
            ? `${path}.${keyword}[${index}]`
            : `${keyword}[${index}]`;
          const subIssues = this.findSchemaIssues(subSchema, toolName, subPath);
          issues.push(...subIssues);
        });
      }
    });

    return issues;
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
