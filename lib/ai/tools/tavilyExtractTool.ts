import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '../../services/observabilityService';

// Define the schema for the basic extract tool
const tavilyExtractSchema = z.object({
  urls: z
    .array(
      z
        .string()
        .describe(
          'A valid URL to extract content from (must be a valid HTTP/HTTPS URL).',
        ),
    )
    .describe('An array of URLs from which to extract content.'),
});

/**
 * A Langchain tool to extract content from web pages using the Tavily Extract API.
 */
export const tavilyExtractTool = new DynamicStructuredTool({
  name: 'extractWebContent',
  description:
    'Extracts the main content from a list of web page URLs using the Tavily API. Returns the extracted content for each successful URL and lists any URLs that failed.',
  schema: tavilyExtractSchema,
  func: async ({ urls }) => {
    const startTime = performance.now();
    console.log(
      `[tavilyExtractTool] Attempting to extract content from URLs: ${urls.join(', ')}`,
    );

    // Track tool usage analytics
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'tavilyExtract',
        urlCount: urls.length,
        urls: urls.slice(0, 3), // Store first 3 URLs for privacy
        timestamp: new Date().toISOString(),
      },
    });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.error(
        '[tavilyExtractTool] Missing TAVILY_API_KEY environment variable.',
      );

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilyExtract',
          success: false,
          error: 'Missing TAVILY_API_KEY',
          duration: Math.round(performance.now() - startTime),
          timestamp: new Date().toISOString(),
        },
      });

      return 'Error: Tavily API key is not configured. Cannot extract web content.';
    }

    const endpoint = 'https://api.tavily.com/extract';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: urls,
        }),
      });

      if (!response.ok) {
        let errorBody = `HTTP error ${response.status}`;
        try {
          const errorJson = await response.json();
          errorBody += `: ${JSON.stringify(errorJson)}`;
        } catch (e) {
          // Ignore if error body is not JSON
        }
        console.error(`[tavilyExtractTool] API call failed: ${errorBody}`);
        return `Error: Failed to extract content from Tavily API (${errorBody})`;
      }

      const data = await response.json();
      const duration = performance.now() - startTime;

      console.log(
        `[tavilyExtractTool] Successfully received response from Tavily Extract.`,
      );

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilyExtract',
          success: true,
          duration: Math.round(duration),
          urlCount: urls.length,
          resultsCount: data.results ? data.results.length : 0,
          failedCount: data.failed_results ? data.failed_results.length : 0,
          timestamp: new Date().toISOString(),
        },
      });

      // Process the extraction results properly
      const results = data.results || [];
      const failedResults = data.failed_results || [];

      console.log(
        `[tavilyExtractTool] Processing ${results.length} results and ${failedResults.length} failures`,
      );

      // Build formatted response with proper content extraction
      let output = `**Content Extraction Results**\n\n`;
      output += `**Summary:**\n`;
      output += `- Total URLs processed: ${urls.length}\n`;
      output += `- Successful extractions: ${results.length}\n`;
      output += `- Failed extractions: ${failedResults.length}\n\n`;

      if (results.length > 0) {
        output += `**EXTRACTED CONTENT:**\n\n`;
        results.forEach((result: any, index: number) => {
          // Fix: Use correct API field names - Extract API returns raw_content
          const content =
            result.raw_content ||
            result.content ||
            result.text ||
            result.body ||
            'No content available';

          console.log(`[tavilyExtractTool] Result ${index + 1} structure:`, {
            url: result.url,
            hasRawContent: !!result.raw_content,
            hasContent: !!result.content,
            hasText: !!result.text,
            hasBody: !!result.body,
            contentLength:
              content !== 'No content available' ? content.length : 0,
            availableFields: Object.keys(result).filter(
              (key) => result[key] !== null && result[key] !== undefined,
            ),
            firstChars:
              content !== 'No content available'
                ? content.substring(0, 100)
                : 'N/A',
          });

          output += `**Source ${index + 1}:**\n`;
          output += `URL: ${result.url}\n`;

          if (content !== 'No content available') {
            const wordCount = content.split(/\s+/).length;
            output += `Content Length: ${content.length} characters (${wordCount} words)\n`;
            output += `Content: ${content.substring(0, 1500)}${content.length > 1500 ? '...\n[Content truncated - total length: ' + content.length + ' characters]' : ''}\n\n`;
          } else {
            output += `Content: No extractable content found\n`;
            output += `Note: This may be due to anti-scraping protection, authentication requirements, or dynamic content\n\n`;
          }
        });
      } else {
        output += `**NO CONTENT EXTRACTED**\n`;
        output += `No content could be extracted from the provided URLs.\n\n`;
      }

      if (failedResults.length > 0) {
        output += `**Failed Extractions:**\n`;
        failedResults.forEach((failed: any, index: number) => {
          output += `${index + 1}. ${failed.url || failed} - ${failed.error || 'Unknown error'}\n`;
        });
        output += `\n`;
      }

      return output;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error('[tavilyExtractTool] Error executing fetch:', error);

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilyExtract',
          success: false,
          duration: Math.round(duration),
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });

      return `Error: Failed to execute web content extraction: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Define the schema for the search-then-extract tool
const tavilySearchThenExtractSchema = z.object({
  query: z.string().max(400).describe('Search query to find relevant URLs'),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe(
      'Minimum relevance score for URLs to extract (0-1, default: 0.5)',
    ),
  maxUrls: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .describe('Maximum number of top-scoring URLs to extract from'),
  extractDepth: z
    .enum(['basic', 'advanced'])
    .default('advanced')
    .describe('Extraction depth for selected URLs'),
  topic: z
    .enum(['general', 'news'])
    .default('general')
    .describe('Search topic: use "news" for recent news stories'),
  timeRange: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .nullable()
    .describe('Time range for news searches'),
  days: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .nullable()
    .describe('Number of days back for news searches (1-30)'),
});

/**
 * Enhanced search-then-extract tool implementing Tavily's recommended two-step process
 */
export const tavilySearchThenExtractTool = new DynamicStructuredTool({
  name: 'tavilySearchThenExtract',
  description: `
Implements Tavily's recommended two-step extraction process:
1. Search for relevant URLs using advanced search
2. Extract content from the highest-scoring results

This is the PREFERRED method for content extraction as it:
- Filters URLs by relevance score before extraction
- Reduces failed extractions by pre-validating sources
- Provides better content quality through score-based selection
- Follows Tavily's documented best practices
- Supports news-specific searches with time filtering

Use this instead of direct extraction when you need content about a topic but don't have specific URLs.
For news stories, set topic='news' and optionally specify timeRange or days.
`.trim(),
  schema: tavilySearchThenExtractSchema,
  func: async ({
    query,
    minScore = 0.5,
    maxUrls = 5,
    extractDepth = 'advanced',
    topic = 'general',
    timeRange,
    days,
  }) => {
    const startTime = performance.now();
    console.log(
      `[tavilySearchThenExtract] Two-step process: "${query}" → extract top ${maxUrls} URLs (score ≥ ${minScore}) [topic: ${topic}]`,
    );

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'tavilySearchThenExtract',
        query,
        topic,
        minScore,
        maxUrls,
        extractDepth,
        hasTimeFilter: !!(timeRange || days),
        timestamp: new Date().toISOString(),
      },
    });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.error(
        '[tavilySearchThenExtract] Missing TAVILY_API_KEY environment variable.',
      );
      return 'Error: Tavily API key is not configured. Cannot search and extract web content.';
    }

    let searchResults: any[] = [];
    let urlsToExtract: string[] = [];
    let highScoreResults: any[] = [];

    try {
      // Step 1: Search for relevant URLs with proper news configuration
      const searchBody: any = {
        query,
        search_depth: 'advanced',
        max_results: 15, // Get more results to filter from
        include_raw_content: false, // Don't extract content yet
        topic: topic,
      };

      // Add time filtering for news searches
      if (topic === 'news') {
        if (days) {
          searchBody.days = days;
        } else if (timeRange) {
          searchBody.time_range = timeRange;
        } else {
          // Default to last week for news if no time filter specified
          searchBody.days = 7;
        }
      }

      console.log(
        `[tavilySearchThenExtract] 🔍 Searching with config:`,
        searchBody,
      );

      const searchResponse = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(searchBody),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(
          `Search failed: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`,
        );
      }

      const searchData = await searchResponse.json();
      searchResults = searchData.results || [];

      console.log(`[tavilySearchThenExtract] 📊 Search results:`, {
        totalResults: searchResults.length,
        sampleScores: searchResults.slice(0, 3).map((r) => r.score),
        hasAnswer: !!searchData.answer,
      });

      // Filter and sort by score
      highScoreResults = searchResults
        .filter((result: any) => (result.score || 0) >= minScore)
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .slice(0, maxUrls);

      if (highScoreResults.length === 0) {
        return `No URLs found with score ≥ ${minScore} for query: "${query}"

**Search Results Summary:**
- Total results found: ${searchResults.length}
- Highest score: ${searchResults.length > 0 ? Math.max(...searchResults.map((r) => r.score || 0)).toFixed(2) : 'N/A'}
- Topic: ${topic}

**Recommendations:**
1. Lower the minScore threshold (try 0.3 or 0.2)
2. Broaden your search query
3. Try different search terms or topic setting`;
      }

      urlsToExtract = highScoreResults.map((result: any) => result.url);
      console.log(
        `[tavilySearchThenExtract] 🎯 Selected ${urlsToExtract.length} high-quality URLs for extraction`,
      );

      // Step 2: Extract content with enhanced timeout and retry logic
      const extractWithTimeout = async (
        urls: string[],
        depth: string,
        timeoutMs: number = 60000,
      ) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(
            `[tavilySearchThenExtract] ⏱️ TIMEOUT: Aborting extraction after ${timeoutMs}ms`,
          );
          controller.abort();
        }, timeoutMs);

        try {
          console.log(
            `[tavilySearchThenExtract] 🔧 Extracting from ${urls.length} URLs with ${depth} depth (timeout: ${timeoutMs}ms)`,
          );
          const response = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              urls,
              extract_depth: depth,
              include_images: false,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[tavilySearchThenExtract] ❌ Extract API error: ${response.status} ${response.statusText} - ${errorText}`,
            );
            throw new Error(
              `Extract API error: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn(
              `[tavilySearchThenExtract] ⏱️ Extraction timed out after ${timeoutMs}ms`,
            );
            throw new Error(`Extraction timeout after ${timeoutMs}ms`);
          }
          throw error;
        }
      };

      // Try extraction with extended timeout first
      console.log(
        `[tavilySearchThenExtract] Attempting extraction with ${extractDepth} depth and 60s timeout...`,
      );
      let extractResponse = await extractWithTimeout(
        urlsToExtract,
        extractDepth,
        60000,
      );

      let extractData = await extractResponse.json();
      let results = extractData.results || [];
      let failedResults = extractData.failedResults || [];

      console.log(`[tavilySearchThenExtract] 📊 Initial extraction results:`, {
        successfulResults: results.length,
        failedResults: failedResults.length,
        totalUrlsAttempted: urlsToExtract.length,
        extractDepth,
        sampleResult:
          results.length > 0
            ? {
                url: results[0].url,
                hasRawContent: !!results[0].raw_content,
                contentLength: results[0].raw_content
                  ? results[0].raw_content.length
                  : 0,
                availableFields: Object.keys(results[0]),
              }
            : null,
        sampleFailure: failedResults.length > 0 ? failedResults[0] : null,
      });

      // Enhanced fallback strategy if extraction fails
      if (results.length === 0 && failedResults.length > 0) {
        console.warn(
          `[tavilySearchThenExtract] Initial extraction failed. Trying fallback strategies...`,
        );

        // Fallback 1: Try with basic depth and longer timeout
        console.log(
          `[tavilySearchThenExtract] Fallback 1: Trying basic depth with 90s timeout...`,
        );
        try {
          extractResponse = await extractWithTimeout(
            urlsToExtract,
            'basic',
            90000,
          );
          extractData = await extractResponse.json();
          results = extractData.results || [];
          failedResults = extractData.failedResults || [];

          console.log(`[tavilySearchThenExtract] 📊 Fallback 1 results:`, {
            successfulResults: results.length,
            failedResults: failedResults.length,
          });
        } catch (error) {
          console.warn(`[tavilySearchThenExtract] Fallback 1 failed:`, error);
        }

        // Fallback 2: Try extracting URLs one by one if still failing
        if (results.length === 0 && urlsToExtract.length > 1) {
          console.log(
            `[tavilySearchThenExtract] Fallback 2: Trying individual URL extraction (top 3 URLs)...`,
          );
          const individualResults: any[] = [];
          const individualFailed: any[] = [];

          for (const url of urlsToExtract.slice(0, 3)) {
            // Limit to top 3 to avoid timeout
            try {
              console.log(
                `[tavilySearchThenExtract] 🔗 Attempting individual extraction: ${url}`,
              );
              const singleResponse = await extractWithTimeout(
                [url],
                'basic',
                45000,
              );
              const singleData = await singleResponse.json();

              console.log(
                `[tavilySearchThenExtract] 📊 Individual result for ${url}:`,
                {
                  hasResults: !!(
                    singleData.results && singleData.results.length > 0
                  ),
                  hasFailed: !!(
                    singleData.failedResults &&
                    singleData.failedResults.length > 0
                  ),
                  resultStructure:
                    singleData.results && singleData.results.length > 0
                      ? Object.keys(singleData.results[0])
                      : null,
                },
              );

              if (singleData.results && singleData.results.length > 0) {
                individualResults.push(...singleData.results);
                console.log(
                  `[tavilySearchThenExtract] ✅ Successfully extracted from: ${url}`,
                );
              } else if (singleData.failedResults) {
                individualFailed.push(...singleData.failedResults);
              }
            } catch (error) {
              console.warn(
                `[tavilySearchThenExtract] Failed to extract from ${url}:`,
                error,
              );
              individualFailed.push({
                url,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (individualResults.length > 0) {
            results = individualResults;
            failedResults = individualFailed;
            console.log(
              `[tavilySearchThenExtract] Individual extraction succeeded: ${results.length} results`,
            );
          }
        }

        // Fallback 3: Get more search results and try different URLs
        if (results.length === 0) {
          console.log(
            `[tavilySearchThenExtract] Fallback 3: Searching for alternative URLs...`,
          );
          try {
            const fallbackSearchBody: any = {
              query,
              search_depth: 'basic', // Use basic for speed
              max_results: 20,
              include_raw_content: true, // Get content directly from search
              topic: topic,
            };

            // Add time filtering for news in fallback too
            if (topic === 'news') {
              if (days) {
                fallbackSearchBody.days = days;
              } else if (timeRange) {
                fallbackSearchBody.time_range = timeRange;
              } else {
                fallbackSearchBody.days = 7;
              }
            }

            const fallbackSearchResponse = await fetch(
              'https://api.tavily.com/search',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(fallbackSearchBody),
              },
            );

            if (fallbackSearchResponse.ok) {
              const fallbackSearchData = await fallbackSearchResponse.json();
              const fallbackSearchResults = fallbackSearchData.results || [];

              // Filter out already attempted URLs and get new ones
              const newUrlsToTry = fallbackSearchResults
                .filter(
                  (r: any) =>
                    !urlsToExtract.includes(r.url) && (r.score || 0) >= 0.3,
                )
                .slice(0, 3)
                .map((r: any) => r.url);

              if (newUrlsToTry.length > 0) {
                console.log(
                  `[tavilySearchThenExtract] Trying ${newUrlsToTry.length} alternative URLs...`,
                );
                const altResponse = await extractWithTimeout(
                  newUrlsToTry,
                  'basic',
                  45000,
                );
                const altData = await altResponse.json();
                results = altData.results || [];
                failedResults = altData.failedResults || [];
                if (results.length > 0) {
                  urlsToExtract = [...urlsToExtract, ...newUrlsToTry];
                }
              }
            }
          } catch (error) {
            console.warn(`[tavilySearchThenExtract] Fallback 3 failed:`, error);
          }
        }
      }

      // Build comprehensive result
      const duration = performance.now() - startTime;
      let output = `**Two-Step Extraction Results for: "${query}"**\n\n`;
      output += `**Step 1 - Search Results:**\n`;
      output += `- Found ${searchResults.length} total results\n`;
      output += `- Selected ${highScoreResults.length} URLs with score ≥ ${minScore}\n`;
      if (highScoreResults.length > 0) {
        output += `- Score range: ${Math.min(...highScoreResults.map((r: any) => r.score)).toFixed(2)} - ${Math.max(...highScoreResults.map((r: any) => r.score)).toFixed(2)}\n`;
      }
      output += `\n**Step 2 - Content Extraction:**\n`;
      output += `- Extraction depth: ${extractDepth}\n`;
      output += `- Successful extractions: ${results.length}\n`;
      output += `- Failed extractions: ${failedResults.length}\n\n`;

      if (results.length > 0) {
        output += `**EXTRACTED CONTENT:**\n\n`;
        results.forEach((result: any, index: number) => {
          // Fix: Check for correct API field names based on Tavily documentation
          // Extract API returns: raw_content, url, images
          const content =
            result.raw_content ||
            result.content ||
            result.text ||
            result.body ||
            result.extracted_content ||
            'No content available';

          console.log(
            `[tavilySearchThenExtract] Result ${index + 1} structure:`,
            {
              url: result.url,
              title: result.title || 'No title',
              hasRawContent: !!result.raw_content,
              hasContent: !!result.content,
              hasText: !!result.text,
              hasBody: !!result.body,
              hasExtractedContent: !!result.extracted_content,
              contentLength:
                content !== 'No content available' ? content.length : 0,
              availableFields: Object.keys(result).filter(
                (key) => result[key] !== null && result[key] !== undefined,
              ),
              firstChars:
                content !== 'No content available'
                  ? content.substring(0, 100)
                  : 'N/A',
            },
          );

          output += `**Source ${index + 1}: ${result.title || 'Untitled'}**\n`;
          output += `URL: ${result.url}\n`;

          if (content !== 'No content available') {
            const wordCount = content.split(/\s+/).length;
            const hasStructure =
              content.includes('\n') ||
              content.includes('.') ||
              content.includes(',');

            output += `Content Length: ${content.length} characters (${wordCount} words)\n`;
            output += `Content Quality: ${hasStructure ? 'Well-structured' : 'Basic text'}\n`;
            output += `Content: ${content.substring(0, 2000)}${content.length > 2000 ? '...\n[Content truncated - total length: ' + content.length + ' characters]' : ''}\n\n`;
          } else {
            output += `Content: No extractable content found\n`;
            output += `Possible reasons: Anti-scraping protection, authentication required, or dynamic content\n\n`;
          }
        });

        const successfulExtractions = results.filter(
          (r: any) =>
            (r.raw_content && r.raw_content.length > 0) ||
            (r.content && r.content.length > 0),
        ).length;

        output += `**Extraction Summary:**\n`;
        output += `- Total URLs processed: ${results.length}\n`;
        output += `- Successful extractions: ${successfulExtractions}\n`;
        output += `- Success rate: ${((successfulExtractions / results.length) * 100).toFixed(1)}%\n\n`;
      } else {
        output += `**NO CONTENT EXTRACTED**\n`;
        output += `Despite multiple fallback attempts, no content could be extracted.\n\n`;
        output += `**Troubleshooting:**\n`;
        output += `1. Sites may have anti-scraping protection\n`;
        output += `2. Content may be behind authentication\n`;
        output += `3. Pages may be JavaScript-heavy or dynamic\n`;
        output += `4. Try searching for different or more specific terms\n`;
        output += `5. Consider using different domains or time ranges\n\n`;
      }

      if (failedResults.length > 0) {
        output += `**Failed Extractions:**\n`;
        failedResults.slice(0, 3).forEach((failed: any, index: number) => {
          output += `${index + 1}. ${failed.url} - ${failed.error || 'Unknown error'}\n`;
        });
        if (failedResults.length > 3) {
          output += `... and ${failedResults.length - 3} more\n`;
        }
        output += `\n`;
      }

      // Track success
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilySearchThenExtract',
          query,
          topic,
          success: true,
          duration: Math.round(duration),
          totalSearchResults: searchResults.length,
          selectedUrls: highScoreResults.length,
          successfulExtractions: results.length,
          failedExtractions: failedResults.length,
          timestamp: new Date().toISOString(),
        },
      });

      return output;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[tavilySearchThenExtract] Error:`, error);

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'tavilySearchThenExtract',
          query,
          topic,
          success: false,
          duration: Math.round(duration),
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      });

      return `Two-step extraction failed: ${error instanceof Error ? error.message : String(error)}

**This may be due to:**
1. Network connectivity issues
2. Tavily API rate limits or quota exceeded
3. Invalid API key configuration
4. Target websites blocking extraction

**Recommendations:**
1. Wait a moment and try again
2. Try a more specific or different search query
3. Check your Tavily API key and quota at https://tavily.com/dashboard
4. For news searches, ensure topic='news' is set`;
    }
  },
});
