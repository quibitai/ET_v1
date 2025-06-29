/**
 * Unified Tool Registry
 *
 * Simple, modular tool registration and discovery system that works with
 * both standard tools and MCP tools. Follows best practices for tool management.
 */

import {
  type Tool,
  ToolCategory,
  type ToolFilter,
  type ToolContext,
  type ToolResult,
  type ToolRegistryConfig,
} from './types';

export class UnifiedToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private toolsByCategory: Map<ToolCategory, Tool[]> = new Map();
  private config: ToolRegistryConfig;
  private cache: Map<string, any> = new Map();

  constructor(config: ToolRegistryConfig) {
    this.config = config;
    this.initializeCategories();
  }

  private initializeCategories() {
    // Initialize empty arrays for each category
    Object.values(ToolCategory).forEach((category) => {
      this.toolsByCategory.set(category, []);
    });
  }

  /**
   * Register a single tool
   */
  registerTool(tool: Tool): void {
    console.log(
      `[ToolRegistry] Registering tool: ${tool.name} (${tool.category})`,
    );

    // Validate tool
    if (!this.validateTool(tool)) {
      console.error(`[ToolRegistry] Invalid tool: ${tool.name}`);
      return;
    }

    // Store tool
    this.tools.set(tool.name, tool);

    // Add to category
    const categoryTools = this.toolsByCategory.get(tool.category) || [];
    categoryTools.push(tool);
    this.toolsByCategory.set(tool.category, categoryTools);

    console.log(`[ToolRegistry] Tool registered: ${tool.name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: Tool[]): void {
    console.log(`[ToolRegistry] Registering ${tools.length} tools`);
    tools.forEach((tool) => this.registerTool(tool));
  }

  /**
   * Replace all tools from a specific source with new tools
   * Critical for MCP tool refresh functionality
   * Enhanced with detailed logging and correlation ID support
   */
  replaceToolsBySource(
    source: string,
    tools: Tool[],
    correlationId?: string,
  ): void {
    const logger = correlationId
      ? (msg: string) => console.log(`[${correlationId}] [ToolRegistry] ${msg}`)
      : (msg: string) => console.log(`[ToolRegistry] ${msg}`);

    logger(`Starting tool replacement for source: ${source}`);
    logger(`New tools to register: ${tools.length}`);

    // Remove existing tools from this source
    const existingTools = Array.from(this.tools.values()).filter(
      (t) => t.source === source,
    );

    logger(
      `Found ${existingTools.length} existing tools from source: ${source}`,
    );

    existingTools.forEach((tool) => {
      logger(`Removing tool: ${tool.name} (category: ${tool.category})`);
      this.tools.delete(tool.name);

      // Remove from category mappings
      const categoryTools = this.toolsByCategory.get(tool.category) || [];
      this.toolsByCategory.set(
        tool.category,
        categoryTools.filter((t) => t.name !== tool.name),
      );
    });

    // Add new tools with detailed logging
    logger(`Adding ${tools.length} new tools from source: ${source}`);
    tools.forEach((tool) => {
      logger(`Adding tool: ${tool.name} (category: ${tool.category})`);
      this.registerTool(tool);
    });

    // Clear cache
    this.cache.clear();
    logger(`Tool replacement complete. Cache cleared.`);

    // Summary logging
    const finalStats = this.getStats();
    logger(`Registry now contains ${finalStats.totalTools} total tools`);
    logger(`Tools by source: ${JSON.stringify(finalStats.toolsBySource)}`);

    console.log(
      `[ToolRegistry] Successfully replaced ${existingTools.length} tools from ${source} with ${tools.length} new tools`,
    );
  }

  /**
   * Get tools with optional filtering
   */
  getTools(filter?: ToolFilter): Tool[] {
    let filteredTools = Array.from(this.tools.values());

    if (!filter) {
      return filteredTools.filter((tool) => tool.isEnabled);
    }

    // Apply filters
    if (filter.categories) {
      filteredTools = filteredTools.filter(
        (tool) => filter.categories?.includes(tool.category) ?? false,
      );
    }

    if (filter.source) {
      filteredTools = filteredTools.filter(
        (tool) => tool.source === filter.source,
      );
    }

    if (filter.requiresAuth !== undefined) {
      filteredTools = filteredTools.filter(
        (tool) => tool.requiresAuth === filter.requiresAuth,
      );
    }

    if (filter.isEnabled !== undefined) {
      filteredTools = filteredTools.filter(
        (tool) => tool.isEnabled === filter.isEnabled,
      );
    }

    return filteredTools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): Tool[] {
    return (
      this.toolsByCategory.get(category)?.filter((tool) => tool.isEnabled) || []
    );
  }

  /**
   * Find tools that match a query (for LLM tool selection)
   */
  findTools(query: string): Tool[] {
    const queryLower = query.toLowerCase();

    return Array.from(this.tools.values())
      .filter((tool) => tool.isEnabled)
      .filter((tool) => {
        // Check name
        if (tool.name.toLowerCase().includes(queryLower)) return true;

        // Check description
        if (tool.description.toLowerCase().includes(queryLower)) return true;

        // Check usage
        if (tool.usage.toLowerCase().includes(queryLower)) return true;

        // Check examples
        return tool.examples.some((example) =>
          example.toLowerCase().includes(queryLower),
        );
      })
      .sort((a, b) => {
        // Prioritize exact name matches
        if (a.name.toLowerCase() === queryLower) return -1;
        if (b.name.toLowerCase() === queryLower) return 1;

        // Then prioritize name contains
        if (
          a.name.toLowerCase().includes(queryLower) &&
          !b.name.toLowerCase().includes(queryLower)
        )
          return -1;
        if (
          b.name.toLowerCase().includes(queryLower) &&
          !a.name.toLowerCase().includes(queryLower)
        )
          return 1;

        return 0;
      });
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        metadata: { toolName },
      };
    }

    if (!tool.isEnabled) {
      return {
        success: false,
        error: `Tool is disabled: ${toolName}`,
        metadata: { toolName },
      };
    }

    try {
      const startTime = Date.now();
      const result = await tool.execute(params, context);
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          toolName,
          source: tool.source,
        },
      };
    } catch (error: any) {
      console.error(`[ToolRegistry] Tool execution failed: ${toolName}`, error);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        metadata: { toolName, source: tool.source },
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    enabledTools: number;
    toolsByCategory: Record<string, number>;
    toolsBySource: Record<string, number>;
  } {
    const allTools = Array.from(this.tools.values());
    const enabledTools = allTools.filter((tool) => tool.isEnabled);

    const toolsByCategory: Record<string, number> = {};
    const toolsBySource: Record<string, number> = {};

    allTools.forEach((tool) => {
      toolsByCategory[tool.category] =
        (toolsByCategory[tool.category] || 0) + 1;
      toolsBySource[tool.source] = (toolsBySource[tool.source] || 0) + 1;
    });

    return {
      totalTools: allTools.length,
      enabledTools: enabledTools.length,
      toolsByCategory,
      toolsBySource,
    };
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.toolsByCategory.clear();
    this.cache.clear();
    this.initializeCategories();
  }

  private validateTool(tool: Tool): boolean {
    if (!tool.name || !tool.description || !tool.category) {
      return false;
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const toolRegistry = new UnifiedToolRegistry({
  enableMcp: true,
  mcpServers: ['asana', 'google-workspace'],
  defaultTimeout: 30000,
  enableCaching: true,
});
