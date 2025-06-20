/**
 * QueryClassifier
 *
 * Intelligent routing service that analyzes queries to determine whether they
 * should be handled by LangChain (complex tool orchestration) or Vercel AI SDK
 * (simple responses). Ports logic from EnhancedAgentExecutor with enhanced
 * complexity scoring algorithm.
 * Target: ~140 lines as per roadmap specifications.
 *
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
 * - Accepts execution plan context for improved classification
 * - Uses strategic planning information to guide routing decisions
 * - Supports Plan-and-Execute pattern for better agent performance
 */

import type { RequestLogger } from './observabilityService';
import type { ClientConfig } from '@/lib/db/queries';
// NEW: Import ExecutionPlan type for enhanced classification
import type { ExecutionPlan } from '@/lib/ai/graphs/services/PlannerService';
// NEW: Import WorkflowSystem for multi-step workflow detection
import { WorkflowSystem } from '@/lib/ai/workflows';
// AsanaToolMapper removed - using direct MCP tool names

/**
 * Query classification result
 */
export interface QueryClassificationResult {
  shouldUseLangChain: boolean;
  confidence: number;
  reasoning: string;
  complexityScore: number;
  detectedPatterns: string[];
  recommendedModel?: string;
  estimatedTokens?: number;
  forceToolCall?: { name: string } | 'required' | null;
  // NEW: Include execution plan context in results
  executionPlanContext?: {
    taskType: string;
    externalResearchNeeded: boolean;
    internalDocsNeeded: boolean;
    planConfidence: number;
  };
  // NEW: Workflow detection results
  workflowDetection?: {
    isWorkflow: boolean;
    confidence: number;
    complexity: string;
    estimatedSteps: number;
    reasoning: string;
  };
}

/**
 * Configuration for query classification
 */
export interface QueryClassifierConfig {
  clientConfig?: ClientConfig | null;
  contextId?: string | null;
  enableOverrides?: boolean;
  complexityThreshold?: number;
  confidenceThreshold?: number;
  verbose?: boolean;
  // NEW: Execution plan for enhanced classification
  executionPlan?: ExecutionPlan;
}

/**
 * Pattern definitions for query analysis
 */
const COMPLEX_PATTERNS = {
  // Tool-heavy operation patterns
  TOOL_OPERATION: [
    /(?:create|make|generate|build).+(?:task|project|document|file)/i,
    /(?:search|find|look up|retrieve|get|fetch|access).+(?:asana|google|drive|file|document|content|data|knowledge)/i,
    /(?:update|modify|change|edit).+(?:task|project|status|document|file)/i,
    /(?:analyze|process|transform).+(?:data|content|document)/i,
    /(?:give me|show me|provide|display).+(?:contents|file|document|data|information)/i,
    /(?:upload|download|save|store|backup).+(?:file|document|data)/i,

    // Enhanced Asana-specific patterns
    /(?:asana|task|project).+(?:list|show|display|view|get)/i,
    /(?:my|mine|assigned to me).+(?:task|project|asana)/i,
    /(?:show|list|display|view).+(?:task|project).+(?:asana|in asana)/i,
    /(?:show me|give me|list|display).+(?:my|mine).+(?:task|project|assignment)/i,
    /(?:create|add|make).+(?:task|project).+(?:asana|in asana)/i,
    /(?:complete|finish|mark).+(?:task|project)/i,
    /(?:assign|assignee|due date|deadline).+(?:task|project)/i,
    /(?:subtask|dependency|milestone|project)/i,
  ],

  // Multi-step operation patterns
  MULTI_STEP: [
    /(?:first|then|next|after|before|finally)/i,
    /(?:step \d+|phase \d+|\d+\. )/i,
    /(?:if.+then|when.+do|unless.+)/i,
  ],

  // Complex reasoning patterns
  REASONING: [
    /(?:compare|contrast|analyze|evaluate|assess)/i,
    /(?:pros and cons|advantages|disadvantages)/i,
    /(?:because|therefore|however|although|despite)/i,
    /(?:explain why|how does|what if|suppose that)/i,
  ],

  // Domain-specific complexity
  DOMAIN_SPECIFIC: [
    /(?:RAG|retrieval|embedding|vector|semantic)/i,
    /(?:workflow|automation|integration|API)/i,
    /(?:code|programming|development|technical)/i,
    /(?:core values|knowledge base|company|organization|internal)/i,
  ],

  // Document and knowledge retrieval
  KNOWLEDGE_RETRIEVAL: [
    /(?:complete contents|full content|entire file|all content)/i,
    /(?:knowledge base|internal docs|company files|core values|policies|procedures)/i,
    /(?:from the|in our|company's|organization's).+(?:files|documents|database)/i,
  ],
};

// NEW: Web search intent patterns
const WEB_SEARCH_PATTERNS = [
  // Explicit search commands
  /^(?:search|look up|find|research|google)\s+(?:the\s+)?(?:web|internet|online)\s+(?:for|about)/i,
  /(?:search|look up|find|research)\s+(?:for\s+)?(?:information|details|data)\s+(?:about|on|regarding)/i,

  // Information gathering patterns
  /(?:find|get|lookup|research)\s+(?:current|latest|recent|up-to-date)\s+(?:information|data|news)/i,
  /(?:what's|what is)\s+(?:the\s+)?(?:latest|current|recent)\s+(?:news|information|data)\s+(?:about|on)/i,

  // Report and content generation patterns - CRITICAL FOR RESEARCH REQUESTS
  /(?:generate|create|write|produce|make)\s+(?:a\s+)?(?:detailed|comprehensive|thorough|complete|full)\s+(?:report|analysis|summary|overview|brief)\s+(?:on|about|regarding)/i,
  /(?:research|analyze|study|investigate)\s+(?:and\s+)?(?:report\s+on|write\s+about|analyze)/i,
  /(?:tell me|explain|describe)\s+(?:everything\s+)?(?:about|regarding)\s+(?:[a-zA-Z\s\-]+)/i,
  /(?:what\s+(?:is|are)|who\s+(?:is|are)|how\s+(?:do|does))\s+(?:[a-zA-Z\s\-]+)/i,

  // Additional research and analysis patterns
  /(?:research|analyze|investigate|study|examine)\s+(?:[a-zA-Z\s\-]+)/i,
  /(?:provide|give me|show me)\s+(?:information|details|data)\s+(?:about|on|regarding)\s+(?:[a-zA-Z\s\-]+)/i,
  /(?:learn|find out)\s+(?:about|more about)\s+(?:[a-zA-Z\s\-]+)/i,

  // Company/organization research
  /(?:search|research|find|look up)\s+(?:the\s+)?(?:company|organization|business|corporation)/i,
  /(?:tell me|find|research)\s+(?:about|information on)\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i, // Proper nouns

  // Location-based searches
  /(?:search|find|look up).+(?:in\s+[A-Z][a-z]+|in\s+the\s+[A-Z][a-z]+)/i, // "in Baton Rouge", "in the US"
];

// NEW: Asana tool intent patterns
const ASANA_PATTERNS = [
  // Task viewing/listing
  /(?:show|list|display|get|view)\s+(?:my\s+)?(?:tasks|projects|assignments)/i,
  /(?:what\s+(?:are\s+)?my|show\s+me\s+my|list\s+my)\s+(?:tasks|projects|assignments)/i,

  // Task creation
  /(?:create|add|make|new)\s+(?:a\s+)?(?:task|project)\s+(?:in\s+asana|for)/i,
  /(?:assign|give)\s+(?:me\s+)?(?:a\s+)?(?:task|project)/i,

  // Task management
  /(?:complete|finish|mark|update)\s+(?:the\s+)?(?:task|project)/i,
  /(?:set|change|update)\s+(?:the\s+)?(?:due date|deadline|priority)/i,

  // Expanded task management vocabulary
  /(?:workspaces?|workspace)/i,
  /(?:teams?|team)/i,
  /(?:create|add|new|make)\s+(?:a\s+)?(?:task|project|item)/i,
  /(?:update|edit|modify|change)\s+(?:task|project|item)/i,
  /(?:list|show|display|view|get)\s+(?:active|current|my|all)\s+(?:tasks?|projects?|items?)/i,

  // Work management language that often relates to Asana
  /(?:work|todo|to-do|deliverables?|milestones?)/i,
  /(?:assigned\s+to\s+me|my\s+assignments?)/i,
  /(?:due\s+(?:today|tomorrow|soon|this\s+week))/i,
  /(?:priority|urgent|important)/i,

  // Project management vocabulary
  /(?:active\s+projects?|current\s+projects?|ongoing\s+projects?)/i,
  /(?:project\s+status|task\s+status)/i,
];

// NEW: Company-specific information patterns that should trigger knowledge base search
const COMPANY_INFO_PATTERNS = [
  // Financial information
  /(?:profit\s+and\s+loss|P&L|income\s+statement|financial\s+statement|revenue|expenses|earnings)/i,
  /(?:balance\s+sheet|cash\s+flow|financial\s+report|budget|financial\s+data)/i,
  /(?:costs?|pricing|rates?|fees?|charges?)\s+(?:card|sheet|structure|breakdown)/i,

  // Company documents and policies
  /(?:core\s+values|company\s+values|mission\s+statement|vision\s+statement)/i,
  /(?:policies|procedures|guidelines|handbook|manual)/i,
  /(?:organizational\s+chart|company\s+structure|team\s+structure)/i,

  // Client and business information
  /(?:ideal\s+client|client\s+profile|target\s+audience|customer\s+profile)/i,
  /(?:client\s+research|market\s+research|competitive\s+analysis)/i,
  /(?:brand\s+overview|company\s+overview|business\s+overview)/i,

  // Project and operational documents
  /(?:producer\s+checklist|project\s+checklist|workflow|process)/i,
  /(?:scripts?|storyboards?|creative\s+brief|proposal)/i,
  /(?:estimates?|quotes?|contracts?|agreements?)/i,

  // Echo Tango specific patterns
  /(?:echo\s+tango|ET)(?:'s)?\s+(?:profit|loss|revenue|expenses|values|mission|clients?|projects?|rates?|pricing)/i,
  /(?:our|company|organization)(?:'s)?\s+(?:profit|loss|revenue|expenses|values|mission|clients?|projects?|rates?|pricing)/i,

  // General company information requests
  /(?:company|organization|business)(?:'s)?\s+(?:information|data|details|overview|profile)/i,
  /(?:internal|company|organizational)\s+(?:documents|files|information|data)/i,
];

// NEW: Knowledge base intent patterns
const KNOWLEDGE_BASE_PATTERNS = [
  // Internal knowledge access
  /(?:search|find|look up|get)\s+(?:in\s+)?(?:our|the|company|internal)\s+(?:knowledge base|documents|files)/i,
  /(?:what\s+(?:do\s+)?(?:our|we|the company)\s+(?:say|have|know)\s+about)/i,

  // Company information
  /(?:company|our)\s+(?:values|mission|policies|procedures|guidelines)/i,
  /(?:internal|company)\s+(?:documents|files|information|data)/i,

  // Core values and alignment
  /(?:core values|ideal clients|client research|company research)/i,
  /(?:how\s+(?:do\s+)?(?:they|we)\s+align\s+with)/i,
];

// NEW: Document listing intent patterns
const DOCUMENT_LISTING_PATTERNS = [
  // Direct listing requests
  /(?:list|show|display|enumerate)\s+(?:all\s+)?(?:the\s+)?(?:available\s+)?(?:documents|files)/i,
  /(?:what\s+(?:documents|files)\s+(?:are\s+)?(?:available|exist|do\s+(?:we|you)\s+have))/i,
  /(?:show\s+me\s+(?:all\s+)?(?:the\s+)?(?:documents|files))/i,
  /(?:give\s+me\s+a\s+list\s+of\s+(?:all\s+)?(?:the\s+)?(?:documents|files))/i,

  // Knowledge base specific listing
  /(?:list|show|display)\s+(?:all\s+)?(?:files|documents)\s+(?:in\s+)?(?:the\s+)?(?:knowledge\s+base)/i,
  /(?:what\s+(?:files|documents)\s+(?:are\s+)?(?:in\s+)?(?:the\s+)?(?:knowledge\s+base))/i,
  /(?:browse|explore)\s+(?:the\s+)?(?:knowledge\s+base|documents|files)/i,

  // Sample/template-based requests - NEW
  /(?:based on|using|from)\s+(?:samples?|templates?|examples?)\s+(?:in\s+)?(?:the\s+)?(?:knowledge\s+base|documents|files)/i,
  /(?:show\s+me\s+(?:the\s+)?(?:samples?|templates?|examples?))/i,
  /(?:what\s+(?:samples?|templates?|examples?)\s+(?:are\s+)?(?:available|exist|do\s+(?:we|you)\s+have))/i,
  /(?:list|display)\s+(?:all\s+)?(?:the\s+)?(?:samples?|templates?|examples?)/i,
];

// NEW: Document content retrieval intent patterns
const DOCUMENT_CONTENT_PATTERNS = [
  // Direct content requests
  /(?:get|show|display|give\s+me)\s+(?:the\s+)?(?:complete|full|entire|whole)\s+(?:contents?|content|text)\s+(?:of|from)/i,
  /(?:contents?|content|text)\s+(?:of|from)\s+(?:the\s+)?(?:file|document)/i,
  /(?:read|open|view)\s+(?:the\s+)?(?:file|document)/i,
  /(?:what\s+(?:is\s+)?(?:in|inside))\s+(?:the\s+)?(?:file|document)/i,

  // Specific file requests
  /(?:show|get|display|give\s+me)\s+(?:the\s+)?(?:echo\s+tango|core\s+values|rate\s+card|company)/i,
  /(?:entire|complete|full|whole)\s+(?:echo\s+tango|core\s+values|rate\s+card|company)\s+(?:file|document)/i,
  /(?:contents?|content|text)\s+(?:of|from)\s+(?:the\s+)?(?:echo\s+tango|core\s+values|rate\s+card|company)/i,
];

const SIMPLE_PATTERNS = {
  // Basic conversational patterns
  CONVERSATIONAL: [
    /^(?:hi|hello|hey|good morning|good afternoon)/i,
    /^(?:how are you|what's up|how's it going)/i,
    /^(?:thanks|thank you|thx)/i,
    /^(?:yes|no|ok|okay|sure|alright)/i,
  ],

  // Simple informational requests
  FACTUAL: [
    /^(?:what is|what are|who is|when is|where is)/i,
    /^(?:define|explain|tell me about)/i,
    /^(?:can you help|help me)/i,
  ],

  // Weather and simple tools
  SIMPLE_TOOLS: [
    /(?:weather|temperature|forecast)/i,
    /(?:time|date|calendar)/i,
    /(?:suggestion|recommend|advice)/i,
  ],
};

/**
 * QueryClassifier class
 *
 * Analyzes queries and determines optimal execution path
 */
export class QueryClassifier {
  private logger: RequestLogger;
  private config: QueryClassifierConfig;
  private workflowSystem: WorkflowSystem;

  constructor(logger: RequestLogger, config: QueryClassifierConfig = {}) {
    this.logger = logger;
    this.config = {
      complexityThreshold: 0.6,
      confidenceThreshold: 0.7,
      enableOverrides: true,
      verbose: false,
      ...config,
    };
    this.workflowSystem = new WorkflowSystem();

    this.logger.info('Initializing QueryClassifier', {
      complexityThreshold: this.config.complexityThreshold,
      confidenceThreshold: this.config.confidenceThreshold,
      contextId: this.config.contextId,
    });
  }

  /**
   * Classify a query and determine execution path
   * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
   * - Accepts execution plan context for improved classification
   * - Uses strategic planning information to guide routing decisions
   * - Supports Plan-and-Execute pattern for better agent performance
   */
  public async classifyQuery(
    userInput: string,
    contextOrHistory?: any[] | { executionPlan?: ExecutionPlan },
    systemPrompt?: string,
  ): Promise<QueryClassificationResult> {
    const startTime = performance.now();

    // Handle both old and new parameter formats for backward compatibility
    let conversationHistory: any[] = [];
    let executionPlan: ExecutionPlan | undefined;

    if (Array.isArray(contextOrHistory)) {
      // Old format: second parameter is conversation history
      conversationHistory = contextOrHistory;
    } else if (contextOrHistory && typeof contextOrHistory === 'object') {
      // New format: second parameter is context object with execution plan
      executionPlan = contextOrHistory.executionPlan;
      conversationHistory = []; // No history in new format for now
    }

    this.logger.info('Classifying query with enhanced context', {
      inputLength: userInput.length,
      historyLength: conversationHistory.length,
      hasSystemPrompt: !!systemPrompt,
      hasExecutionPlan: !!executionPlan,
      planType: executionPlan?.task_type || 'none',
      externalResearchNeeded:
        executionPlan?.external_research_topics?.length || 0,
      internalDocsNeeded:
        executionPlan?.required_internal_documents?.length || 0,
    });

    try {
      // 1. Calculate complexity score (enhanced with execution plan context)
      const complexityScore = this.calculateComplexityScore(
        userInput,
        conversationHistory,
        executionPlan,
      );

      // 2. Detect patterns
      const detectedPatterns = this.detectPatterns(userInput);

      // 3. NEW: Detect multiple tool intents (enhanced with execution plan)
      const webSearchIntent = this.detectWebSearchIntent(
        userInput,
        executionPlan,
      );
      const asanaIntent = this.detectAsanaIntent(userInput);
      const knowledgeBaseIntent = this.detectKnowledgeBaseIntent(
        userInput,
        executionPlan,
      );
      const documentListingIntent = this.detectDocumentListingIntent(userInput);
      const documentContentIntent = this.detectDocumentContentIntent(userInput);
      const companyInfoIntent = this.detectCompanyInfoIntent(userInput);

      // 4. NEW: Workflow detection using WorkflowSystem
      const workflowAnalysis = this.workflowSystem.analyzeQuery(userInput);
      const workflowDetection = {
        isWorkflow: workflowAnalysis.detection.isWorkflow,
        confidence: workflowAnalysis.detection.confidence,
        complexity: workflowAnalysis.detection.complexity,
        estimatedSteps: workflowAnalysis.plan?.totalSteps || 1,
        reasoning:
          workflowAnalysis.detection.reasoning ||
          'Single-step operation detected',
      };

      this.logger.info('Workflow detection completed', {
        isWorkflow: workflowDetection.isWorkflow,
        confidence: workflowDetection.confidence,
        complexity: workflowDetection.complexity,
        estimatedSteps: workflowDetection.estimatedSteps,
      });

      // 5. Analyze conversation context
      const contextComplexity =
        this.analyzeContextComplexity(conversationHistory);

      // 6. Make routing decision (enhanced with execution plan guidance and workflow detection)
      let shouldUseLangChain = this.determineRoutingDecision(
        complexityScore,
        detectedPatterns,
        contextComplexity,
        executionPlan,
      );

      // OVERRIDE: If any tool forcing is detected, always use LangChain
      // This ensures web search, knowledge base, etc. go through the proper tool system
      if (
        webSearchIntent.hasIntent ||
        asanaIntent.hasIntent ||
        knowledgeBaseIntent.hasIntent ||
        documentListingIntent.hasIntent ||
        documentContentIntent.hasIntent ||
        companyInfoIntent.hasIntent
      ) {
        shouldUseLangChain = true;
        this.logger.info(
          'Overriding routing decision: tool intent detected, forcing LangChain',
          {
            webSearchIntent: webSearchIntent.hasIntent,
            asanaIntent: asanaIntent.hasIntent,
            knowledgeBaseIntent: knowledgeBaseIntent.hasIntent,
            documentListingIntent: documentListingIntent.hasIntent,
            documentContentIntent: documentContentIntent.hasIntent,
            companyInfoIntent: companyInfoIntent.hasIntent,
          },
        );
      }

      // Always use LangChain - simplified architecture
      shouldUseLangChain = true;

      // 6. Calculate confidence
      const confidence = this.calculateConfidence(
        complexityScore,
        detectedPatterns,
      );

      // 7. Generate reasoning
      const reasoning = this.generateReasoning(
        shouldUseLangChain,
        complexityScore,
        detectedPatterns,
        contextComplexity,
      );

      // 8. NEW: Enhanced tool forcing strategy with sequence awareness
      let forceToolCall: any = null;

      // Check for explicit web search + knowledge base combination
      const hasExplicitWebSearch =
        /search\s+(?:the\s+)?web/i.test(userInput) ||
        /web\s+search/i.test(userInput);
      const hasKnowledgeBaseRef =
        /(?:knowledge\s+base|examples?|templates?|samples?)/i.test(userInput);
      const isResearchQuery =
        /(?:research|report|analysis|create.*report)/i.test(userInput);

      // Special case: "based on samples/templates in knowledge base" pattern
      const basedOnSamplesPattern =
        /(?:based on|using|from)\s+(?:samples?|templates?|examples?)\s+(?:in\s+)?(?:the\s+)?(?:knowledge\s+base|documents|files)/i;
      const createWithSamplesPattern =
        /(?:create|generate|write|make)\s+.+\s+(?:based on|using|from)\s+(?:samples?|templates?|examples?)/i;

      if (hasExplicitWebSearch && hasKnowledgeBaseRef && isResearchQuery) {
        this.logger.info(
          '[QueryClassifier] Detected explicit web search + knowledge base research query - forcing both tools',
        );

        // Force tool usage but let agent orchestrate the sequence
        forceToolCall = 'required';

        this.logger.info(
          '[QueryClassifier] Forcing required tools for comprehensive research workflow',
        );
      } else if (
        basedOnSamplesPattern.test(userInput) ||
        createWithSamplesPattern.test(userInput)
      ) {
        this.logger.info(
          '[QueryClassifier] Detected "based on samples" pattern - prioritizing document listing',
        );

        // For "based on samples" queries, always start with listing documents
        // This helps the agent see what templates/samples are available
        forceToolCall = { name: 'listDocuments' };

        this.logger.info(
          '[QueryClassifier] Forcing listDocuments first for sample-based creation',
        );
      } else if (
        documentListingIntent.hasIntent &&
        documentListingIntent.confidence > 0.3
      ) {
        this.logger.info(
          '[QueryClassifier] Detected document listing request - using single tool approach',
        );

        // For document listing requests, force ONLY listDocuments and prevent follow-ups
        // This ensures we get a clean list without additional content retrieval
        forceToolCall = { name: 'listDocuments' };

        this.logger.info(
          '[QueryClassifier] Forcing ONLY listDocuments for clean listing',
        );
      } else if (
        documentContentIntent.hasIntent &&
        documentContentIntent.confidence > 0.6
      ) {
        this.logger.info(
          '[QueryClassifier] Detected explicit document content request - using smart discovery approach',
        );

        // For explicit content requests like "complete contents of [file]",
        // first list documents to find the right match, then get contents
        // This ensures we find the correct document even with fuzzy naming
        forceToolCall = { name: 'listDocuments' };

        this.logger.info(
          '[QueryClassifier] Forcing listDocuments first for smart document discovery',
        );
      } else if (
        companyInfoIntent.hasIntent &&
        companyInfoIntent.confidence > 0.5
      ) {
        this.logger.info(
          '[QueryClassifier] Detected company information request - prioritizing document listing',
        );

        // For company info queries, start with listing documents to find relevant files
        // This helps the agent discover documents like "Echo_Tango__LLC_-_Income_Statement__Profit_and_Loss_.xlsx"
        forceToolCall = { name: 'listDocuments' };

        this.logger.info(
          '[QueryClassifier] Forcing listDocuments first for company information request',
        );
      } else {
        // Original tool forcing logic for other cases
        // Prioritize tool forcing by confidence level
        const toolIntents = [
          { name: 'tavilySearch', intent: webSearchIntent },
          { name: 'listDocuments', intent: documentListingIntent }, // Prioritize listing over searching
          { name: 'listDocuments', intent: companyInfoIntent }, // Company info should also list documents first
          { name: 'getDocumentContents', intent: documentContentIntent }, // Highest priority for specific content
          { name: 'searchInternalKnowledgeBase', intent: knowledgeBaseIntent },
          // NOTE: MCP tools (like Asana) are discovered dynamically
          // No hardcoded tool names to avoid mismatches with actual MCP server tools
        ];

        // Sort by confidence descending
        toolIntents.sort((a, b) => b.intent.confidence - a.intent.confidence);

        // Identify all intents with sufficient confidence
        const confidentIntents = toolIntents.filter(
          (intent) => intent.intent.confidence > 0.3,
        );

        this.logger.info('[QueryClassifier] Confident tool intents detected', {
          count: confidentIntents.length,
          intents: confidentIntents.map((i) => ({
            name: i.name,
            confidence: i.intent.confidence,
          })),
        });

        if (confidentIntents.length > 1) {
          // Multi-tool scenario: let the agent decide the order
          this.logger.info(
            '[QueryClassifier] Multiple tools detected, letting agent orchestrate.',
          );
          forceToolCall = 'required'; // LangGraph will force a tool call from available tools
        } else if (confidentIntents.length === 1) {
          // Single-tool scenario: force the specific tool
          const toolToForce = confidentIntents[0].name;
          this.logger.info(
            `[QueryClassifier] Single high-confidence tool detected: ${toolToForce}`,
          );
          forceToolCall = { name: toolToForce };
        } else {
          this.logger.info(
            '[QueryClassifier] No high-confidence tool intents detected, no forcing applied.',
          );
        }
      }

      // Detection: Direct Asana tool usage (no mapping layer)
      if (asanaIntent.hasIntent && asanaIntent.confidence > 0.2) {
        const toolToForce = asanaIntent.suggestedTool || 'asana_search_tasks';

        this.logger.info(
          `[QueryClassifier] Asana intent detected - forcing tool: ${toolToForce}`,
          {
            confidence: asanaIntent.confidence,
            suggestedTool: toolToForce,
            query: `${userInput.substring(0, 100)}...`,
          },
        );

        return {
          shouldUseLangChain: true,
          confidence: Math.max(0.85, asanaIntent.confidence),
          reasoning: `Asana intent detected - using ${toolToForce} based on query analysis`,
          complexityScore,
          detectedPatterns,
          forceToolCall: { name: toolToForce }, // Use intelligently selected tool
          executionPlanContext: {
            taskType: 'LangChain',
            externalResearchNeeded: webSearchIntent.hasIntent,
            internalDocsNeeded: knowledgeBaseIntent.hasIntent,
            planConfidence: confidence,
          },
          workflowDetection, // Include workflow detection results
        };
      }

      const result: QueryClassificationResult = {
        shouldUseLangChain,
        confidence,
        reasoning,
        complexityScore,
        detectedPatterns,
        recommendedModel: shouldUseLangChain ? 'gpt-4.1' : 'gpt-4.1-mini',
        estimatedTokens: this.estimateTokenUsage(
          userInput,
          conversationHistory,
        ),
        forceToolCall, // NEW: Include tool forcing directive
        executionPlanContext: {
          taskType: shouldUseLangChain ? 'LangChain' : 'Vercel AI SDK',
          externalResearchNeeded: webSearchIntent.hasIntent,
          internalDocsNeeded: knowledgeBaseIntent.hasIntent,
          planConfidence: confidence,
        },
        workflowDetection, // NEW: Include workflow detection results
      };

      const executionTime = performance.now() - startTime;

      this.logger.info('Query classification completed', {
        shouldUseLangChain,
        confidence,
        complexityScore,
        patternCount: detectedPatterns.length,

        webSearchIntentConfidence: webSearchIntent.confidence,
        asanaIntentConfidence: asanaIntent.confidence,
        knowledgeBaseIntentConfidence: knowledgeBaseIntent.confidence,
        documentListingIntentConfidence: documentListingIntent.confidence,
        documentContentIntentConfidence: documentContentIntent.confidence,
        forceToolCall: forceToolCall
          ? typeof forceToolCall === 'string'
            ? forceToolCall
            : forceToolCall.name
          : null,
        executionTime: `${executionTime.toFixed(2)}ms`,
      });

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;

      this.logger.error('Query classification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime.toFixed(2)}ms`,
        inputLength: userInput.length,
      });

      // Fallback to LangChain for safety
      return {
        shouldUseLangChain: true,
        confidence: 0.5,
        reasoning: 'Classification failed, using LangChain as fallback',
        complexityScore: 1.0,
        detectedPatterns: ['classification_error'],
        recommendedModel: 'gpt-4.1',
        forceToolCall: null, // No forcing on error
        executionPlanContext: {
          taskType: 'LangChain',
          externalResearchNeeded: false,
          internalDocsNeeded: false,
          planConfidence: 0.5,
        },
        workflowDetection: {
          isWorkflow: false,
          confidence: 0,
          complexity: 'simple',
          estimatedSteps: 1,
          reasoning: 'Classification error - no workflow analysis performed',
        },
      };
    }
  }

  /**
   * Calculate complexity score based on query characteristics
   */
  private calculateComplexityScore(
    userInput: string,
    conversationHistory: any[],
    executionPlan?: ExecutionPlan,
  ): number {
    let score = 0;

    // Base complexity factors
    const wordCount = userInput.split(/\s+/).length;
    score += Math.min(wordCount / 50, 0.3); // Word count contribution (max 0.3)

    const sentenceCount = userInput
      .split(/[.!?]+/)
      .filter((s) => s.trim()).length;
    score += Math.min(sentenceCount / 5, 0.2); // Sentence complexity (max 0.2)

    // Question complexity
    const questionWords = [
      'how',
      'why',
      'what',
      'when',
      'where',
      'which',
      'who',
    ];
    const questionCount = questionWords.filter((word) =>
      userInput.toLowerCase().includes(word),
    ).length;
    score += Math.min(questionCount / 3, 0.2); // Question complexity (max 0.2)

    // Technical terminology
    const technicalTerms = [
      'API',
      'database',
      'algorithm',
      'integration',
      'workflow',
      'automation',
    ];
    const techTermCount = technicalTerms.filter((term) =>
      userInput.toLowerCase().includes(term.toLowerCase()),
    ).length;
    score += Math.min(techTermCount / 2, 0.3); // Technical complexity (max 0.3)

    // Conversation history complexity
    if (conversationHistory.length > 3) {
      score += 0.2; // Context complexity
    }

    // Execution plan context
    if (executionPlan) {
      score += Math.min(
        executionPlan.external_research_topics?.length || 0,
        0.3,
      );
      score += Math.min(
        executionPlan.required_internal_documents?.length || 0,
        0.3,
      );
    }

    return Math.min(score, 1.0);
  }

  /**
   * Detect patterns in the user input
   */
  private detectPatterns(userInput: string): string[] {
    const patterns: string[] = [];

    // Check complex patterns
    for (const [category, regexes] of Object.entries(COMPLEX_PATTERNS)) {
      for (const regex of regexes) {
        if (regex.test(userInput)) {
          patterns.push(`complex_${category.toLowerCase()}`);
          break; // One per category
        }
      }
    }

    // Check simple patterns
    for (const [category, regexes] of Object.entries(SIMPLE_PATTERNS)) {
      for (const regex of regexes) {
        if (regex.test(userInput)) {
          patterns.push(`simple_${category.toLowerCase()}`);
          break; // One per category
        }
      }
    }

    return patterns;
  }

  /**
   * NEW: Detect document creation intent with high confidence
   */
  private detectDocumentCreationIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
  } {
    // Simple document creation detection without external patterns
    const documentKeywords = [
      'create document',
      'write report',
      'make document',
      'draft',
      'generate file',
    ];
    let matchCount = 0;

    for (const keyword of documentKeywords) {
      if (userInput.toLowerCase().includes(keyword)) {
        matchCount++;
      }
    }

    const confidence = matchCount / documentKeywords.length;
    const hasIntent = confidence > 0; // Any match indicates document creation intent

    // Additional confidence boosters
    let adjustedConfidence = confidence;

    // Boost confidence for explicit words
    if (
      userInput.toLowerCase().includes('create document') ||
      userInput.toLowerCase().includes('write report') ||
      userInput.toLowerCase().includes('make document')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.5);
    }

    // Boost confidence for imperative statements
    if (
      userInput.toLowerCase().startsWith('create') ||
      userInput.toLowerCase().startsWith('write') ||
      userInput.toLowerCase().startsWith('draft') ||
      userInput.toLowerCase().startsWith('make')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    return {
      hasIntent: adjustedConfidence > 0.1, // Lower threshold since any pattern match is significant
      confidence: adjustedConfidence,
    };
  }

  /**
   * Detect web search intent in user input
   */
  private detectWebSearchIntent(
    userInput: string,
    executionPlan?: ExecutionPlan,
  ): {
    hasIntent: boolean;
    confidence: number;
  } {
    let matchCount = 0;
    const totalPatterns = WEB_SEARCH_PATTERNS.length;

    for (const pattern of WEB_SEARCH_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;
      }
    }

    const confidence = matchCount / totalPatterns;
    let adjustedConfidence = confidence;

    // Boost confidence for explicit search terms
    if (
      userInput.toLowerCase().includes('search') ||
      userInput.toLowerCase().includes('look up') ||
      userInput.toLowerCase().includes('research')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
    }

    // Boost confidence for report generation terms
    if (
      userInput.toLowerCase().includes('generate') ||
      userInput.toLowerCase().includes('report') ||
      userInput.toLowerCase().includes('analysis') ||
      userInput.toLowerCase().includes('create')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    // Boost for location-specific searches (like "LWCC in Baton Rouge")
    if (/\s+in\s+[A-Z][a-z]+/.test(userInput)) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    // Execution plan context
    if (executionPlan) {
      adjustedConfidence += Math.min(
        executionPlan.external_research_topics?.length || 0,
        0.3,
      );
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * Detect Asana tool intent in user input and determine the most appropriate tool
   */
  private detectAsanaIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
    suggestedTool?: string;
  } {
    let matchCount = 0;
    const totalPatterns = ASANA_PATTERNS.length;

    for (const pattern of ASANA_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;
      }
    }

    const confidence = matchCount / totalPatterns;
    let adjustedConfidence = confidence;

    // Boost confidence for explicit Asana mentions
    if (userInput.toLowerCase().includes('asana')) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.5);
    }

    // Boost for task/project management terms
    if (
      userInput.toLowerCase().includes('task') ||
      userInput.toLowerCase().includes('project')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    // Boost for workspace/team management terms (these often don't match many patterns)
    if (
      userInput.toLowerCase().includes('workspace') ||
      userInput.toLowerCase().includes('team') ||
      userInput.toLowerCase().includes('available')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.2);
    }

    // Determine the most appropriate Asana tool based on query content
    let suggestedTool = 'asana_search_tasks'; // Default fallback

    const lowerInput = userInput.toLowerCase();

    // PRIORITY 1: Update requests (check FIRST to avoid being caught by generic task patterns)
    if (
      /(?:update|edit|modify|change)\s+(?:my\s+|the\s+)?(?:task|project)/i.test(
        userInput,
      ) ||
      /(?:mark|set)\s+(?:task|project)\s+as/i.test(userInput)
    ) {
      if (lowerInput.includes('project')) {
        suggestedTool = 'asana_update_project';
      } else {
        suggestedTool = 'asana_update_task';
      }
      this.logger.info(
        `[QueryClassifier] Detected update query - suggesting ${suggestedTool}`,
      );
    }
    // PRIORITY 2: Creation requests
    else if (
      /(?:create|add|new|make)\s+(?:a\s+)?(?:task|project)/i.test(userInput)
    ) {
      if (lowerInput.includes('project')) {
        suggestedTool = 'asana_create_project';
      } else {
        suggestedTool = 'asana_create_task';
      }
      this.logger.info(
        `[QueryClassifier] Detected creation query - suggesting ${suggestedTool}`,
      );
    }
    // PRIORITY 3: Workspace-related queries (boost confidence for these)
    else if (
      /(?:list|show|display|get|view)\s+(?:my\s+|all\s+)?workspaces?/i.test(
        userInput,
      ) ||
      /(?:workspaces?\s+(?:in|on|from)\s+asana)/i.test(userInput) ||
      /(?:what\s+workspaces?)/i.test(userInput) ||
      lowerInput.includes('workspace')
    ) {
      suggestedTool = 'asana_list_workspaces';
      // Boost confidence for workspace queries
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
      this.logger.info(
        '[QueryClassifier] Detected workspace query - suggesting asana_list_workspaces',
      );
    }
    // PRIORITY 4: Team-related queries (boost confidence for these)
    else if (
      /(?:list|show|display|get|view)\s+(?:my\s+|all\s+)?teams?/i.test(
        userInput,
      ) ||
      /(?:teams?\s+(?:in|on|from)\s+(?:asana|workspace))/i.test(userInput) ||
      /(?:what\s+teams?\s+(?:are\s+)?(?:available|exist))/i.test(userInput) ||
      /(?:teams?\s+available)/i.test(userInput)
    ) {
      suggestedTool = 'asana_get_teams_for_workspace';
      // Boost confidence for team queries
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
      this.logger.info(
        '[QueryClassifier] Detected team query - suggesting asana_get_teams_for_workspace',
      );
    }
    // PRIORITY 5: User-specific task queries (my tasks, assigned to me)
    else if (
      /(?:my|mine)\s+(?:tasks?|assignments?)/i.test(userInput) ||
      /(?:tasks?\s+(?:assigned\s+to\s+)?me)/i.test(userInput) ||
      /(?:show\s+me\s+my|give\s+me\s+my)\s+(?:tasks?|assignments?)/i.test(
        userInput,
      ) ||
      /(?:what\s+(?:are\s+)?my\s+(?:tasks?|assignments?))/i.test(userInput)
    ) {
      suggestedTool = 'asana_search_tasks';
      // Boost confidence for user-specific queries
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
      this.logger.info(
        '[QueryClassifier] Detected user-specific task query - suggesting asana_search_tasks with user filter',
      );
    }
    // PRIORITY 6: Specific task filtering (use search with filters)
    else if (
      /(?:incomplete|uncompleted|unfinished|pending)\s+tasks?/i.test(
        userInput,
      ) ||
      /(?:tasks?\s+(?:that\s+are\s+)?(?:incomplete|uncompleted|unfinished|pending))/i.test(
        userInput,
      ) ||
      /(?:due\s+(?:today|tomorrow|soon|this\s+week))/i.test(userInput) ||
      /(?:assigned\s+to\s+me)/i.test(userInput) ||
      /(?:high\s+priority|urgent)/i.test(userInput)
    ) {
      suggestedTool = 'asana_search_tasks';
      this.logger.info(
        '[QueryClassifier] Detected filtered task query - suggesting asana_search_tasks with filters',
      );
    }
    // PRIORITY 7: General project listing (use list_projects for general listing)
    else if (
      /(?:list|show|display|view|see)\s+(?:my\s+|active\s+|current\s+|all\s+)?projects?/i.test(
        userInput,
      ) ||
      /(?:projects?\s+(?:in|on|from)\s+asana)/i.test(userInput) ||
      /(?:active\s+projects?)/i.test(userInput) ||
      /(?:current\s+projects?)/i.test(userInput) ||
      /(?:what\s+projects?)/i.test(userInput)
    ) {
      suggestedTool = 'asana_list_projects';
      this.logger.info(
        '[QueryClassifier] Detected general project listing - suggesting asana_list_projects',
      );
    }
    // PRIORITY 8: General task listing (use search for general listing)
    else if (
      /(?:list|show|display|view|see)\s+(?:my\s+|active\s+|current\s+|all\s+)?tasks?/i.test(
        userInput,
      ) ||
      /(?:tasks?\s+(?:in|on|from|for)\s+(?:asana|me))/i.test(userInput) ||
      /(?:what\s+tasks?)/i.test(userInput)
    ) {
      suggestedTool = 'asana_search_tasks';
      this.logger.info(
        '[QueryClassifier] Detected general task listing - suggesting asana_search_tasks',
      );
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
      suggestedTool,
    };
  }

  /**
   * Detect knowledge base search intent in user input
   */
  private detectKnowledgeBaseIntent(
    userInput: string,
    executionPlan?: ExecutionPlan,
  ): {
    hasIntent: boolean;
    confidence: number;
  } {
    let matchCount = 0;
    const totalPatterns = KNOWLEDGE_BASE_PATTERNS.length;

    for (const pattern of KNOWLEDGE_BASE_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;
      }
    }

    const confidence = matchCount / totalPatterns;
    let adjustedConfidence = confidence;

    // Boost confidence for knowledge base specific terms
    if (
      userInput.toLowerCase().includes('knowledge base') ||
      userInput.toLowerCase().includes('core values') ||
      userInput.toLowerCase().includes('company')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
    }

    // Boost for internal/company references
    if (
      userInput.toLowerCase().includes('our') ||
      userInput.toLowerCase().includes('internal') ||
      userInput.toLowerCase().includes('company')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.2);
    }

    // Execution plan context
    if (executionPlan) {
      adjustedConfidence += Math.min(
        executionPlan.external_research_topics?.length || 0,
        0.3,
      );
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * NEW: Detect document listing intent with high confidence
   */
  private detectDocumentListingIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
  } {
    let matchCount = 0;
    const totalPatterns = DOCUMENT_LISTING_PATTERNS.length;

    for (const pattern of DOCUMENT_LISTING_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;
      }
    }

    const confidence = matchCount / totalPatterns;
    let adjustedConfidence = confidence;

    // Boost confidence for explicit listing terms
    if (
      userInput.toLowerCase().includes('list') ||
      userInput.toLowerCase().includes('show') ||
      userInput.toLowerCase().includes('display') ||
      userInput.toLowerCase().includes('enumerate')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    // Boost for "all" or "available" modifiers
    if (
      userInput.toLowerCase().includes('all') ||
      userInput.toLowerCase().includes('available')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.2);
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * NEW: Detect document content retrieval intent with high confidence
   */
  private detectDocumentContentIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
  } {
    let matchCount = 0;
    const totalPatterns = DOCUMENT_CONTENT_PATTERNS.length;

    for (const pattern of DOCUMENT_CONTENT_PATTERNS) {
      if (pattern.test(userInput)) {
        matchCount++;
      }
    }

    const confidence = matchCount / totalPatterns;
    let adjustedConfidence = confidence;

    // Boost confidence for explicit content terms
    if (
      userInput.toLowerCase().includes('contents') ||
      userInput.toLowerCase().includes('content') ||
      userInput.toLowerCase().includes('entire') ||
      userInput.toLowerCase().includes('complete') ||
      userInput.toLowerCase().includes('full')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.4);
    }

    // Boost for specific file mentions
    if (
      userInput.toLowerCase().includes('echo tango') ||
      userInput.toLowerCase().includes('core values') ||
      userInput.toLowerCase().includes('rate card')
    ) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * Analyze conversation context for complexity indicators
   */
  private analyzeContextComplexity(conversationHistory: any[]): number {
    if (conversationHistory.length === 0) return 0;

    let contextScore = 0;

    // Recent tool usage
    const recentMessages = conversationHistory.slice(-5);
    const toolMentions = recentMessages.filter(
      (msg) =>
        msg.content &&
        (msg.content.includes('tool') ||
          msg.content.includes('search') ||
          msg.content.includes('create') ||
          msg.content.includes('update')),
    ).length;

    contextScore += Math.min(toolMentions / 3, 0.4);

    // Conversation length indicates complexity
    contextScore += Math.min(conversationHistory.length / 10, 0.3);

    // Recent errors or failures might indicate complexity
    const errorMentions = recentMessages.filter(
      (msg) =>
        msg.content &&
        (msg.content.includes('error') ||
          msg.content.includes('failed') ||
          msg.content.includes('try again')),
    ).length;

    contextScore += Math.min(errorMentions / 2, 0.3);

    return Math.min(contextScore, 1.0);
  }

  /**
   * Make the final routing decision
   */
  private determineRoutingDecision(
    complexityScore: number,
    detectedPatterns: string[],
    contextComplexity: number,
    executionPlan?: ExecutionPlan,
  ): boolean {
    // Check for override patterns first
    const hasComplexPatterns = detectedPatterns.some((p) =>
      p.startsWith('complex_'),
    );
    const hasSimplePatterns = detectedPatterns.some((p) =>
      p.startsWith('simple_'),
    );

    // Strong Asana/tool operation indicators - always use LangChain
    const hasToolPatterns = detectedPatterns.includes('complex_tool_operation');
    if (hasToolPatterns) {
      return true; // Force LangChain for tool operations
    }

    // Strong simple indicators
    if (hasSimplePatterns && !hasComplexPatterns && contextComplexity < 0.3) {
      return false; // Use Vercel AI SDK
    }

    // Strong complex indicators
    if (hasComplexPatterns || contextComplexity > 0.6) {
      return true; // Use LangChain
    }

    // Use threshold-based decision
    const combinedScore = (complexityScore + contextComplexity) / 2;
    return combinedScore >= (this.config.complexityThreshold || 0.6);
  }

  /**
   * Calculate confidence in the routing decision
   */
  private calculateConfidence(
    complexityScore: number,
    detectedPatterns: string[],
  ): number {
    let confidence = 0.5; // Base confidence

    // Pattern-based confidence
    const patternStrength = detectedPatterns.length / 5; // Normalize by max expected patterns
    confidence += Math.min(patternStrength * 0.3, 0.3);

    // Score clarity (how far from threshold)
    const threshold = this.config.complexityThreshold || 0.6;
    const scoreDistance = Math.abs(complexityScore - threshold);
    confidence += Math.min(scoreDistance * 0.4, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate human-readable reasoning for the decision
   */
  private generateReasoning(
    shouldUseLangChain: boolean,
    complexityScore: number,
    detectedPatterns: string[],
    contextComplexity: number,
  ): string {
    if (shouldUseLangChain) {
      const reasons = [];

      if (complexityScore > 0.7) {
        reasons.push('high query complexity');
      }

      if (detectedPatterns.some((p) => p.includes('tool_operation'))) {
        reasons.push('tool operation detected');
      }

      if (detectedPatterns.some((p) => p.includes('knowledge_retrieval'))) {
        reasons.push('knowledge retrieval required');
      }

      if (contextComplexity > 0.5) {
        reasons.push('complex conversation context');
      }

      if (reasons.length === 0) {
        reasons.push('complexity score above threshold');
      }

      return `Using LangChain due to: ${reasons.join(', ')}`;
    } else {
      const reasons = [];

      if (detectedPatterns.some((p) => p.includes('simple'))) {
        reasons.push('simple conversational patterns');
      }

      if (complexityScore < 0.4) {
        reasons.push('low complexity score');
      }

      if (contextComplexity < 0.3) {
        reasons.push('simple context');
      }

      if (reasons.length === 0) {
        reasons.push('complexity score below threshold');
      }

      return `Using Vercel AI SDK due to: ${reasons.join(', ')}`;
    }
  }

  /**
   * Estimate token usage for the query
   */
  private estimateTokenUsage(
    userInput: string,
    conversationHistory: any[],
  ): number {
    // Rough estimation: ~4 characters per token
    const inputTokens = Math.ceil(userInput.length / 4);
    const historyTokens = conversationHistory.reduce((total, msg) => {
      return total + Math.ceil((msg.content?.length || 0) / 4);
    }, 0);

    return inputTokens + historyTokens;
  }

  /**
   * Get classifier metrics
   */
  public getMetrics(): {
    complexityThreshold: number;
    confidenceThreshold: number;
    enableOverrides: boolean;
  } {
    return {
      complexityThreshold: this.config.complexityThreshold || 0.6,
      confidenceThreshold: this.config.confidenceThreshold || 0.7,
      enableOverrides: this.config.enableOverrides || false,
    };
  }

  /**
   * Detect company information intent that should trigger knowledge base search
   */
  private detectCompanyInfoIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
  } {
    const matches = COMPANY_INFO_PATTERNS.filter((pattern) =>
      pattern.test(userInput),
    );

    if (matches.length === 0) {
      return { hasIntent: false, confidence: 0 };
    }

    // Higher confidence for multiple matches or specific Echo Tango mentions
    let confidence = Math.min(0.3 + matches.length * 0.2, 0.9);

    // Boost confidence for Echo Tango specific mentions
    if (/(?:echo\s+tango|ET)(?:'s)?/i.test(userInput)) {
      confidence = Math.min(confidence + 0.2, 0.95);
    }

    // Boost confidence for financial terms
    if (
      /(?:profit\s+and\s+loss|P&L|income\s+statement|financial)/i.test(
        userInput,
      )
    ) {
      confidence = Math.min(confidence + 0.15, 0.95);
    }

    this.logger.info('[QueryClassifier] Company info intent detected', {
      matches: matches.length,
      confidence,
      patterns: matches.map((m) => m.toString()),
    });

    return { hasIntent: true, confidence };
  }
}

/**
 * Convenience functions for query classification
 */

/**
 * Create a QueryClassifier instance with default configuration
 */
export function createQueryClassifier(
  logger: RequestLogger,
  config?: QueryClassifierConfig,
): QueryClassifier {
  return new QueryClassifier(logger, config);
}

/**
 * Quick classification utility
 */
export async function classifyQuery(
  logger: RequestLogger,
  userInput: string,
  conversationHistory: any[] = [],
  config?: QueryClassifierConfig,
): Promise<QueryClassificationResult> {
  const classifier = createQueryClassifier(logger, config);
  return classifier.classifyQuery(userInput, conversationHistory);
}
