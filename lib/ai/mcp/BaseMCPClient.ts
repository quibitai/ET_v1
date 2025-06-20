/**
 * Base MCP Client
 *
 * Abstract base class for all MCP service clients.
 * Provides common functionality for configuration, validation, health checks,
 * and tool execution while allowing service-specific implementations.
 *
 * This abstraction enables multi-service support without code duplication.
 */

export interface MCPClientConfig {
  serverUrl?: string;
  timeout?: number;
  retries?: number;
  autoDetect?: boolean;
  maxConcurrentRequests?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
}

export interface ValidationResult {
  isValid: boolean;
  serverUrl: string;
  serverStatus: 'healthy' | 'unhealthy' | 'unreachable';
  errors: string[];
  warnings?: string[];
}

export interface HealthStatus {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  version?: string;
  error?: string;
  uptime?: number;
}

export interface MCPToolRequest {
  arguments?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface MCPToolResponse {
  success: boolean;
  tool: string;
  result: any;
  timestamp: string;
  error?: string;
  duration?: number;
}

export interface MCPBatchRequest {
  requests: Array<{
    tool: string;
    arguments?: Record<string, any>;
  }>;
  parallel?: boolean;
}

export interface MCPBatchResponse {
  success: boolean;
  results: Array<{
    index: number;
    status: 'fulfilled' | 'rejected';
    result?: any;
    error?: string;
  }>;
  timestamp: string;
  totalDuration?: number;
}

/**
 * Abstract base class for MCP clients
 */
export abstract class BaseMCPClient {
  protected config: Required<MCPClientConfig>;
  protected requestCache: Map<string, { data: any; timestamp: number }> =
    new Map();

  /**
   * Service-specific properties that must be implemented
   */
  abstract readonly serviceName: string;
  abstract readonly defaultServerUrl: string;
  abstract readonly supportedTools: string[];

  constructor(config: MCPClientConfig = {}) {
    this.config = this.mergeConfig(config);
  }

  /**
   * Merge user config with defaults
   */
  protected mergeConfig(config: MCPClientConfig): Required<MCPClientConfig> {
    return {
      serverUrl: config.serverUrl || this.detectServerUrl(),
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      autoDetect: config.autoDetect !== false,
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      enableCaching: config.enableCaching !== false,
      cacheTTL: config.cacheTTL || 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Auto-detect server URL based on environment
   */
  protected detectServerUrl(): string {
    // Check service-specific environment variable
    const envKey = `${this.serviceName.toUpperCase()}_MCP_SERVER_URL`;
    const envUrl = process.env[envKey];
    if (envUrl) {
      return envUrl;
    }

    // Check if we're in Docker Compose environment
    if (process.env.NODE_ENV === 'development' && process.env.DOCKER_COMPOSE) {
      return `http://${this.serviceName.toLowerCase()}-mcp:8080`;
    }

    // Default to service-specific default
    return this.defaultServerUrl;
  }

  /**
   * Validate configuration and test connectivity
   */
  async validateConfiguration(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let serverStatus: 'healthy' | 'unhealthy' | 'unreachable' = 'unreachable';

    try {
      const health = await this.healthCheck();
      serverStatus = health.status === 'ok' ? 'healthy' : 'unhealthy';

      if (serverStatus === 'unhealthy') {
        errors.push(
          `MCP server is unhealthy: ${health.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      serverStatus = 'unreachable';
      errors.push(
        `Cannot reach MCP server at ${this.config.serverUrl}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    // Service-specific validation
    const serviceValidation = await this.validateServiceSpecific();
    errors.push(...serviceValidation.errors);
    if (serviceValidation.warnings) {
      warnings.push(...serviceValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      serverUrl: this.config.serverUrl,
      serverStatus,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Service-specific validation (to be implemented by subclasses)
   */
  protected abstract validateServiceSpecific(): Promise<{
    errors: string[];
    warnings?: string[];
  }>;

  /**
   * Check if the MCP server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get configuration (read-only)
   */
  get configuration(): Readonly<Required<MCPClientConfig>> {
    return { ...this.config };
  }

  /**
   * Execute a tool with caching support
   */
  async executeTool(
    toolName: string,
    args: MCPToolRequest = {},
  ): Promise<MCPToolResponse> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(toolName, args);
      if (cached) {
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      const response = await this.makeRequest(`/tool/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      const result: MCPToolResponse = {
        success: true,
        tool: toolName,
        result: await response.json(),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      // Cache successful results
      if (this.config.enableCaching && result.success) {
        this.setCachedResult(toolName, args, result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        tool: toolName,
        result: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute multiple tools in batch
   */
  async executeBatch(request: MCPBatchRequest): Promise<MCPBatchResponse> {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest('/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      return {
        ...data,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        results: request.requests.map((_, index) => ({
          index,
          status: 'rejected' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
        timestamp: new Date().toISOString(),
        totalDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get tool schema/documentation
   */
  async getToolSchema(toolName: string): Promise<any> {
    const response = await this.makeRequest(`/schema/${toolName}`, {
      method: 'GET',
    });
    return response.json();
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    const response = await this.makeRequest('/tools', {
      method: 'GET',
    });
    return response.json();
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
      });
      const data = await response.json();

      return {
        status: 'ok',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...data,
      };
    } catch (error) {
      return {
        status: 'error',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const url = `${this.config.serverUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Cache management
   */
  protected getCachedResult(
    toolName: string,
    args: MCPToolRequest,
  ): MCPToolResponse | null {
    const cacheKey = this.getCacheKey(toolName, args);
    const cached = this.requestCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }

    // Clean up expired entry
    if (cached) {
      this.requestCache.delete(cacheKey);
    }

    return null;
  }

  protected setCachedResult(
    toolName: string,
    args: MCPToolRequest,
    result: MCPToolResponse,
  ): void {
    const cacheKey = this.getCacheKey(toolName, args);
    this.requestCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (this.requestCache.size > 1000) {
      const firstKey = this.requestCache.keys().next().value;
      if (firstKey !== undefined) {
        this.requestCache.delete(firstKey);
      }
    }
  }

  protected getCacheKey(toolName: string, args: MCPToolRequest): string {
    return `${toolName}:${JSON.stringify(args.arguments || {})}`;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.requestCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    // This is a simplified version - in production you'd track hits/misses
    return {
      size: this.requestCache.size,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }
}
