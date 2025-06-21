/**
 * Search and Retrieve Internal Knowledge Base Tool (Supabase Vector Search Version)
 *
 * Performs semantic search using embeddings and calls the match_documents Supabase function.
 * This tool now returns the FULL content of the best matching document.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai'; // Using OpenAI for embeddings
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase URL or Key for searchInternalKnowledgeBase tool.',
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Embeddings Model (Consider making this a shared instance)
// Ensure OPENAI_API_KEY is set in your environment
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Missing OPENAI_API_KEY for searchInternalKnowledgeBase tool's embedding generation.",
  );
}
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small', // Or your preferred embedding model
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Tool response type definition
 */
type SearchResponse = {
  success: boolean;
  results?: Array<{
    title: string;
    similarity: number;
    content: string;
    metadata?: Record<string, any>;
  }>;
  error?: string;
  metadata?: Record<string, any>;
};

export const searchAndRetrieveKnowledgeBase = new DynamicStructuredTool({
  name: 'searchInternalKnowledgeBase',
  description: `Searches the internal knowledge base and returns the FULL CONTENT of the most relevant document. Use this to answer questions, retrieve examples, get templates, or find client research. When a user asks for "the contents of a file," this is the primary tool to use.`,
  schema: z.object({
    query: z
      .string()
      .describe('The question or topic to semantically search for.'),
    match_count: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe(
        'Number of results to consider. The tool will return the content of the top result.',
      ),
    filter: z
      .record(z.string())
      .optional()
      .nullable()
      .describe(
        'Optional JSONB filter for metadata (e.g., {"file_title": "Specific Title"}).',
      ),
  }),
  func: async ({ query, match_count = 1, filter }): Promise<string> => {
    const startTime = performance.now();
    const normalizedFilter = filter || {};
    console.log(
      `[searchAndRetrieveKnowledgeBase] Searching "${query}" (k=${match_count}, filter=${JSON.stringify(normalizedFilter)})`,
    );

    // Track tool usage analytics
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'searchInternalKnowledgeBase',
        query: query.substring(0, 100), // Limit for privacy
        matchCount: match_count,
        hasFilter: normalizedFilter
          ? Object.keys(normalizedFilter).length > 0
          : false,
        timestamp: new Date().toISOString(),
      },
    });

    if (!supabaseUrl || !supabaseKey) {
      const duration = performance.now() - startTime;

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'searchInternalKnowledgeBase',
          success: false,
          error: 'Missing Supabase credentials',
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return JSON.stringify({
        success: false,
        error: 'Supabase credentials are not configured.',
        metadata: { reason: 'configuration_error' },
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      const duration = performance.now() - startTime;

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'searchInternalKnowledgeBase',
          success: false,
          error: 'Missing OpenAI API key',
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return JSON.stringify({
        success: false,
        error: 'OpenAI API key is not configured for embeddings.',
        metadata: { reason: 'configuration_error' },
      });
    }

    try {
      // 1) generate embedding
      const queryEmbedding = await embeddings.embedQuery(query);

      // 2) call RPC
      const { data: docs, error: rpcError } = await supabase.rpc(
        'match_documents',
        {
          query_embedding: queryEmbedding,
          match_count,
          filter: normalizedFilter,
        },
      );

      if (rpcError) {
        const duration = performance.now() - startTime;

        console.error('[searchAndRetrieveKnowledgeBase] RPC error', rpcError);

        // Track error
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'searchInternalKnowledgeBase',
            success: false,
            error: `RPC error: ${rpcError.message}`,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return JSON.stringify({
          success: false,
          error: `Error during vector search: ${rpcError.message}`,
          metadata: {
            errorType: 'rpc_error',
            code: rpcError.code,
            details: rpcError.details,
          },
        });
      }

      // 3) format results
      const duration = performance.now() - startTime;

      if (!Array.isArray(docs) || docs.length === 0) {
        // Track no results
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'searchInternalKnowledgeBase',
            success: true,
            duration: Math.round(duration),
            resultsCount: 0,
            timestamp: new Date().toISOString(),
          },
        });

        return `No documents found in the knowledge base matching the query: "${query}". Try a broader search term.`;
      }

      // Take the top result
      const topDoc = docs[0];
      const title = topDoc.metadata?.file_title || 'Unknown Title';
      const content = topDoc.content || 'No content found.';
      const similarity = topDoc.similarity ?? 0;

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'searchInternalKnowledgeBase',
          success: true,
          duration: Math.round(duration),
          resultsCount: docs.length,
          topSimilarity: Math.round(similarity * 100) / 100,
          documentTitle: title.substring(0, 50), // Limit for privacy
          timestamp: new Date().toISOString(),
        },
      });

      const result = {
        title: title,
        content: content, // Return the FULL content
        similarity: similarity,
        metadata: topDoc.metadata || {},
      };

      const response = `Successfully retrieved document titled "${title}" (Similarity: ${similarity.toFixed(2)}).\n\nFULL CONTENT:\n${content}`;

      console.log(
        `[searchAndRetrieveKnowledgeBase] Returning full content of "${title}"`,
      );
      return response;
    } catch (err: any) {
      const duration = performance.now() - startTime;

      console.error('[searchAndRetrieveKnowledgeBase] Unexpected error:', err);

      // Track unexpected error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'searchInternalKnowledgeBase',
          success: false,
          error: `Unexpected error: ${err.message}`,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return JSON.stringify({
        success: false,
        error: `Unexpected error during search: ${err.message}`,
        metadata: {
          errorType: err.name || 'Unknown',
          query,
        },
      });
    }
  },
});
