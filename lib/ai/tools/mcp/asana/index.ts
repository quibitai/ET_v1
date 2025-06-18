/**
 * Asana MCP Integration
 *
 * Pure MCP-based Asana tool integration.
 * This replaces the direct API approach with standardized MCP communication.
 */

import type { DynamicStructuredTool } from '@langchain/core/tools';
import { McpToolFactory } from '../core/factory';
import type { RequestLogger } from '@/lib/services/observabilityService';

/**
 * Create Asana tools using MCP protocol
 */
export async function createAsanaTools(
  userId: string,
  sessionId: string,
  logger?: RequestLogger,
): Promise<DynamicStructuredTool[]> {
  const SERVER_NAME = 'Asana';

  try {
    // Check if Asana MCP is available for this user
    const isAvailable = await McpToolFactory.isServerAvailable(
      SERVER_NAME,
      userId,
    );
    if (!isAvailable) {
      console.warn(
        `[AsanaMCP] Asana MCP server not available for user ${userId}`,
      );
      return [];
    }

    // Create tools using the universal MCP factory
    const tools = await McpToolFactory.createToolsForUser(
      SERVER_NAME,
      userId,
      sessionId,
      logger,
    );

    console.log(
      `[AsanaMCP] Created ${tools.length} Asana tools for user ${userId}`,
    );
    return tools;
  } catch (error) {
    console.error(
      `[AsanaMCP] Failed to create Asana tools for user ${userId}:`,
      error,
    );
    return [];
  }
}

/**
 * Check if Asana MCP integration is available for a user
 */
export async function isAsanaMcpAvailable(userId: string): Promise<boolean> {
  return McpToolFactory.isServerAvailable('Asana', userId);
}

/**
 * Legacy compatibility function
 * @deprecated Use createAsanaTools instead
 */
export function createAsanaToolsLegacy(
  sessionId: string,
): DynamicStructuredTool[] {
  console.warn(
    '[AsanaMCP] Legacy createAsanaTools called - requires userId for MCP. Returning empty array.',
  );
  return [];
}

export default createAsanaTools;
