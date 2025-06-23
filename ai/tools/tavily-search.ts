import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Ensure TAVILY_API_KEY is set in your .env.local file
// The tool will automatically look for process.env.TAVILY_API_KEY

// Create schema for the Tavily search
const tavilySearchSchema = z.object({
  query: z.string().describe('The search query to look up on the web'),
});

/**
 * Tavily Search Tool (Direct Integration)
 *
 * Uses the Tavily Search API to find relevant information on the web.
 * Leverages the TavilySearchResults tool from @langchain/community.
 * Automatically uses the TAVILY_API_KEY environment variable.
 */
export const tavilySearchTool = new DynamicStructuredTool({
  name: 'tavilySearch',
  description:
    'Search the web for comprehensive information about companies, organizations, current events, industry trends, or any external information. Returns up to 12 diverse results per search. IMPORTANT: Use broad, comprehensive queries that capture multiple aspects (e.g., "LWCC Baton Rouge company profile mission values leadership recent news" instead of separate searches). Essential for research tasks requiring current data.',
  schema: tavilySearchSchema,
  func: async ({ query }) => {
    const startTime = performance.now();
    console.log(`[tavilySearchTool] Searching for: "${query}"`);

    // Track tool usage analytics
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'tavilySearch',
        query: query,
        timestamp: new Date().toISOString(),
      },
    });

    // Create an instance of TavilySearchResults
    const tavilySearch = new TavilySearchResults({
      maxResults: 12,
      apiKey: process.env.TAVILY_API_KEY,
      includeAnswer: true,
      includeRawContent: true,
    });

    try {
      // Call the Tavily API using the underlying tool
      const result = await tavilySearch.invoke(query);
      const duration = performance.now() - startTime;

      console.log(
        `[tavilySearchTool] Successfully received results for query: "${query}"`,
      );

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilySearch',
          query: query,
          success: true,
          duration: Math.round(duration),
          resultCount: Array.isArray(result) ? result.length : 1,
          timestamp: new Date().toISOString(),
        },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error(
        `[tavilySearchTool] Error searching for "${query}":`,
        error,
      );

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilySearch',
          query: query,
          success: false,
          duration: Math.round(duration),
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });

      return `Error: Failed to search for "${query}". ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Export with a more descriptive name for consistency with other tools
export const searchWeb = tavilySearchTool;
