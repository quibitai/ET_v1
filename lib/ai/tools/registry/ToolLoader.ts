/**
 * Tool Loader Service
 *
 * Enhanced service for Phase 2 Task 2.4: Runtime Tool Loading
 * - Dynamically loads and refreshes MCP tools
 * - Implements caching for performance
 * - Enforces tool limitation (max 3 per sub-graph)
 * - Supports real-time tool updates
 */

import type { Tool, ToolContext } from './types';
import { ToolCategory } from './types';
import { toolRegistry } from './UnifiedToolRegistry';
import { AsanaToolAdapter } from '../adapters/AsanaToolAdapter';
import { GoogleWorkspaceToolAdapter } from '../adapters/GoogleWorkspaceToolAdapter';

// Task 2.4: Tool cache interface for performance optimization
interface ToolCache {
  tools: Tool[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Task 2.4: MCP tool refresh configuration
interface MCPRefreshConfig {
  enabled: boolean;
  intervalMs: number;
  maxRetries: number;
}

export class ToolLoader {
  private static instance: ToolLoader | null = null;
  private initialized = false;
  private asanaAdapter: AsanaToolAdapter | null = null;
  private googleWorkspaceAdapter: GoogleWorkspaceToolAdapter | null = null;

  // Task 2.4: Enhanced caching and refresh capabilities
  private toolCache: Map<string, ToolCache> = new Map();
  private refreshConfig: MCPRefreshConfig = {
    enabled: true,
    intervalMs: 300000, // 5 minutes
    maxRetries: 3,
  };
  private refreshInterval: NodeJS.Timeout | null = null;
  private lastRefreshAttempt: number = 0;
  private refreshInProgress = false;

  private constructor() {}

  static getInstance(): ToolLoader {
    if (!ToolLoader.instance) {
      ToolLoader.instance = new ToolLoader();
    }
    return ToolLoader.instance;
  }

  /**
   * Initialize all tools and register them
   * ENHANCED for Task 2.4: Now includes caching and refresh setup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(
      '[ToolLoader] Initializing tools with enhanced caching and refresh...',
    );

    try {
      // Clear existing tools and cache
      toolRegistry.clear();
      this.toolCache.clear();

      // Load standard tools
      await this.loadStandardTools();

      // Load MCP tools with caching
      await this.loadMCPToolsWithCaching();

      // Task 2.4: Setup automatic refresh if enabled
      this.setupAutomaticRefresh();

      this.initialized = true;

      const stats = toolRegistry.getStats();
      console.log('[ToolLoader] Enhanced tools initialized:', {
        ...stats,
        cacheEnabled: true,
        refreshEnabled: this.refreshConfig.enabled,
        refreshIntervalMinutes: this.refreshConfig.intervalMs / 60000,
      });
    } catch (error) {
      console.error('[ToolLoader] Failed to initialize tools:', error);
      throw error;
    }
  }

  /**
   * Get all registered tools with tool limitation enforcement
   * ENHANCED for Task 2.4: Enforces max 3 tools per category for sub-graphs
   */
  getTools(limitPerCategory?: number): Tool[] {
    if (!this.initialized) {
      console.warn('[ToolLoader] Tools not initialized, returning empty array');
      return [];
    }

    const allTools = toolRegistry.getTools();

    // Task 2.4: Apply tool limitation if specified (default: no limit for backward compatibility)
    if (limitPerCategory) {
      return this.applyToolLimitation(allTools, limitPerCategory);
    }

    return allTools;
  }

  /**
   * Task 2.4: Get tools for sub-graphs with strict limitation enforcement
   */
  getToolsForSubGraph(category: ToolCategory, maxTools: number = 3): Tool[] {
    if (!this.initialized) {
      console.warn('[ToolLoader] Tools not initialized, returning empty array');
      return [];
    }

    const categoryTools = toolRegistry.getToolsByCategory(category);

    // Enforce maximum tools per sub-graph
    const limitedTools = categoryTools.slice(0, maxTools);

    console.log(
      `[ToolLoader] Sub-graph tools for ${category}: ${limitedTools.length}/${categoryTools.length} (limit: ${maxTools})`,
    );

    return limitedTools;
  }

  /**
   * Task 2.4: Refresh MCP tools dynamically without system restart
   */
  async refreshMCPTools(): Promise<{
    success: boolean;
    updatedTools: number;
    errors: string[];
  }> {
    if (this.refreshInProgress) {
      console.log('[ToolLoader] Refresh already in progress, skipping');
      return {
        success: false,
        updatedTools: 0,
        errors: ['Refresh already in progress'],
      };
    }

    this.refreshInProgress = true;
    this.lastRefreshAttempt = Date.now();

    console.log('[ToolLoader] Starting dynamic MCP tool refresh...');

    const errors: string[] = [];
    let updatedTools = 0;

    try {
      // Refresh Asana tools
      if (this.asanaAdapter) {
        try {
          await this.asanaAdapter.refresh?.();
          const newAsanaTools = this.asanaAdapter.getTools();

          // Update registry with new tools
          toolRegistry.replaceToolsBySource('asana', newAsanaTools);
          updatedTools += newAsanaTools.length;

          // Update cache
          this.updateToolCache('asana', newAsanaTools);

          console.log(
            `[ToolLoader] Refreshed ${newAsanaTools.length} Asana tools`,
          );
        } catch (error) {
          const errorMsg = `Asana refresh failed: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[ToolLoader] ${errorMsg}`);
        }
      }

      // Refresh Google Workspace tools
      if (this.googleWorkspaceAdapter) {
        try {
          await this.googleWorkspaceAdapter.refresh?.();
          const newGoogleTools = this.googleWorkspaceAdapter.getTools();

          // Update registry with new tools
          toolRegistry.replaceToolsBySource('google-workspace', newGoogleTools);
          updatedTools += newGoogleTools.length;

          // Update cache
          this.updateToolCache('google-workspace', newGoogleTools);

          console.log(
            `[ToolLoader] Refreshed ${newGoogleTools.length} Google Workspace tools`,
          );
        } catch (error) {
          const errorMsg = `Google Workspace refresh failed: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[ToolLoader] ${errorMsg}`);
        }
      }

      const success = errors.length === 0;
      console.log(
        `[ToolLoader] MCP tool refresh completed: ${success ? 'SUCCESS' : 'PARTIAL'} (${updatedTools} tools updated, ${errors.length} errors)`,
      );

      return { success, updatedTools, errors };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Task 2.4: Apply tool limitation enforcement
   */
  private applyToolLimitation(tools: Tool[], limitPerCategory: number): Tool[] {
    const categorizedTools = new Map<ToolCategory, Tool[]>();

    // Group tools by category
    for (const tool of tools) {
      const category = tool.category;
      if (!categorizedTools.has(category)) {
        categorizedTools.set(category, []);
      }
      categorizedTools.get(category)!.push(tool);
    }

    // Apply limitation per category
    const limitedTools: Tool[] = [];
    for (const [category, categoryTools] of categorizedTools) {
      const limited = categoryTools.slice(0, limitPerCategory);
      limitedTools.push(...limited);

      if (categoryTools.length > limitPerCategory) {
        console.log(
          `[ToolLoader] Limited ${category} tools: ${limited.length}/${categoryTools.length} (max: ${limitPerCategory})`,
        );
      }
    }

    return limitedTools;
  }

  /**
   * Task 2.4: Update tool cache for performance
   */
  private updateToolCache(source: string, tools: Tool[]): void {
    this.toolCache.set(source, {
      tools,
      timestamp: Date.now(),
      ttl: 300000, // 5 minutes
    });
  }

  /**
   * Task 2.4: Get tools from cache if valid
   */
  private getToolsFromCache(source: string): Tool[] | null {
    const cached = this.toolCache.get(source);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.toolCache.delete(source);
      return null;
    }

    return cached.tools;
  }

  /**
   * Task 2.4: Setup automatic MCP tool refresh
   */
  private setupAutomaticRefresh(): void {
    if (!this.refreshConfig.enabled) {
      console.log('[ToolLoader] Automatic refresh disabled');
      return;
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      console.log('[ToolLoader] Starting automatic MCP tool refresh...');
      await this.refreshMCPTools();
    }, this.refreshConfig.intervalMs);

    console.log(
      `[ToolLoader] Automatic refresh enabled (every ${this.refreshConfig.intervalMs / 60000} minutes)`,
    );
  }

  /**
   * Task 2.4: Enhanced MCP tools loading with caching
   */
  private async loadMCPToolsWithCaching(): Promise<void> {
    console.log('[ToolLoader] Loading MCP tools with caching...');

    try {
      // Load Asana tools
      await this.loadAsanaToolsWithCache();

      // Load Google Workspace tools
      await this.loadGoogleWorkspaceToolsWithCache();
    } catch (error) {
      console.error('[ToolLoader] Failed to load MCP tools:', error);
      // Don't throw - allow system to work with just standard tools
    }

    console.log('[ToolLoader] MCP tools loading with caching completed');
  }

  /**
   * Task 2.4: Load Asana tools with caching
   */
  private async loadAsanaToolsWithCache(): Promise<void> {
    // Check cache first
    const cachedAsanaTools = this.getToolsFromCache('asana');
    if (cachedAsanaTools) {
      toolRegistry.registerTools(cachedAsanaTools);
      console.log(
        `[ToolLoader] Loaded ${cachedAsanaTools.length} Asana tools from cache`,
      );
      return;
    }

    // Load fresh if not cached
    try {
      this.asanaAdapter = new AsanaToolAdapter();
      await this.asanaAdapter.initialize();

      const asanaTools = this.asanaAdapter.getTools();
      toolRegistry.registerTools(asanaTools);

      // Update cache
      this.updateToolCache('asana', asanaTools);

      console.log(
        `[ToolLoader] Loaded ${asanaTools.length} Asana tools (fresh)`,
      );
    } catch (error) {
      console.error('[ToolLoader] Failed to load Asana tools:', error);
    }
  }

  /**
   * Task 2.4: Load Google Workspace tools with caching
   */
  private async loadGoogleWorkspaceToolsWithCache(): Promise<void> {
    // Check cache first
    const cachedGoogleTools = this.getToolsFromCache('google-workspace');
    if (cachedGoogleTools) {
      toolRegistry.registerTools(cachedGoogleTools);
      console.log(
        `[ToolLoader] Loaded ${cachedGoogleTools.length} Google Workspace tools from cache`,
      );
      return;
    }

    // Load fresh if not cached
    try {
      this.googleWorkspaceAdapter = new GoogleWorkspaceToolAdapter();
      await this.googleWorkspaceAdapter.initialize();

      const googleWorkspaceTools = this.googleWorkspaceAdapter.getTools();
      toolRegistry.registerTools(googleWorkspaceTools);

      // Update cache
      this.updateToolCache('google-workspace', googleWorkspaceTools);

      console.log(
        `[ToolLoader] Loaded ${googleWorkspaceTools.length} Google Workspace tools (fresh)`,
      );
    } catch (error) {
      console.error(
        '[ToolLoader] Failed to load Google Workspace tools:',
        error,
      );
    }
  }

  /**
   * Reload tools (for development/testing)
   */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return toolRegistry.getStats();
  }

  /**
   * Load standard (non-MCP) tools into the registry
   */
  private async loadStandardTools(): Promise<void> {
    try {
      console.log('[ToolLoader] Loading standard tools...');

      // Import the standard tools from the tools index
      const {
        listDocumentsTool,
        getDocumentContentsTool,
        searchAndRetrieveKnowledgeBase,
        requestSuggestionsTool,
        tavilySearchTool,
        getMessagesFromOtherChatTool,
      } = await import('../index');

      // Helper function to convert LangChain tools to our Tool format
      const convertTool = (
        langchainTool: any,
        category: ToolCategory,
        source = 'standard',
      ) => ({
        name: langchainTool.name,
        description: langchainTool.description,
        displayName: langchainTool.name,
        usage: langchainTool.description,
        category,
        source: source as 'standard' | 'mcp' | 'google-workspace',
        isEnabled: true,
        requiresAuth: false,
        examples: [],
        parameters: [], // LangChain tools handle their own parameter validation
        execute: async (params: any, context: any) => {
          const result = await langchainTool.func(params);
          return {
            success: true,
            data: result,
            metadata: { toolName: langchainTool.name },
          };
        },
      });

      // Add knowledge base tools
      toolRegistry.registerTool(
        convertTool(listDocumentsTool, ToolCategory.DOCUMENTS),
      );
      toolRegistry.registerTool(
        convertTool(getDocumentContentsTool, ToolCategory.DOCUMENTS),
      );
      toolRegistry.registerTool(
        convertTool(searchAndRetrieveKnowledgeBase, ToolCategory.KNOWLEDGE),
      );

      // Add utility tools
      toolRegistry.registerTool(
        convertTool(requestSuggestionsTool, ToolCategory.GENERAL),
      );
      toolRegistry.registerTool(
        convertTool(getMessagesFromOtherChatTool, ToolCategory.MESSAGING),
      );

      // Add research tools
      toolRegistry.registerTool(
        convertTool(tavilySearchTool, ToolCategory.SEARCH),
      );

      // Integration tools - Google Calendar now handled by Google Workspace MCP

      console.log('[ToolLoader] Standard tools loaded successfully');
    } catch (error) {
      console.error('[ToolLoader] Failed to load standard tools:', error);
      throw error;
    }
  }

  /**
   * Get tools for a specific context (used by BrainOrchestrator)
   */
  async getToolsForContext(context: ToolContext = {}): Promise<Tool[]> {
    if (!this.initialized) {
      console.warn(
        '[ToolLoader] Tools not initialized, attempting to initialize...',
      );
      await this.initialize();
    }

    // For now, return all tools - context filtering can be added later if needed
    const allTools = toolRegistry.getTools();

    console.log(
      `[ToolLoader] getToolsForContext returning ${allTools.length} tools`,
      {
        toolNames: allTools.map((t) => t.name),
        context: context,
      },
    );

    return allTools;
  }
}

// Export singleton instance
export const toolLoader = ToolLoader.getInstance();
