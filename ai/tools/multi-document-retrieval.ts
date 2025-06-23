/**
 * Multi-Document Retrieval Tool
 *
 * Intelligently retrieves multiple documents for comparative analysis,
 * synthesis, and other multi-document scenarios. This tool coordinates
 * the retrieval of all relevant documents based on query analysis.
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

const supabase = createClient(supabaseUrl, supabaseKey);

interface DocumentRetrievalPlan {
  requiredDocuments: string[];
  analysisType: 'comparative' | 'synthesis' | 'summary' | 'relationship';
  relationshipMapping: Record<string, string[]>;
  priority: 'high' | 'medium' | 'low';
}

interface DocumentReference {
  id: string;
  title: string;
  content: string;
  url?: string;
  metadata: {
    content_length: number;
    chunk_count: number;
    retrieved_at: string;
  };
}

/**
 * Extract document keywords from query using comprehensive patterns
 */
function extractDocumentKeywords(query: string): string[] {
  const keywords: string[] = [];

  // Enhanced document name patterns
  const documentPatterns = [
    /\b(?:core\s+values?|values?)\b/gi,
    /\b(?:ideal\s+client\s+profile?|client\s+profile?|icp)\b/gi,
    /\b(?:brand\s+overview|brand\s+guide|brand)\b/gi,
    /\b(?:producer\s+checklist|checklist)\b/gi,
    /\b(?:client\s+research|research)\b/gi,
    /\b(?:cost\s+sheet|costs?|pricing|rates?)\b/gi,
    /\b(?:profit\s+and\s+loss|p&l|financial)\b/gi,
    /\b(?:creative\s+brief|brief)\b/gi,
    /\b(?:project\s+scope|scope)\b/gi,
    /\b(?:requirements?|specs?|specifications?)\b/gi,
  ];

  documentPatterns.forEach((pattern) => {
    const matches = query.match(pattern);
    if (matches) {
      keywords.push(...matches.map((m) => m.toLowerCase().trim()));
    }
  });

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Analyze query to determine document retrieval requirements
 */
function analyzeDocumentRetrievalNeeds(query: string): DocumentRetrievalPlan {
  const keywords = extractDocumentKeywords(query);

  // Detect analysis type
  let analysisType: DocumentRetrievalPlan['analysisType'] = 'summary';

  if (/\b(?:compar[ei]|comparison|vs|versus|contrast)\b/i.test(query)) {
    analysisType = 'comparative';
  } else if (/\b(?:synthesis|synth|combine|merge)\b/i.test(query)) {
    analysisType = 'synthesis';
  } else if (/\b(?:relationship|align|alignment|how.*relate)\b/i.test(query)) {
    analysisType = 'relationship';
  }

  // Create relationship mapping for comparative analysis
  const relationshipMapping: Record<string, string[]> = {};
  if (analysisType === 'comparative' && keywords.length >= 2) {
    // For comparative analysis, map documents that should be compared
    keywords.forEach((keyword, index) => {
      relationshipMapping[keyword] = keywords.filter((_, i) => i !== index);
    });
  }

  // Determine priority based on analysis complexity
  const priority =
    analysisType === 'comparative' || keywords.length > 2 ? 'high' : 'medium';

  return {
    requiredDocuments: keywords,
    analysisType,
    relationshipMapping,
    priority,
  };
}

/**
 * Retrieve a single document by ID or title with enhanced matching
 */
async function retrieveSingleDocument(
  documentQuery: string,
): Promise<DocumentReference | null> {
  try {
    // 1) Try exact ID match first
    let { data: metaData, error: metaError } = await supabase
      .from('document_metadata')
      .select('id, title, url, created_at, schema')
      .eq('id', documentQuery)
      .single();

    // 2) If no exact match, try fuzzy title matching
    if (metaError || !metaData) {
      // Try multiple matching strategies
      const matchingStrategies = [
        // Exact phrase match
        documentQuery,
        // Individual keywords
        ...documentQuery
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 2),
      ];

      for (const strategy of matchingStrategies) {
        const { data: metaList, error: titleError } = await supabase
          .from('document_metadata')
          .select('id, title, url, created_at, schema')
          .ilike('title', `%${strategy}%`)
          .limit(1);

        if (!titleError && metaList && metaList.length > 0) {
          metaData = metaList[0];
          break;
        }
      }
    }

    if (!metaData) {
      return null;
    }

    // 3) Retrieve document content
    const { data: docs, error: contentError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: new Array(1536).fill(0), // Dummy embedding
        match_count: 100, // Get all chunks for this document
        filter: { file_id: metaData.id },
      },
    );

    if (contentError || !docs || docs.length === 0) {
      return null;
    }

    // 4) Combine all chunks into full document content
    const fullContent = docs
      .map((doc: any) => doc.content || '')
      .filter((content: string) => content.trim().length > 0)
      .join('\n\n');

    if (!fullContent.trim()) {
      return null;
    }

    return {
      id: metaData.id,
      title: metaData.title,
      content: fullContent,
      url: metaData.url,
      metadata: {
        content_length: fullContent.length,
        chunk_count: docs.length,
        retrieved_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(
      `[multiDocumentRetrieval] Error retrieving document "${documentQuery}":`,
      error,
    );
    return null;
  }
}

export const multiDocumentRetrievalTool = new DynamicStructuredTool({
  name: 'getMultipleDocuments',
  description: `Intelligently retrieves multiple documents for comparative analysis, synthesis, or relationship analysis. 
    This tool automatically identifies all relevant documents mentioned in the query and retrieves them in a coordinated manner.
    Use this tool when the user asks for comparisons, analysis involving multiple documents, or when multiple documents are referenced.
    
    Examples:
    - "Compare Core Values and Ideal Client Profile"
    - "How do our brand guidelines align with our client research?"  
    - "Show me the relationship between our pricing and our producer checklist"`,
  schema: z.object({
    query: z
      .string()
      .describe(
        'The user query that references multiple documents or requires multi-document analysis. The tool will extract document references automatically.',
      ),
    specific_documents: z
      .array(z.string())
      .nullish()
      .describe(
        'Optional: Specific document names or IDs to retrieve if you know them exactly. If not provided, the tool will extract them from the query.',
      ),
  }),
  func: async ({ query, specific_documents }): Promise<string> => {
    const startTime = performance.now();
    console.log('[getMultipleDocuments] Starting multi-document retrieval', {
      query: query.substring(0, 100),
      specificDocuments: specific_documents,
    });

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'getMultipleDocuments',
        query: query.substring(0, 100),
        timestamp: new Date().toISOString(),
      },
    });

    if (!supabaseUrl || !supabaseKey) {
      const duration = performance.now() - startTime;
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getMultipleDocuments',
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
      // Analyze query to create retrieval plan
      const retrievalPlan = analyzeDocumentRetrievalNeeds(query);

      // Use specific documents if provided, otherwise use extracted keywords
      const documentsToRetrieve =
        specific_documents && specific_documents.length > 0
          ? specific_documents
          : retrievalPlan.requiredDocuments;

      if (documentsToRetrieve.length === 0) {
        const duration = performance.now() - startTime;
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getMultipleDocuments',
            success: false,
            error: 'No documents identified',
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        return JSON.stringify({
          success: false,
          error:
            'No document references found in the query. Please specify which documents you want to retrieve.',
          metadata: {
            reason: 'no_documents_identified',
            analyzedQuery: query.substring(0, 100),
          },
        });
      }

      console.log('[getMultipleDocuments] Retrieval plan created', {
        analysisType: retrievalPlan.analysisType,
        documentsToRetrieve,
        priority: retrievalPlan.priority,
      });

      // Retrieve all documents in parallel
      const retrievalPromises = documentsToRetrieve.map((docQuery) =>
        retrieveSingleDocument(docQuery),
      );

      const retrievalResults = await Promise.all(retrievalPromises);

      // Filter out failed retrievals
      const successfulRetrievals = retrievalResults.filter(
        (result): result is DocumentReference => result !== null,
      );

      const failedRetrievals = documentsToRetrieve.filter(
        (_, index) => retrievalResults[index] === null,
      );

      const duration = performance.now() - startTime;

      if (successfulRetrievals.length === 0) {
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getMultipleDocuments',
            success: false,
            error: 'No documents found',
            duration: Math.round(duration),
            attemptedDocuments: documentsToRetrieve.length,
            timestamp: new Date().toISOString(),
          },
        });

        return JSON.stringify({
          success: false,
          error: `None of the requested documents could be found: ${documentsToRetrieve.join(', ')}`,
          metadata: {
            reason: 'documents_not_found',
            attemptedDocuments: documentsToRetrieve,
            failedRetrievals,
          },
        });
      }

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getMultipleDocuments',
          success: true,
          duration: Math.round(duration),
          documentsRetrieved: successfulRetrievals.length,
          analysisType: retrievalPlan.analysisType,
          totalContentLength: successfulRetrievals.reduce(
            (sum, doc) => sum + doc.metadata.content_length,
            0,
          ),
          timestamp: new Date().toISOString(),
        },
      });

      return JSON.stringify({
        success: true,
        retrievalPlan,
        documents: successfulRetrievals,
        metadata: {
          documents_retrieved: successfulRetrievals.length,
          documents_requested: documentsToRetrieve.length,
          failed_retrievals: failedRetrievals,
          total_content_length: successfulRetrievals.reduce(
            (sum, doc) => sum + doc.metadata.content_length,
            0,
          ),
          analysis_type: retrievalPlan.analysisType,
          retrieval_time_ms: Math.round(duration),
        },
      });
    } catch (err: any) {
      const duration = performance.now() - startTime;
      console.error('[getMultipleDocuments] Unexpected error:', err);

      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getMultipleDocuments',
          success: false,
          error: `Unexpected error: ${err.message}`,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return JSON.stringify({
        success: false,
        error: `Unexpected error during multi-document retrieval: ${err.message}`,
        metadata: {
          errorType: err.name || 'Unknown',
          query: query.substring(0, 100),
        },
      });
    }
  },
});
