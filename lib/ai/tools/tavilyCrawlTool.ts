import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '../../services/observabilityService';

// Enhanced Tavily Crawl Tool with comprehensive site mapping and content discovery
const tavilyCrawlSchema = z.object({
  url: z
    .string()
    .describe('Starting URL to crawl (must be a valid, accessible URL)'),
  maxDepth: z
    .number()
    .min(1)
    .max(5)
    .default(1)
    .describe(
      'Crawl depth (1-5, default: 1). WARNING: depth > 2 can be very slow',
    ),
  maxBreadth: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum pages per level (1-50, default: 10)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe('Total page limit (1-100, default: 20)'),
  selectPaths: z
    .array(z.string())
    .optional()
    .nullable()
    .describe(
      'Regex patterns for paths to include (e.g., ["/docs/.*", "/api/.*"])',
    ),
  excludePaths: z
    .array(z.string())
    .optional()
    .nullable()
    .describe(
      'Regex patterns for paths to exclude (e.g., ["/private/.*", "/admin/.*"])',
    ),
  includeDomains: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Additional domains to include in crawl'),
  excludeDomains: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Domains to exclude from crawl'),
  timeoutSeconds: z
    .number()
    .min(10)
    .max(300)
    .default(60)
    .describe('Maximum crawl time in seconds (10-300, default: 60)'),
});

/**
 * Tavily Crawl Tool with proper timeout and resource controls
 *
 * IMPORTANT: This tool now has strict limits to prevent infinite crawling:
 * - Maximum crawl time: 60 seconds (configurable)
 * - Reduced default limits for faster completion
 * - Automatic timeout and abort mechanisms
 */
export const tavilyCrawlTool = new DynamicStructuredTool({
  name: 'tavilyCrawl',
  description: `
Crawl websites with STRICT LIMITS to prevent infinite execution.

**SAFETY FEATURES:**
- Maximum timeout: 60 seconds (configurable)
- Reduced default limits for faster completion
- Automatic abort on timeout or excessive resource usage

**Best Use Cases:**
- Small to medium documentation sites
- Focused content extraction with selectPaths
- Quick site structure analysis

**IMPORTANT LIMITS:**
- maxDepth: 1-3 (default: 1) - Higher values risk timeout
- maxBreadth: 5-50 (default: 10) - Controls pages per level
- limit: 5-100 (default: 20) - Total pages to crawl
- timeoutSeconds: 10-300 (default: 60) - Hard timeout

Start with minimal settings and increase gradually if needed.
`.trim(),
  schema: tavilyCrawlSchema,
  func: async ({
    url,
    maxDepth = 1,
    maxBreadth = 10,
    limit = 20,
    selectPaths,
    excludePaths,
    includeDomains,
    excludeDomains,
    timeoutSeconds = 60,
  }) => {
    const startTime = performance.now();
    console.log(
      `[tavilyCrawl] CONTROLLED crawl: ${url} (depth: ${maxDepth}, breadth: ${maxBreadth}, limit: ${limit}, timeout: ${timeoutSeconds}s)`,
    );

    // Create AbortController for timeout control
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(
        `[tavilyCrawl] TIMEOUT: Aborting crawl after ${timeoutSeconds} seconds`,
      );
      abortController.abort();
    }, timeoutSeconds * 1000);

    // Validate conservative parameters
    if (maxDepth > 2) {
      console.warn(
        `[tavilyCrawl] WARNING: High depth (${maxDepth}) may cause timeout. Consider depth=1-2.`,
      );
    }

    if (limit > 50) {
      console.warn(
        `[tavilyCrawl] WARNING: High limit (${limit}) may cause timeout. Consider limit=10-30.`,
      );
    }

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'tavilyCrawl',
        url,
        maxDepth,
        maxBreadth,
        limit,
        timeoutSeconds,
        hasSelectPaths: !!selectPaths?.length,
        hasExcludePaths: !!excludePaths?.length,
        hasIncludeDomains: !!includeDomains?.length,
        hasExcludeDomains: !!excludeDomains?.length,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      // Build conservative request payload
      const requestBody: any = {
        url,
        max_depth: maxDepth,
        max_breadth: maxBreadth,
        limit,
      };

      // Path filtering (key for focused crawling)
      if (selectPaths && selectPaths.length > 0) {
        requestBody.select_paths = selectPaths;
      }

      if (excludePaths && excludePaths.length > 0) {
        requestBody.exclude_paths = excludePaths;
      }

      if (includeDomains && includeDomains.length > 0) {
        requestBody.include_domains = includeDomains;
      }

      if (excludeDomains && excludeDomains.length > 0) {
        requestBody.exclude_domains = excludeDomains;
      }

      console.log(
        `[tavilyCrawl] Request config:`,
        JSON.stringify(requestBody, null, 2),
      );

      // Make API call with timeout control
      const response = await fetch('https://api.tavily.com/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal, // Enable timeout abort
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Tavily Crawl API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();
      const duration = performance.now() - startTime;

      console.log(
        `[tavilyCrawl] Completed in ${(duration / 1000).toFixed(1)}s:`,
        {
          hasResults: !!data.results,
          resultCount: data.results?.length || 0,
          hasFailedResults: !!data.failedResults,
          failedCount: data.failedResults?.length || 0,
          totalPages: data.total_pages || 0,
          crawlDepth: data.crawl_depth || 0,
        },
      );

      // Process crawl results
      const results = data.results || [];
      const failedResults = data.failedResults || [];
      const totalPages = data.total_pages || 0;
      const crawlDepth = data.crawl_depth || 0;

      const processedResult = processCrawlResults(results, failedResults, {
        url,
        totalPages,
        crawlDepth,
        maxDepth,
        maxBreadth,
        limit,
        timeoutSeconds,
        actualDuration: duration / 1000,
        selectPaths: selectPaths ?? undefined,
        excludePaths: excludePaths ?? undefined,
        includeDomains: includeDomains ?? undefined,
        excludeDomains: excludeDomains ?? undefined,
      });

      // Track success
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilyCrawl',
          url,
          success: true,
          duration: Math.round(duration),
          totalPages,
          crawlDepth,
          successfulPages: results.length,
          failedPages: failedResults.length,
          timestamp: new Date().toISOString(),
        },
      });

      return processedResult;
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      const duration = performance.now() - startTime;

      console.error(
        `[tavilyCrawl] Error after ${(duration / 1000).toFixed(1)}s:`,
        error,
      );

      // Handle specific error types
      let errorMessage = '';
      let troubleshooting = '';

      if ((error as any)?.name === 'AbortError') {
        errorMessage = `Crawl timed out after ${timeoutSeconds} seconds`;
        troubleshooting = `**TIMEOUT TROUBLESHOOTING:**
1. Reduce maxDepth to 1 for faster crawling
2. Reduce limit to 10-20 pages maximum
3. Use selectPaths to focus on specific sections
4. Try basic extractDepth for faster processing
5. Increase timeoutSeconds if the site is known to be slow`;
      } else if (
        error instanceof Error &&
        (error.message.includes('403') || error.message.includes('Forbidden'))
      ) {
        errorMessage = 'Site blocks automated crawling';
        troubleshooting = `**ACCESS DENIED TROUBLESHOOTING:**
1. Check the site's robots.txt file
2. Try tavilySearch + tavilyExtract instead
3. Use a different approach for this content`;
      } else if (
        error instanceof Error &&
        (error.message.includes('429') || error.message.includes('rate limit'))
      ) {
        errorMessage = 'API rate limit exceeded';
        troubleshooting = `**RATE LIMIT TROUBLESHOOTING:**
1. Wait a few minutes before retrying
2. Reduce the crawl scope (lower limits)
3. Use tavilySearch for targeted content`;
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
        troubleshooting = `**GENERAL TROUBLESHOOTING:**
1. Verify the URL is accessible and properly formatted
2. Try reducing maxDepth and limit parameters
3. Use selectPaths to focus crawling
4. Consider using tavilySearch + tavilyExtract for specific content`;
      }

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilyCrawl',
          url,
          success: false,
          duration: Math.round(duration),
          error: errorMessage,
          errorType: (error as any)?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        },
      });

      return `Crawl failed for ${url}: ${errorMessage}

${troubleshooting}

**Current Settings:**
- Depth: ${maxDepth}, Breadth: ${maxBreadth}, Limit: ${limit}
- Timeout: ${timeoutSeconds}s, Actual Duration: ${(duration / 1000).toFixed(1)}s
- Select Paths: ${selectPaths?.join(', ')}, Exclude Paths: ${excludePaths?.join(', ')}
- Include Domains: ${includeDomains?.join(', ')}, Exclude Domains: ${excludeDomains?.join(', ')}`;
    }
  },
});

/**
 * Process crawl results - FIXED to show actual content instead of just analysis
 */
function processCrawlResults(
  results: any[],
  failedResults: any[],
  config: {
    url: string;
    totalPages: number;
    crawlDepth: number;
    maxDepth: number;
    maxBreadth: number;
    limit: number;
    timeoutSeconds: number;
    actualDuration: number;
    selectPaths?: string[];
    excludePaths?: string[];
    includeDomains?: string[];
    excludeDomains?: string[];
  },
): string {
  let output = `**Website Crawl Results for: ${config.url}**\n\n`;

  // Brief performance summary
  output += `**Crawl Summary:**\n`;
  output += `- Pages Found: ${config.totalPages}\n`;
  output += `- Successfully Extracted: ${results.length} pages\n`;
  output += `- Failed: ${failedResults.length} pages\n`;
  output += `- Execution Time: ${config.actualDuration.toFixed(1)}s\n\n`;

  // Process successful extractions - SHOW ACTUAL CONTENT
  if (results.length > 0) {
    output += `**EXTRACTED CONTENT:**\n\n`;

    let totalContentLength = 0;

    // Process each result and show FULL CONTENT (not just previews)
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      // Fix: Use correct API field names (raw_content vs rawContent)
      const content =
        result.raw_content ||
        result.rawContent ||
        result.content ||
        result.text ||
        'No content available';
      totalContentLength += content.length;

      output += `**Page ${index + 1}: ${result.title || 'Untitled'}**\n`;
      output += `**URL:** ${result.url}\n`;
      output += `**Content Length:** ${content.length} characters\n\n`;

      // Show FULL CONTENT (not just preview)
      if (content && content !== 'No content available') {
        output += `**CONTENT:**\n`;
        output += `${content}\n\n`;
      } else {
        output += `**CONTENT:** No extractable content found\n\n`;
      }

      output += `${'='.repeat(80)}\n\n`;
    }

    output += `**Total Content Extracted:** ${totalContentLength.toLocaleString()} characters across ${results.length} pages\n\n`;
  } else {
    output += `**No content was successfully extracted.**\n\n`;
  }

  // Show failed extractions (brief)
  if (failedResults.length > 0) {
    output += `**Failed Extractions (${failedResults.length}):**\n`;
    const showFailures = Math.min(3, failedResults.length);
    for (let i = 0; i < showFailures; i++) {
      const failed = failedResults[i];
      output += `- ${failed.url}: ${failed.error || 'Unknown error'}\n`;
    }
    if (failedResults.length > showFailures) {
      output += `- ... and ${failedResults.length - showFailures} more failures\n`;
    }
    output += `\n`;
  }

  return output;
}

export const crawlWebsite = tavilyCrawlTool;
