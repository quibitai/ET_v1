/**
 * Tool Manifest Types
 *
 * Defines the metadata structure for enhanced tool discovery and management.
 * This is an additive layer that enriches existing tool loading without
 * modifying the core streaming pipeline.
 */

export interface ToolManifest {
  /**
   * Unique identifier for the tool (e.g., 'asana_list_projects')
   */
  id: string;

  /**
   * Service this tool belongs to (e.g., 'asana', 'notion', 'slack')
   */
  service: string;

  /**
   * Whether this tool supports streaming responses
   * Note: This is for future use - main chat streaming must not be modified
   */
  streamingSupported: boolean;

  /**
   * Category for better tool organization and discovery
   */
  category:
    | 'project_management'
    | 'task_management'
    | 'team_operations'
    | 'analytics'
    | 'communication'
    | 'general';

  /**
   * Priority level for tool selection when multiple tools could handle a request
   */
  priority: 'high' | 'medium' | 'low';

  /**
   * Enhanced description for better AI tool selection
   */
  description: string;

  /**
   * Estimated execution duration in milliseconds
   * Helps with timeout management and user expectations
   */
  estimatedDuration?: number;

  /**
   * Whether this tool can be batched with similar operations
   */
  batchCompatible?: boolean;

  /**
   * Tags for additional categorization and discovery
   */
  tags?: string[];

  /**
   * Required permissions or scopes for this tool
   */
  requiredScopes?: string[];

  /**
   * Streaming configuration for tools that support streaming
   */
  streamingConfig?: {
    /**
     * Type of streaming this tool provides
     * - progress: Shows completion percentage and status updates
     * - incremental: Streams data as it becomes available
     * - status: Provides real-time status messages
     */
    type: 'progress' | 'incremental' | 'status';

    /**
     * Preferred chunk size for incremental streaming
     */
    chunkSize?: number;

    /**
     * Expected progress steps for progress streaming
     */
    progressSteps?: string[];

    /**
     * Status messages for status streaming
     */
    statusMessages?: string[];

    /**
     * Whether this tool can stream partial results
     */
    supportsPartialResults?: boolean;
  };

  /**
   * Version of the manifest format (for future compatibility)
   */
  manifestVersion?: string;
}

/**
 * Collection of manifests organized by service
 */
export interface ManifestCollection {
  [service: string]: {
    [toolId: string]: ToolManifest;
  };
}

/**
 * Tool enrichment result after applying manifest metadata
 */
export interface EnrichedTool {
  /**
   * Original tool instance (unchanged)
   */
  tool: any;

  /**
   * Manifest metadata if available
   */
  manifest?: ToolManifest;

  /**
   * Combined description (tool + manifest)
   */
  enrichedDescription?: string;
}

/**
 * Manifest validation result
 */
export interface ManifestValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Registry configuration options
 */
export interface ToolRegistryConfig {
  /**
   * Path to manifest directory
   */
  manifestPath?: string;

  /**
   * Whether to cache manifests in memory
   */
  enableCaching?: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number;

  /**
   * Whether to watch for manifest file changes (dev mode)
   */
  watchForChanges?: boolean;

  /**
   * Whether to validate manifests on load
   */
  validateOnLoad?: boolean;
}
