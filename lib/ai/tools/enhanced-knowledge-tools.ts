/**
 * Enhanced Knowledge Base Tools with Modern Error Handling
 * Following LangChain 2024 best practices
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';

// Initialize Supabase client with error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let supabase: any = null;
let embeddings: OpenAIEmbeddings | null = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }

  if (process.env.OPENAI_API_KEY) {
    embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.error('[Enhanced Knowledge Tools] Initialization error:', error);
}

/**
 * Enhanced List Documents Tool with proper error handling
 *
 * Lists actual files from document_metadata table (Google Drive files)
 * rather than vector chunks from documents table
 */
export const enhancedListDocumentsTool = new DynamicStructuredTool({
  name: 'listDocuments',
  description: `📋 KNOWLEDGE_BASE: Lists all actual files available in the internal knowledge base from Google Drive. 
    
    Use this tool to discover what files are available before retrieving specific content.
    This tool returns file IDs, titles, and clickable Google Drive links.`,

  schema: z.object({
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .default(20)
      .optional()
      .describe('Maximum number of files to return (default: 20, max: 50)'),
    filter: z
      .string()
      .optional()
      .describe('Optional filter to search for specific file titles'),
  }),

  func: async ({ limit = 20, filter }): Promise<string> => {
    try {
      console.log('[Enhanced List Documents] Starting with params:', {
        limit,
        filter,
      });

      // Validate environment
      if (!supabase) {
        return 'Error: Knowledge base is not properly configured. Please check system configuration.';
      }

      // Build base query - Use document_metadata table for actual files
      let query = supabase
        .from('document_metadata')
        .select('id, title, url, created_at, client_id')
        .eq('client_id', 'echo-tango')
        .order('title', { ascending: true })
        .limit(limit);

      // Apply intelligent fuzzy search if filter provided
      if (filter) {
        // Normalize the search filter for better matching
        const normalizedFilter = filter
          .toLowerCase()
          .replace(/[_\-\s]+/g, ' ') // Replace underscores, dashes, spaces with single space
          .replace(/[^a-z0-9\s]/g, '') // Remove special characters
          .trim();

        console.log('[Enhanced List Documents] Normalized filter:', {
          original: filter,
          normalized: normalizedFilter,
        });

        // Try multiple search strategies for better results
        const searchTerms = normalizedFilter
          .split(' ')
          .filter((term) => term.length > 2);

        if (searchTerms.length === 0) {
          // Fallback to original filter if normalization removed everything
          query = query.ilike('title', `%${filter}%`);
        } else if (searchTerms.length === 1) {
          // Single term - use simple ilike
          query = query.ilike('title', `%${searchTerms[0]}%`);
        } else {
          // Multiple terms - create OR conditions for better matching
          // Each term should match somewhere in the title (case-insensitive)
          const orConditions = searchTerms.map(
            (term) => `title.ilike.%${term}%`,
          );
          query = query.or(orConditions.join(','));
        }
      }

      const { data: files, error } = await query;

      if (error) {
        console.error('[Enhanced List Documents] Database error:', error);
        return `Error: Unable to retrieve files from knowledge base: ${error.message}`;
      }

      if (!files || files.length === 0) {
        const filterMsg = filter ? ` matching "${filter}"` : '';
        return `No files found in the knowledge base${filterMsg}. The knowledge base may be empty or the filter may be too restrictive.

💡 **Available files include:**
- Echo Tango Core Values Draft
- Ideal Client Profile  
- Client Research examples
- Rate cards and estimates
- Producer checklists

Try using broader search terms or use \`searchInternalKnowledgeBase\` for content-based search.`;
      }

      // Format response with clickable hyperlinks
      const fileList = files
        .map((file: any, index: number) => {
          const title = file.title || `File ${file.id}`;
          const url = file.url || '#';
          const date = file.created_at
            ? new Date(file.created_at).toLocaleDateString()
            : 'Unknown date';

          // Create clickable hyperlink
          const hyperlink = `[${title}](${url})`;

          return `${index + 1}. ${hyperlink}\n   - ID: \`${file.id}\`\n   - Added: ${date}`;
        })
        .join('\n\n');

      const response = `📄 **Found ${files.length} file(s) in the Echo Tango knowledge base:**

${fileList}

💡 **Next steps**: 
- Click any link above to open the file in Google Drive
- Use \`getDocumentContents\` with a file ID to retrieve content from our knowledge base
- Use \`searchInternalKnowledgeBase\` to search across all file content`;

      console.log('[Enhanced List Documents] Success:', {
        count: files.length,
        filter_applied: !!filter,
      });
      return response;
    } catch (error) {
      console.error('[Enhanced List Documents] Unexpected error:', error);
      return `Error: Unexpected error while listing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

/**
 * Enhanced Get Document Contents Tool with proper error handling
 *
 * Updated to handle both document_metadata IDs and vector chunk IDs
 */
export const enhancedGetDocumentContentsTool = new DynamicStructuredTool({
  name: 'getDocumentContents',
  description: `📖 KNOWLEDGE_BASE: Retrieves content for a specific document by ID.
    
    Use this tool after using listDocuments to get the file ID.
    This tool searches our vector knowledge base for the document content.`,

  schema: z.object({
    document_id: z
      .string()
      .min(1)
      .describe(
        'The document ID obtained from listDocuments (can be file ID or vector chunk ID)',
      ),
  }),

  func: async ({ document_id }): Promise<string> => {
    try {
      console.log(
        '[Enhanced Get Document Contents] Starting with document_id:',
        document_id,
      );

      // Validate parameters
      if (!document_id || typeof document_id !== 'string') {
        return 'Error: Invalid document_id provided. Please provide a valid document ID from listDocuments.';
      }

      // Validate environment
      if (!supabase) {
        return 'Error: Knowledge base is not properly configured. Please check system configuration.';
      }

      // First, try to find the document in document_metadata (original files)
      const { data: metadataDoc, error: metadataError } = await supabase
        .from('document_metadata')
        .select('id, title, url, created_at')
        .eq('id', document_id)
        .eq('client_id', 'echo-tango')
        .single();

      if (metadataDoc && !metadataError) {
        // Found in metadata - now search for content in vector chunks
        const { data: vectorChunks, error: vectorError } = await supabase
          .from('documents')
          .select('id, content, metadata')
          .eq('client_id', 'echo-tango')
          .eq('metadata->>file_id', document_id)
          .order('id', { ascending: true });

        if (vectorError) {
          console.error(
            '[Enhanced Get Document Contents] Vector search error:',
            vectorError,
          );
          return `Found file "${metadataDoc.title}" but could not retrieve content: ${vectorError.message}`;
        }

        if (!vectorChunks || vectorChunks.length === 0) {
          return `Found file "${metadataDoc.title}" in our knowledge base, but the content has not been processed yet. You can access it directly via: ${metadataDoc.url}`;
        }

        // Combine all chunks for this file
        const fullContent = vectorChunks
          .map((chunk: any) => chunk.content)
          .join('\n\n');

        const response = `📄 **File: ${metadataDoc.title}**
*Google Drive Link: [Open in Drive](${metadataDoc.url})*
*Added: ${new Date(metadataDoc.created_at).toLocaleDateString()}*

**CONTENT FROM KNOWLEDGE BASE:**

${fullContent}`;

        console.log(
          '[Enhanced Get Document Contents] Success from metadata + vectors:',
          {
            title: metadataDoc.title,
            chunks: vectorChunks.length,
            contentLength: fullContent.length,
          },
        );

        return response;
      }

      // If not found in metadata, try as a direct vector chunk ID
      const { data: vectorDoc, error: vectorError } = await supabase
        .from('documents')
        .select('id, content, metadata, client_id')
        .eq('id', document_id)
        .eq('client_id', 'echo-tango')
        .single();

      if (vectorError) {
        console.error(
          '[Enhanced Get Document Contents] Database error:',
          vectorError,
        );

        if (vectorError.code === 'PGRST116') {
          return `Error: Document with ID "${document_id}" not found. Please use listDocuments to get valid document IDs.`;
        }

        return `Error: Unable to retrieve document: ${vectorError.message}`;
      }

      if (!vectorDoc) {
        return `Error: Document with ID "${document_id}" not found in the knowledge base.`;
      }

      if (!vectorDoc.content) {
        const title =
          vectorDoc.metadata?.file_title || `Document ${vectorDoc.id}`;
        return `Error: Document "${title}" exists but has no content available.`;
      }

      // Format response for vector chunk
      const title =
        vectorDoc.metadata?.file_title || `Vector Chunk ${vectorDoc.id}`;

      const response = `📄 **Document Chunk: ${title}**
*Type: Vector chunk from knowledge base*

**CONTENT:**

${vectorDoc.content}`;

      console.log(
        '[Enhanced Get Document Contents] Success from vector chunk:',
        {
          title: title,
          contentLength: vectorDoc.content.length,
        },
      );

      return response;
    } catch (error) {
      console.error(
        '[Enhanced Get Document Contents] Unexpected error:',
        error,
      );
      return `Error: Unexpected error while retrieving document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

/**
 * Enhanced Search Knowledge Base Tool with proper error handling
 */
export const enhancedSearchKnowledgeBaseTool = new DynamicStructuredTool({
  name: 'searchInternalKnowledgeBase',
  description: `🔍 KNOWLEDGE_BASE: Performs semantic search across the internal knowledge base and returns the most relevant content.
    
    Use this tool to find information about specific topics, questions, or concepts.
    This tool uses AI embeddings to find the most relevant document content.`,

  schema: z.object({
    query: z
      .string()
      .min(1)
      .describe('The search query or question to find relevant information'),
    match_count: z
      .number()
      .int()
      .positive()
      .max(5)
      .default(1)
      .optional()
      .describe('Number of results to return (default: 1, max: 5)'),
    filter: z
      .record(z.string())
      .optional()
      .describe(
        'Optional metadata filter (e.g., {"file_title": "Specific Title"})',
      ),
  }),

  func: async ({ query, match_count = 1, filter }): Promise<string> => {
    try {
      console.log('[Enhanced Search Knowledge Base] Starting with params:', {
        query: query.substring(0, 100),
        match_count,
        filter,
      });

      // Validate parameters
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return 'Error: Invalid search query. Please provide a non-empty search query.';
      }

      // Validate environment
      if (!supabase) {
        return 'Error: Knowledge base is not properly configured. Please check system configuration.';
      }

      if (!embeddings) {
        return 'Error: Search functionality is not available. OpenAI API key is not configured.';
      }

      // Generate embedding for the query
      const queryEmbedding = await embeddings.embedQuery(query);

      // Perform vector search using the match_documents function
      const { data: docs, error: rpcError } = await supabase.rpc(
        'match_documents',
        {
          query_embedding: queryEmbedding,
          match_count,
          filter: filter || {},
        },
      );

      if (rpcError) {
        console.error('[Enhanced Search Knowledge Base] RPC error:', rpcError);
        return `Error: Unable to search knowledge base: ${rpcError.message}`;
      }

      if (!Array.isArray(docs) || docs.length === 0) {
        return `No documents found matching the query: "${query}". Try using different search terms or check if the knowledge base contains relevant information.`;
      }

      // Format results
      if (docs.length === 1) {
        const doc = docs[0];
        const title = doc.metadata?.file_title || 'Unknown Title';
        const content = doc.content || 'No content found.';
        const similarity = doc.similarity ?? 0;

        const response = `🎯 **Search Result: ${title}** (Similarity: ${similarity.toFixed(2)})

**RELEVANT CONTENT:**

${content}`;

        console.log('[Enhanced Search Knowledge Base] Single result success:', {
          title,
          similarity: similarity.toFixed(2),
        });

        return response;
      } else {
        // Multiple results
        const resultsList = docs
          .map((doc, index) => {
            const title = doc.metadata?.file_title || 'Unknown Title';
            const content = doc.content || 'No content found.';
            const similarity = doc.similarity ?? 0;

            return `**${index + 1}. ${title}** (Similarity: ${similarity.toFixed(2)})

${content}`;
          })
          .join('\n\n---\n\n');

        const response = `🎯 **Found ${docs.length} relevant results for: "${query}"**

${resultsList}`;

        console.log(
          '[Enhanced Search Knowledge Base] Multiple results success:',
          {
            count: docs.length,
            topSimilarity: docs[0]?.similarity?.toFixed(2),
          },
        );

        return response;
      }
    } catch (error) {
      console.error(
        '[Enhanced Search Knowledge Base] Unexpected error:',
        error,
      );
      return `Error: Unexpected error while searching knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

/**
 * Export all enhanced tools
 */
export const enhancedKnowledgeTools = [
  enhancedListDocumentsTool,
  enhancedGetDocumentContentsTool,
  enhancedSearchKnowledgeBaseTool,
];

export default enhancedKnowledgeTools;
