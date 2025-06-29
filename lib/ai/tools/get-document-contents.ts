/**
 * Get Document Contents Tool
 *
 * Retrieves the full text content of a document from the knowledge base
 * using its ID from the document_metadata table.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
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
  console.error('Missing Supabase URL or Key for getDocumentContents tool.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const getDocumentContentsTool = new DynamicStructuredTool({
  name: 'getDocumentContents',
  description: `🗂️ KNOWLEDGE_BASE: Retrieves the full text content of a document from the INTERNAL knowledge base using its ID.
    
    **ALWAYS USE THIS TOOL WHEN:**
    - User asks for "company" documents, policies, values, or internal content
    - Document ID comes from listDocuments results (starts with /api/documents/)
    - Query mentions "Echo Tango's", "our company's", or internal business content
    
    **NEVER USE GOOGLE DRIVE TOOLS** for knowledge base document IDs - even if the ID looks like a Google Drive ID!
    Google Drive tools are ONLY for user's personal/work Google Drive files.
    
    First tries exact ID match, then falls back to fuzzy title matching if ID not found.
    Use listDocuments first to get valid document IDs.`,
  schema: z.object({
    document_id: z
      .string()
      .describe(
        'The document ID or title to retrieve. For exact matches, use the ID from listDocuments.',
      ),
  }),
  func: async ({ document_id }): Promise<string> => {
    const startTime = performance.now();
    console.log(
      `[getDocumentContents] Fetching content for document_id=${document_id}`,
    );

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'getDocumentContents',
        documentId: document_id,
        timestamp: new Date().toISOString(),
      },
    });

    if (!supabaseUrl || !supabaseKey) {
      const duration = performance.now() - startTime;

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getDocumentContents',
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

    try {
      // 1) First try to get document metadata by exact ID match
      let { data: metaData, error: metaError } = await supabase
        .from('document_metadata')
        .select('id, title, url, created_at, schema')
        .eq('id', document_id)
        .single();

      // 2) If no exact match, try fuzzy title matching
      if (metaError || !metaData) {
        if (metaError && metaError.code !== 'PGRST116') {
          // PGRST116 is "not found", other errors are real problems
          const duration = performance.now() - startTime;
          console.error(
            '[getDocumentContents] Metadata lookup error:',
            metaError,
          );

          await trackEvent({
            eventName: ANALYTICS_EVENTS.TOOL_USED,
            properties: {
              toolName: 'getDocumentContents',
              success: false,
              error: `Metadata lookup error: ${metaError.message}`,
              duration: Math.round(duration),
              timestamp: new Date().toISOString(),
            },
          });

          return JSON.stringify({
            success: false,
            error: `Error looking up document metadata: ${metaError.message}`,
            metadata: {
              errorType: 'metadata_lookup_error',
              details: metaError.details,
            },
          });
        }

        // Try fuzzy title match with multiple strategies
        console.log(
          '[getDocumentContents] No exact ID match, trying title match',
        );

        // Strategy 1: Try exact phrase match first
        let { data: metaList, error: titleError } = await supabase
          .from('document_metadata')
          .select('id, title, url, created_at, schema')
          .ilike('title', `%${document_id}%`)
          .limit(1);

        // Strategy 2: If no exact phrase match, try individual keywords
        if ((!metaList || metaList.length === 0) && !titleError) {
          console.log('[getDocumentContents] Trying keyword-based matching');

          // Extract meaningful keywords (ignore common words)
          const keywords = document_id
            .toLowerCase()
            .split(/\s+/)
            .filter(
              (word) =>
                word.length > 2 &&
                ![
                  'the',
                  'and',
                  'or',
                  'of',
                  'in',
                  'on',
                  'at',
                  'to',
                  'for',
                  'with',
                  'by',
                  'file',
                  'document',
                ].includes(word),
            );

          if (keywords.length > 0) {
            // Build a query that matches any of the keywords
            const keywordQuery = keywords
              .map((keyword) => `title.ilike.%${keyword}%`)
              .join(',');

            const { data: keywordResults, error: keywordError } = await supabase
              .from('document_metadata')
              .select('id, title, url, created_at, schema')
              .or(keywordQuery)
              .limit(5); // Get multiple results to find best match

            if (!keywordError && keywordResults && keywordResults.length > 0) {
              // Score results based on keyword matches
              const scoredResults = keywordResults.map((doc) => {
                const titleLower = doc.title.toLowerCase();
                const score = keywords.reduce((acc, keyword) => {
                  return acc + (titleLower.includes(keyword) ? 1 : 0);
                }, 0);
                return { ...doc, score };
              });

              // Sort by score (most keyword matches first)
              scoredResults.sort((a, b) => b.score - a.score);
              metaList = [scoredResults[0]];

              console.log(
                `[getDocumentContents] Keyword match found: "${metaList[0].title}" (score: ${scoredResults[0].score})`,
              );
            }
          }
        }

        if (titleError) {
          const duration = performance.now() - startTime;
          console.error(
            '[getDocumentContents] Title lookup error:',
            titleError,
          );

          await trackEvent({
            eventName: ANALYTICS_EVENTS.TOOL_USED,
            properties: {
              toolName: 'getDocumentContents',
              success: false,
              error: `Title lookup error: ${titleError.message}`,
              duration: Math.round(duration),
              timestamp: new Date().toISOString(),
            },
          });

          return `Error: Unable to lookup document by title: ${titleError.message}`;
        }

        if (!metaList || metaList.length === 0) {
          const duration = performance.now() - startTime;

          await trackEvent({
            eventName: ANALYTICS_EVENTS.TOOL_USED,
            properties: {
              toolName: 'getDocumentContents',
              success: false,
              error: 'Document not found',
              duration: Math.round(duration),
              timestamp: new Date().toISOString(),
            },
          });

          return `Error: No document found matching "${document_id}". Use listDocuments to see available documents.`;
        }

        metaData = metaList[0];
        console.log(
          `[getDocumentContents] Fuzzy matched "${metaData.title}" → ${metaData.id}`,
        );
      }

      // 3) Now get the document content using match_documents with the file_id
      // We'll use a dummy query and filter by the specific document ID
      const { data: docs, error: contentError } = await supabase.rpc(
        'match_documents',
        {
          query_embedding: new Array(1536).fill(0), // Dummy embedding
          match_count: 100, // Get all chunks for this document
          filter: { file_id: metaData.id },
        },
      );

      if (contentError) {
        const duration = performance.now() - startTime;
        console.error(
          '[getDocumentContents] Content retrieval error:',
          contentError,
        );

        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getDocumentContents',
            success: false,
            error: `Content retrieval error: ${contentError.message}`,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return `Error: Unable to retrieve document content: ${contentError.message}`;
      }

      const duration = performance.now() - startTime;

      if (!docs || docs.length === 0) {
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getDocumentContents',
            success: false,
            error: 'No content found',
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return `Error: No content found for document "${metaData.title}". The document may be empty.`;
      }

      // 4) Combine all chunks into full document content
      const fullContent = docs
        .map((doc: any) => doc.content || '')
        .filter((content: string) => content.trim().length > 0)
        .join('\n\n');

      if (!fullContent.trim()) {
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getDocumentContents',
            success: false,
            error: 'Empty content',
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return `Error: Document "${metaData.title}" exists but contains no readable content.`;
      }

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getDocumentContents',
          success: true,
          duration: Math.round(duration),
          contentLength: fullContent.length,
          chunkCount: docs.length,
          timestamp: new Date().toISOString(),
        },
      });

      // Return the actual document content with proper formatting
      return `📄 **${metaData.title}**

**Document ID:** ${metaData.id}
**URL:** ${metaData.url || 'N/A'}
**Created:** ${metaData.created_at}
**Content Length:** ${fullContent.length} characters (${docs.length} chunks)

---

**FULL CONTENT:**

${fullContent}`;
    } catch (err: any) {
      const duration = performance.now() - startTime;
      console.error('[getDocumentContents] Unexpected error:', err);

      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getDocumentContents',
          success: false,
          error: `Unexpected error: ${err.message}`,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return `Error: Unexpected error retrieving document: ${err.message}`;
    }
  },
});
