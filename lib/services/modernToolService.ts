import { availableTools } from '@/lib/ai/tools';
import type { RequestLogger } from './observabilityService';
import type { Session } from 'next-auth';
import { mcpService } from './mcpService';
import {
  getMcpServerByName,
  getDecryptedAccessTokenByServerName,
} from '@/lib/db/repositories/mcpIntegrations';

// Import timezone tool
import { timezoneToolDefinition } from '@/lib/tools/timezoneTool';

/**
 * ModernToolService
 *
 * Provides intelligent tool selection and context management for the hybrid architecture
 * Bridges LangChain tools with modern patterns while maintaining compatibility
 */

export interface ToolContext {
  userQuery: string;
  activeBitContextId?: string;
  uploadedContent?: any;
  artifactContext?: any;
  fileContext?: any;
  crossUIContext?: any;
  logger: RequestLogger;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  toolName: string;
}

/**
 * Tool categories for better organization
 */
export enum ToolCategory {
  DOCUMENT = 'document',
  SEARCH = 'search',
  ASANA = 'asana',
  EXTERNAL = 'external',
  UTILITY = 'utility',
}

export interface CategorizedTool {
  tool: any; // Use any to avoid complex type issues with mixed tool types
  category: ToolCategory;
  priority: number;
  contextRequirements?: string[];
}

/**
 * Executes a tool with monitoring and error handling
 */
export async function executeToolWithMonitoring(
  tool: any, // Use any to handle different tool types
  params: any,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  context.logger.info(`Executing tool: ${tool.name}`, { params });

  try {
    // Handle different tool types
    const result = tool.func
      ? await tool.func(params)
      : await tool.execute?.(params);
    const duration = performance.now() - startTime;

    context.logger.info(`Tool completed: ${tool.name}`, {
      duration: `${duration.toFixed(2)}ms`,
      success: true,
    });

    return {
      success: true,
      result,
      toolName: tool.name,
      duration,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    context.logger.error(`Tool failed: ${tool.name}`, error);

    return {
      success: false,
      error: errorMessage,
      toolName: tool.name,
      duration,
    };
  }
}

/**
 * Categorizes available tools
 */
export function categorizeTools(): CategorizedTool[] {
  const categorized: CategorizedTool[] = [];

  // Add timezone tool first with high priority for time queries
  categorized.push({
    tool: timezoneToolDefinition,
    category: ToolCategory.UTILITY,
    priority: 9, // High priority for time queries
    contextRequirements: [],
  });

  for (const tool of availableTools) {
    const category: ToolCategory =
      tool.name.includes('Document') || tool.name.includes('document')
        ? ToolCategory.DOCUMENT
        : tool.name.includes('search') ||
            tool.name.includes('Search') ||
            tool.name.includes('knowledge')
          ? ToolCategory.SEARCH
          : tool.name.includes('asana') || tool.name.includes('Asana')
            ? ToolCategory.ASANA
            : tool.name.includes('tavily') ||
                tool.name.includes('weather') ||
                tool.name.includes('calendar')
              ? ToolCategory.EXTERNAL
              : ToolCategory.UTILITY;

    const priority =
      category === ToolCategory.DOCUMENT
        ? 8
        : category === ToolCategory.SEARCH
          ? 7
          : category === ToolCategory.ASANA
            ? 6
            : category === ToolCategory.EXTERNAL
              ? 4
              : 3;

    const contextRequirements: string[] = [];
    if (category === ToolCategory.SEARCH && tool.description?.includes('⚠️')) {
      contextRequirements.push('check_uploaded_content');
    }

    categorized.push({
      tool,
      category,
      priority,
      contextRequirements,
    });
  }

  return categorized.sort((a, b) => b.priority - a.priority);
}

/**
 * Enhanced tool selection with MCP integration support
 */
export async function selectRelevantTools(
  context: ToolContext,
  session: Session | null = null, // Enhanced: Accept user session
  maxTools = 26,
): Promise<any[]> {
  const { userQuery, logger } = context;

  // Enhanced document keyword extraction for multi-document scenarios
  const extractDocumentKeywords = (query: string): string[] => {
    const keywords: string[] = [];

    // Common document name patterns
    const documentPatterns = [
      /\b(?:core\s+values?|values?)\b/gi,
      /\b(?:ideal\s+client\s+profile?|client\s+profile?|icp)\b/gi,
      /\b(?:brand\s+overview|brand)\b/gi,
      /\b(?:producer\s+checklist|checklist)\b/gi,
      /\b(?:client\s+research|research)\b/gi,
      /\b(?:cost\s+sheet|costs?|pricing|rates?)\b/gi,
      /\b(?:profit\s+and\s+loss|p&l|financial)\b/gi,
    ];

    documentPatterns.forEach((pattern) => {
      const matches = query.match(pattern);
      if (matches) {
        keywords.push(...matches.map((m) => m.toLowerCase().trim()));
      }
    });

    return keywords;
  };

  // Detect multi-document analysis scenarios
  const isMultiDocumentQuery = (query: string): boolean => {
    const multiDocPatterns = [
      /\b(?:comparative?|comparison|compare|vs|versus)\b/i,
      /\b(?:analysis|analyze|analytical)\b/i,
      /\b(?:relationship|align|alignment)\b/i,
      /\b(?:differences?|similarities)\b/i,
      /\b(?:contrast|contrasting)\b/i,
      /\b(?:how\s+.*\s+relate)\b/i,
    ];

    return multiDocPatterns.some((pattern) => pattern.test(query));
  };

  const isMultiDoc = isMultiDocumentQuery(userQuery);
  const documentKeywords = extractDocumentKeywords(userQuery);

  logger?.info('[modernToolService] Enhanced document analysis', {
    isMultiDocumentQuery: isMultiDoc,
    extractedDocumentKeywords: documentKeywords,
    inputPreview: userQuery.substring(0, 100),
  });

  const categorizedTools = categorizeTools();
  const keywords = userQuery.toLowerCase();

  logger.info('Starting intelligent tool selection with MCP support', {
    userQuery: userQuery.substring(0, 100),
    totalTools: categorizedTools.length,
    specialist: context.activeBitContextId,
    hasSession: !!session,
    userId: session?.user?.id,
  });

  // Enhanced: Load MCP tools for authenticated users
  let mcpTools: any[] = [];
  if (session?.user?.id) {
    try {
      mcpTools = await loadUserMcpTools(session.user.id, logger);
      logger.info(`Loaded ${mcpTools.length} MCP tools for user`, {
        userId: session.user.id,
        mcpToolNames: mcpTools.map((t) => t.name),
      });
    } catch (error) {
      logger.error('Failed to load MCP tools for user', {
        userId: session.user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Scoring system for tool relevance
  const toolScores: Map<string, number> = new Map();

  for (const {
    tool,
    category,
    priority,
    contextRequirements,
  } of categorizedTools) {
    let score = priority;

    // Advanced keyword matching with intent detection

    // Time and timezone queries (highest priority for time-related questions)
    if (tool.name === 'timezoneTool') {
      if (
        keywords.includes('time') ||
        keywords.includes('timezone') ||
        keywords.includes('clock') ||
        keywords.includes('what time is it') ||
        keywords.includes('current time') ||
        keywords.includes('time in') ||
        keywords.includes('convert time') ||
        keywords.includes('chicago') ||
        keywords.includes('london') ||
        keywords.includes('tokyo') ||
        keywords.includes('paris') ||
        keywords.includes('sydney') ||
        keywords.includes('new york') ||
        keywords.includes('est') ||
        keywords.includes('pst') ||
        keywords.includes('cst') ||
        keywords.includes('mst') ||
        keywords.includes('utc') ||
        keywords.includes('gmt')
      ) {
        score += 50; // Very high priority for time queries
      }
    }

    // Document operations
    if (
      tool.name.toLowerCase().includes('document') ||
      tool.name.toLowerCase().includes('create') ||
      tool.name.toLowerCase().includes('update')
    ) {
      if (
        keywords.includes('create') ||
        keywords.includes('document') ||
        keywords.includes('write') ||
        keywords.includes('edit') ||
        keywords.includes('draft')
      ) {
        score += 15;
      }
    }

    // Knowledge base and search operations
    if (
      tool.name.toLowerCase().includes('search') ||
      tool.name.toLowerCase().includes('knowledge') ||
      tool.name.toLowerCase().includes('list')
    ) {
      if (
        keywords.includes('search') ||
        keywords.includes('find') ||
        keywords.includes('knowledge') ||
        keywords.includes('what') ||
        keywords.includes('show me') ||
        keywords.includes('list') ||
        keywords.includes('contents') ||
        keywords.includes('files') ||
        keywords.includes('documents')
      ) {
        score += 20; // Higher priority for knowledge operations
      }
    }

    // Content retrieval
    if (tool.name.toLowerCase().includes('getfilecontents')) {
      if (
        keywords.includes('contents') ||
        keywords.includes('read') ||
        keywords.includes('file') ||
        keywords.includes('complete') ||
        keywords.includes('full')
      ) {
        score += 18;
      }
    }

    // Asana project management
    if (tool.name.toLowerCase().includes('asana')) {
      if (
        keywords.includes('asana') ||
        keywords.includes('task') ||
        keywords.includes('project') ||
        keywords.includes('assign') ||
        keywords.includes('deadline')
      ) {
        score += 12;
      }
    }

    // External search
    if (tool.name.toLowerCase().includes('tavily')) {
      if (
        keywords.includes('web') ||
        keywords.includes('internet') ||
        keywords.includes('online') ||
        keywords.includes('latest') ||
        keywords.includes('current')
      ) {
        score += 8;
      }
    }

    // Calendar operations
    if (tool.name.toLowerCase().includes('calendar')) {
      if (
        keywords.includes('calendar') ||
        keywords.includes('schedule') ||
        keywords.includes('meeting') ||
        keywords.includes('appointment')
      ) {
        score += 10;
      }
    }

    // Context-based scoring adjustments (but still include all tools)
    if (context.activeBitContextId === 'echo-tango-specialist') {
      // Echo Tango specialist gets slight priority boost for creative and project tools
      if (
        category === ToolCategory.DOCUMENT ||
        category === ToolCategory.ASANA
      ) {
        score += 3; // Reduced from 5 to keep selection more balanced
      }
    }

    if (context.activeBitContextId === 'global-orchestrator') {
      // Global orchestrator gets slight priority boost for knowledge and search tools
      if (
        category === ToolCategory.SEARCH ||
        category === ToolCategory.EXTERNAL
      ) {
        score += 3; // Reduced from 5 to keep selection more balanced
      }

      // Ensure cross-context tool is always available to orchestrator
      if (tool.name === 'getMessagesFromOtherChat') {
        score += 50; // Very high priority for orchestrator
      }
    }

    // Enhanced: MCP tool scoring
    if (mcpTools.some((mcp) => mcp.name === tool.name)) {
      // Boost score for MCP tools when relevant
      if (
        tool.name.toLowerCase().includes('asana') &&
        (keywords.includes('asana') ||
          keywords.includes('task') ||
          keywords.includes('project'))
      ) {
        score += 15; // High priority for relevant MCP tools
      }
    }

    toolScores.set(tool.name, score);
  }

  // Sort tools by score and select top tools
  const sortedTools = categorizedTools
    .sort(
      (a, b) =>
        (toolScores.get(b.tool.name) || 0) - (toolScores.get(a.tool.name) || 0),
    )
    .slice(0, maxTools)
    .map((ct) => ct.tool);

  logger.info('Enhanced tool selection completed', {
    selectedTools: sortedTools.map((t) => t.name),
    mcpTools: mcpTools.length,
    scores: Object.fromEntries(
      sortedTools
        .slice(0, 10)
        .map((t) => [t.name, toolScores.get(t.name) || 0]),
    ),
  });

  return sortedTools;
}

/**
 * Loads MCP tools for a specific user
 */
async function loadUserMcpTools(
  userId: string,
  logger: RequestLogger,
): Promise<any[]> {
  const mcpTools: any[] = [];

  try {
    // Load Asana MCP tools if user has integration
    const asanaServer = await getMcpServerByName('Asana');
    if (asanaServer?.isEnabled) {
      const asanaToken = await getDecryptedAccessTokenByServerName(
        userId,
        'Asana',
      );

      if (asanaToken) {
        const asanaClient = await mcpService.connectToServer(
          asanaServer,
          userId,
          asanaToken,
        );

        if (asanaClient) {
          const availableMcpTools = await mcpService.getAvailableTools(
            asanaClient,
            'Asana',
          );
          const langChainTools = mcpService.convertToLangChainTools(
            availableMcpTools,
            asanaClient,
            'Asana',
          );

          mcpTools.push(...langChainTools);

          logger.info('Successfully loaded Asana MCP tools', {
            userId,
            toolCount: langChainTools.length,
            toolNames: langChainTools.map((t) => t.name),
          });
        }
      }
    }

    // TODO: Add other MCP integrations here as they become available
    // Example: Slack, GitHub, etc.
  } catch (error) {
    logger.error('Error loading MCP tools', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return mcpTools;
}

/**
 * Determines the category for MCP tools
 */
function determineMcpToolCategory(toolName: string): ToolCategory {
  if (toolName.toLowerCase().includes('asana')) {
    return ToolCategory.ASANA;
  }

  // Add more MCP tool categorization logic here

  return ToolCategory.EXTERNAL;
}

/**
 * Gets tools by category
 */
export function getToolsByCategory(category: ToolCategory): any[] {
  const categorizedTools = categorizeTools();
  return categorizedTools
    .filter((ct) => ct.category === category)
    .map((ct) => ct.tool);
}

/**
 * Validates tool parameters before execution
 */
export function validateToolParameters(
  tool: any,
  params: any,
): { valid: boolean; errors?: string[] } {
  try {
    // Check if tool has a schema and it supports safeParse (Zod schema)
    if (tool.schema && typeof tool.schema.safeParse === 'function') {
      const result = tool.schema.safeParse(params);

      if (result.success) {
        return { valid: true };
      } else {
        const errors = result.error.errors.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`,
        );
        return { valid: false, errors };
      }
    }

    // If no schema or not a Zod schema, assume valid
    return { valid: true };
  } catch (error) {
    return { valid: false, errors: ['Schema validation failed'] };
  }
}

/**
 * Gets tool information for display purposes
 */
export function getToolInfo(toolName: string): {
  name: string;
  description: string;
  parameters: any;
  category: ToolCategory;
} | null {
  const tool = availableTools.find((t) => t.name === toolName);
  if (!tool) return null;

  const categorized = categorizeTools().find((ct) => ct.tool.name === toolName);

  return {
    name: tool.name,
    description: tool.description || '',
    parameters: tool.schema,
    category: categorized?.category || ToolCategory.UTILITY,
  };
}

/**
 * Context-aware tool filtering
 */
export function filterToolsForContext(
  tools: any[],
  context: ToolContext,
): any[] {
  return tools.filter((tool) => {
    // Filter out tools that require specific context we don't have
    if (
      tool.description?.includes('⚠️ Knowledge Base Search') &&
      context.uploadedContent
    ) {
      return false;
    }

    // Add other context-based filtering logic here
    return true;
  });
}
