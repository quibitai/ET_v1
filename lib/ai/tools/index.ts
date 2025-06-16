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
  try {
    // Get user's active MCP integrations
    const integrations =
      await McpIntegrationRepository.getUserMcpIntegrations(userId);

    if (integrations.length === 0) {
      return [];
    }

    const mcpService = new McpService();
    const allMcpTools: DynamicStructuredTool[] = [];

    // For each integration, connect and get tools
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
          `[ToolIndex] Error loading tools from integration ${integration.serverName}:`,
          error,
        );
      }
    }

    return allMcpTools;
  } catch (error) {
    console.error('[ToolIndex] Error loading user MCP tools:', error);
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
      const mcpTools = await getUserMcpTools(session.user.id);

      if (mcpTools.length > 0) {
        console.log('[ToolIndex] Loading MCP tools:', {
          userId: session.user.id,
          mcpToolCount: mcpTools.length,
          mcpToolNames: mcpTools.map((t: DynamicStructuredTool) => t.name),
        });
        integrationTools = mcpTools;
      } else {
        // No MCP integrations available
        console.log(
          '[ToolIndex] No MCP integrations found, no legacy tools available',
        );
        integrationTools = [];
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
