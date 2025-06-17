/**
 * Enhanced Tool Instructions for Modular LangGraph Architecture
 *
 * These instructions guide tools to provide structured, service-compatible output
 * that works optimally with our DocumentAnalysisService, ContextService, and
 * QueryAnalysisService for intelligent response generation.
 */

/**
 * Enhanced instructions for document-related tools
 * Optimized for DocumentAnalysisService processing
 */
export const enhancedDocumentToolInstructions = {
  listDocuments: `KNOWLEDGE BASE DISCOVERY TOOL: 
  
  **PRIMARY PURPOSE**: Discover available documents in the knowledge base
  
  **USAGE WORKFLOW**:
  1. Always use this tool first when users ask about available documents
  2. Provide comprehensive document listing with metadata
  3. Results are used by DocumentAnalysisService for multi-document scenario detection
  
  **STRUCTURED OUTPUT**: Return results with:
  - Document IDs (essential for exact retrieval)
  - Clear, descriptive titles
  - Brief content summaries when available
  - Document types/categories for analysis
  - Creation dates for relevance assessment
  
  **SERVICE INTEGRATION**: Results feed into:
  - Multi-document scenario detection (DocumentAnalysisService)
  - Response strategy determination (synthesis vs simple)
  - Context optimization for follow-up queries`,

  getDocumentContents: `DOCUMENT RETRIEVAL TOOL:
  
  **PRIMARY PURPOSE**: Fetch full content of specific documents with analysis metadata
  
  **ENHANCED RETRIEVAL STRATEGY**:
  1. Prefer document IDs from listDocuments for exact matches
  2. For title-based retrieval, use specific title terms
  3. Return structured content for service processing
  
  **STRUCTURED OUTPUT**: Include:
  - Document metadata (title, ID, type, date)
  - Content summary (2-3 sentences for context service)
  - Key topics/entities for analysis service
  - Content length indicator for response planning
  - Relationship hints (references to other documents)
  
  **SERVICE INTEGRATION**:
  - DocumentAnalysisService uses metadata for scenario analysis
  - ContextService uses summaries for message window optimization
  - Response generation uses structure hints for formatting`,

  getMultipleDocuments: `SMART MULTI-DOCUMENT RETRIEVAL TOOL:
  
  **ENHANCED CAPABILITIES**: Optimized for service-based analysis
  
  **AUTOMATIC PROCESSING**:
  1. Query analysis for document detection
  2. Parallel retrieval for efficiency
  3. Relationship mapping for comparative analysis
  4. **NEW**: Service-compatible output formatting
  
  **STRUCTURED OUTPUT**: Provide:
  - Document comparison matrix (for DocumentAnalysisService)
  - Relationship indicators (alignment, conflicts, complementary)
  - Analysis type recommendations (comparative, synthesis, report)
  - Confidence scores for document relevance
  - Cross-references and citation opportunities
  
  **ADVANCED SCENARIOS**:
  - Multi-document synthesis requirements
  - Comparative analysis with confidence scoring
  - Document relationship mapping
  - Content gap identification for follow-up queries
  
  **SERVICE INTEGRATION**: Results directly feed:
  - DocumentAnalysisService.analyzeDocumentScenario()
  - Response mode determination (synthesis highly likely)
  - Citation and reference building for response generation`,

  searchAndRetrieveKnowledgeBase: `PROACTIVE RESEARCH TOOL:
  
  **ENHANCED SEARCH STRATEGY**: Semantic search with service integration
  
  **INTELLIGENT RETRIEVAL**:
  1. Semantic matching with relevance scoring
  2. Context-aware result ranking
  3. **NEW**: Service-optimized result formatting
  
  **STRUCTURED OUTPUT**: Include:
  - Search query analysis (intent, complexity, scope)
  - Relevance scores for each result
  - Content type classification (FAQ, guide, case study, etc.)
  - Key entity extraction for further analysis
  - Related search suggestions for context expansion
  
  **BUDGET CREATION WORKFLOW**: Enhanced with service integration:
  1. Project scope analysis from uploaded content
  2. Rate card retrieval with confidence scoring
  3. **NEW**: Service-guided budget structure recommendations
  4. Cross-reference validation with multiple sources
  5. Confidence assessment for budget accuracy`,
};

/**
 * Enhanced instructions for web search tools
 * Optimized for external information integration
 */
export const enhancedWebSearchInstructions = {
  tavilySearch: `PROACTIVE RESEARCH TOOL:
  
  **ENHANCED SEARCH CAPABILITIES**: Web research with service integration
  
  **INTELLIGENT SEARCH STRATEGY**:
  1. Query optimization for current, relevant results
  2. Source credibility assessment
  3. **NEW**: Service-compatible result structuring
  
  **STRUCTURED OUTPUT**: Provide:
  - Search intent analysis (informational, commercial, research)
  - Source credibility indicators (domain authority, publication date)
  - Key findings summary (for ContextService)
  - Fact verification status (verified, needs verification, conflicting)
  - Related query suggestions for comprehensive coverage
  
  **COMPREHENSIVE RESEARCH**: When searching:
  - Company information with credibility assessment
  - Current events with source verification
  - Industry research with trend analysis
  - **NEW**: Integration points with internal knowledge base
  
  **SERVICE INTEGRATION**:
  - QueryAnalysisService uses intent analysis for response planning
  - ContextService uses summaries for optimization
  - Citation building with credibility scores`,

  tavilyExtract: `CONTENT EXTRACTION TOOL:
  
  **ENHANCED EXTRACTION**: Structured content with analysis metadata
  
  **INTELLIGENT EXTRACTION**:
  1. Content relevance assessment
  2. Key information extraction
  3. **NEW**: Service-optimized structuring
  
  **STRUCTURED OUTPUT**: Include:
  - Content summary and key points
  - Source credibility assessment
  - Extraction confidence score
  - Related content suggestions
  - Integration opportunities with knowledge base`,
};

/**
 * Enhanced instructions for data analysis tools
 * Optimized for analytical processing
 */
export const enhancedDataAnalysisInstructions = {
  queryDocumentRows: `DATA ANALYSIS TOOL:
  
  **ENHANCED ANALYSIS**: Raw data processing with intelligent insights
  
  **ANALYTICAL PROCESSING**:
  1. Data analysis and pattern recognition
  2. **NEW**: Service-guided insight generation
  3. Confidence scoring for findings
  
  **STRUCTURED OUTPUT**: Provide:
  - Data analysis summary (key metrics, trends, outliers)
  - Insight confidence scores
  - Visualization recommendations
  - Follow-up analysis suggestions
  - Business impact assessment
  
  **AVOID**: Simply displaying raw rows unless specifically requested
  **FOCUS**: Actionable insights and calculated findings
  
  **SERVICE INTEGRATION**:
  - QueryAnalysisService uses complexity assessment
  - Response formatting based on analysis depth`,
};

/**
 * Enhanced instructions for integration tools
 * Optimized for cross-platform intelligence
 */
export const enhancedIntegrationInstructions = {
  googleCalendar: `CALENDAR MANAGEMENT TOOL:
  
  **ENHANCED INTEGRATION**: Calendar operations with context awareness
  
  **INTELLIGENT OPERATIONS**:
  1. Natural language processing for calendar requests
  2. **NEW**: Context-aware scheduling suggestions
  3. Conflict detection and resolution
  
  **STRUCTURED OUTPUT**: Include:
  - Operation success confirmation
  - Context preservation for follow-up actions
  - Related scheduling opportunities
  - Integration with project management context`,

  asana_tools: `ASANA INTEGRATION TOOLS:
  
  **ENHANCED PROJECT MANAGEMENT**: Task operations with workflow intelligence
  
  **INTELLIGENT OPERATIONS**:
  1. Semantic resolution of project and user names
  2. **NEW**: Workflow impact analysis
  3. Cross-project relationship detection
  
  **STRUCTURED OUTPUT**: Provide:
  - Operation confirmation with context
  - Related task/project suggestions
  - Workflow impact assessment
  - Follow-up action recommendations`,
};

/**
 * General enhanced tool behavior guidelines
 * Applied across all tools for service compatibility
 */
export const enhancedGeneralInstructions = `
## ENHANCED TOOL BEHAVIOR FOR MODULAR ARCHITECTURE

### **STRUCTURED OUTPUT REQUIREMENTS**:
All tools should provide JSON-structured responses with:
- Primary result/content
- Metadata for service processing
- Confidence/relevance scores
- Related suggestions for follow-up
- Service integration hints

### **SERVICE INTEGRATION AWARENESS**:
- DocumentAnalysisService: Provide document metadata and relationship indicators
- ContextService: Include summaries and key information for optimization
- QueryAnalysisService: Return intent analysis and complexity indicators

### **RESPONSE MODE OPTIMIZATION**:
Format results considering downstream response generation:
- **Synthesis Mode**: Rich metadata, cross-references, analysis depth
- **Simple Mode**: Clear summaries, direct answers, minimal complexity
- **Conversational Mode**: Engaging details, follow-up opportunities

### **ERROR HANDLING**:
Provide structured error responses with:
- Clear error categorization
- Recovery suggestions
- Alternative approach recommendations
- Service impact assessment (what services can't function)

### **PERFORMANCE OPTIMIZATION**:
- Include processing time indicators
- Suggest caching opportunities
- Provide result confidence for cache decision-making
- Enable service-level optimization decisions
`;

/**
 * Complete enhanced tool instruction mapping
 * Integrates with existing tool system while adding modular architecture support
 */
export const enhancedToolInstructionMap: Record<string, string> = {
  // Enhanced Knowledge Base Tools
  listDocuments: enhancedDocumentToolInstructions.listDocuments,
  getDocumentContents: enhancedDocumentToolInstructions.getDocumentContents,
  getMultipleDocuments: enhancedDocumentToolInstructions.getMultipleDocuments,
  searchAndRetrieveKnowledgeBase:
    enhancedDocumentToolInstructions.searchAndRetrieveKnowledgeBase,

  // Enhanced Web Search Tools
  tavilySearch: enhancedWebSearchInstructions.tavilySearch,
  tavilyExtract: enhancedWebSearchInstructions.tavilyExtract,

  // Enhanced Data Analysis Tools
  queryDocumentRows: enhancedDataAnalysisInstructions.queryDocumentRows,

  // Enhanced Integration Tools
  googleCalendar: enhancedIntegrationInstructions.googleCalendar,
  ...Object.fromEntries(
    [
      'asana_get_project_details',
      'asana_list_projects',
      'asana_create_task',
      'asana_list_tasks',
      'asana_update_task',
      'asana_create_comment',
      'asana_search_tasks',
    ].map((tool) => [tool, enhancedIntegrationInstructions.asana_tools]),
  ),

  // Enhanced Budget Creation
  createBudget: `BUDGET CREATION TOOL: Enhanced with service integration
  
  **INTELLIGENT BUDGET CREATION**:
  1. Project scope analysis with DocumentAnalysisService integration
  2. Rate card retrieval with confidence scoring
  3. **NEW**: Service-guided budget structure recommendations
  4. Cross-validation with multiple knowledge base sources
  
  **STRUCTURED OUTPUT**: Provide:
  - Budget breakdown with confidence scores
  - Source attribution for all rates
  - Alternative scenario calculations
  - Risk assessment and contingency recommendations
  - Follow-up questions for refinement`,

  // General enhancement for other tools
  getMessagesFromOtherChat: `CHAT MESSAGE RETRIEVAL: Enhanced with context preservation
  
  **STRUCTURED SUMMARY**: When retrieving messages:
  - Summarize key points relevant to current query
  - Preserve context and source attribution
  - **NEW**: Integration opportunities with current conversation
  - Confidence scoring for relevance`,

  requestSuggestions: `SUGGESTION REQUEST: Enhanced confirmation with context
  
  **INTELLIGENT CONFIRMATION**:
  - Confirm request with context preservation  
  - **NEW**: Suggest immediate actions while waiting
  - Integration with ongoing conversation flow`,
};

/**
 * Function to get enhanced tool instructions
 * Compatible with existing system while adding modular architecture benefits
 */
export function getEnhancedToolPromptInstructions(
  toolIds: string[] = [],
): string {
  const instructions = [];

  // Add general enhanced guidelines
  instructions.push(enhancedGeneralInstructions);

  // Add specific tool instructions
  for (const toolId of toolIds) {
    const instruction = enhancedToolInstructionMap[toolId];
    if (instruction) {
      instructions.push(`### ${toolId.toUpperCase()}\n${instruction}`);
    }
  }

  return instructions.join('\n\n');
}
