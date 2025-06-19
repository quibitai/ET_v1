/**
 * AI Tools Index
 *
 * This file exports all available AI tools for use in the agent system.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Import all tools
import { queryDocumentRowsTool } from './query-document-rows';
import { searchAndRetrieveKnowledgeBase } from './search-internal-knowledge-base';
import { requestSuggestionsTool } from './request-suggestions';
import { tavilySearchTool } from './tavily-search';
import { tavilyExtractTool } from './tavilyExtractTool';
import { googleCalendarTool } from './googleCalendarTool';
import { getMessagesFromOtherChatTool } from './getMessagesFromOtherChatTool';
import { listDocumentsTool } from './list-documents';
import { getDocumentContentsTool } from './get-document-contents';
import { multiDocumentRetrievalTool } from './multi-document-retrieval';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Legacy Asana tools import removed - only MCP integration supported

// Import MCP integration repository for loading user MCP tools
import { McpIntegrationRepository } from '@/lib/db/repositories/mcpIntegrations';
import { McpService } from '@/lib/services/mcpService';

// Legacy Asana tools removed - only MCP integration supported

/**
 * Loads MCP tools for a specific user
 */
async function getUserMcpTools(
  userId: string,
): Promise<DynamicStructuredTool[]> {
  console.log('[getUserMcpTools] ENTRY - Starting for userId:', userId);
  console.log(
    '[getUserMcpTools] Environment check - ASANA_ACCESS_TOKEN:',
    process.env.ASANA_ACCESS_TOKEN ? 'SET' : 'NOT_SET',
  );

  try {
    const allMcpTools: DynamicStructuredTool[] = [];

    // DEVELOPMENT MODE: Check for environment variable based MCP tools first
    const envAsanaToken = process.env.ASANA_ACCESS_TOKEN;
    console.log('[getUserMcpTools] envAsanaToken check:', !!envAsanaToken);

    if (envAsanaToken) {
      console.log(
        '[ToolIndex] Development mode: Loading Asana MCP tools from environment variables',
      );

      try {
        // Use the MCP tool factory which handles environment variables
        const { createAsanaTools } = await import('./mcp/asana');
        console.log('[getUserMcpTools] Successfully imported createAsanaTools');

        const asanaTools = await createAsanaTools(userId, 'env-session');
        console.log(
          '[getUserMcpTools] createAsanaTools returned:',
          asanaTools.length,
          'tools',
        );

        if (asanaTools.length > 0) {
          console.log(
            '[ToolIndex] Successfully loaded Asana tools from environment:',
            {
              toolCount: asanaTools.length,
              toolNames: asanaTools.map((t: DynamicStructuredTool) => t.name),
            },
          );
          allMcpTools.push(...asanaTools);
        }
      } catch (error) {
        console.error(
          '[ToolIndex] Error loading Asana tools from environment:',
          error,
        );
      }
    } else {
      console.log(
        '[getUserMcpTools] No envAsanaToken found, skipping environment mode',
      );
    }

    // PRODUCTION MODE: Get user's active MCP integrations from database
    const integrations =
      await McpIntegrationRepository.getUserMcpIntegrations(userId);

    if (integrations.length === 0 && allMcpTools.length === 0) {
      return [];
    }

    const mcpService = new McpService();

    // For each database integration, connect and get tools
    for (const integration of integrations) {
      try {
        // Get the server configuration
        const server = await McpIntegrationRepository.getMcpServerById(
          integration.mcpServerId,
        );
        if (!server) {
          console.warn(
            `[ToolIndex] Server not found for integration: ${integration.mcpServerId}`,
          );
          continue;
        }

        // Skip if we already loaded this server from environment variables
        if (server.name === 'Asana' && envAsanaToken) {
          console.log(
            '[ToolIndex] Skipping database Asana integration - already loaded from environment',
          );
          continue;
        }

        // Get decrypted access token
        const accessToken =
          await McpIntegrationRepository.getDecryptedAccessToken(
            userId,
            integration.mcpServerId,
          );

        if (!accessToken) {
          console.warn(
            `[ToolIndex] No access token for user ${userId} and server ${server.name}`,
          );
          continue;
        }

        // Connect to MCP server
        const client = await mcpService.connectToServer(
          server,
          userId,
          accessToken,
        );
        if (!client) {
          console.warn(
            `[ToolIndex] Failed to connect to MCP server: ${server.name}`,
          );
          continue;
        }

        // Get available tools from the server
        const mcpTools = await mcpService.getAvailableTools(
          client,
          server.name,
        );

        // Convert to LangChain tools
        const langchainTools = mcpService.convertToLangChainTools(
          mcpTools,
          client,
          server.name,
        );

        allMcpTools.push(...langchainTools);

        console.log(
          `[ToolIndex] Loaded ${langchainTools.length} tools from ${server.name} MCP server`,
        );
      } catch (error) {
        console.error(
          `[ToolIndex] Error loading tools for integration ${integration.mcpServerId}:`,
          error,
        );
      }
    }

    return allMcpTools;
  } catch (error) {
    console.error('[ToolIndex] Error in getUserMcpTools:', error);
    return [];
  }
}

// Create budget creation helper tool
const createBudgetTool = new DynamicStructuredTool({
  name: 'createBudget',
  description:
    'Structure and calculate budgets for video production projects using uploaded project details and rate card information. Use when users request budgets or estimates.',
  schema: z.object({
    projectScope: z
      .string()
      .describe('Project scope and deliverables from uploaded content'),
    rateCardInfo: z
      .string()
      .describe('Rate card information found in knowledge base'),
    projectDetails: z
      .string()
      .describe('Additional project details like timeline, complexity'),
  }),
  func: async ({ projectScope, rateCardInfo, projectDetails }) => {
    const startTime = performance.now();

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'createBudget',
        hasProjectScope: !!projectScope,
        hasRateCardInfo: !!rateCardInfo,
        hasProjectDetails: !!projectDetails,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const result = {
        message:
          'BUDGET CREATION GUIDANCE: Create a detailed budget with line items based on the provided information. Include categories like: Creative Development, Production, Post-Production, Motion Graphics, Project Management. Calculate totals and provide clear breakdowns.',
        projectScope,
        rateCardInfo,
        projectDetails,
        guidance:
          'Structure as: 1) Project Overview, 2) Budget Breakdown by Category, 3) Line Items with Quantities/Rates, 4) Totals and Payment Schedule',
      };

      const duration = performance.now() - startTime;

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'createBudget',
          success: true,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'createBudget',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      throw error; // Re-throw to maintain original behavior
    }
  },
});

// Create a simple debug tool for Asana testing
const debugAsanaTasksTool = new DynamicStructuredTool({
  name: 'debug_get_asana_tasks',
  description:
    'Get Asana tasks for debugging. Use this when user asks for Asana tasks or task lists. This is a debug tool that directly accesses Asana.',
  schema: z.object({
    workspace: z
      .string()
      .optional()
      .describe('Workspace ID (optional, will use default if not provided)'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Number of tasks to retrieve (default: 10)'),
  }),
  func: async ({ workspace, limit = 10 }) => {
    try {
      console.log('[DebugAsanaTool] Called with:', { workspace, limit });

      // Use the default workspace if none provided
      const workspaceId = workspace || process.env.DEFAULT_WORKSPACE_ID;

      if (!workspaceId) {
        return JSON.stringify({
          error: 'No workspace specified and no default workspace configured',
          solution:
            'Set DEFAULT_WORKSPACE_ID environment variable or provide workspace parameter',
        });
      }

      // Import and use the McpToolFactory to get tools
      const { McpToolFactory } = await import('./mcp/core/factory');
      const mockSession = { user: { id: 'debug-session-user' } };

      // Create tools for debug session
      const asanaTools = await McpToolFactory.createToolsForUser(
        'Asana',
        mockSession.user.id,
        'debug-session',
      );

      // Find the search tasks tool
      const searchTasksTool = asanaTools.find(
        (tool) => tool.name === 'asana_search_tasks',
      );

      if (!searchTasksTool) {
        return JSON.stringify({
          error: 'asana_search_tasks tool not found',
          availableTools: asanaTools.map((t) => t.name),
          totalTools: asanaTools.length,
        });
      }

      // Call the tool with proper parameters
      const result = await searchTasksTool.func({
        workspace: workspaceId,
        text: '',
        completed: false,
        limit: limit,
      });

      console.log('[DebugAsanaTool] Successfully retrieved tasks');

      return JSON.stringify({
        success: true,
        workspace: workspaceId,
        tasks: JSON.parse(result),
        message: `Found tasks in workspace ${workspaceId}`,
      });
    } catch (error) {
      console.error('[DebugAsanaTool] Error:', error);
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to retrieve Asana tasks',
      });
    }
  },
});

export async function getAvailableTools(session?: any) {
  const staticTools = [
    // Knowledge Base Tools
    listDocumentsTool,
    getDocumentContentsTool,
    multiDocumentRetrievalTool,
    searchAndRetrieveKnowledgeBase,
    queryDocumentRowsTool,
    // Utility Tools
    requestSuggestionsTool,
    createBudgetTool,
    // Search & Retrieval Tools
    tavilySearchTool,
    tavilyExtractTool,
    // Integration Tools
    googleCalendarTool,
    getMessagesFromOtherChatTool,
    // Debug Tools
    debugAsanaTasksTool,
  ];

  let integrationTools: DynamicStructuredTool[] = [];

  // Check if user has MCP integrations and load MCP tools
  if (session?.user?.id) {
    try {
      // DEVELOPMENT MODE: Check for Asana environment variables first
      const envAsanaToken = process.env.ASANA_ACCESS_TOKEN;
      if (envAsanaToken) {
        console.log(
          '[ToolIndex] DEVELOPMENT MODE: Loading Asana from environment variables',
        );
        try {
          const { McpToolFactory } = await import('./mcp/core/factory');
          const asanaTools = await McpToolFactory.createToolsForUser(
            'Asana',
            session.user.id,
            'env-session',
          );

          console.log(
            '[ToolIndex] Successfully loaded Asana tools from environment:',
            {
              toolCount: asanaTools.length,
              toolNames: asanaTools.map((t: DynamicStructuredTool) => t.name),
            },
          );
          integrationTools.push(...asanaTools);
        } catch (error) {
          console.error(
            '[ToolIndex] Error loading Asana tools from environment:',
            error,
          );
        }
      }

      // Load additional MCP tools from database integrations
      const mcpTools = await getUserMcpTools(session.user.id);

      if (mcpTools.length > 0) {
        console.log('[ToolIndex] Loading additional MCP tools from database:', {
          userId: session.user.id,
          mcpToolCount: mcpTools.length,
          mcpToolNames: mcpTools.map((t: DynamicStructuredTool) => t.name),
        });
        integrationTools.push(...mcpTools);
      }

      if (integrationTools.length === 0) {
        // No MCP integrations available
        console.log(
          '[ToolIndex] No MCP integrations found, no integration tools available',
        );
      }
    } catch (error) {
      console.error('[ToolIndex] Error loading MCP tools:', error);
      integrationTools = [];
    }
  } else {
    // No session, no integration tools available
    console.log(
      '[ToolIndex] No session provided, no integration tools available',
    );
    integrationTools = [];
  }

  console.log('[ToolIndex] Loading tools:', {
    staticTools: staticTools.length,
    integrationTools: integrationTools.length,
    total: staticTools.length + integrationTools.length,
    hasSession: !!session,
    userId: session?.user?.id,
  });

  return [...staticTools, ...integrationTools];
}

// Synchronous version for backward compatibility (without session-aware MCP tools)
function getAvailableToolsSync() {
  const staticTools = [
    // Knowledge Base Tools
    listDocumentsTool,
    getDocumentContentsTool,
    multiDocumentRetrievalTool,
    searchAndRetrieveKnowledgeBase,
    queryDocumentRowsTool,
    // Utility Tools
    requestSuggestionsTool,
    createBudgetTool,
    // Search & Retrieval Tools
    tavilySearchTool,
    tavilyExtractTool,
    // Integration Tools
    googleCalendarTool,
    getMessagesFromOtherChatTool,
  ];

  // No legacy tools available - only MCP integration supported
  const integrationTools: DynamicStructuredTool[] = [];

  return [...staticTools, ...integrationTools];
}

// For backward compatibility, export availableTools as synchronous array
export const availableTools = getAvailableToolsSync();

export {
  listDocumentsTool,
  getDocumentContentsTool,
  multiDocumentRetrievalTool,
  searchAndRetrieveKnowledgeBase,
  requestSuggestionsTool,
  tavilySearchTool,
  getMessagesFromOtherChatTool,
  googleCalendarTool,
  // Legacy Asana tools removed - only MCP integration supported
};
