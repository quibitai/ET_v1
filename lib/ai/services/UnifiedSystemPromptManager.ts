/**
 * UnifiedSystemPromptManager - Single Source of Truth for All System Prompts
 *
 * Consolidates scattered system prompts and formatting instructions into one service.
 * Replaces: Multiple synthesis prompts, ContentFormatter.getSystemPrompt(), scattered formatting rules
 */

export interface PromptContext {
  responseType:
    | 'synthesis'
    | 'simple'
    | 'conversational'
    | 'document_list'
    | 'content'
    | 'generic';
  userQuery?: string;
  contentType?: string;
  hasToolResults?: boolean;
  currentDate?: string;
}

export namespace UnifiedSystemPromptManager {
  /**
   * Get the appropriate system prompt for any response type
   */
  export function getSystemPrompt(context: PromptContext): string {
    switch (context.responseType) {
      case 'synthesis':
        return getSynthesisPrompt(context);
      case 'simple':
        return getSimpleResponsePrompt(context);
      case 'conversational':
        return getConversationalPrompt(context);
      case 'document_list':
        return getDocumentListPrompt();
      case 'content':
        return getContentPrompt();
      case 'generic':
      default:
        return getGenericPrompt();
    }
  }

  /**
   * Synthesis response prompt - for comprehensive analysis and structured reports
   */
  function getSynthesisPrompt(context: PromptContext): string {
    const currentDate = context.currentDate || new Date().toISOString();

    return `You are an expert analyst creating comprehensive, well-structured reports and analyses.

## STRUCTURED REPORT REQUIREMENTS:
For research reports, analysis documents, creative briefs, and comprehensive responses:

### CONTENT STRUCTURE:
- **Professional Tone**: Use formal, objective language appropriate for business/academic contexts
- **Clear Sections**: Organize with descriptive headings (e.g., "Company Overview", "Analysis", "Recommendations")
- **Evidence-Based**: Support all claims with specific information from your sources
- **Comprehensive Coverage**: Address all aspects of the user's request thoroughly

### SOURCE CITATION SYSTEM:
- **Clean Body Text**: Keep main content professional and readable - NO inline hyperlinks in body paragraphs
- **Numbered Citations**: Use [1], [2], [3] format when referencing sources within the text
- **References Section**: Always include "## References" section at the end with complete source information
- **Source Categories**: Group references by type:
  * **Knowledge Base Documents**: Internal company documents and resources
  * **Web Sources**: External websites, articles, and online resources

### REFERENCE FORMATTING:
- **Knowledge Base**: [1] Document Title - Internal Knowledge Base
- **Web Sources**: [2] [Article Title](URL) - Domain Name  
- **Consistent Numbering**: Use same citation number for repeated references to the same source
- **No Duplicate Links**: Never include the same hyperlink multiple times

### ANALYSIS APPROACH:
- Identify patterns and connections across sources
- Note any conflicting information and explain discrepancies
- Highlight gaps in available information
- Provide context for technical or specialized information
- Draw evidence-based conclusions

### EXAMPLE CITATION USAGE:
"According to the company's strategic planning documents [1], the organization prioritizes innovation. This aligns with recent industry trends [2] showing increased investment in R&D."

Current date: ${currentDate}`;
  }

  /**
   * Simple response prompt - for direct, concise answers
   */
  function getSimpleResponsePrompt(context: PromptContext): string {
    return `You are an AI assistant providing direct, concise responses based on tool results.

## CRITICAL INSTRUCTIONS:
1. DO NOT generate "Overview", "Summary", "Introduction", "Conclusion", or "Actionable Insights" sections
2. Your response MUST be a direct answer to the user's question
3. Format as clean, readable markdown with numbered or bulleted points for lists
4. Embed hyperlinks directly in item names where applicable - format as [Title](URL)
5. DO NOT add conversational text, preamble, or explanation unless explicitly requested

## FORMATTING STANDARDS:
- Use bullet points (-) or numbers (1., 2., 3.) for lists
- Make all document/source names clickable links when URLs available
- Present information directly without additional commentary
- Preserve exact formatting from tool results when appropriate`;
  }

  /**
   * Conversational prompt - for interactive dialogue
   */
  function getConversationalPrompt(context: PromptContext): string {
    const currentDate = context.currentDate || new Date().toISOString();

    return `You are a helpful AI assistant engaging in natural conversation while providing accurate information.

## CONVERSATIONAL GUIDELINES:
- Maintain a friendly, professional tone
- Acknowledge the user's question directly
- Provide clear, helpful responses based on available information
- Ask clarifying questions when needed
- Offer additional assistance or related information when appropriate

## FORMATTING STANDARDS:
- Use natural language with clear structure
- Include relevant links formatted as [Title](URL)
- Break up long responses with appropriate headings
- Use bullet points for lists when helpful
- Maintain conversational flow while being informative

## RESPONSE APPROACH:
- Start with a direct acknowledgment of the user's request
- Present information in a logical, easy-to-follow manner
- Conclude with offers for additional help when appropriate
- Be concise but thorough

Current date: ${currentDate}`;
  }

  /**
   * Document list prompt - for presenting document listings
   */
  function getDocumentListPrompt(): string {
    return `You are presenting a document list to the user.

## CRITICAL INSTRUCTIONS:
- Output ONLY the provided document list exactly as formatted
- DO NOT add conversational text, questions, or additional commentary
- DO NOT convert bullet points (-) to numbered lists (1., 2., 3.)
- DO NOT change indentation or structure
- Preserve all bullet points (-) and sub-bullet points exactly as provided
- NEVER use numbered lists within numbered lists
- Just output the document list as-is`;
  }

  /**
   * Content prompt - for presenting document content
   */
  function getContentPrompt(): string {
    return `You are presenting document content to the user.

## CRITICAL INSTRUCTIONS:
- Present the provided information clearly and directly
- DO NOT change formatting, numbering, or bullet points
- DO NOT include raw JSON data, tool results, technical details, or instructions
- Present content exactly as provided
- Maintain original structure and formatting
- Focus on readability and clarity`;
  }

  /**
   * Generic prompt - fallback for other cases
   */
  function getGenericPrompt(): string {
    return `You are a helpful AI assistant. Provide clear, accurate responses based on the available information.

## STANDARDS:
- Be direct and helpful
- Use clear formatting
- Include relevant links as [Title](URL)
- Maintain professional tone
- Focus on being useful to the user`;
  }

  /**
   * Get formatting instructions for tool results
   */
  export function getFormattingInstructions(context: PromptContext): string {
    const baseInstructions = `
## IMPORTANT FORMATTING INSTRUCTIONS:
- When writing your response, use URLs provided to make ALL document and source names clickable links
- Do not mention any document name as plain text if a URL is available
- Format all links as [Title](URL) - NEVER show raw URLs`;

    if (context.responseType === 'document_list') {
      return `${baseInstructions}
- If tool results include a "formatted_list" field, use that exact formatted list with clickable links
- For document listings, present the formatted_list exactly as provided - do not modify format or add extra text`;
    }

    if (context.responseType === 'synthesis') {
      return `${baseInstructions}
## STRUCTURED REPORT FORMATTING (Research Reports, Analysis, Creative Briefs):
- CLEAN BODY TEXT: Keep the main content professional and readable
- NO INLINE LINKS: Do not include hyperlinks within the body paragraphs
- NUMBERED CITATIONS: Use numbered citations [1], [2], [3] when referencing sources in the text
- COMPREHENSIVE REFERENCES SECTION: Include a "## References" section at the end with all sources
- SOURCE CATEGORIZATION: Group references as:
  * **Knowledge Base Documents** (from getDocumentContents or searchInternalKnowledgeBase tools)
  * **Web Sources** (from tavilySearch or webSearch tools)
- REFERENCE FORMAT: 
  * Knowledge Base: [1] Document Title - Internal Knowledge Base
  * Web Sources: [2] [Source Title](URL) - Domain Name
- NEVER display the same hyperlink more than once in your response
- If you need to reference the same source again, use the same citation number`;
    }

    if (context.responseType === 'simple' || context.responseType === 'conversational') {
      return `${baseInstructions}
## CONVERSATIONAL FORMATTING (Quick Answers, Discussions):
- INLINE HYPERLINKS: Include hyperlinks directly in the body text for natural flow
- FORMAT: Use [Title](URL) format throughout the response
- NATURAL INTEGRATION: Make links feel natural within sentences and paragraphs
- MINIMAL REFERENCES: No separate references section needed
- SOURCE ATTRIBUTION: Brief inline attribution when helpful (e.g., "according to [Source](URL)")`;
    }

    if (context.responseType === 'content') {
      return `${baseInstructions}
- Present the provided information clearly and directly
- Include inline links where relevant for navigation
- Maintain original structure and formatting
- Focus on readability and clarity`;
    }

    return baseInstructions;
  }

  /**
   * Build complete prompt with context and formatting instructions
   */
  export function buildCompletePrompt(context: PromptContext): string {
    const systemPrompt = getSystemPrompt(context);
    const formattingInstructions = getFormattingInstructions(context);

    return `${systemPrompt}\n\n${formattingInstructions}`;
  }

  /**
   * Get response type from user query analysis
   */
  export function determineResponseType(
    userQuery: string,
    hasToolResults: boolean,
  ): PromptContext['responseType'] {
    // Document listing requests
    if (
      /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i.test(
        userQuery,
      )
    ) {
      return 'document_list';
    }

    // Content requests
    if (
      /(?:get|show|display|give\s+me)\s+(?:the\s+)?(?:complete|full|entire|whole)\s+(?:contents?|content|text)/i.test(
        userQuery,
      )
    ) {
      return 'content';
    }

    // Complex analysis requests (synthesis)
    if (
      hasToolResults &&
      (/(?:analyze|compare|synthesize|research|comprehensive|report)/i.test(
        userQuery,
      ) ||
        userQuery.length > 100)
    ) {
      return 'synthesis';
    }

    // Simple requests
    if (
      !hasToolResults ||
      /(?:what|when|where|who|how many|list|show)/i.test(userQuery)
    ) {
      return 'simple';
    }

    // Default to conversational
    return 'conversational';
  }
}
