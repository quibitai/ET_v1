/**
 * Streaming MCP Wrapper
 *
 * Adds streaming capabilities to existing MCP clients without modifying
 * the core functionality. This is an enhancement layer that provides
 * progress updates, incremental data delivery, and status streaming.
 */

import type { BaseMCPClient } from '../BaseMCPClient';
import type { ToolManifest } from '../../tools/registry/types';
import type {
  StreamingEventType,
  StreamingToolRequest,
  StreamingToolResponse,
  StreamingCapabilities,
  StreamingTool,
  StreamingStartEvent,
  StreamingProgressEvent,
  StreamingDataEvent,
  StreamingStatusEvent,
  StreamingCompleteEvent,
  StreamingErrorEvent,
} from './types';
import { randomUUID } from 'node:crypto';

export class StreamingMCPWrapper implements StreamingTool {
  private client: BaseMCPClient;
  private manifest?: ToolManifest;

  constructor(client: BaseMCPClient, manifest?: ToolManifest) {
    this.client = client;
    this.manifest = manifest;
  }

  /**
   * Get streaming capabilities based on manifest
   */
  getStreamingCapabilities(): StreamingCapabilities {
    if (!this.manifest?.streamingSupported || !this.manifest.streamingConfig) {
      return {
        supportsProgress: false,
        supportsIncrementalData: false,
        supportsStatusUpdates: false,
        supportsPartialResults: false,
      };
    }

    const config = this.manifest.streamingConfig;

    return {
      supportsProgress: config.type === 'progress',
      supportsIncrementalData: config.type === 'incremental',
      supportsStatusUpdates: config.type === 'status',
      supportsPartialResults: config.supportsPartialResults || false,
      estimatedDuration: this.manifest.estimatedDuration,
      progressSteps: config.progressSteps,
    };
  }

  /**
   * Check if tool supports streaming for given arguments
   */
  supportsStreamingFor(arguments_: Record<string, any>): boolean {
    if (!this.manifest?.streamingSupported) {
      return false;
    }

    // Add specific logic for different tools
    // For now, return true if manifest indicates streaming support
    return true;
  }

  /**
   * Execute tool with streaming support
   */
  async executeStreaming(
    request: StreamingToolRequest,
  ): Promise<StreamingToolResponse> {
    const requestId = request.requestId || randomUUID();
    const capabilities = this.getStreamingCapabilities();

    if (!this.supportsStreamingFor(request.arguments || {})) {
      // Fall back to non-streaming execution
      return this.executeNonStreaming(request, requestId);
    }

    const stream = this.createStreamingGenerator(
      request,
      requestId,
      capabilities,
    );

    return {
      requestId,
      stream,
    };
  }

  /**
   * Fall back to non-streaming execution
   */
  private async executeNonStreaming(
    request: StreamingToolRequest,
    requestId: string,
  ): Promise<StreamingToolResponse> {
    const client = this.client;
    const stream = async function* (): AsyncGenerator<StreamingEventType> {
      const startTime = Date.now();

      // Start event
      yield {
        type: 'start' as const,
        timestamp: new Date(),
        toolName: request.toolName,
        requestId,
      } as StreamingStartEvent;

      try {
        // Execute tool normally
        const result = await client.executeTool(request.toolName, {
          arguments: request.arguments,
        });

        // Complete event
        yield {
          type: 'complete' as const,
          timestamp: new Date(),
          toolName: request.toolName,
          requestId,
          result: result.result,
          duration: Date.now() - startTime,
          success: result.success,
        } as StreamingCompleteEvent;
      } catch (error) {
        // Error event
        yield {
          type: 'error' as const,
          timestamp: new Date(),
          toolName: request.toolName,
          requestId,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: false,
          },
        } as StreamingErrorEvent;
      }
    };

    return {
      requestId,
      stream: stream(),
    };
  }

  /**
   * Create streaming generator based on tool capabilities
   */
  private async *createStreamingGenerator(
    request: StreamingToolRequest,
    requestId: string,
    capabilities: StreamingCapabilities,
  ): AsyncGenerator<StreamingEventType> {
    const startTime = Date.now();
    const toolName = request.toolName;

    // Start event
    yield {
      type: 'start',
      timestamp: new Date(),
      toolName,
      requestId,
      totalSteps: capabilities.progressSteps?.length,
      estimatedDuration: capabilities.estimatedDuration,
    } as StreamingStartEvent;

    try {
      if (capabilities.supportsProgress && capabilities.progressSteps) {
        // Progress-based streaming
        yield* this.executeWithProgress(request, requestId, capabilities);
      } else if (capabilities.supportsIncrementalData) {
        // Incremental data streaming
        yield* this.executeWithIncrementalData(
          request,
          requestId,
          capabilities,
        );
      } else if (capabilities.supportsStatusUpdates) {
        // Status-based streaming
        yield* this.executeWithStatusUpdates(request, requestId, capabilities);
      } else {
        // Default streaming with status updates
        yield* this.executeWithDefaultStreaming(request, requestId);
      }
    } catch (error) {
      yield {
        type: 'error',
        timestamp: new Date(),
        toolName,
        requestId,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        },
      } as StreamingErrorEvent;
    }
  }

  /**
   * Execute with progress updates
   */
  private async *executeWithProgress(
    request: StreamingToolRequest,
    requestId: string,
    capabilities: StreamingCapabilities,
  ): AsyncGenerator<StreamingEventType> {
    const steps = capabilities.progressSteps || ['Processing'];
    const toolName = request.toolName;

    for (let i = 0; i < steps.length; i++) {
      yield {
        type: 'progress',
        timestamp: new Date(),
        toolName,
        requestId,
        step: i + 1,
        totalSteps: steps.length,
        percentage: Math.round(((i + 1) / steps.length) * 100),
        message: steps[i],
      } as StreamingProgressEvent;

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Execute the actual tool
    const result = await this.client.executeTool(toolName, {
      arguments: request.arguments,
    });

    // Complete event
    yield {
      type: 'complete',
      timestamp: new Date(),
      toolName,
      requestId,
      result: result.result,
      duration: Date.now() - Date.now(), // Will be calculated properly
      success: result.success,
      summary: {
        totalSteps: steps.length,
        completedSteps: steps.length,
        errors: result.success ? 0 : 1,
        warnings: 0,
      },
    } as StreamingCompleteEvent;
  }

  /**
   * Execute with incremental data delivery
   */
  private async *executeWithIncrementalData(
    request: StreamingToolRequest,
    requestId: string,
    capabilities: StreamingCapabilities,
  ): AsyncGenerator<StreamingEventType> {
    const toolName = request.toolName;

    // Status update
    yield {
      type: 'status',
      timestamp: new Date(),
      toolName,
      requestId,
      status: 'processing',
      message: 'Fetching data incrementally...',
    } as StreamingStatusEvent;

    // Execute the tool
    const result = await this.client.executeTool(toolName, {
      arguments: request.arguments,
    });

    // For incremental data, we'll simulate chunking the result
    if (result.success && result.result) {
      const data = result.result;

      // If result is an array, stream it in chunks
      if (Array.isArray(data)) {
        const chunkSize = request.streamingOptions?.chunkSize || 10;
        const chunks = this.chunkArray(data, chunkSize);

        for (let i = 0; i < chunks.length; i++) {
          yield {
            type: 'data',
            timestamp: new Date(),
            toolName,
            requestId,
            data: chunks[i],
            isPartial: i < chunks.length - 1,
            chunkIndex: i,
            totalChunks: chunks.length,
          } as StreamingDataEvent;

          // Small delay between chunks
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } else {
        // Single data event for non-array results
        yield {
          type: 'data',
          timestamp: new Date(),
          toolName,
          requestId,
          data,
          isPartial: false,
        } as StreamingDataEvent;
      }
    }

    // Complete event
    yield {
      type: 'complete',
      timestamp: new Date(),
      toolName,
      requestId,
      result: result.result,
      duration: Date.now() - Date.now(),
      success: result.success,
    } as StreamingCompleteEvent;
  }

  /**
   * Execute with status updates
   */
  private async *executeWithStatusUpdates(
    request: StreamingToolRequest,
    requestId: string,
    capabilities: StreamingCapabilities,
  ): AsyncGenerator<StreamingEventType> {
    const toolName = request.toolName;

    // Initial status
    yield {
      type: 'status',
      timestamp: new Date(),
      toolName,
      requestId,
      status: 'processing',
      message: 'Initializing request...',
    } as StreamingStatusEvent;

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Processing status
    yield {
      type: 'status',
      timestamp: new Date(),
      toolName,
      requestId,
      status: 'processing',
      message: 'Executing tool...',
    } as StreamingStatusEvent;

    // Execute the tool
    const result = await this.client.executeTool(toolName, {
      arguments: request.arguments,
    });

    // Completing status
    yield {
      type: 'status',
      timestamp: new Date(),
      toolName,
      requestId,
      status: 'completing',
      message: 'Finalizing results...',
    } as StreamingStatusEvent;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Complete event
    yield {
      type: 'complete',
      timestamp: new Date(),
      toolName,
      requestId,
      result: result.result,
      duration: Date.now() - Date.now(),
      success: result.success,
    } as StreamingCompleteEvent;
  }

  /**
   * Default streaming implementation
   */
  private async *executeWithDefaultStreaming(
    request: StreamingToolRequest,
    requestId: string,
  ): AsyncGenerator<StreamingEventType> {
    const toolName = request.toolName;

    // Status update
    yield {
      type: 'status',
      timestamp: new Date(),
      toolName,
      requestId,
      status: 'processing',
      message: 'Executing tool...',
    } as StreamingStatusEvent;

    // Execute the tool
    const result = await this.client.executeTool(toolName, {
      arguments: request.arguments,
    });

    // Complete event
    yield {
      type: 'complete',
      timestamp: new Date(),
      toolName,
      requestId,
      result: result.result,
      duration: Date.now() - Date.now(),
      success: result.success,
    } as StreamingCompleteEvent;
  }

  /**
   * Utility to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
