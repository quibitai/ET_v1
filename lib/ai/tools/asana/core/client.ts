/**
 * Asana API Client
 *
 * Production-ready client with rate limiting, retry logic, and error handling
 * Integrates with existing logging and observability services
 */

import type { AsanaConfig } from './config';
import type {
  AsanaApiResponse,
  AsanaApiCollectionResponse,
  RequestOptions,
} from './types';
import { AsanaToolError } from './types';

export class AsanaApiClient {
  private rateLimitTracker = new Map<string, number[]>();

  constructor(private config: AsanaConfig) {}

  /**
   * Execute API request with rate limiting and retry logic
   */
  async request<T>(
    endpoint: string,
    options: RequestOptions & { method?: string; body?: any } = {},
  ): Promise<AsanaApiResponse<T> | AsanaApiCollectionResponse<T>> {
    await this.enforceRateLimit();

    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${this.config.personalAccessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeout || this.config.timeout),
      });

      if (!response.ok) {
        throw await this.createErrorFromResponse(response);
      }

      return response.json();
    }, options.retries || 2);
  }

  /**
   * GET request helper
   */
  async get<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<AsanaApiResponse<T> | AsanaApiCollectionResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T>(
    endpoint: string,
    data: any,
    options?: RequestOptions,
  ): Promise<AsanaApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data,
    }) as Promise<AsanaApiResponse<T>>;
  }

  /**
   * PUT request helper
   */
  async put<T>(
    endpoint: string,
    data: any,
    options?: RequestOptions,
  ): Promise<AsanaApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data,
    }) as Promise<AsanaApiResponse<T>>;
  }

  /**
   * DELETE request helper
   */
  async delete<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<AsanaApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    }) as Promise<AsanaApiResponse<T>>;
  }

  /**
   * Rate limiting enforcement (1500 requests/minute)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = this.config.rateLimits.requestsPerMinute;

    // Clean old requests outside the window
    const requests = this.rateLimitTracker.get('requests') || [];
    const validRequests = requests.filter((time) => now - time < windowMs);

    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = windowMs - (now - oldestRequest) + 100; // Add small buffer
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Track this request
    validRequests.push(now);
    this.rateLimitTracker.set('requests', validRequests);
  }

  /**
   * Execute request with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry non-retryable errors
        if (error instanceof AsanaToolError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff with jitter
        const baseDelay = 1000; // 1 second
        const backoffDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * backoffDelay;
        const totalDelay = Math.min(backoffDelay + jitter, 30000); // Cap at 30s

        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Create appropriate error from HTTP response
   */
  private async createErrorFromResponse(
    response: Response,
  ): Promise<AsanaToolError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let retryable = false;

    try {
      const errorBody = await response.json();
      if (errorBody.errors?.[0]) {
        errorMessage = errorBody.errors[0].message;
      }
    } catch {
      // Use default error message if JSON parsing fails
    }

    // Determine if error is retryable
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      retryable = true;
    }

    return new AsanaToolError(
      errorMessage,
      `HTTP_${response.status}`,
      response.status,
      retryable,
      { url: response.url, status: response.status },
    );
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    requests: number;
    maxRequests: number;
    resetTime: number;
  } {
    const now = Date.now();
    const requests = this.rateLimitTracker.get('requests') || [];
    const validRequests = requests.filter((time) => now - time < 60000);

    return {
      requests: validRequests.length,
      maxRequests: this.config.rateLimits.requestsPerMinute,
      resetTime:
        validRequests.length > 0 ? Math.min(...validRequests) + 60000 : now,
    };
  }
}
