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
// Weather tool removed - focusing on core business functionality
import { tavilySearchTool } from './tavily-search';
import { tavilyExtractTool } from './tavilyExtractTool';
import { googleCalendarTool } from './googleCalendarTool';
import { getMessagesFromOtherChatTool } from './getMessagesFromOtherChatTool';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Import Asana tools from the new modular structure
import { createAsanaTools } from './asana/integration/tool-factory-simple';

// Create Asana tool instances lazily to avoid startup validation errors
let asanaTools: ReturnType<typeof createAsanaTools> | null = null;

function getAsanaTools() {
  if (!asanaTools) {
    try {
      console.log('[AsanaTools] Creating Asana tools...');
      asanaTools = createAsanaTools('default-session');
      console.log(
        '[AsanaTools] Successfully created',
        asanaTools.length,
        'tools:',
        asanaTools.map((t) => t.name),
      );
    } catch (error) {
      console.error('[AsanaTools] Failed to create Asana tools:', error);
      asanaTools = []; // Return empty array on error to prevent crashes
    }
  }
  return asanaTools;
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

export function getAvailableTools() {
  const staticTools = [
    queryDocumentRowsTool,
    searchAndRetrieveKnowledgeBase,
    requestSuggestionsTool,
    tavilySearchTool,
    tavilyExtractTool,
    googleCalendarTool,
    getMessagesFromOtherChatTool,
    createBudgetTool,
  ];

  // Get Asana tools dynamically each time
  const asanaTools = getAsanaTools();

  console.log('[ToolIndex] Loading tools:', {
    staticTools: staticTools.length,
    asanaTools: asanaTools.length,
    total: staticTools.length + asanaTools.length,
  });

  return [...staticTools, ...asanaTools];
}

// For backward compatibility, export availableTools as a getter
export const availableTools = getAvailableTools();

export {
  searchAndRetrieveKnowledgeBase,
  requestSuggestionsTool,
  tavilySearchTool,
  getMessagesFromOtherChatTool,
  googleCalendarTool,
  getAsanaTools, // Modern Asana function calling tools getter
};
