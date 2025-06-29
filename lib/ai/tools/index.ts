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

import { getMessagesFromOtherChatTool } from './getMessagesFromOtherChatTool';
import { listDocumentsTool } from './list-documents';
import { getDocumentContentsTool } from './get-document-contents';
import { multiDocumentRetrievalTool } from './multi-document-retrieval';
import { tavilySearchTool } from './tavily-search';
import {
  tavilyExtractTool,
  tavilySearchThenExtractTool,
} from './tavilyExtractTool';
import { tavilyCrawlTool } from './tavilyCrawlTool';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Legacy Asana tools import removed - only MCP integration supported

// Import MCP integration repository for loading user MCP tools
import { McpIntegrationRepository } from '@/lib/db/repositories/mcpIntegrations';
import { McpService } from '@/lib/services/mcpService';

// Import the new toolRegistry for manifest enrichment
import { toolRegistry } from './registry';

// Legacy Asana tools removed - only MCP integration supported

/**
 * Loads MCP tools for a specific user
 */
async function getUserMcpTools(
  userId: string,
): Promise<DynamicStructuredTool[]> {
  try {
    const allMcpTools: DynamicStructuredTool[] = [];

    // DEVELOPMENT MODE: Check for environment variable based MCP tools first
    const envAsanaToken = process.env.ASANA_ACCESS_TOKEN;

    // Always prefer new MCP implementation when available
    let asanaToolsLoaded = false;
    if (envAsanaToken) {
      try {
        // Use the new AsanaMCPClient implementation
        const { createAsanaTools } = await import('./mcp/asana');

        const asanaTools = await createAsanaTools(userId, 'env-session');

        if (asanaTools.length > 0) {
          allMcpTools.push(...asanaTools);
          asanaToolsLoaded = true;
          console.log(
            `[MCP] Successfully loaded ${asanaTools.length} Asana tools using new MCP client`,
          );
        }
      } catch (error) {
        console.error('[MCP] New Asana client failed:', error);
        // Fall back to database lookup if new client fails
      }
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
          continue;
        }

        // Skip if we already loaded this server from environment variables
        if (
          (server.name === 'Asana' || server.name === 'asana') &&
          asanaToolsLoaded
        ) {
          console.log(
            `[MCP] Skipping database Asana lookup - already loaded ${allMcpTools.filter((t) => t.name.includes('asana')).length} tools from new MCP client`,
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
          continue;
        }

        // Connect to MCP server
        const client = await mcpService.connectToServer(
          server,
          userId,
          accessToken,
        );
        if (!client) {
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
      } catch (error) {
        // Silently handle error in production
      }
    }

    return allMcpTools;
  } catch (error) {
    return [];
  }
}

/**
 * Enhanced version of getUserMcpTools with manifest enrichment
 * This is the new V2 function that adds metadata without breaking existing functionality
 */
async function getUserMcpToolsV2(
  userId: string,
): Promise<DynamicStructuredTool[]> {
  // Get tools using the existing function
  const tools = await getUserMcpTools(userId);

  // For now, return tools as-is
  // TODO: Implement manifest enrichment via the new unified registry
  return tools;
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
    // Search & Retrieval Tools - Tavily Web Search
    tavilySearchTool,
    tavilyExtractTool,
    tavilySearchThenExtractTool,
    tavilyCrawlTool,
    // Integration Tools
    getMessagesFromOtherChatTool,
  ];

  let integrationTools: DynamicStructuredTool[] = [];

  // Check if user has MCP integrations and load MCP tools
  if (session?.user?.id) {
    try {
      // DEVELOPMENT MODE: Use new MCP implementation directly
      const envAsanaToken = process.env.ASANA_ACCESS_TOKEN;
      if (envAsanaToken) {
        try {
          // Use the new AsanaMCPClient implementation
          const { createAsanaTools } = await import('./mcp/asana');
          const asanaTools = await createAsanaTools(
            session.user.id,
            'env-session',
          );

          if (asanaTools.length > 0) {
            integrationTools.push(...asanaTools);
            console.log(
              `[MCP] getAvailableTools: Loaded ${asanaTools.length} Asana tools using new MCP client`,
            );
          }
        } catch (error) {
          console.error(
            '[MCP] getAvailableTools: New Asana client failed:',
            error,
          );
          // Silently handle error in production
        }
      }

      // Load additional MCP tools from database integrations
      const mcpTools = await getUserMcpTools(session.user.id);

      if (mcpTools.length > 0) {
        integrationTools.push(...mcpTools);
      }

      // Load Google Workspace tools if user has valid session with access token
      if (session.accessToken && session.user.email) {
        try {
          const { createGoogleWorkspaceTools } = await import(
            './mcp/google-workspace'
          );
          const googleWorkspaceTools = await createGoogleWorkspaceTools(
            session.user.id,
            `session-${session.user.id}`,
            session.accessToken,
            session.user.email,
          );

          if (googleWorkspaceTools.length > 0) {
            integrationTools.push(...googleWorkspaceTools);
            console.log(
              `[MCP] getAvailableTools: Loaded ${googleWorkspaceTools.length} Google Workspace tools`,
            );
          }
        } catch (error) {
          console.error(
            '[MCP] getAvailableTools: Google Workspace client failed:',
            error,
          );
          // Silently handle error in production
        }
      }
    } catch (error) {
      integrationTools = [];
    }
  }

  return [...staticTools, ...integrationTools];
}

/**
 * Enhanced version of getAvailableTools with manifest enrichment
 * This is the new V2 function that adds metadata without breaking existing functionality
 */
export async function getAvailableToolsV2(session?: any) {
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
    // Search & Retrieval Tools - Tavily Web Search
    tavilySearchTool,
    tavilyExtractTool,
    tavilySearchThenExtractTool,
    tavilyCrawlTool,
    // Integration Tools
    getMessagesFromOtherChatTool,
  ];

  let integrationTools: DynamicStructuredTool[] = [];

  // Check if user has MCP integrations and load MCP tools
  if (session?.user?.id) {
    try {
      // Use the enhanced V2 function for MCP tools
      const mcpTools = await getUserMcpToolsV2(session.user.id);

      if (mcpTools.length > 0) {
        integrationTools.push(...mcpTools);
      }
    } catch (error) {
      integrationTools = [];
    }
  }

  // For now, return tools as-is
  // TODO: Implement manifest enrichment via the new unified registry
  const allTools = [...staticTools, ...integrationTools];
  return allTools;
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
    // Search & Retrieval Tools - Tavily Web Search
    tavilySearchTool,
    tavilyExtractTool,
    tavilySearchThenExtractTool,
    tavilyCrawlTool,
    // Integration Tools
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
  getMessagesFromOtherChatTool,
  // Tavily Web Search Tools
  tavilySearchTool,
  tavilyExtractTool,
  tavilySearchThenExtractTool,
  tavilyCrawlTool,
  // Legacy Asana tools removed - only MCP integration supported
};

// MCP Tools
export * from './mcp/asana';
export * from './mcp/google-workspace';
