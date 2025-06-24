/**
 * Direct Tool Executor - Critical Issue #5: Tool Calling Reliability
 *
 * Implements the simple, direct tool execution pattern specified in
 * Development Roadmap v6.0.0 to replace complex routing and validation layers.
 *
 * Key Features:
 * - Direct tool execution without complex routing
 * - Simple error handling and retry logic
 * - Minimal abstraction for maximum reliability
 * - Performance monitoring
 */

import type { RequestLogger } from '../../services/observabilityService';

export interface DirectToolCall {
  id: string;
  name: string;
  args: any;
}

export interface DirectToolResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  toolName: string;
  toolCallId: string;
}

export interface DirectToolRegistry {
  [toolName: string]: (args: any) => Promise<any>;
}

/**
 * Direct Tool Executor - No complex routing or validation layers
 * As specified in Development Roadmap v6.0.0
 */
export class DirectToolExecutor {
  private tools: DirectToolRegistry = {};
  private logger: RequestLogger;

  constructor(logger: RequestLogger) {
    this.logger = logger;
  }

  /**
   * Register tools directly - simple mapping
   */
  registerTools(toolsMap: DirectToolRegistry): void {
    this.tools = { ...this.tools, ...toolsMap };
    this.logger.info('[Direct Tool Executor] Registered tools', {
      count: Object.keys(toolsMap).length,
      toolNames: Object.keys(toolsMap),
    });
  }

  /**
   * Execute tools directly - no complex validation or routing
   */
  async executeTools(toolCalls: DirectToolCall[]): Promise<DirectToolResult[]> {
    const results: DirectToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeSingleTool(toolCall);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single tool with simple error handling
   */
  private async executeSingleTool(toolCall: DirectToolCall): Promise<DirectToolResult> {
    const startTime = Date.now();
    
    try {
      // Direct tool lookup - no complex routing
      const tool = this.tools[toolCall.name];
      if (!tool) {
        throw new Error(`Tool '${toolCall.name}' not found`);
      }

      this.logger.info('[Direct Tool Executor] Executing tool', {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
      });

      // Direct tool invocation
      const result = await tool(toolCall.args);
      const duration = Date.now() - startTime;

      this.logger.info('[Direct Tool Executor] Tool completed', {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        duration,
        success: true,
      });

      return {
        success: true,
        result,
        duration,
        toolName: toolCall.name,
        toolCallId: toolCall.id,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('[Direct Tool Executor] Tool failed', {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        error: errorMessage,
        duration,
        toolName: toolCall.name,
        toolCallId: toolCall.id,
      };
    }
  }

  /**
   * Get available tool names
   */
  getAvailableTools(): string[] {
    return Object.keys(this.tools);
  }

  /**
   * Check if a tool is available
   */
  hasPlugin(toolName: string): boolean {
    return toolName in this.tools;
  }
}

/**
 * Factory function for creating tool registries from various sources
 */
export function createDirectToolRegistry(
  asanaMCP: any,
  googleWorkspaceMCP: any,
  internalTools: any[]
): DirectToolRegistry {
  const registry: DirectToolRegistry = {};

  // Add Asana MCP tools
  if (asanaMCP && asanaMCP.executeTool) {
    // Example Asana tools - these would be dynamically discovered
    const asanaTools = [
      'asana_list_workspaces',
      'asana_list_projects', 
      'asana_create_task',
      'asana_list_tasks',
      'asana_update_task',
    ];

    for (const toolName of asanaTools) {
      registry[toolName] = async (args: any) => {
        return await asanaMCP.executeTool(toolName, args);
      };
    }
  }

  // Add Google Workspace MCP tools
  if (googleWorkspaceMCP && googleWorkspaceMCP.executeTool) {
    const googleTools = [
      'gmail_search',
      'drive_search', 
      'calendar_list_events',
      'docs_get_content',
    ];

    for (const toolName of googleTools) {
      registry[toolName] = async (args: any) => {
        return await googleWorkspaceMCP.executeTool(toolName, args);
      };
    }
  }

  // Add internal knowledge base tools
  for (const tool of internalTools) {
    if (tool.name && tool.invoke) {
      registry[tool.name] = async (args: any) => {
        return await tool.invoke(args);
      };
    }
  }

  return registry;
} 