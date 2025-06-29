/**
 * Tool Router Graph
 *
 * Implements the industry-standard tool routing pattern where queries are routed to
 * specialized sub-graphs with 2-3 domain-specific tools, eliminating tool selection confusion.
 *
 * Architecture:
 * Query → Router Node → Specialized Sub-Graph → Focused Agent (2-3 tools) → Success
 *
 * PHASE 2 ENHANCEMENT: Now supports dynamic MCP tool discovery and routing
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { MultiMCPClient } from '../mcp/MultiMCPClient';

// Router state annotation following LangGraph best practices
const RouterStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[] = [], y: BaseMessage[] = []) => x.concat(y),
    default: () => [],
  }),
  route_decision: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),
  routing_metadata: Annotation<{
    confidence?: number;
    reasoning?: string;
    keywords?: string[];
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  agent_outcome: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  // Additional state channels for compatibility
  input: Annotation<string>({
    reducer: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  }),
  ui: Annotation<any[]>({
    reducer: (x: any[] = [], y: any[] = []) => x.concat(y),
    default: () => [],
  }),
  _lastToolExecutionResults: Annotation<any[]>({
    reducer: (x: any[] = [], y: any[] = []) => x.concat(y),
    default: () => [],
  }),
  toolForcingCount: Annotation<number>({
    reducer: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  }),
  iterationCount: Annotation<number>({
    reducer: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  }),
  needsSynthesis: Annotation<boolean>({
    reducer: (x?: boolean, y?: boolean) => y ?? x ?? false,
    default: () => false,
  }),
  response_mode: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  node_execution_trace: Annotation<string[]>({
    reducer: (x: string[] = [], y: string[] = []) => x.concat(y),
    default: () => [],
  }),
  tool_workflow_state: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  metadata: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Extract type from annotation
export type RouterGraphState = typeof RouterStateAnnotation.State;

// Types for routing decisions
type RouteDecision =
  | 'knowledge_base'
  | 'google_workspace'
  | 'research'
  | 'project_management'
  | 'direct_response';

type QueryIntent = {
  type: RouteDecision;
  confidence: number;
  reasoning: string;
  keywords: string[];
};

type SubGraphConfig = {
  name: string;
  tools: any[];
  description: string;
  compiledGraph: any;
};

/**
 * Main Tool Router Graph Class
 * Routes queries to specialized sub-graphs based on semantic intent analysis
 * ENHANCED: Now supports dynamic MCP tool discovery and categorization
 */
export class ToolRouterGraph {
  private llm: ChatOpenAI;
  private allTools: any[];
  private subGraphs: Map<RouteDecision, SubGraphConfig>;
  private compiledGraph: any;
  private mcpClient?: MultiMCPClient;

  constructor(llm: ChatOpenAI, tools: any[], mcpClient?: MultiMCPClient) {
    this.llm = llm;
    this.allTools = tools;
    this.mcpClient = mcpClient;
    this.subGraphs = new Map();
    this.initializeSubGraphs();
    this.compiledGraph = this.createGraph();
  }

  /**
   * Initialize specialized sub-graphs with domain-specific tools
   * ENHANCED: Now supports dynamic MCP tool discovery and categorization
   */
  private initializeSubGraphs(): void {
    console.log(
      '[ToolRouterGraph] Initializing sub-graphs with MCP support...',
    );

    // Phase 1: Initialize standard tool sub-graphs
    this.initializeStandardSubGraphs();

    // Phase 2: Initialize MCP tool sub-graphs (if MCP client available)
    if (this.mcpClient) {
      this.initializeMCPSubGraphs();
    }

    console.log('[ToolRouterGraph] Sub-graph initialization complete:', {
      totalSubGraphs: this.subGraphs.size,
      subGraphNames: Array.from(this.subGraphs.keys()),
      hasMCPSupport: !!this.mcpClient,
    });
  }

  /**
   * Initialize standard (non-MCP) sub-graphs
   */
  private initializeStandardSubGraphs(): void {
    // Knowledge Base Sub-Graph (Internal Documents)
    const knowledgeBaseTools = this.allTools.filter((tool) =>
      [
        'listDocuments',
        'getDocumentContents',
        'searchInternalKnowledgeBase',
      ].includes(tool.name),
    );

    if (knowledgeBaseTools.length > 0) {
      this.subGraphs.set('knowledge_base', {
        name: 'Knowledge Base',
        tools: knowledgeBaseTools,
        description: 'Access internal company documents and knowledge base',
        compiledGraph: createReactAgent({
          llm: this.llm,
          tools: knowledgeBaseTools,
          messageModifier: (messages: BaseMessage[]) => {
            return messages;
          },
        }),
      });
    }

    // Google Workspace Sub-Graph (External Google Services)
    const googleWorkspaceTools = this.allTools.filter(
      (tool) =>
        tool.name.includes('get_') &&
        (tool.name.includes('drive') ||
          tool.name.includes('docs') ||
          tool.name.includes('gmail') ||
          tool.name.includes('sheets')),
    );

    if (googleWorkspaceTools.length > 0) {
      this.subGraphs.set('google_workspace', {
        name: 'Google Workspace',
        tools: googleWorkspaceTools.slice(0, 3), // Limit to 3 tools max
        description: 'Access Google Drive, Docs, Gmail, and Sheets',
        compiledGraph: createReactAgent({
          llm: this.llm,
          tools: googleWorkspaceTools.slice(0, 3),
          messageModifier: (messages: BaseMessage[]) => {
            return messages;
          },
        }),
      });
    }

    // Research Sub-Graph (Web Search and External Research)
    const researchTools = this.allTools.filter((tool) =>
      ['tavilySearch', 'webSearch', 'searchWeb'].includes(tool.name),
    );

    if (researchTools.length > 0) {
      this.subGraphs.set('research', {
        name: 'Research',
        tools: researchTools.slice(0, 3), // Limit to 3 tools max
        description: 'Web search and external research capabilities',
        compiledGraph: createReactAgent({
          llm: this.llm,
          tools: researchTools.slice(0, 3),
          messageModifier: (messages: BaseMessage[]) => {
            return messages;
          },
        }),
      });
    }

    console.log('[ToolRouterGraph] Standard sub-graphs initialized:', {
      knowledge_base: knowledgeBaseTools.length,
      google_workspace: Math.min(googleWorkspaceTools.length, 3),
      research: Math.min(researchTools.length, 3),
    });
  }

  /**
   * Initialize MCP-based sub-graphs with dynamic tool discovery
   * This is the core enhancement for Phase 2 MCP scaling
   * ENHANCED for Task 2.3: Now includes health checking and graceful degradation
   */
  private initializeMCPSubGraphs(): void {
    if (!this.mcpClient) return;

    console.log(
      '[ToolRouterGraph] Discovering MCP tools with health checking...',
    );

    try {
      // Get available MCP services and their tools with health status
      const serviceStatuses = this.mcpClient.getServiceStatus() as any[];

      for (const serviceStatus of serviceStatuses) {
        // Task 2.3: Check service health before using tools
        if (!serviceStatus.available) {
          console.log(
            `[ToolRouterGraph] Skipping unavailable service: ${serviceStatus.name} (health: ${serviceStatus.health?.status || 'unknown'})`,
          );
          continue;
        }

        // Additional health checks for production readiness
        const isHealthy = this.isServiceHealthy(serviceStatus);
        if (!isHealthy) {
          console.warn(
            `[ToolRouterGraph] Service ${serviceStatus.name} is available but unhealthy, skipping`,
          );
          continue;
        }

        console.log(
          `[ToolRouterGraph] Processing healthy service: ${serviceStatus.name} with ${serviceStatus.supportedTools?.length || 0} tools`,
        );

        // Categorize MCP tools by domain
        const mcpTools = this.categorizeMCPTools(
          serviceStatus.name,
          serviceStatus.supportedTools,
        );

        // Create sub-graphs for each domain with available tools
        this.createMCPSubGraphs(serviceStatus.name, mcpTools);
      }

      // Log health summary for monitoring
      this.logMCPHealthSummary(serviceStatuses);
    } catch (error) {
      console.error(
        '[ToolRouterGraph] Failed to initialize MCP sub-graphs:',
        error,
      );
      // Continue with standard tools if MCP initialization fails (graceful degradation)
    }
  }

  /**
   * Task 2.3: Check if an MCP service is healthy enough to use
   */
  private isServiceHealthy(serviceStatus: any): boolean {
    // Basic availability check
    if (!serviceStatus.available) return false;

    // Check if service has tools
    if (
      !serviceStatus.supportedTools ||
      serviceStatus.supportedTools.length === 0
    ) {
      console.warn(
        `[ToolRouterGraph] Service ${serviceStatus.name} has no supported tools`,
      );
      return false;
    }

    // Check health status if available
    if (serviceStatus.health) {
      const health = serviceStatus.health;

      // Check response time (fail if > 5 seconds)
      if (health.responseTime && health.responseTime > 5000) {
        console.warn(
          `[ToolRouterGraph] Service ${serviceStatus.name} response time too high: ${health.responseTime}ms`,
        );
        return false;
      }

      // Check uptime percentage (fail if < 95%)
      if (health.uptime && health.uptime < 0.95) {
        console.warn(
          `[ToolRouterGraph] Service ${serviceStatus.name} uptime too low: ${(health.uptime * 100).toFixed(1)}%`,
        );
        return false;
      }

      // Check error rate (fail if > 5%)
      if (health.errorRate && health.errorRate > 0.05) {
        console.warn(
          `[ToolRouterGraph] Service ${serviceStatus.name} error rate too high: ${(health.errorRate * 100).toFixed(1)}%`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Task 2.3: Log MCP health summary for monitoring and alerting
   */
  private logMCPHealthSummary(serviceStatuses: any[]): void {
    const healthSummary = {
      totalServices: serviceStatuses.length,
      availableServices: serviceStatuses.filter((s) => s.available).length,
      healthyServices: serviceStatuses.filter((s) => this.isServiceHealthy(s))
        .length,
      unhealthyServices: serviceStatuses.filter(
        (s) => s.available && !this.isServiceHealthy(s),
      ),
      unavailableServices: serviceStatuses.filter((s) => !s.available),
    };

    console.log('[ToolRouterGraph] MCP Health Summary:', {
      ...healthSummary,
      healthyServiceNames: serviceStatuses
        .filter((s) => this.isServiceHealthy(s))
        .map((s) => s.name),
      unhealthyServiceNames: healthSummary.unhealthyServices.map((s) => s.name),
      unavailableServiceNames: healthSummary.unavailableServices.map(
        (s) => s.name,
      ),
    });

    // Alert if too many services are unhealthy
    const healthyPercentage =
      healthSummary.healthyServices / healthSummary.totalServices;
    if (healthyPercentage < 0.8 && healthSummary.totalServices > 0) {
      console.warn(
        `[ToolRouterGraph] MCP HEALTH ALERT: Only ${(healthyPercentage * 100).toFixed(1)}% of MCP services are healthy`,
      );
    }
  }

  /**
   * Categorize MCP tools into routing domains based on service name and tool patterns
   * ENHANCED: Mutually exclusive categorization to prevent tool redundancy
   */
  private categorizeMCPTools(
    serviceName: string,
    toolNames: string[],
  ): Record<RouteDecision, string[]> {
    const categorized: Record<RouteDecision, string[]> = {
      knowledge_base: [],
      google_workspace: [],
      research: [],
      project_management: [],
      direct_response: [],
    };

    // Track categorized tools to prevent duplicates
    const categorizedTools = new Set<string>();

    // Service-based categorization (highest priority)
    if (
      serviceName.toLowerCase().includes('google') ||
      serviceName.toLowerCase().includes('workspace')
    ) {
      // Google Workspace tools - categorize by function
      for (const toolName of toolNames) {
        if (categorizedTools.has(toolName)) continue;

        const toolLower = toolName.toLowerCase();

        // Search tools → research
        if (toolLower.includes('search')) {
          categorized.research.push(toolName);
          categorizedTools.add(toolName);
        }
        // File/document tools → knowledge_base
        else if (
          toolLower.includes('drive') ||
          toolLower.includes('docs') ||
          toolLower.includes('file')
        ) {
          categorized.knowledge_base.push(toolName);
          categorizedTools.add(toolName);
        }
        // Communication tools → google_workspace
        else if (
          toolLower.includes('gmail') ||
          toolLower.includes('chat') ||
          toolLower.includes('calendar')
        ) {
          categorized.google_workspace.push(toolName);
          categorizedTools.add(toolName);
        }
        // Spreadsheet tools → google_workspace
        else if (
          toolLower.includes('sheets') ||
          toolLower.includes('forms') ||
          toolLower.includes('slides')
        ) {
          categorized.google_workspace.push(toolName);
          categorizedTools.add(toolName);
        }
        // Default to google_workspace for unmatched google tools
        else {
          categorized.google_workspace.push(toolName);
          categorizedTools.add(toolName);
        }
      }
    }

    if (
      serviceName.toLowerCase().includes('asana') ||
      serviceName.toLowerCase().includes('project')
    ) {
      // Project Management tools - all go to project_management
      for (const toolName of toolNames) {
        if (categorizedTools.has(toolName)) continue;
        categorized.project_management.push(toolName);
        categorizedTools.add(toolName);
      }
    }

    // Only do pattern-based categorization for uncategorized tools
    for (const toolName of toolNames) {
      if (categorizedTools.has(toolName)) continue;

      const toolLower = toolName.toLowerCase();

      if (
        toolLower.includes('search') ||
        toolLower.includes('web') ||
        toolLower.includes('research')
      ) {
        categorized.research.push(toolName);
        categorizedTools.add(toolName);
      } else if (
        toolLower.includes('document') ||
        toolLower.includes('file') ||
        toolLower.includes('knowledge')
      ) {
        categorized.knowledge_base.push(toolName);
        categorizedTools.add(toolName);
      }
      // If no pattern matches, don't categorize (prevents random assignments)
    }

    // Remove empty categories
    Object.keys(categorized).forEach((key) => {
      if (categorized[key as RouteDecision].length === 0) {
        delete categorized[key as RouteDecision];
      }
    });

    console.log(
      `[ToolRouterGraph] OPTIMIZED categorization for ${serviceName}:`,
      {
        totalTools: toolNames.length,
        categorizedCount: categorizedTools.size,
        uncategorized: toolNames.filter((t) => !categorizedTools.has(t)),
        categories: Object.fromEntries(
          Object.entries(categorized).map(([k, v]) => [k, v.length]),
        ),
      },
    );

    return categorized;
  }

  /**
   * Create sub-graphs for MCP tools by domain
   * ENHANCED: Optimized to reduce redundancy and limit tools per sub-graph
   */
  private createMCPSubGraphs(
    serviceName: string,
    categorizedTools: Record<RouteDecision, string[]>,
  ): void {
    console.log(
      `[ToolRouterGraph] Creating optimized sub-graphs for ${serviceName}...`,
    );

    for (const [domain, toolNames] of Object.entries(categorizedTools)) {
      if (toolNames.length === 0) continue;

      const routeDecision = domain as RouteDecision;

      // Limit tools per domain for optimal performance (max 2 per domain)
      const limitedToolNames = toolNames.slice(0, 2);

      // First try to get tools from allTools (for standard tools)
      let domainTools = this.allTools.filter((tool) =>
        limitedToolNames.includes(tool.name),
      );

      // If no tools found in allTools, create minimal tool objects from MCP service
      if (domainTools.length === 0 && this.mcpClient) {
        try {
          // Get the service registration to access tool manifests
          const service = this.mcpClient.getService(serviceName);
          if (service) {
            domainTools = limitedToolNames.map((toolName) => ({
              name: toolName,
              description: `${toolName} via ${serviceName}`,
              // Create a simple tool function that delegates to MCP client
              func: async (args: any) => {
                try {
                  return await this.mcpClient?.executeTool(toolName, args);
                } catch (error) {
                  console.error(
                    `[ToolRouterGraph] MCP tool ${toolName} execution failed:`,
                    error,
                  );
                  throw error;
                }
              },
              schema: {
                type: 'object',
                properties: {},
                description: `Execute ${toolName} via ${serviceName}`,
              },
            }));

            console.log(
              `[ToolRouterGraph] Created ${domainTools.length} optimized MCP tool objects for ${serviceName} ${domain}:`,
              domainTools.map((t) => t.name),
            );
          }
        } catch (error) {
          console.error(
            `[ToolRouterGraph] Failed to create MCP tools for ${serviceName}:`,
            error,
          );
          continue;
        }
      }

      if (domainTools.length === 0) {
        console.warn(
          `[ToolRouterGraph] No tools found for domain ${domain} from service ${serviceName}`,
        );
        continue;
      }

      // Create or enhance existing sub-graph with limited tools
      const existingSubGraph = this.subGraphs.get(routeDecision);

      if (existingSubGraph) {
        // For existing sub-graphs, only add if we have fewer than 3 tools total
        if (existingSubGraph.tools.length < 3) {
          const slotsAvailable = 3 - existingSubGraph.tools.length;
          const toolsToAdd = domainTools.slice(0, slotsAvailable);

          const combinedTools = [...existingSubGraph.tools, ...toolsToAdd];

          this.subGraphs.set(routeDecision, {
            ...existingSubGraph,
            tools: combinedTools,
            description: `${existingSubGraph.description} (Enhanced with ${serviceName})`,
            compiledGraph: createReactAgent({
              llm: this.llm,
              tools: combinedTools,
            }),
          });

          console.log(
            `[ToolRouterGraph] Enhanced ${routeDecision} sub-graph with ${toolsToAdd.length} tools from ${serviceName}:`,
            toolsToAdd.map((t) => t.name),
          );
        } else {
          console.log(
            `[ToolRouterGraph] Skipping ${routeDecision} enhancement - already has ${existingSubGraph.tools.length} tools (max 3)`,
          );
        }
      } else {
        // Create new sub-graph with limited tools
        const finalTools = domainTools.slice(0, 3);
        const subGraphConfig = this.createSubGraphConfig(
          routeDecision,
          finalTools,
          serviceName,
        );
        this.subGraphs.set(routeDecision, subGraphConfig);

        console.log(
          `[ToolRouterGraph] Created new ${routeDecision} sub-graph with ${finalTools.length} tools from ${serviceName}:`,
          finalTools.map((t) => t.name),
        );
      }
    }

    // Log optimization summary
    const totalSubGraphs = this.subGraphs.size;
    const totalTools = Array.from(this.subGraphs.values()).reduce(
      (sum, sg) => sum + sg.tools.length,
      0,
    );

    console.log(
      `[ToolRouterGraph] Sub-graph optimization complete for ${serviceName}: ${totalSubGraphs} sub-graphs, ${totalTools} total tools (optimized from ${Object.values(categorizedTools).flat().length} possible)`,
    );
  }

  /**
   * Create sub-graph configuration for a specific domain
   */
  private createSubGraphConfig(
    domain: RouteDecision,
    tools: any[],
    serviceName: string,
  ): SubGraphConfig {
    const configs = {
      google_workspace: {
        name: 'Google Workspace',
        description: `Access Google Drive, Docs, Gmail, and Sheets via ${serviceName}`,
      },
      project_management: {
        name: 'Project Management',
        description: `Manage tasks, projects, and team collaboration via ${serviceName}`,
      },
      research: {
        name: 'Research',
        description: `Web search and external research capabilities via ${serviceName}`,
      },
      knowledge_base: {
        name: 'Knowledge Base',
        description: `Access documents and knowledge base via ${serviceName}`,
      },
      direct_response: {
        name: 'Direct Response',
        description: 'Direct LLM response without tools',
      },
    };

    const config = configs[domain];

    return {
      name: config.name,
      tools: tools,
      description: config.description,
      compiledGraph: createReactAgent({
        llm: this.llm,
        tools: tools,
      }),
    };
  }

  /**
   * Master router node - analyzes query intent and routes to appropriate sub-graph
   * ENHANCED: Now considers file context to avoid unnecessary tool calls
   */
  private async routerNode(state: RouterGraphState): Promise<RouterGraphState> {
    const messages = state.messages || [];
    const userQuery = this.extractUserQuery(messages);

    console.log('[ToolRouterGraph] Router analyzing query:', userQuery);

    // 🚀 CRITICAL FIX: Check for file context first
    const fileContext = state.metadata?.fileContext;
    const hasFileContent = !!(
      fileContext?.extractedText && fileContext.extractedText.length > 0
    );

    if (hasFileContent) {
      console.log('[ToolRouterGraph] File context detected:', {
        filename: fileContext.filename,
        contentLength: fileContext.extractedText.length,
        contentType: fileContext.contentType,
      });

      // Check if query is about the uploaded file
      const isFileQuery = this.isQueryAboutFile(userQuery, fileContext);

      if (isFileQuery) {
        console.log(
          '[ToolRouterGraph] File-related query detected - routing to direct_response',
        );
        return {
          ...state,
          route_decision: 'direct_response',
          routing_metadata: {
            confidence: 1.0,
            reasoning:
              'File context available - using file content directly instead of searching',
            keywords: ['file_context', 'direct_content'],
          },
        };
      }
    }

    // If no file context or query not about file, use standard routing
    const intent = this.analyzeQueryIntent(userQuery);

    console.log('[ToolRouterGraph] Routing decision:', {
      route: intent.type,
      confidence: intent.confidence,
      reasoning: intent.reasoning,
    });

    return {
      ...state,
      route_decision: intent.type,
      routing_metadata: {
        confidence: intent.confidence,
        reasoning: intent.reasoning,
        keywords: intent.keywords,
      },
    };
  }

  /**
   * Check if the user query is asking about the uploaded file
   */
  private isQueryAboutFile(query: string, fileContext: any): boolean {
    const queryLower = query.toLowerCase();
    const filename = fileContext.filename?.toLowerCase() || '';

    // File-specific query patterns
    const fileQueryPatterns = [
      'summarize this',
      'summarize the',
      'what is this',
      'what does this say',
      'analyze this',
      'analyze the',
      'explain this',
      'explain the',
      'review this',
      'review the',
      'tell me about this',
      'describe this',
      'describe the',
      "what's in this",
      'content of this',
      'overview of this',
      'summary of this',
      'details about this',
      'information in this',
    ];

    // Check for general file query patterns
    for (const pattern of fileQueryPatterns) {
      if (queryLower.includes(pattern)) {
        return true;
      }
    }

    // Check if query mentions the filename
    if (filename) {
      const baseFilename = filename.replace(/\.[^/.]+$/, ''); // Remove extension
      const filenameWords = baseFilename.split(/[_\-\s]+/);

      for (const word of filenameWords) {
        if (word.length > 2 && queryLower.includes(word)) {
          return true;
        }
      }
    }

    // Check for contextual pronouns suggesting reference to uploaded content
    const contextualPronouns = [
      'this document',
      'this file',
      'the document',
      'the file',
      'it says',
      'this content',
    ];
    for (const pronoun of contextualPronouns) {
      if (queryLower.includes(pronoun)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract user query from message history
   */
  private extractUserQuery(messages: BaseMessage[]): string {
    // Find the most recent human message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message._getType() === 'human') {
        return message.content as string;
      }
    }
    return '';
  }

  /**
   * Analyze query intent to determine which sub-graph to route to
   * ENHANCED for Task 2.3: Now includes health-aware routing
   */
  private analyzeQueryIntent(query: string): QueryIntent {
    const queryLower = query.toLowerCase();

    // Knowledge Base indicators (Internal company content) - ENHANCED with file content patterns
    const knowledgeBaseIndicators = [
      // Existing company-specific indicators
      'echo tango',
      'core values',
      'company policy',
      'internal document',
      'our company',
      'knowledge base',
      'company information',
      'company data',
      'internal knowledge',
      'company docs',
      'organizational',
      'business process',

      // NEW: File content request patterns - CRITICAL FIX
      'show me contents',
      'show me the contents',
      'show contents',
      'get contents',
      'file contents',
      'document contents',
      'contents of',
      'retrieve document',
      'show me the',
      'display content',
      'file content',
      'document content',
      'full content',
      'complete contents',
      'full text',
      'show me',
      'get file',
      'retrieve file',
      'display document',
      'view document',
      'open document',
      'read document',
      'access document',

      // Generic document-related queries
      'document',
      'file',
      'text',
      'content',
      'contents',
      'internal',
      'knowledge',
      'documents',
      'files',

      // Specific file types and patterns
      'pdf',
      'doc',
      'docx',
      'txt',
      'profile',
      'report',
      'guide',
      'manual',
      'policy',
      'procedures',
      'handbook',
    ];

    // Google Workspace indicators (External Google services)
    const googleWorkspaceIndicators = [
      'google drive',
      'my drive',
      'drive file',
      'google docs',
      'google doc',
      'gmail',
      'google sheets',
      'spreadsheet',
      'drive document',
      'shared drive',
      'google workspace',
      'gsuite',
      'drive folder',
      'google chat',
      'google calendar',
    ];

    // Project Management indicators (Asana, task management)
    const projectManagementIndicators = [
      'asana',
      'task',
      'project',
      'assignment',
      'team',
      'workspace',
      'deadline',
      'milestone',
      'collaboration',
      'project management',
      'task management',
      'work management',
    ];

    // Research indicators (Web search and external research)
    const researchIndicators = [
      'research',
      'search web',
      'find information',
      'look up',
      'investigate',
      'market trends',
      'industry analysis',
      'competitive analysis',
      'external data',
      'web search',
      'online information',
      'current events',
      'news',
    ];

    // Calculate confidence scores for each domain
    const knowledgeScore = this.calculateIndicatorScore(
      queryLower,
      knowledgeBaseIndicators,
    );
    const googleScore = this.calculateIndicatorScore(
      queryLower,
      googleWorkspaceIndicators,
    );
    const projectScore = this.calculateIndicatorScore(
      queryLower,
      projectManagementIndicators,
    );
    const researchScore = this.calculateIndicatorScore(
      queryLower,
      researchIndicators,
    );

    // Determine the highest scoring domain
    const scores = [
      {
        type: 'knowledge_base' as RouteDecision,
        score: knowledgeScore,
        indicators: knowledgeBaseIndicators,
      },
      {
        type: 'google_workspace' as RouteDecision,
        score: googleScore,
        indicators: googleWorkspaceIndicators,
      },
      {
        type: 'project_management' as RouteDecision,
        score: projectScore,
        indicators: projectManagementIndicators,
      },
      {
        type: 'research' as RouteDecision,
        score: researchScore,
        indicators: researchIndicators,
      },
    ];

    // Sort by score and get the highest
    scores.sort((a, b) => b.score - a.score);
    const topChoice = scores[0];

    // If no strong indicators, check for document-related fallback patterns
    if (topChoice.score === 0) {
      // ENHANCED FALLBACK: Check for document-related queries that should use knowledge base
      const documentFallbackPatterns = [
        'document',
        'file',
        'content',
        'contents',
        'text',
        'pdf',
        'doc',
        'show',
        'get',
        'retrieve',
        'display',
        'view',
        'read',
        'access',
        'profile',
        'report',
        'guide',
        'manual',
        'handbook',
      ];

      const hasDocumentPattern = documentFallbackPatterns.some((pattern) =>
        queryLower.includes(pattern),
      );

      if (hasDocumentPattern && this.subGraphs.has('knowledge_base')) {
        return {
          type: 'knowledge_base',
          confidence: 0.7,
          reasoning:
            'Document-related query detected, routing to knowledge base as fallback',
          keywords: documentFallbackPatterns.filter((pattern) =>
            queryLower.includes(pattern),
          ),
        };
      }

      return {
        type: 'direct_response',
        confidence: 0.9,
        reasoning:
          'No specific tool indicators detected, using direct LLM response',
        keywords: [],
      };
    }

    // Task 2.3: Check if the chosen sub-graph actually exists and is healthy
    if (!this.subGraphs.has(topChoice.type)) {
      console.log(
        `[ToolRouterGraph] Sub-graph ${topChoice.type} not available, falling back to direct response`,
      );
      return {
        type: 'direct_response',
        confidence: 0.8,
        reasoning: `${topChoice.type} sub-graph not available, using direct response`,
        keywords: [],
      };
    }

    // Task 2.3: Additional health check for MCP-dependent sub-graphs
    const subGraph = this.subGraphs.get(topChoice.type);
    if (subGraph && this.mcpClient) {
      const isSubGraphHealthy = this.isSubGraphHealthy(topChoice.type);
      if (!isSubGraphHealthy) {
        console.warn(
          `[ToolRouterGraph] Sub-graph ${topChoice.type} has unhealthy MCP dependencies, considering fallback`,
        );

        // Try to find a healthy alternative or fall back to direct response
        const fallbackRoute = this.findHealthyFallbackRoute(scores);
        if (fallbackRoute) {
          return {
            type: fallbackRoute.type,
            confidence: Math.max(0.6, fallbackRoute.score * 0.8), // Reduced confidence for fallback
            reasoning: `Primary route ${topChoice.type} unhealthy, using fallback ${fallbackRoute.type}`,
            keywords: fallbackRoute.indicators.filter((indicator) =>
              queryLower.includes(indicator),
            ),
          };
        } else {
          return {
            type: 'direct_response',
            confidence: 0.7,
            reasoning: `All MCP-dependent routes unhealthy, using direct response`,
            keywords: [],
          };
        }
      }
    }

    const confidence = Math.min(0.95, 0.6 + topChoice.score * 0.35);
    const matchedKeywords = topChoice.indicators.filter((indicator) =>
      queryLower.includes(indicator),
    );

    return {
      type: topChoice.type,
      confidence: confidence,
      reasoning: `Query matches ${topChoice.type} patterns with score ${topChoice.score.toFixed(2)}`,
      keywords: matchedKeywords,
    };
  }

  /**
   * Task 2.3: Check if a sub-graph has healthy MCP dependencies
   */
  private isSubGraphHealthy(routeDecision: RouteDecision): boolean {
    if (!this.mcpClient) return true; // No MCP dependencies

    const subGraph = this.subGraphs.get(routeDecision);
    if (!subGraph) return false;

    // Check if any tools in this sub-graph depend on MCP services
    const mcpDependentTools = subGraph.tools.filter(
      (tool) =>
        tool.name.includes('get_') ||
        tool.name.includes('asana') ||
        tool.name.includes('drive') ||
        tool.name.includes('gmail'),
    );

    if (mcpDependentTools.length === 0) return true; // No MCP dependencies

    // Check health of relevant MCP services
    const serviceStatuses = this.mcpClient.getServiceStatus() as any[];

    for (const tool of mcpDependentTools) {
      const relevantService = serviceStatuses.find((service) =>
        service.supportedTools?.includes(tool.name),
      );

      if (relevantService && !this.isServiceHealthy(relevantService)) {
        console.warn(
          `[ToolRouterGraph] Tool ${tool.name} depends on unhealthy service ${relevantService.name}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Task 2.3: Find a healthy fallback route from scored options
   */
  private findHealthyFallbackRoute(
    scores: Array<{ type: RouteDecision; score: number; indicators: string[] }>,
  ): { type: RouteDecision; score: number; indicators: string[] } | null {
    // Skip the first (primary) choice and look for alternatives
    for (let i = 1; i < scores.length; i++) {
      const candidate = scores[i];
      if (
        candidate.score > 0 &&
        this.subGraphs.has(candidate.type) &&
        this.isSubGraphHealthy(candidate.type)
      ) {
        console.log(
          `[ToolRouterGraph] Found healthy fallback route: ${candidate.type}`,
        );
        return candidate;
      }
    }

    // If no scored alternatives, check if knowledge_base is available (most reliable fallback)
    if (
      this.subGraphs.has('knowledge_base') &&
      this.isSubGraphHealthy('knowledge_base')
    ) {
      return {
        type: 'knowledge_base',
        score: 0.3, // Low score but available
        indicators: ['fallback'],
      };
    }

    return null;
  }

  /**
   * Calculate indicator score for a query against a set of indicators
   */
  private calculateIndicatorScore(query: string, indicators: string[]): number {
    let score = 0;
    for (const indicator of indicators) {
      if (query.includes(indicator)) {
        score += indicator.length / query.length; // Weight by indicator specificity
      }
    }
    return score;
  }

  /**
   * Direct response node for queries that don't need tools
   * ENHANCED: Now uses file content when available for file-related queries
   */
  private async directResponseNode(
    state: RouterGraphState,
  ): Promise<RouterGraphState> {
    const messages = state.messages || [];
    const fileContext = state.metadata?.fileContext;
    const hasFileContent = !!(
      fileContext?.extractedText && fileContext.extractedText.length > 0
    );

    console.log('[ToolRouterGraph] Direct response - no tools needed');

    try {
      let responseMessages = [...messages];

      // 🚀 CRITICAL FIX: If file content is available, include it in the context
      if (hasFileContent) {
        const userQuery = this.extractUserQuery(messages);

        console.log(
          '[ToolRouterGraph] Using file content for direct response:',
          {
            filename: fileContext.filename,
            contentLength: fileContext.extractedText.length,
            userQuery: userQuery.substring(0, 100),
          },
        );

        // Create an enhanced system message with file content
        const fileContentPrompt = `You have been provided with the content of a file: "${fileContext.filename}"

FILE CONTENT:
---
${fileContext.extractedText}
---

Please respond to the user's query about this file content. Use the file content directly to answer their question. Do not search for external information or mention that you need to look up anything - you have all the information needed in the file content above.

User Query: ${userQuery}`;

        // Replace or enhance the user's message with file-aware context
        responseMessages = [
          ...messages.slice(0, -1), // All messages except the last user message
          {
            _getType: () => 'human',
            content: fileContentPrompt,
          } as any,
        ];
      }

      // Use LLM without any tools for direct response
      const response = await this.llm.invoke(responseMessages);

      return {
        ...state,
        messages: [...messages, response],
        agent_outcome: response,
      };
    } catch (error) {
      console.error('[ToolRouterGraph] Error in direct response:', error);

      const errorMessage = new AIMessage({
        content: `Error generating response: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });

      return {
        ...state,
        messages: [...messages, errorMessage],
        agent_outcome: errorMessage,
      };
    }
  }

  /**
   * Route to appropriate sub-graph based on routing decision
   */
  private routeToSubGraph(state: any): string {
    const routeDecision = state.route_decision;

    console.log('[ToolRouterGraph] Routing to sub-graph:', routeDecision);

    // Validate route decision and ensure sub-graph exists
    if (routeDecision && this.subGraphs.has(routeDecision)) {
      return routeDecision;
    }

    if (routeDecision === 'direct_response') {
      return 'direct_response';
    }

    // Fallback to direct response if route is invalid
    console.warn(
      '[ToolRouterGraph] Invalid route decision, falling back to direct response',
      { routeDecision, availableRoutes: Array.from(this.subGraphs.keys()) },
    );
    return 'direct_response';
  }

  /**
   * Create the complete router graph with all sub-graphs
   */
  private createGraph(): any {
    const graphBuilder: any = new StateGraph(RouterStateAnnotation)
      .addNode('router', this.routerNode.bind(this))
      .addNode('direct_response', this.directResponseNode.bind(this));

    // Add sub-graph nodes that delegate to the compiled sub-graphs
    const subGraphEntries = Array.from(this.subGraphs.entries());
    for (const [route, config] of subGraphEntries) {
      graphBuilder.addNode(route, async (state: RouterGraphState) => {
        console.log(`[ToolRouterGraph] Executing ${route} sub-graph`);

        try {
          // Execute the sub-graph with the current state
          const result = await config.compiledGraph.invoke(state);

          return {
            ...state,
            messages: result.messages || state.messages,
            agent_outcome:
              result.agent_outcome ||
              (result.messages && result.messages.length > 0
                ? result.messages[result.messages.length - 1]
                : undefined),
          };
        } catch (error) {
          console.error(
            `[ToolRouterGraph] Error in ${route} sub-graph:`,
            error,
          );

          const errorMessage = new AIMessage({
            content: `Error in ${config.name}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          });

          return {
            ...state,
            messages: [...(state.messages || []), errorMessage],
            agent_outcome: errorMessage,
          };
        }
      });
    }

    // Set entry point and routing
    graphBuilder
      .addEdge(START, 'router')
      .addConditionalEdges('router', this.routeToSubGraph.bind(this));

    // All sub-graphs and direct response go to END
    const subGraphKeys = Array.from(this.subGraphs.keys());
    for (const route of subGraphKeys) {
      graphBuilder.addEdge(route, END);
    }
    graphBuilder.addEdge('direct_response', END);

    return graphBuilder.compile();
  }

  /**
   * Stream execution through the router graph
   * ENHANCED: Now supports real-time character-by-character streaming
   */
  public async *stream(input: {
    messages: BaseMessage[];
  }): AsyncIterableIterator<string> {
    console.log('[ToolRouterGraph] Starting stream execution');

    try {
      const stream = await this.compiledGraph.stream(input);
      let processedContent = '';

      for await (const chunk of stream) {
        console.log(
          '[ToolRouterGraph] Stream chunk:',
          typeof chunk,
          Object.keys(chunk || {}),
        );

        // LangGraph streams state chunks as objects with node names as keys
        if (chunk && typeof chunk === 'object') {
          // Look for terminal nodes that contain final results
          const nodeNames = Object.keys(chunk);

          for (const nodeName of nodeNames) {
            const nodeState = chunk[nodeName];

            // Skip intermediate router states
            if (nodeName === 'router') {
              continue;
            }

            // Process terminal nodes (sub-graphs and direct_response)
            if (nodeState && typeof nodeState === 'object') {
              let content = '';

              // Extract content from messages array
              if (nodeState.messages && Array.isArray(nodeState.messages)) {
                const lastMessage =
                  nodeState.messages[nodeState.messages.length - 1];
                if (lastMessage?.content) {
                  content =
                    typeof lastMessage.content === 'string'
                      ? lastMessage.content
                      : String(lastMessage.content);
                }
              }

              // Extract content from agent_outcome
              if (!content && nodeState.agent_outcome?.content) {
                content =
                  typeof nodeState.agent_outcome?.content === 'string'
                    ? nodeState.agent_outcome?.content
                    : String(nodeState.agent_outcome?.content);
              }

              // REAL-TIME STREAMING FIX: Yield content incrementally
              if (content?.trim() && content !== processedContent) {
                console.log(
                  `[ToolRouterGraph] Found content from node ${nodeName}, streaming incrementally`,
                );

                // NEW: Stream content in smaller chunks for real-time display
                const newContent = content.slice(processedContent.length);

                if (newContent.length > 0) {
                  // Break into word-sized chunks for smooth streaming
                  const words = newContent.split(/(\s+)/);

                  for (const word of words) {
                    if (word.trim()) {
                      // Yield each word with a small delay for smooth streaming effect
                      yield word;
                      processedContent += word;
                    } else if (word) {
                      // Include whitespace
                      yield word;
                      processedContent += word;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Final safety check - yield any remaining content
      if (!processedContent.trim()) {
        console.warn('[ToolRouterGraph] No content found in stream');
        yield 'No content generated from the query.';
      }
    } catch (error) {
      console.error('[ToolRouterGraph] Stream execution error:', error);

      // Yield error as readable text
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred during execution'}`;

      // Stream error message word by word too
      const errorWords = errorMessage.split(/(\s+)/);
      for (const word of errorWords) {
        yield word;
      }
    }
  }

  /**
   * Get summary of sub-graph configurations for debugging
   */
  public getSubGraphSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    const subGraphEntries = Array.from(this.subGraphs.entries());
    for (const [route, config] of subGraphEntries) {
      summary[route] = {
        name: config.name,
        toolCount: config.tools.length,
        tools: config.tools.map((t) => t.name),
        description: config.description,
      };
    }

    return summary;
  }
}

/**
 * Factory function to create a configured ToolRouterGraph
 */
export function createToolRouterGraph(
  llm: ChatOpenAI,
  tools: any[],
  mcpClient?: MultiMCPClient,
): ToolRouterGraph {
  console.log(
    '[ToolRouterGraph] Creating router graph with',
    tools.length,
    'total tools',
  );

  const router = new ToolRouterGraph(llm, tools, mcpClient);

  console.log(
    '[ToolRouterGraph] Sub-graph summary:',
    router.getSubGraphSummary(),
  );

  return router;
}
