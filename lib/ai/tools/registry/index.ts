/**
 * Unified Tool Registry - Main Export
 *
 * Simple, modular tool registration and calling system.
 * This is the single entry point for all tool operations.
 */

export { UnifiedToolRegistry, toolRegistry } from './UnifiedToolRegistry';
export { ToolLoader, toolLoader } from './ToolLoader';
export {
  ToolCategory,
  type Tool,
  type ToolContext,
  type ToolResult,
  type ToolFilter,
} from './types';

// Simple API for the rest of the application
import { toolLoader } from './ToolLoader';
import { toolRegistry } from './UnifiedToolRegistry';
import type { ToolContext, Tool } from './types';

/**
 * Initialize the tool system (call once at startup)
 */
export async function initializeTools(): Promise<void> {
  await toolLoader.initialize();
}

/**
 * Get all available tools for a context (replaces getAvailableTools)
 */
export async function getAvailableTools(
  context: ToolContext = {},
): Promise<Tool[]> {
  return await toolLoader.getToolsForContext(context);
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  context: ToolContext = {},
) {
  return await toolRegistry.executeTool(toolName, params, context);
}

/**
 * Find tools that match a query (for LLM tool selection)
 */
export function findTools(query: string): Tool[] {
  return toolRegistry.findTools(query);
}

/**
 * Get tool registry statistics
 */
export function getToolStats() {
  return toolRegistry.getStats();
}

/**
 * Reload tools (for development)
 */
export async function reloadTools(): Promise<void> {
  await toolLoader.reload();
}
