/**
 * QueryClassifier
 *
 * Intelligent routing service that analyzes queries to determine whether they
 * should be handled by LangChain (complex tool orchestration) or Vercel AI SDK
 * (simple responses). Ports logic from EnhancedAgentExecutor with enhanced
 * complexity scoring algorithm.
 * Target: ~140 lines as per roadmap specifications.
 */

import type { RequestLogger } from './observabilityService';
import type { ClientConfig } from '@/lib/db/queries';

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

  constructor(logger: RequestLogger, config: QueryClassifierConfig = {}) {
    this.logger = logger;
    this.config = {
      complexityThreshold: 0.6,
      confidenceThreshold: 0.7,
      enableOverrides: true,
      verbose: false,
      ...config,
    };

    this.logger.info('Initializing QueryClassifier', {
      complexityThreshold: this.config.complexityThreshold,
      confidenceThreshold: this.config.confidenceThreshold,
      contextId: this.config.contextId,
    });
  }

  /**
   * Classify a query and determine execution path
   */
  public async classifyQuery(
    userInput: string,
    conversationHistory: any[] = [],
    systemPrompt?: string,
  ): Promise<QueryClassificationResult> {
    const startTime = performance.now();

    this.logger.info('Classifying query', {
      inputLength: userInput.length,
      historyLength: conversationHistory.length,
      hasSystemPrompt: !!systemPrompt,
    });

    try {
      // 1. Calculate complexity score
      const complexityScore = this.calculateComplexityScore(
        userInput,
        conversationHistory,
      );

      // 2. Detect patterns
      const detectedPatterns = this.detectPatterns(userInput);

      // 3. NEW: Detect multiple tool intents
      const webSearchIntent = this.detectWebSearchIntent(userInput);
      const asanaIntent = this.detectAsanaIntent(userInput);
      const knowledgeBaseIntent = this.detectKnowledgeBaseIntent(userInput);
      const documentListingIntent = this.detectDocumentListingIntent(userInput);
      const documentContentIntent = this.detectDocumentContentIntent(userInput);

      // 4. Analyze conversation context
      const contextComplexity =
        this.analyzeContextComplexity(conversationHistory);

      // 5. Make routing decision
      let shouldUseLangChain = this.determineRoutingDecision(
        complexityScore,
        detectedPatterns,
        contextComplexity,
      );

      // OVERRIDE: If any tool forcing is detected, always use LangChain
      // This ensures web search, asana, etc. go through the proper tool system
      if (
        webSearchIntent.hasIntent ||
        asanaIntent.hasIntent ||
        knowledgeBaseIntent.hasIntent ||
        documentListingIntent.hasIntent ||
        documentContentIntent.hasIntent
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
          },
        );
      }

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

      // 8. NEW: Comprehensive tool forcing strategy
      let forceToolCall: any = null;

      // Prioritize tool forcing by confidence level
      const toolIntents = [
        { name: 'tavilySearch', intent: webSearchIntent },
        { name: 'asana_list_tasks', intent: asanaIntent }, // Use most common Asana tool
        { name: 'getDocumentContents', intent: documentContentIntent }, // Highest priority for specific content
        { name: 'listDocuments', intent: documentListingIntent }, // Prioritize listing over searching
        { name: 'searchInternalKnowledgeBase', intent: knowledgeBaseIntent },
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
      };
    }
  }

  /**
   * Calculate complexity score based on query characteristics
   */
  private calculateComplexityScore(
    userInput: string,
    conversationHistory: any[],
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
  private detectWebSearchIntent(userInput: string): {
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

    // Boost for location-specific searches (like "LWCC in Baton Rouge")
    if (/\s+in\s+[A-Z][a-z]+/.test(userInput)) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.3);
    }

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * Detect Asana tool intent in user input
   */
  private detectAsanaIntent(userInput: string): {
    hasIntent: boolean;
    confidence: number;
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

    return {
      hasIntent: adjustedConfidence > 0.1,
      confidence: adjustedConfidence,
    };
  }

  /**
   * Detect knowledge base search intent in user input
   */
  private detectKnowledgeBaseIntent(userInput: string): {
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
