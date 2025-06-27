/**
 * Tool Loader Service
 *
 * Simple service that loads and registers all tools (standard and MCP)
 * into the unified tool registry. Replaces the complex getAvailableTools system.
 */

import type { Tool, ToolContext } from './types';
import { ToolCategory } from './types';
import { toolRegistry } from './UnifiedToolRegistry';
import { AsanaToolAdapter } from '../adapters/AsanaToolAdapter';
import { GoogleWorkspaceToolAdapter } from '../adapters/GoogleWorkspaceToolAdapter';

export class ToolLoader {
  private static instance: ToolLoader | null = null;
  private initialized = false;
  private asanaAdapter: AsanaToolAdapter | null = null;
  private googleWorkspaceAdapter: GoogleWorkspaceToolAdapter | null = null;

  private constructor() {}

  static getInstance(): ToolLoader {
    if (!ToolLoader.instance) {
      ToolLoader.instance = new ToolLoader();
    }
    return ToolLoader.instance;
  }

  /**
   * Initialize all tools and register them
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[ToolLoader] Initializing tools...');

    try {
      // Clear existing tools
      toolRegistry.clear();

      // Load standard tools
      await this.loadStandardTools();

      // Load MCP tools
      await this.loadMCPTools();

      this.initialized = true;

      const stats = toolRegistry.getStats();
      console.log('[ToolLoader] Tools initialized:', stats);
    } catch (error) {
      console.error('[ToolLoader] Failed to initialize tools:', error);
      throw error;
    }
  }

  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    if (!this.initialized) {
      console.warn('[ToolLoader] Tools not initialized, returning empty array');
      return [];
    }

    return toolRegistry.getTools();
  }

  /**
   * Get tools for a specific context (session-based)
   */
  async getToolsForContext(context: ToolContext): Promise<Tool[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // For now, return all enabled tools
    // In the future, this could filter based on user permissions, specialist, etc.
    return toolRegistry.getTools();
  }

  private async loadStandardTools(): Promise<void> {
    console.log('[ToolLoader] Loading standard tools...');

    // Tavily Search Tool
    const tavilySearchTool: Tool = {
      name: 'tavilySearch',
      displayName: 'Web Search',
      description: 'Search the web for current information using Tavily',
      usage: 'Use when user asks for current information, news, or web search',
      examples: [
        'search for latest news',
        'find information about',
        'look up current data',
        'web search for',
      ],
      category: ToolCategory.SEARCH,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
      ],
      source: 'standard',
      isEnabled: true,
      requiresAuth: false,
      execute: async (params: Record<string, any>, context: ToolContext) => {
        try {
          // Import the actual Tavily tool
          const { tavilySearchTool } = await import('../tavily-search');
          const result = await tavilySearchTool.invoke(params);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'tavily',
              toolName: 'tavilySearch',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Search failed',
            metadata: {
              toolName: 'tavilySearch',
            },
          };
        }
      },
    };

    // Internal Knowledge Base Search
    const searchInternalTool: Tool = {
      name: 'searchInternalKnowledgeBase',
      displayName: 'Search Internal Knowledge',
      description: 'Search internal documents and knowledge base',
      usage:
        'Use when user asks about internal documents, files, or stored information',
      examples: [
        'search my documents',
        'find internal information',
        'look in knowledge base',
        'search files',
      ],
      category: ToolCategory.KNOWLEDGE,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query for internal documents',
          required: true,
        },
      ],
      source: 'standard',
      isEnabled: true,
      requiresAuth: true,
      execute: async (params: Record<string, any>, context: ToolContext) => {
        try {
          // Import the actual search tool
          const { searchInternalKnowledgeBase } = await import(
            '../search-internal-knowledge-base'
          );
          const result = await searchInternalKnowledgeBase.execute(
            params,
            context,
          );

          return {
            success: true,
            data: result,
            metadata: {
              source: 'internal',
              toolName: 'searchInternalKnowledgeBase',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Internal search failed',
            metadata: {
              toolName: 'searchInternalKnowledgeBase',
            },
          };
        }
      },
    };

    // List Documents Tool
    const listDocumentsTool: Tool = {
      name: 'listDocuments',
      displayName: 'List Documents',
      description: 'List available documents and files',
      usage: 'Use when user wants to see available documents or files',
      examples: [
        'list my documents',
        'show me my files',
        'what documents do I have',
        'list available files',
      ],
      category: ToolCategory.DOCUMENTS,
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of documents to return',
          required: false,
          default: 20,
        },
      ],
      source: 'standard',
      isEnabled: true,
      requiresAuth: true,
      execute: async (params: Record<string, any>, context: ToolContext) => {
        try {
          // Import the actual list documents tool
          const { listDocuments } = await import('../list-documents');
          const result = await listDocuments.execute(params, context);

          return {
            success: true,
            data: result,
            metadata: {
              source: 'internal',
              toolName: 'listDocuments',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to list documents',
            metadata: {
              toolName: 'listDocuments',
            },
          };
        }
      },
    };

    // Register standard tools
    toolRegistry.registerTools([
      tavilySearchTool,
      searchInternalTool,
      listDocumentsTool,
    ]);

    console.log('[ToolLoader] Standard tools loaded');
  }

  private async loadMCPTools(): Promise<void> {
    console.log('[ToolLoader] Loading MCP tools...');

    try {
      // Initialize Asana adapter
      this.asanaAdapter = new AsanaToolAdapter();
      await this.asanaAdapter.initialize();

      // Get Asana tools
      const asanaTools = this.asanaAdapter.getTools();
      toolRegistry.registerTools(asanaTools);

      console.log(`[ToolLoader] Loaded ${asanaTools.length} Asana tools`);

      // Initialize Google Workspace adapter
      this.googleWorkspaceAdapter = new GoogleWorkspaceToolAdapter();
      await this.googleWorkspaceAdapter.initialize();

      // Get Google Workspace tools
      const googleWorkspaceTools = this.googleWorkspaceAdapter.getTools();
      toolRegistry.registerTools(googleWorkspaceTools);

      console.log(
        `[ToolLoader] Loaded ${googleWorkspaceTools.length} Google Workspace tools`,
      );
    } catch (error) {
      console.error('[ToolLoader] Failed to load MCP tools:', error);
      // Don't throw - allow system to work with just standard tools
    }

    console.log('[ToolLoader] MCP tools loading completed');
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
}

// Export singleton instance
export const toolLoader = ToolLoader.getInstance();
