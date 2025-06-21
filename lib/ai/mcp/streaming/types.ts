/**
 * MCP Streaming Types
 *
 * Types for streaming MCP tool execution with progress updates,
 * incremental results, and status messages.
 */

export interface StreamingEvent {
  type: 'start' | 'progress' | 'data' | 'status' | 'error' | 'complete';
  timestamp: Date;
  toolName: string;
  requestId: string;
}

export interface StreamingStartEvent extends StreamingEvent {
  type: 'start';
  totalSteps?: number;
  estimatedDuration?: number;
}

export interface StreamingProgressEvent extends StreamingEvent {
  type: 'progress';
  step: number;
  totalSteps: number;
  percentage: number;
  message: string;
  data?: any;
}

export interface StreamingDataEvent extends StreamingEvent {
  type: 'data';
  data: any;
  isPartial: boolean;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface StreamingStatusEvent extends StreamingEvent {
  type: 'status';
  status: 'processing' | 'waiting' | 'retrying' | 'completing';
  message: string;
  details?: any;
}

export interface StreamingErrorEvent extends StreamingEvent {
  type: 'error';
  error: {
    message: string;
    code?: string;
    recoverable: boolean;
    retryAfter?: number;
  };
}

export interface StreamingCompleteEvent extends StreamingEvent {
  type: 'complete';
  result: any;
  duration: number;
  success: boolean;
  summary?: {
    totalSteps: number;
    completedSteps: number;
    errors: number;
    warnings: number;
  };
}

export type StreamingEventType =
  | StreamingStartEvent
  | StreamingProgressEvent
  | StreamingDataEvent
  | StreamingStatusEvent
  | StreamingErrorEvent
  | StreamingCompleteEvent;

export interface StreamingToolRequest {
  toolName: string;
  arguments?: Record<string, any>;
  requestId?: string;
  streamingOptions?: {
    enableProgress?: boolean;
    enableIncrementalData?: boolean;
    enableStatusUpdates?: boolean;
    chunkSize?: number;
  };
}

export interface StreamingToolResponse {
  requestId: string;
  stream: AsyncGenerator<StreamingEventType>;
}

export interface StreamingCapabilities {
  supportsProgress: boolean;
  supportsIncrementalData: boolean;
  supportsStatusUpdates: boolean;
  supportsPartialResults: boolean;
  estimatedDuration?: number;
  progressSteps?: string[];
}

/**
 * Interface for tools that support streaming
 */
export interface StreamingTool {
  /**
   * Get streaming capabilities for this tool
   */
  getStreamingCapabilities(): StreamingCapabilities;

  /**
   * Execute tool with streaming support
   */
  executeStreaming(
    request: StreamingToolRequest,
  ): Promise<StreamingToolResponse>;

  /**
   * Check if tool supports streaming for given arguments
   */
  supportsStreamingFor(arguments_: Record<string, any>): boolean;
}
