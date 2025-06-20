/**
 * MCP Error System
 *
 * Comprehensive error handling with categorization, retry strategies,
 * and detailed error context for debugging and monitoring.
 */

export enum MCPErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN',
}

export interface MCPErrorContext {
  service: string;
  tool?: string;
  request?: any;
  response?: any;
  timestamp: Date;
  attemptNumber?: number;
  maxAttempts?: number;
}

export class MCPError extends Error {
  public readonly category: MCPErrorCategory;
  public readonly context: MCPErrorContext;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    category: MCPErrorCategory,
    context: MCPErrorContext,
    options?: {
      isRetryable?: boolean;
      statusCode?: number;
      originalError?: Error;
    },
  ) {
    super(message);
    this.name = 'MCPError';
    this.category = category;
    this.context = context;
    this.isRetryable =
      options?.isRetryable ?? this.determineRetryability(category);
    this.statusCode = options?.statusCode;
    this.originalError = options?.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  private determineRetryability(category: MCPErrorCategory): boolean {
    const retryableCategories = [
      MCPErrorCategory.NETWORK,
      MCPErrorCategory.TIMEOUT,
      MCPErrorCategory.RATE_LIMIT,
      MCPErrorCategory.SERVER_ERROR,
    ];
    return retryableCategories.includes(category);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      context: this.context,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
      stack: this.stack,
    };
  }
}

export class NetworkError extends MCPError {
  constructor(
    message: string,
    context: MCPErrorContext,
    originalError?: Error,
  ) {
    super(message, MCPErrorCategory.NETWORK, context, {
      isRetryable: true,
      originalError,
    });
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends MCPError {
  constructor(message: string, context: MCPErrorContext) {
    super(message, MCPErrorCategory.AUTHENTICATION, context, {
      isRetryable: false,
      statusCode: 401,
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends MCPError {
  constructor(message: string, context: MCPErrorContext) {
    super(message, MCPErrorCategory.AUTHORIZATION, context, {
      isRetryable: false,
      statusCode: 403,
    });
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends MCPError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string,
    context: MCPErrorContext,
    validationErrors: Array<{ field: string; message: string; value?: any }>,
  ) {
    super(message, MCPErrorCategory.VALIDATION, context, {
      isRetryable: false,
      statusCode: 400,
    });
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class RateLimitError extends MCPError {
  public readonly retryAfter?: number;
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly reset?: Date;

  constructor(
    message: string,
    context: MCPErrorContext,
    rateLimitInfo?: {
      retryAfter?: number;
      limit?: number;
      remaining?: number;
      reset?: Date;
    },
  ) {
    super(message, MCPErrorCategory.RATE_LIMIT, context, {
      isRetryable: true,
      statusCode: 429,
    });
    this.name = 'RateLimitError';
    this.retryAfter = rateLimitInfo?.retryAfter;
    this.limit = rateLimitInfo?.limit;
    this.remaining = rateLimitInfo?.remaining;
    this.reset = rateLimitInfo?.reset;
  }
}

export class TimeoutError extends MCPError {
  public readonly timeoutMs: number;

  constructor(message: string, context: MCPErrorContext, timeoutMs: number) {
    super(message, MCPErrorCategory.TIMEOUT, context, {
      isRetryable: true,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class ConfigurationError extends MCPError {
  public readonly missingFields?: string[];
  public readonly invalidFields?: Array<{ field: string; reason: string }>;

  constructor(
    message: string,
    context: MCPErrorContext,
    configErrors?: {
      missingFields?: string[];
      invalidFields?: Array<{ field: string; reason: string }>;
    },
  ) {
    super(message, MCPErrorCategory.CONFIGURATION, context, {
      isRetryable: false,
    });
    this.name = 'ConfigurationError';
    this.missingFields = configErrors?.missingFields;
    this.invalidFields = configErrors?.invalidFields;
  }
}

/**
 * Error factory for creating appropriate error types from responses
 */
export const MCPErrorFactory = {
  fromResponse(
    response: Response,
    context: MCPErrorContext,
    responseBody?: any,
  ): MCPError {
    const status = response.status;
    const message = responseBody?.error?.message || response.statusText;

    switch (status) {
      case 401:
        return new AuthenticationError(
          message || 'Authentication required',
          context,
        );

      case 403:
        return new AuthorizationError(message || 'Access forbidden', context);

      case 400:
        if (responseBody?.validationErrors) {
          return new ValidationError(
            message || 'Validation failed',
            context,
            responseBody.validationErrors,
          );
        }
        return new MCPError(
          message || 'Bad request',
          MCPErrorCategory.CLIENT_ERROR,
          context,
          { statusCode: 400 },
        );

      case 429: {
        const rateLimitInfo = {
          retryAfter: Number.parseInt(
            response.headers.get('Retry-After') || '60',
          ),
          limit: Number.parseInt(
            response.headers.get('X-RateLimit-Limit') || '0',
          ),
          remaining: Number.parseInt(
            response.headers.get('X-RateLimit-Remaining') || '0',
          ),
          reset: response.headers.get('X-RateLimit-Reset')
            ? new Date(
                Number.parseInt(
                  response.headers.get('X-RateLimit-Reset') || '0',
                ) * 1000,
              )
            : undefined,
        };
        return new RateLimitError(
          message || 'Rate limit exceeded',
          context,
          rateLimitInfo,
        );
      }

      case 500:
      case 502:
      case 503:
      case 504:
        return new MCPError(
          message || 'Server error',
          MCPErrorCategory.SERVER_ERROR,
          context,
          { statusCode: status, isRetryable: true },
        );

      default:
        if (status >= 400 && status < 500) {
          return new MCPError(
            message || 'Client error',
            MCPErrorCategory.CLIENT_ERROR,
            context,
            { statusCode: status, isRetryable: false },
          );
        } else if (status >= 500) {
          return new MCPError(
            message || 'Server error',
            MCPErrorCategory.SERVER_ERROR,
            context,
            { statusCode: status, isRetryable: true },
          );
        }
        return new MCPError(
          message || 'Unknown error',
          MCPErrorCategory.UNKNOWN,
          context,
          { statusCode: status },
        );
    }
  },

  fromError(error: Error, context: MCPErrorContext): MCPError {
    // Already an MCPError
    if (error instanceof MCPError) {
      return error;
    }

    // Network errors
    if (error.name === 'FetchError' || error.message.includes('fetch')) {
      return new NetworkError(error.message, context, error);
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new TimeoutError(
        error.message,
        context,
        context.request?.timeout || 30000,
      );
    }

    // Default unknown error
    return new MCPError(error.message, MCPErrorCategory.UNKNOWN, context, {
      originalError: error,
    });
  },
};

/**
 * Retry strategy based on error type
 */
export const RetryStrategy = {
  getRetryDelay(error: MCPError, attemptNumber: number): number | null {
    if (!error.isRetryable) {
      return null;
    }

    // Rate limit errors use retry-after header
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000;
    }

    // Exponential backoff for other retryable errors
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    let delay = baseDelay * Math.pow(2, attemptNumber - 1);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    delay += jitter;

    return Math.min(delay, maxDelay);
  },

  shouldRetry(
    error: MCPError,
    attemptNumber: number,
    maxAttempts: number,
  ): boolean {
    if (!error.isRetryable) {
      return false;
    }

    if (attemptNumber >= maxAttempts) {
      return false;
    }

    // Don't retry configuration errors
    if (error.category === MCPErrorCategory.CONFIGURATION) {
      return false;
    }

    return true;
  },
};
