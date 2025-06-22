/**
 * StandardizedResponseFormatter - Single Source of Truth for All Response Formatting
 *
 * Consolidates 15+ scattered formatting functions into one authoritative service.
 * Replaces: ContentFormatter, scattered system prompts, strategy formatting, etc.
 */

export interface ToolResult {
  name: string;
  content: any;
  metadata?: Record<string, any>;
}

export interface DocumentResult {
  title: string;
  url: string;
  content?: string;
  created_at?: string;
  description?: string;
}

export interface FormattingOptions {
  contentType:
    | 'document_list'
    | 'content'
    | 'search_results'
    | 'task_list'
    | 'calendar'
    | 'generic';
  isPreview?: boolean;
  includeMetadata?: boolean;
  userQuery?: string;
  maxLength?: number;
}

export namespace StandardizedResponseFormatter {
  const MAX_CONTENT_LENGTH = 10000;
  const PREVIEW_LENGTH = 500;
  const TITLE_MAX_LENGTH = 200;

  /**
   * Main entry point - formats any tool results with consistent standards
   */
  export function formatToolResults(
    toolResults: ToolResult[],
    options: FormattingOptions,
  ): string {
    if (!toolResults || toolResults.length === 0) {
      return getEmptyResultsMessage(options.contentType);
    }

    let formattedContent = '';

    for (const toolResult of toolResults) {
      const formatted = formatSingleToolResult(toolResult, options);
      if (formatted) {
        formattedContent = `${formattedContent}${formatted}\n\n`;
      }
    }

    return applyFinalFormatting(formattedContent.trim(), options);
  }

  /**
   * Format a single tool result based on its content type
   */
  function formatSingleToolResult(
    toolResult: ToolResult,
    options: FormattingOptions,
  ): string {
    const content = sanitizeContent(toolResult.content);

    try {
      const parsed = JSON.parse(content);

      // Document listing responses
      if (
        parsed.available_documents &&
        Array.isArray(parsed.available_documents)
      ) {
        return formatDocumentListing(parsed, options);
      }

      // Single document responses
      if (parsed.success && parsed.document && parsed.content) {
        return formatSingleDocument(parsed, options);
      }

      // Search results
      if (parsed.results && Array.isArray(parsed.results)) {
        return formatSearchResults(parsed.results, options);
      }

      // Asana task/project responses
      if (parsed.data && (parsed.data.tasks || parsed.data.projects)) {
        return formatAsanaResults(parsed.data, options);
      }

      // Calendar events
      if (parsed.events && Array.isArray(parsed.events)) {
        return formatCalendarEvents(parsed.events, options);
      }

      // Array responses
      if (Array.isArray(parsed)) {
        return formatArrayResults(parsed, options);
      }

      // Generic object responses
      return formatGenericObject(parsed, options);
    } catch {
      // Not JSON, treat as plain text
      return formatPlainText(content, options);
    }
  }

  /**
   * Format document listings with consistent structure
   */
  function formatDocumentListing(
    parsed: any,
    options: FormattingOptions,
  ): string {
    const documents = parsed.available_documents;

    if (!documents || documents.length === 0) {
      return '📋 **Available Documents:** None found';
    }

    // Use pre-formatted list if available (maintains clickable links)
    if (parsed.formatted_list) {
      return `📋 **Available Documents:**\n\n${parsed.formatted_list}`;
    }

    // Format documents manually
    const formattedDocs = documents
      .map((doc: DocumentResult) => formatDocumentLink(doc))
      .join('\n');

    return `📋 **Available Documents:**\n\n${formattedDocs}`;
  }

  /**
   * Format single document with content
   */
  function formatSingleDocument(
    parsed: any,
    options: FormattingOptions,
  ): string {
    const doc: DocumentResult = {
      title: parsed.document.title,
      url: parsed.document.url,
      content: parsed.content,
    };

    const title = sanitizeTitle(doc.title);
    const url = String(doc.url || '');
    const content = sanitizeContent(doc.content);

    if (!content) {
      return `[${title}](${url})\n\n**No content available**`;
    }

    const isContentRequest =
      options.userQuery &&
      /(?:get|show|display|give\s+me)\s+(?:the\s+)?(?:complete|full|entire|whole)\s+(?:contents?|content|text)/i.test(
        options.userQuery,
      );

    if (isContentRequest || content.length <= PREVIEW_LENGTH) {
      return content;
    } else {
      return `[${title}](${url})\n\n**Content Preview:**\n${content.substring(0, PREVIEW_LENGTH)}...`;
    }
  }

  /**
   * Format search results (web search, internal search)
   */
  function formatSearchResults(
    results: any[],
    options: FormattingOptions,
  ): string {
    if (!results || results.length === 0) {
      return '🔍 **Search Results:** No results found';
    }

    const formattedResults = results
      .slice(0, 10) // Limit to top 10 results
      .map((result, index) => {
        if (result.title && result.url) {
          const snippet = result.snippet || result.description || '';
          return `${index + 1}. [${sanitizeTitle(result.title)}](${result.url})\n   ${snippet.substring(0, 150)}...`;
        }
        return `${index + 1}. ${sanitizeContent(result).substring(0, 200)}...`;
      })
      .join('\n\n');

    return `🔍 **Search Results:**\n\n${formattedResults}`;
  }

  /**
   * Format Asana tasks and projects
   */
  function formatAsanaResults(data: any, options: FormattingOptions): string {
    let formatted = '';

    if (data.tasks && Array.isArray(data.tasks)) {
      const tasks = data.tasks
        .slice(0, 20) // Limit to 20 tasks
        .map((task: any) => {
          const status = task.completed ? '✅' : '⏳';
          const assignee = task.assignee ? ` (${task.assignee.name})` : '';
          return `${status} [${task.name}](${task.permalink_url})${assignee}`;
        })
        .join('\n');

      formatted += `📋 **Tasks:**\n\n${tasks}`;
    }

    if (data.projects && Array.isArray(data.projects)) {
      const projects = data.projects
        .slice(0, 10) // Limit to 10 projects
        .map((project: any) => {
          const status = project.current_status?.status_type || 'active';
          const statusEmoji =
            status === 'on_track' ? '🟢' : status === 'at_risk' ? '🟡' : '🔴';
          return `${statusEmoji} [${project.name}](${project.permalink_url})`;
        })
        .join('\n');

      if (formatted) formatted += '\n\n';
      formatted += `🗂️ **Projects:**\n\n${projects}`;
    }

    return formatted || formatGenericObject(data, options);
  }

  /**
   * Format calendar events
   */
  function formatCalendarEvents(
    events: any[],
    options: FormattingOptions,
  ): string {
    if (!events || events.length === 0) {
      return '📅 **Calendar Events:** No events found';
    }

    const formattedEvents = events
      .slice(0, 15) // Limit to 15 events
      .map((event: any) => {
        const start = event.start
          ? new Date(event.start).toLocaleString()
          : 'TBD';
        const attendees = event.attendees
          ? ` (${event.attendees.length} attendees)`
          : '';
        return `📅 **${event.summary || 'Untitled Event'}**\n   📍 ${start}${attendees}`;
      })
      .join('\n\n');

    return `📅 **Calendar Events:**\n\n${formattedEvents}`;
  }

  /**
   * Format array results generically
   */
  function formatArrayResults(
    results: any[],
    options: FormattingOptions,
  ): string {
    const formattedItems = results
      .slice(0, 20) // Limit to 20 items
      .map((item: any, index: number) => {
        if (item && typeof item === 'object' && item.title && item.url) {
          return formatDocumentLink(item as DocumentResult);
        }
        return `${index + 1}. ${sanitizeContent(item).substring(0, 200)}...`;
      })
      .join('\n');

    return `📋 **Results:**\n\n${formattedItems}`;
  }

  /**
   * Format generic object responses
   */
  function formatGenericObject(obj: any, options: FormattingOptions): string {
    return sanitizeContent(obj);
  }

  /**
   * Format plain text content
   */
  function formatPlainText(
    content: string,
    options: FormattingOptions,
  ): string {
    return sanitizeContent(content);
  }

  /**
   * Format a document link consistently
   */
  function formatDocumentLink(doc: DocumentResult): string {
    const title = sanitizeTitle(doc.title);
    const url = String(doc.url || '');
    return `- [${title}](${url})`;
  }

  /**
   * Apply final formatting rules
   */
  function applyFinalFormatting(
    content: string,
    options: FormattingOptions,
  ): string {
    if (!content) return getEmptyResultsMessage(options.contentType);

    // Apply length limits
    if (options.maxLength && content.length > options.maxLength) {
      return `${content.substring(0, options.maxLength)}...`;
    }

    return content;
  }

  /**
   * Get appropriate empty results message
   */
  function getEmptyResultsMessage(contentType: string): string {
    const messages = {
      document_list: '📋 **Available Documents:** None found',
      search_results: '🔍 **Search Results:** No results found',
      task_list: '📋 **Tasks:** No tasks found',
      calendar: '📅 **Calendar Events:** No events found',
      generic: 'No results found.',
    };

    return messages[contentType as keyof typeof messages] || messages.generic;
  }

  /**
   * Sanitize content with consistent rules
   */
  function sanitizeContent(content: any): string {
    if (!content) return '';

    let contentStr: string;

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
   * Sanitize titles with consistent rules
   */
  function sanitizeTitle(title: string): string {
    if (!title) return 'Untitled';

    return String(title)
      .replace(/[^\w\s\-\.]/g, '') // Remove special characters except word chars, spaces, hyphens, dots
      .trim()
      .substring(0, TITLE_MAX_LENGTH);
  }

  /**
   * Check if query is requesting a document listing
   */
  export function isDocumentListingRequest(query: string): boolean {
    return /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
      query,
    );
  }

  /**
   * Check if query is requesting full content
   */
  export function isContentRequest(query: string): boolean {
    return /(?:get|show|display|give\s+me)\s+(?:the\s+)?(?:complete|full|entire|whole)\s+(?:contents?|content|text)/i.test(
      query,
    );
  }
}
