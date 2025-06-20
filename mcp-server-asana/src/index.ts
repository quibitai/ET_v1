#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { AsanaClientWrapper } from './asana-client-wrapper.js';
import { createToolHandler, list_of_tools } from './tool-handler.js';
import { createPromptHandler } from './prompt-handler.js';
import { createHttpServer } from './http-server.js';
import { logger } from './utils/logger.js';
import { VERSION } from './version.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Validate required environment variables
    const accessToken = process.env.ASANA_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('ASANA_ACCESS_TOKEN environment variable is required');
    }

    // Initialize Asana client
    const asanaClient = new AsanaClientWrapper({
      accessToken,
      defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID,
    });

    // Start HTTP server for API access
    const httpPort = Number.parseInt(process.env.HTTP_PORT || '8080');
    const httpServer = createHttpServer(asanaClient);
    httpServer.listen(httpPort, () => {
      logger.info(`HTTP API server running on port ${httpPort}`);
      logger.info(`Health check: http://localhost:${httpPort}/health`);
      logger.info(
        `Tools endpoint: http://localhost:${httpPort}/tools/asana/:toolName`,
      );
    });

    // Create MCP server for protocol compliance
    const server = new Server(
      {
        name: 'quibit-mcp-server-asana',
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    // Create handlers
    const toolHandler = createToolHandler(asanaClient);
    const promptHandler = createPromptHandler(asanaClient);

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: list_of_tools,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const result = await toolHandler(request.params);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    });

    // Register prompt handlers
    server.setRequestHandler(
      ListPromptsRequestSchema,
      promptHandler.listPrompts,
    );
    server.setRequestHandler(GetPromptRequestSchema, promptHandler.getPrompt);

    // Start MCP server (stdio transport for MCP compliance)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP Server connected and ready');
    logger.info(`Server version: ${VERSION}`);
    logger.info(`Available tools: ${list_of_tools.length}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
