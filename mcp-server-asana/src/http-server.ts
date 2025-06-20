import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { AsanaClientWrapper } from './asana-client-wrapper.js';
import { createToolHandler, list_of_tools } from './tool-handler.js';
import { logger } from './utils/logger.js';
import { VERSION } from './version.js';

export function createHttpServer(asanaClient: AsanaClientWrapper) {
  const app = express();
  const toolHandler = createToolHandler(asanaClient);

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // List all available tools
  app.get('/tools', (req, res) => {
    res.json({
      tools: list_of_tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
      count: list_of_tools.length,
    });
  });

  // Execute a specific tool
  app.post('/tools/asana/:toolName', async (req, res) => {
    try {
      const { toolName } = req.params;
      const { arguments: toolArgs = {} } = req.body;

      // Validate tool exists
      const tool = list_of_tools.find((t) => t.name === toolName);
      if (!tool) {
        return res.status(404).json({
          error: 'Tool not found',
          toolName,
          availableTools: list_of_tools.map((t) => t.name),
        });
      }

      // Create MCP-compatible request
      const mcpRequest = {
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      };

      // Execute tool via MCP handler
      const result = await toolHandler({
        name: toolName,
        arguments: toolArgs,
      });

      // Return result
      res.json({
        success: true,
        tool: toolName,
        result: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error executing tool ${req.params.toolName}:`, error);

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tool: req.params.toolName,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get tool schema
  app.get('/tools/asana/:toolName/schema', (req, res) => {
    const { toolName } = req.params;
    const tool = list_of_tools.find((t) => t.name === toolName);

    if (!tool) {
      return res.status(404).json({
        error: 'Tool not found',
        toolName,
      });
    }

    res.json({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
  });

  // Batch tool execution
  app.post('/tools/asana/batch', async (req, res) => {
    try {
      const { requests = [] } = req.body;

      if (!Array.isArray(requests)) {
        return res.status(400).json({
          error: 'Requests must be an array',
        });
      }

      const results = await Promise.allSettled(
        requests.map(async (request: any) => {
          const { tool, arguments: toolArgs = {} } = request;

          const mcpRequest = {
            params: {
              name: tool,
              arguments: toolArgs,
            },
          };

          return await toolHandler({
            name: tool,
            arguments: toolArgs,
          });
        }),
      );

      res.json({
        success: true,
        results: results.map((result, index) => ({
          index,
          status: result.status,
          ...(result.status === 'fulfilled'
            ? { result: result.value.content }
            : { error: result.reason?.message || 'Unknown error' }),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in batch execution:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Error handling middleware
  app.use(
    (
      error: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
      availableEndpoints: [
        'GET /health',
        'GET /tools',
        'POST /tools/asana/:toolName',
        'GET /tools/asana/:toolName/schema',
        'POST /tools/asana/batch',
      ],
    });
  });

  return app;
}
