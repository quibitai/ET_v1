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
  description: `Lists all available documents in the knowledge base. Use this to discover what documents exist before requesting specific content. 
    Returns document metadata including:
    - id: The unique identifier needed for getDocumentContents
    - title: Human-readable document title
    - url: Original source URL if applicable
    - created_at: Document creation timestamp
    - schema: Document type/schema information`,
  schema: z.object({
    filter: z
      .record(z.unknown())
      .optional()
      .describe(
        'Optional JSONB filter for metadata (e.g., {"schema": "markdown"})',
      ),
  }),
  func: async ({ filter = {} }): Promise<string> => {
    const startTime = performance.now();
    console.log('[listDocuments] Fetching document list', { filter });

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'listDocuments',
        hasFilter: Object.keys(filter).length > 0,
        timestamp: new Date().toISOString(),
      },
    });

    if (!supabaseUrl || !supabaseKey) {
      const duration = performance.now() - startTime;

      // Track error
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'listDocuments',
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
      // Build query with optional filter
      let query = supabase
        .from('document_metadata')
        .select('id, title, url, created_at, schema')
        .order('title');

      // Apply any provided filters
      if (Object.keys(filter).length > 0) {
        Object.entries(filter).forEach(([key, value]) => {
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

        return JSON.stringify({
          success: false,
          error: `Failed to fetch documents: ${error.message}`,
          metadata: {
            errorType: 'database_error',
            code: error.code,
            details: error.details,
          },
        });
      }

      const duration = performance.now() - startTime;

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

        return JSON.stringify({
          success: true,
          message: 'No documents found in the knowledge base.',
          available_documents: [],
          total_count: 0,
        });
      }

      // Format document list
      const documentList = data.map((doc) => ({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        created_at: doc.created_at,
        schema: doc.schema,
      }));

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

      return JSON.stringify({
        success: true,
        available_documents: documentList,
        total_count: documentList.length,
        usage_instructions:
          "To retrieve a document's full content, use the getDocumentContents tool with the document's id.",
      });
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

      return JSON.stringify({
        success: false,
        error: `Unexpected error: ${err.message}`,
        metadata: {
          errorType: err.name || 'Unknown',
        },
      });
    }
  },
});
