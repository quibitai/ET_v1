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

// Import the new ToolRegistry for manifest enrichment
import { ToolRegistry } from './registry';

// Legacy Asana tools removed - only MCP integration supported

// Create a singleton instance of ToolRegistry
const toolRegistry = new ToolRegistry();

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

  // Enhance with manifest metadata
  const enrichedTools = await toolRegistry.enrichToolsWithManifests(tools);

  // Return tools with enhanced descriptions
  return enrichedTools.map(({ tool, enrichedDescription }) => {
    if (enrichedDescription && enrichedDescription !== tool.description) {
      // Create a new tool instance with enhanced description
      return new DynamicStructuredTool({
        name: tool.name,
        description: enrichedDescription,
        schema: tool.schema,
        func: tool.func,
      });
    }
    return tool;
  });
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
    // Search & Retrieval Tools
    tavilySearchTool,
    tavilyExtractTool,
    // Integration Tools
    googleCalendarTool,
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
    // Search & Retrieval Tools
    tavilySearchTool,
    tavilyExtractTool,
    // Integration Tools
    googleCalendarTool,
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

  // Enhance static tools with manifests as well
  const allTools = [...staticTools, ...integrationTools];
  const enrichedTools = await toolRegistry.enrichToolsWithManifests(allTools);

  return enrichedTools.map(({ tool, enrichedDescription }) => {
    if (enrichedDescription && enrichedDescription !== tool.description) {
      return new DynamicStructuredTool({
        name: tool.name,
        description: enrichedDescription,
        schema: tool.schema,
        func: tool.func,
      });
    }
    return tool;
  });
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
