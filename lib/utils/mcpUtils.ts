/**
 * Utility functions for MCP tool result and error formatting.
 * These are stateless functions that can be easily tested and reused.
 */

/**
 * Formats MCP tool results for LangChain.
 */
export function formatMcpToolResult(result: any, toolName: string): string {
  try {
    if (result.content) {
      if (Array.isArray(result.content)) {
        return result.content
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item.type === 'text') return item.text;
            return JSON.stringify(item);
          })
          .join('\n');
      }

      if (typeof result.content === 'string') {
        return result.content;
      }

      return JSON.stringify(result.content, null, 2);
    }

    if (result.toolResult) {
      return JSON.stringify(result.toolResult, null, 2);
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error(
      `[McpUtils] Error formatting result for tool ${toolName}:`,
      error,
    );
    return `Tool ${toolName} completed successfully but result formatting failed.`;
  }
}

/**
 * Formats MCP tool errors for LangChain.
 */
export function formatMcpToolError(error: any, toolName: string): string {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';

  // Check for common MCP error patterns
  if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return `Authentication failed for ${toolName}. Please reconnect your account.`;
  }

  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return `Resource not found when using ${toolName}. Please check the parameters.`;
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return `Rate limit exceeded for ${toolName}. Please try again later.`;
  }

  return `Error executing ${toolName}: ${errorMessage}`;
}

/**
 * Validates if a tool object has the minimum required properties.
 */
export function isValidMcpTool(tool: any): boolean {
  return (
    tool &&
    typeof tool === 'object' &&
    typeof tool.name === 'string' &&
    tool.name.length > 0
  );
}

/**
 * Creates a standardized tool execution function for MCP tools.
 */
export function createMcpToolFunction(toolName: string, client: any) {
  return async (input: any) => {
    try {
      console.log(
        `[McpUtils] Executing MCP tool ${toolName} with input:`,
        input,
      );

      // Add default parameters for Asana tools when needed
      let processedInput = input || {};

      // Special handling for Asana task search tools
      if (
        toolName === 'asana_search_tasks' &&
        (!input || Object.keys(input).length === 0)
      ) {
        const defaultWorkspace = process.env.DEFAULT_WORKSPACE_ID;
        if (defaultWorkspace) {
          processedInput = {
            workspace: defaultWorkspace,
            text: '',
            completed: false,
            limit: 10,
          };
          console.log(
            `[McpUtils] Applied default parameters for ${toolName}:`,
            processedInput,
          );
        }
      }

      const startTime = Date.now();
      const result = await client.callTool({
        name: toolName,
        arguments: processedInput,
      });
      const duration = Date.now() - startTime;

      console.log(`[McpUtils] Tool ${toolName} completed in ${duration}ms`);

      return formatMcpToolResult(result, toolName);
    } catch (error: any) {
      console.error(`[McpUtils] Error executing MCP tool ${toolName}:`, error);
      return formatMcpToolError(error, toolName);
    }
  };
}
