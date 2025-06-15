/**
 * Centralized Content Formatter
 *
 * Follows LangGraph best practices for consistent content formatting:
 * - Single responsibility for all content formatting
 * - Consistent sanitization and length management
 * - Standardized response templates
 * - Type-safe formatting methods
 */

export interface DocumentResult {
  title: string;
  url: string;
  content?: string;
  created_at?: string;
  description?: string;
}

export interface ToolResult {
  name: string;
  content: any;
  metadata?: Record<string, any>;
}

export namespace ContentFormatter {
  const MAX_CONTENT_LENGTH = 10000;
  const PREVIEW_LENGTH = 500;
  const TITLE_MAX_LENGTH = 200;

  /**
   * Centralized content sanitization with consistent rules
   */
  export function sanitizeContent(content: any): string {
    if (!content) return '';

    let contentStr: string;

    // Handle different content types consistently
    if (typeof content === 'string') {
      contentStr = content;
    } else if (typeof content === 'object') {
      try {
        contentStr = JSON.stringify(content, null, 2);
      } catch {
        contentStr = String(content);
      }
    } else {
      contentStr = String(content);
    }

    return contentStr.trim().substring(0, MAX_CONTENT_LENGTH);
  }

  /**
   * Standardized title cleaning with consistent regex
   */
  export function sanitizeTitle(title: string): string {
    if (!title) return 'Untitled';

    return String(title)
      .replace(/[^\w\s\-\.]/g, '') // Remove special characters except word chars, spaces, hyphens, dots
      .trim()
      .substring(0, TITLE_MAX_LENGTH);
  }

  /**
   * Format a single document with consistent structure
   */
  export function formatDocument(doc: DocumentResult): string {
    const title = sanitizeTitle(doc.title);
    const url = String(doc.url || '');

    return `- [${title}](${url})`;
  }

  /**
   * Format document list with consistent header and structure
   */
  export function formatDocumentList(documents: DocumentResult[]): string {
    if (!documents || documents.length === 0) {
      return '📋 **Available Documents:** None found';
    }

    const formattedDocs = documents
      .map((doc) => formatDocument(doc))
      .join('\n');

    return `📋 **Available Documents:**\n\n${formattedDocs}`;
  }

  /**
   * Format document content with preview logic
   */
  export function formatDocumentContent(
    doc: DocumentResult,
    isContentRequest = false,
  ): string {
    const title = sanitizeTitle(doc.title);
    const url = String(doc.url || '');
    const content = sanitizeContent(doc.content);

    if (!content) {
      return `[${title}](${url})\n\n**No content available**`;
    }

    if (isContentRequest || content.length <= PREVIEW_LENGTH) {
      // Show full content for explicit requests or short content
      return content;
    } else {
      // Show preview for long content
      return `[${title}](${url})\n\n**Content Preview:**\n${content.substring(0, PREVIEW_LENGTH)}...`;
    }
  }

  /**
   * Format tool results with consistent structure
   */
  export function formatToolResults(
    toolResults: ToolResult[],
    userQuery = '',
  ): string {
    if (!toolResults || toolResults.length === 0) {
      return 'No results found.';
    }

    const isListingRequest =
      /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
        userQuery,
      );
    const isContentRequest =
      /(?:get|show|display|give\s+me)\s+(?:the\s+)?(?:complete|full|entire|whole)\s+(?:contents?|content|text)/i.test(
        userQuery,
      );

    let formattedContent = '';

    for (const toolResult of toolResults) {
      const content = toolResult.content;

      try {
        const parsed = JSON.parse(sanitizeContent(content));

        // Handle document listing responses
        if (
          parsed.available_documents &&
          Array.isArray(parsed.available_documents)
        ) {
          formattedContent = formatDocumentList(parsed.available_documents);
        }
        // Handle single document responses
        else if (parsed.success && parsed.document && parsed.content) {
          const doc: DocumentResult = {
            title: parsed.document.title,
            url: parsed.document.url,
            content: parsed.content,
          };
          formattedContent = formatDocumentContent(doc, isContentRequest);
        }
        // Handle array responses
        else if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanContent = parsed
            .map((item: any, index: number) => {
              if (item && typeof item === 'object' && item.title && item.url) {
                return formatDocument(item as DocumentResult);
              }
              return `${index + 1}. ${sanitizeContent(item).substring(0, 200)}...`;
            })
            .join('\n');
          formattedContent = `📋 **Results:**\n\n${cleanContent}`;
        }
        // Handle generic objects
        else {
          formattedContent = sanitizeContent(parsed);
        }
      } catch {
        // Not JSON, use content as-is
        formattedContent = sanitizeContent(content);
      }
    }

    return formattedContent.trim();
  }

  /**
   * Get appropriate system prompt based on content type
   */
  export function getSystemPrompt(
    contentType: 'document_list' | 'content' | 'generic',
  ): string {
    const prompts = {
      document_list:
        'You are presenting a document list to the user. Output ONLY the provided document list exactly as formatted. Do NOT add any conversational text, questions, or additional commentary. Do NOT convert bullet points (-) to numbered lists (1., 2., 3.). Do NOT change the indentation or structure. Preserve all bullet points (-) and sub-bullet points exactly as provided. Just output the document list as-is.',
      content:
        'You are a helpful assistant. Present the provided information clearly and directly to the user. Do NOT change the formatting, numbering, or bullet points. Do NOT include any raw JSON data, tool results, technical details, or instructions. Just present the content exactly as provided.',
      generic: 'Provide a brief acknowledgment that the request was processed.',
    };

    return prompts[contentType] || prompts.generic;
  }
}

/**
 * Document descriptions for consistent formatting
 */
export namespace DocumentDescriptions {
  const descriptions: Record<string, string> = {
    // Core business documents
    core_values: 'Company core values and principles',
    income_statement: 'Financial income statement and profit/loss data',
    profit_and_loss: 'Financial income statement and profit/loss data',
    producer_checklist: 'Production workflow checklist and guidelines',
    rate_card: 'Service pricing and rate information',
    ideal_client_profile: 'Target client characteristics and profile',

    // Scripts and creative content
    scripts: 'Creative scripts and storyboard materials',
    storyboards: 'Creative scripts and storyboard materials',

    // Example/template documents
    example_brand_marketing: 'Example brand marketing strategy overview',
    example_client_estimate: 'Sample client project estimate template',
    example_client_research: 'Example client research and analysis',
    example_proposal_pitch: 'Sample proposal and pitch template',

    // File type defaults
    pdf: 'PDF document',
    xlsx: 'Excel spreadsheet',
    xls: 'Excel spreadsheet',
    md: 'Markdown document',
    txt: 'Text document',
  };

  export function getDescription(filename: string): string {
    const lowerFilename = filename.toLowerCase();

    // Check for specific document patterns
    for (const [key, description] of Object.entries(descriptions)) {
      if (lowerFilename.includes(key)) {
        return description;
      }
    }

    // Check file extensions
    const extension = lowerFilename.split('.').pop();
    if (extension && descriptions[extension]) {
      return descriptions[extension];
    }

    // Default fallback
    return 'Business document';
  }
}
