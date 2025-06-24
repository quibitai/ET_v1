/**
 * Base MCP Client
 *
 * Abstract base class for all MCP service clients.
 * Provides common functionality for configuration, validation, health checks,
 * and tool execution while allowing service-specific implementations.
 *
 * This abstraction enables multi-service support without code duplication.
 */

import {
  MCPErrorFactory,
  RetryStrategy,
  MCPError,
  type MCPErrorContext,
} from './errors';

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
  protected cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
  };

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
      serverUrl: config.serverUrl || '', // Don't auto-detect during construction
      timeout: config.timeout || 5000, // Reduced from 30000
      retries: config.retries || 3,
      autoDetect: config.autoDetect !== false,
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      enableCaching: config.enableCaching !== false,
      cacheTTL: config.cacheTTL || 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Ensure configuration is complete (lazy initialization)
   */
  protected ensureConfigured(): void {
    if (!this.config.serverUrl && this.config.autoDetect) {
      this.config.serverUrl = this.detectServerUrl();
    }
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
   * Check if the MCP server is available with fast timeout
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
        this.cacheStats.hits++;
        this.cacheStats.totalRequests++;
        return cached;
      }
      this.cacheStats.misses++;
      this.cacheStats.totalRequests++;
    }

    const startTime = Date.now();

    try {
      const response = await this.makeRequest(
        `/tool/${toolName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
        },
        toolName,
      );

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
   * Make HTTP request with enhanced retry logic and error handling
   */
  protected async makeRequest(
    path: string,
    options: RequestInit,
    toolName?: string,
  ): Promise<Response> {
    const url = `${this.config.serverUrl}${path}`;
    let lastError: MCPError | null = null;

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      const errorContext: MCPErrorContext = {
        service: this.serviceName,
        tool: toolName,
        request: { url, method: options.method, body: options.body },
        timestamp: new Date(),
        attemptNumber: attempt,
        maxAttempts: this.config.retries + 1,
      };

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
          const responseBody = await response.text().catch(() => null);
          let parsedBody: any;
          try {
            parsedBody = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            parsedBody = { message: responseBody };
          }

          const error = MCPErrorFactory.fromResponse(
            response,
            errorContext,
            parsedBody,
          );

          if (
            !RetryStrategy.shouldRetry(error, attempt, this.config.retries + 1)
          ) {
            throw error;
          }

          lastError = error;
          const delay = RetryStrategy.getRetryDelay(error, attempt);
          if (delay && attempt < this.config.retries + 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        return response;
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPErrorFactory.fromError(error as Error, errorContext);

        if (
          !RetryStrategy.shouldRetry(mcpError, attempt, this.config.retries + 1)
        ) {
          throw mcpError;
        }

        lastError = mcpError;
        const delay = RetryStrategy.getRetryDelay(mcpError, attempt);
        if (delay && attempt < this.config.retries + 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw (
      lastError ||
      MCPErrorFactory.fromError(new Error('Request failed after retries'), {
        service: this.serviceName,
        tool: toolName,
        timestamp: new Date(),
      })
    );
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

    // Limit cache size with LRU eviction
    if (this.requestCache.size > 1000) {
      // Find least recently used entry
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      for (const [key, value] of this.requestCache.entries()) {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.requestCache.delete(oldestKey);
        this.cacheStats.evictions++;
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
    evictions: number;
    totalRequests: number;
  } {
    const hitRate =
      this.cacheStats.totalRequests > 0
        ? this.cacheStats.hits / this.cacheStats.totalRequests
        : 0;

    return {
      size: this.requestCache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.cacheStats.evictions,
      totalRequests: this.cacheStats.totalRequests,
    };
  }
}
