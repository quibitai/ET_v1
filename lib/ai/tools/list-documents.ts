/**
 * List Documents Tool
 *
 * Lists all available documents in the knowledge base from the document_metadata table.
 * This helps the agent discover what documents exist before requesting specific content.
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
  console.error('Missing Supabase URL or Key for listDocuments tool.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const listDocumentsTool = new DynamicStructuredTool({
  name: 'listDocuments',
  description: `🗂️ KNOWLEDGE_BASE: Lists all available documents in the INTERNAL knowledge base. Use this to discover what documents exist before requesting specific content.
    
    CRITICAL: Use this for internal company documents, policies, templates, and knowledge stored in the RAG system.
    DO NOT use for Google Drive files - use Google Drive tools for external cloud storage.
    
    IMPORTANT USAGE GUIDELINES:
    - Use WITHOUT filters in most cases to see all available documents
    - Only use filters when users explicitly specify metadata/schema requirements
    - For content-based searches (e.g., "find client research"), use searchInternalKnowledgeBase instead
    - This tool discovers documents; searchInternalKnowledgeBase finds content within them
    
    Returns document metadata including:
    - id: The unique identifier needed for getDocumentContents
    - title: Human-readable document title
    - url: Original source URL if applicable
    - created_at: Document creation timestamp
    - schema: Document type/schema information`,
  schema: z.object({
    filter: z
      .record(z.string())
      .nullish()
      .describe(
        'Optional metadata filter - ONLY use when user explicitly specifies schema/metadata requirements. For content searches, use searchInternalKnowledgeBase instead. Example: {"schema": "markdown"} only if user specifically asks for markdown documents.',
      ),
  }),
  func: async ({ filter }): Promise<string> => {
    const startTime = performance.now();

    console.log('[listDocuments] Tool invoked with filter:', filter);

    // Normalize filter to remove null/undefined values
    const normalizedFilter = filter
      ? Object.fromEntries(
          Object.entries(filter).filter(([_, value]) => value != null),
        )
      : null;

    if (!supabaseUrl || !supabaseKey) {
      return 'Error: Supabase credentials are not configured for document access.';
    }

    try {
      const hasFilter =
        normalizedFilter && Object.keys(normalizedFilter).length > 0;

      // Build query with optional filter
      let query = supabase
        .from('document_metadata')
        .select('id, title, url, created_at, schema')
        .order('title');

      // Apply any provided filters
      if (hasFilter) {
        Object.entries(normalizedFilter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error } = await query;

      if (error) {
        const duration = performance.now() - startTime;
        console.error('[listDocuments] Database error:', error);

        // Track error
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'listDocuments',
            success: false,
            error: `Database error: ${error.message}`,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return `Error: Failed to fetch documents: ${error.message}`;
      }

      const duration = performance.now() - startTime;

      // INTELLIGENT FALLBACK: If filter returns no results, try without filter
      if (hasFilter && (!data || data.length === 0)) {
        console.log(
          '[listDocuments] Filter returned no results, trying without filter as fallback',
        );

        const fallbackQuery = supabase
          .from('document_metadata')
          .select('id, title, url, created_at, schema')
          .order('title');

        const { data: fallbackData, error: fallbackError } =
          await fallbackQuery;

        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          // Format fallback results
          const documentList = fallbackData.map((doc) => ({
            id: doc.id,
            title: doc.title,
            url: doc.url,
            created_at: doc.created_at,
            schema: doc.schema,
            clickable_link: `[${doc.title}](/api/documents/${doc.id})`,
          }));

          const formattedList = documentList
            .map((doc) => `- [${doc.title}](/api/documents/${doc.id})`)
            .join('\n');

          await trackEvent({
            eventName: ANALYTICS_EVENTS.TOOL_USED,
            properties: {
              toolName: 'listDocuments',
              success: true,
              duration: Math.round(duration),
              documentCount: documentList.length,
              usedFallback: true,
              originalFilter: normalizedFilter,
              timestamp: new Date().toISOString(),
            },
          });

          return `📚 **Available Documents** (${documentList.length} total)

**Note**: Filter ${JSON.stringify(normalizedFilter)} returned no results. Showing all documents instead.

${formattedList}

**Usage**: To retrieve a document's full content, use the getDocumentContents tool with the document's ID.
For content-based searches, use searchInternalKnowledgeBase.`;
        }
      }

      if (!data || data.length === 0) {
        // Track empty results
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'listDocuments',
            success: true,
            duration: Math.round(duration),
            documentCount: 0,
            timestamp: new Date().toISOString(),
          },
        });

        const message = hasFilter
          ? `No documents found matching filter ${JSON.stringify(normalizedFilter)}. Try without filters or use searchInternalKnowledgeBase for content searches.`
          : 'No documents found in the knowledge base.';

        return `📚 **Document Search Results**

${message}`;
      }

      // Format document list with functional clickable links
      const documentList = data.map((doc) => ({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        created_at: doc.created_at,
        schema: doc.schema,
        // Add clickable link format for LLM to use
        clickable_link: `[${doc.title}](/api/documents/${doc.id})`,
      }));

      // Create formatted list for immediate display using bullet points to avoid nested numbering
      const formattedList = documentList
        .map((doc) => `- [${doc.title}](/api/documents/${doc.id})`)
        .join('\n');

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'listDocuments',
          success: true,
          duration: Math.round(duration),
          documentCount: documentList.length,
          timestamp: new Date().toISOString(),
        },
      });

      return `📚 **Available Documents** (${documentList.length} total)

${formattedList}

**Usage**: To retrieve a document's full content, use the getDocumentContents tool with the document's ID.`;
    } catch (err: any) {
      const duration = performance.now() - startTime;
      console.error('[listDocuments] Unexpected error:', err);

      // Track unexpected error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'listDocuments',
          success: false,
          error: `Unexpected error: ${err.message}`,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return `Error: Unexpected error during document listing: ${err.message}`;
    }
  },
});

// FIX: Replaced the ambiguous parenthesized expression with Object.assign
Object.assign(listDocumentsTool, {
  responseType: 'list',
});
