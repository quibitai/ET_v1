/**
 * Universal MCP Tool Factory
 *
 * Modular factory for creating LangChain tools from any MCP server.
 * Designed for easy extension with new MCP integrations.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { McpIntegrationRepository } from '@/lib/db/repositories/mcpIntegrations';
import { mcpService } from '@/lib/services/mcpService';

interface McpToolFactoryConfig {
  serverName: string;
  userId: string;
  sessionId: string;
  logger?: RequestLogger;
}

interface McpToolContext {
  serverName: string;
  userId: string;
  sessionId: string;
  logger?: RequestLogger;
}

/**
 * Simple logging utility
 */
const createLogger = (prefix: string) => ({
  info: (message: string, data?: any) =>
    console.log(`[${prefix}] ${message}`, data || ''),
  error: (message: string, data?: any) =>
    console.error(`[${prefix}] ${message}`, data || ''),
  warn: (message: string, data?: any) =>
    console.warn(`[${prefix}] ${message}`, data || ''),
});

/**
 * Creates LangChain tools from an MCP server
 */
export class McpToolFactory {
  private config: McpToolFactoryConfig;
  private context: McpToolContext;
  private log = createLogger('McpToolFactory');

  constructor(config: McpToolFactoryConfig) {
    this.config = config;
    this.context = {
      ...config,
    };
  }

  /**
   * Create all available tools for the specified MCP server
   */
  async createTools(): Promise<DynamicStructuredTool[]> {
    try {
      const logData = {
        userId: this.config.userId,
        sessionId: this.config.sessionId,
      };

      if (this.context.logger) {
        this.context.logger.info(
          `Creating tools for ${this.config.serverName}`,
          logData,
        );
      } else {
        this.log.info(`Creating tools for ${this.config.serverName}`, logData);
      }

      // Get server configuration from database
      const serverConfig = await McpIntegrationRepository.getMcpServerByName(
        this.config.serverName,
      );
      if (!serverConfig) {
        throw new Error(
          `MCP server '${this.config.serverName}' not found in database`,
        );
      }

      if (!serverConfig.isEnabled) {
        throw new Error(`MCP server '${this.config.serverName}' is disabled`);
      }

      // Get user's access token - support both environment variables and database
      let accessToken: string | null = null;

      // DEVELOPMENT MODE: For community MCP servers (npm: URLs), try environment variables first
      if (serverConfig.url.startsWith('npm:')) {
        const envVarName = `${this.config.serverName.toUpperCase()}_ACCESS_TOKEN`;
        accessToken = process.env[envVarName] || null;

        if (accessToken) {
          this.log.info(
            `✅ Development mode: Using environment token for ${this.config.serverName}`,
          );
        } else {
          // For community MCP in development, if no env token, fail immediately
          throw new Error(
            `❌ Development mode: No environment token found for ${this.config.serverName}. Set ${envVarName} environment variable to enable ${this.config.serverName} MCP. Get your token from: https://app.asana.com/0/my-apps`,
          );
        }
      } else {
        // PRODUCTION MODE: Use database-stored OAuth tokens for official MCP servers
        accessToken =
          await McpIntegrationRepository.getDecryptedAccessTokenByServerName(
            this.config.userId,
            this.config.serverName,
          );
      }

      if (!accessToken) {
        throw new Error(
          `No access token found for user ${this.config.userId} and server ${this.config.serverName}. For community MCP servers, set ${this.config.serverName.toUpperCase()}_ACCESS_TOKEN environment variable.`,
        );
      }

      // Connect to MCP server
      const client = await mcpService.connectToServer(
        serverConfig,
        this.config.userId,
        accessToken,
      );
      if (!client) {
        throw new Error(
          `Failed to connect to MCP server: ${this.config.serverName}`,
        );
      }

      // Get available tools from the server
      const mcpTools = await mcpService.getAvailableTools(
        client,
        this.config.serverName,
      );

      const toolLogData = { toolNames: mcpTools.map((t) => t.name) };
      if (this.context.logger) {
        this.context.logger.info(
          `Found ${mcpTools.length} tools on ${this.config.serverName}`,
          toolLogData,
        );
      } else {
        this.log.info(
          `Found ${mcpTools.length} tools on ${this.config.serverName}`,
          toolLogData,
        );
      }

      // Convert to LangChain tools
      const langChainTools = mcpService.convertToLangChainTools(
        mcpTools,
        client,
        this.config.serverName,
      );

      // Enhance tools with additional context and logging
      const enhancedTools = langChainTools.map((tool) =>
        this.enhanceToolWithContext(tool),
      );

      if (this.context.logger) {
        this.context.logger.info(
          `Successfully created ${enhancedTools.length} tools for ${this.config.serverName}`,
        );
      } else {
        this.log.info(
          `Successfully created ${enhancedTools.length} tools for ${this.config.serverName}`,
        );
      }

      return enhancedTools;
    } catch (error) {
      const errorData = {
        error: error instanceof Error ? error.message : error,
        userId: this.config.userId,
      };

      if (this.context.logger) {
        this.context.logger.error(
          `Failed to create tools for ${this.config.serverName}`,
          errorData,
        );
      } else {
        this.log.error(
          `Failed to create tools for ${this.config.serverName}`,
          errorData,
        );
      }

      // Return empty array rather than throwing - allows graceful degradation
      return [];
    }
  }

  /**
   * Create tools for a specific user and session
   */
  static async createToolsForUser(
    serverName: string,
    userId: string,
    sessionId: string,
    logger?: RequestLogger,
  ): Promise<DynamicStructuredTool[]> {
    const factory = new McpToolFactory({
      serverName,
      userId,
      sessionId,
      logger,
    });

    return factory.createTools();
  }

  /**
   * Check if an MCP server is available and ready for the user
   */
  static async isServerAvailable(
    serverName: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const serverConfig =
        await McpIntegrationRepository.getMcpServerByName(serverName);
      if (!serverConfig?.isEnabled) return false;

      // DEVELOPMENT MODE: For community MCP servers (npm: URLs), check environment variables first
      if (serverConfig.url.startsWith('npm:')) {
        // Community MCP servers use environment variables for PAT
        const envVarName = `${serverName.toUpperCase()}_ACCESS_TOKEN`;
        const envToken = process.env[envVarName];
        if (envToken) {
          console.log(
            `[McpToolFactory] ✅ Development mode: Using environment token for ${serverName}`,
          );
          return true;
        }

        // For community MCP in development, if no env token, consider it unavailable
        // This bypasses OAuth entirely for community servers
        console.log(
          `[McpToolFactory] ❌ Development mode: No environment token found for ${serverName}`,
        );
        console.log(
          `[McpToolFactory] 💡 Set ${envVarName} environment variable to enable ${serverName} MCP`,
        );
        return false;
      }

      // PRODUCTION MODE: Fallback to database-stored OAuth tokens for official MCP servers
      const accessToken =
        await McpIntegrationRepository.getDecryptedAccessTokenByServerName(
          userId,
          serverName,
        );

      return !!accessToken;
    } catch (error) {
      console.error(
        `[McpToolFactory] Error checking server availability for ${serverName}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all available MCP servers for a user
   */
  static async getAvailableServers(userId: string): Promise<string[]> {
    try {
      const integrations =
        await McpIntegrationRepository.getUserMcpIntegrations(userId);
      const activeIntegrations = integrations.filter(
        (integration) => integration.isActive,
      );

      return activeIntegrations.map((integration) => integration.serverName);
    } catch {
      return [];
    }
  }

  /**
   * Enhance a tool with additional context and logging
   */
  private enhanceToolWithContext(
    tool: DynamicStructuredTool,
  ): DynamicStructuredTool {
    const originalFunc = tool.func;

    // Create enhanced tool with the same properties but enhanced functionality
    return new DynamicStructuredTool({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
      func: async (input: any) => {
        const requestId = `${this.config.sessionId}_${tool.name}_${Date.now()}`;
        const startTime = Date.now();

        const logData = {
          requestId,
          serverName: this.config.serverName,
          userId: this.config.userId,
          input: this.sanitizeInput(input),
        };

        if (this.context.logger) {
          this.context.logger.info(
            `[McpTool:${tool.name}] Starting execution`,
            logData,
          );
        } else {
          this.log.info(`[McpTool:${tool.name}] Starting execution`, logData);
        }

        try {
          const result = await originalFunc(input);
          const duration = Date.now() - startTime;

          const successData = {
            requestId,
            duration: `${duration}ms`,
            resultLength:
              typeof result === 'string' ? result.length : 'non-string',
          };

          if (this.context.logger) {
            this.context.logger.info(
              `[McpTool:${tool.name}] Completed successfully`,
              successData,
            );
          } else {
            this.log.info(
              `[McpTool:${tool.name}] Completed successfully`,
              successData,
            );
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          const errorData = {
            requestId,
            duration: `${duration}ms`,
            error: error instanceof Error ? error.message : error,
          };

          if (this.context.logger) {
            this.context.logger.error(
              `[McpTool:${tool.name}] Execution failed`,
              errorData,
            );
          } else {
            this.log.error(
              `[McpTool:${tool.name}] Execution failed`,
              errorData,
            );
          }

          throw error;
        }
      },
    });
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   */
  private sanitizeInput(input: any): any {
    if (!input || typeof input !== 'object') return input;

    const sanitized = { ...input };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

export default McpToolFactory;
