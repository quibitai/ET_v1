/**
 * Tools Node - Tool Execution and Result Processing
 *
 * This node handles:
 * - Executing tool calls from the agent
 * - Processing tool results
 * - Managing tool errors and timeouts
 * - Updating workflow state based on tool execution
 */

import { ToolMessage } from '@langchain/core/messages';
import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';

/**
 * Dependencies for the tools node
 */
export interface ToolsNodeDependencies {
  tools: any[];
  logger: RequestLogger;
  timeout?: number; // Tool execution timeout in milliseconds
}

/**
 * Tool execution result
 */
interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

/**
 * Tools node function - executes requested tools and returns results
 */
export async function toolsNode(
  state: GraphState,
  dependencies: ToolsNodeDependencies,
): Promise<Partial<GraphState>> {
  const { tools, logger, timeout = 30000 } = dependencies;

  const startTime = Date.now();
  const lastMessage = state.messages[state.messages.length - 1];

  // Cast to AIMessage to access tool_calls
  const aiMessage = lastMessage as any;

  // Validate that we have tool calls to execute
  if (!aiMessage?.tool_calls?.length) {
    logger.warn('[Tools] No tool calls found in last message', {
      messageType: lastMessage?._getType?.(),
      messageId: lastMessage?.id,
    });

    return {
      node_execution_trace: [
        ...(state.node_execution_trace || []),
        'tools_no_calls',
      ],
    };
  }

  logger.info('[Tools] Executing tool calls', {
    toolCallCount: aiMessage.tool_calls.length,
    toolNames: aiMessage.tool_calls.map((tc: any) => tc.name),
    availableTools: tools.map((t) => t.name),
  });

  const toolExecutionResults: ToolExecutionResult[] = [];
  const toolMessages: ToolMessage[] = [];

  // Execute each tool call
  for (const toolCall of aiMessage.tool_calls) {
    const toolStartTime = Date.now();

    try {
      const executionResult = await executeToolCall(
        toolCall,
        tools,
        logger,
        timeout,
      );

      toolExecutionResults.push(executionResult);

      // Create tool message for successful execution
      toolMessages.push(
        new ToolMessage({
          content: JSON.stringify(executionResult.result),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        }),
      );
    } catch (error) {
      const duration = Date.now() - toolStartTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('[Tools] Tool execution failed', {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        error: errorMessage,
        duration,
      });

      // Create error tool message
      toolMessages.push(
        new ToolMessage({
          content: JSON.stringify({
            error: errorMessage,
            tool_name: toolCall.name,
            status: 'error',
          }),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        }),
      );

      toolExecutionResults.push({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        success: false,
        error: errorMessage,
        duration,
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  // Update workflow state based on executed tools
  const updatedWorkflowState = updateWorkflowStateFromResults(
    state.tool_workflow_state,
    toolExecutionResults,
  );

  logger.info('[Tools] Tool execution completed', {
    totalDuration,
    successfulTools: toolExecutionResults.filter((r) => r.success).length,
    failedTools: toolExecutionResults.filter((r) => !r.success).length,
    toolResults: toolExecutionResults.map((r) => ({
      name: r.toolName,
      success: r.success,
      duration: r.duration,
    })),
  });

  return {
    messages: toolMessages,
    _lastToolExecutionResults: toolExecutionResults,
    node_execution_trace: [...(state.node_execution_trace || []), 'tools'],
    tool_workflow_state: updatedWorkflowState,
  };
}

/**
 * Execute a single tool call with timeout and error handling
 */
async function executeToolCall(
  toolCall: any,
  tools: any[],
  logger: RequestLogger,
  timeout: number,
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  // Find the tool
  const tool = tools.find((t) => t.name === toolCall.name);
  if (!tool) {
    throw new Error(`Tool '${toolCall.name}' not found in available tools`);
  }

  logger.info('[Tools] Executing tool', {
    toolName: toolCall.name,
    toolArgs: toolCall.args,
    toolCallId: toolCall.id,
  });

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
      timeout,
    );
  });

  // Execute tool with timeout
  const executionPromise = tool.invoke(toolCall.args);

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    logger.info('[Tools] Tool executed successfully', {
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      duration,
      resultSize: JSON.stringify(result).length,
    });

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      success: true,
      result,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(`Tool '${toolCall.name}' failed: ${errorMessage}`);
  }
}

/**
 * Update workflow state based on tool execution results
 */
function updateWorkflowStateFromResults(
  currentWorkflowState: any,
  toolResults: ToolExecutionResult[],
): any {
  const updatedState = {
    ...currentWorkflowState,
  };

  toolResults.forEach((result) => {
    if (!result.success) return;

    switch (result.toolName) {
      case 'listDocuments':
        updatedState.documentsListed = true;
        break;

      case 'getDocumentContents':
        try {
          const toolResult = result.result;
          const docId = toolResult?.id || toolResult?.title || 'unknown';
          if (!updatedState.documentsRetrieved.includes(docId)) {
            updatedState.documentsRetrieved.push(docId);
          }
        } catch (e) {
          // Ignore parsing errors
        }
        break;

      case 'tavilySearch':
        updatedState.webSearchCompleted = true;
        break;

      case 'tavilyExtract':
        updatedState.extractionCompleted = true;
        break;

      case 'multiDocumentRetrieval':
        updatedState.multiDocAnalysisCompleted = true;
        break;
    }
  });

  return updatedState;
}

/**
 * Validate tools node configuration
 */
export function validateToolsNode(dependencies: ToolsNodeDependencies): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!dependencies.tools || dependencies.tools.length === 0) {
    issues.push('At least one tool is required for tools node');
  }

  if (!dependencies.logger) {
    issues.push('Logger is required for tools node');
  }

  if (dependencies.timeout && dependencies.timeout < 1000) {
    issues.push('Tool timeout should be at least 1000ms');
  }

  // Validate that all tools have required properties
  dependencies.tools?.forEach((tool, index) => {
    if (!tool.name) {
      issues.push(`Tool at index ${index} is missing 'name' property`);
    }
    if (!tool.invoke || typeof tool.invoke !== 'function') {
      issues.push(
        `Tool '${tool.name || 'unnamed'}' is missing 'invoke' method`,
      );
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Get tool execution statistics from results
 */
export function getToolExecutionStats(results: ToolExecutionResult[]): {
  totalTools: number;
  successfulTools: number;
  failedTools: number;
  averageDuration: number;
  toolsByName: Record<string, { success: boolean; duration: number }[]>;
} {
  const toolsByName: Record<string, { success: boolean; duration: number }[]> =
    {};

  results.forEach((result) => {
    if (!toolsByName[result.toolName]) {
      toolsByName[result.toolName] = [];
    }
    toolsByName[result.toolName].push({
      success: result.success,
      duration: result.duration,
    });
  });

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  return {
    totalTools: results.length,
    successfulTools: results.filter((r) => r.success).length,
    failedTools: results.filter((r) => !r.success).length,
    averageDuration: results.length > 0 ? totalDuration / results.length : 0,
    toolsByName,
  };
}
