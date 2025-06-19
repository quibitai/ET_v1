import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { McpServer as McpServerType } from '@/lib/db/schema';
import { mcpSchemaService, type McpTool } from './mcpSchemaService';
import { isValidMcpTool, createMcpToolFunction } from '@/lib/utils/mcpUtils';

/**
 * Production-grade MCP Service - Connection Management Only
 *
 * Manages MCP client connections with proper lifecycle management.
 * Delegates schema handling and tool conversion to specialized services.
 *
 * Based on @modelcontextprotocol/sdk version 1.12.3
 */

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
            '🌐 YOUR DOMAIN: You need your Vercel/production domain allowlisted',
          );
          console.error('');
          console.error('🛠️ SOLUTION:');
          console.error(
            '1. 📧 Contact Asana support to add your domain to MCP allowlist',
          );
          console.error('2. 🔗 Include your production domain URL');
          console.error('3. ⏰ This may take 1-2 business days to process');
          console.error('');
          console.error('💡 ALTERNATIVE: Use the stdio version instead:');
          console.error('   Change URL from https://mcp.asana.com to npm:@...');
          console.error('━'.repeat(80));
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
   * Converts MCP tools to LangChain tools by delegating schema handling.
   */
  public convertToLangChainTools(
    mcpTools: McpTool[],
    client: Client,
    serverName = 'unknown',
  ): DynamicStructuredTool[] {
    console.log(
      `[McpService] Received ${mcpTools.length} tools from ${serverName} for conversion.`,
    );

    const validTools = mcpTools.filter(isValidMcpTool);

    if (validTools.length !== mcpTools.length) {
      console.warn(
        `[McpService] Filtered out ${mcpTools.length - validTools.length} invalid tools from ${serverName}`,
      );
    }

    const langchainTools = validTools.map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.name,
          description: `${tool.description || ''} (via ${serverName} MCP server)`,
          schema: mcpSchemaService.buildToolSchema(tool, serverName), // DELEGATE
          func: createMcpToolFunction(tool.name, client), // DELEGATE
        }),
    );

    console.log(
      `[McpService] Successfully converted ${langchainTools.length} tools from ${serverName}.`,
    );
    return langchainTools;
  }

  /**
   * Gets available tools from an MCP server.
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
      return (result.tools as McpTool[]) || [];
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

    // Use Array.from to avoid the iterator issue
    for (const [key, connection] of Array.from(this.connections.entries())) {
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

  /**
   * Get service statistics for monitoring
   */
  public getStats(): {
    activeConnections: number;
    schemaCache: { size: number };
  } {
    return {
      activeConnections: this.connections.size,
      schemaCache: mcpSchemaService.getCacheStats(),
    };
  }
}

// Singleton instance
export const mcpService = new McpService();
