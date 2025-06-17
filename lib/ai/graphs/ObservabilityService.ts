/**
 * Enhanced Observability Service for LangGraph
 *
 * Provides comprehensive monitoring, metrics collection, and error tracking
 * for the modular LangGraph implementation with production-ready features.
 */

import type { RequestLogger } from '../../services/observabilityService';
import type { GraphState } from './state';

/**
 * Execution metrics for individual operations
 */
interface OperationMetrics {
  operationType: 'node' | 'tool' | 'service' | 'cache';
  operationName: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Session-level performance metrics
 */
interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  operations: OperationMetrics[];
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  iterationCount: number;
  finalState?: 'success' | 'error' | 'timeout';
}

/**
 * Health check status for monitoring
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  checks: {
    memory: { status: 'ok' | 'warning' | 'critical'; usage: number };
    cache: { status: 'ok' | 'warning' | 'critical'; hitRate: number };
    errors: { status: 'ok' | 'warning' | 'critical'; recentErrorRate: number };
    performance: {
      status: 'ok' | 'warning' | 'critical';
      avgResponseTime: number;
    };
  };
  uptime: number;
}

/**
 * Enhanced Observability Service
 *
 * Features:
 * - Real-time performance monitoring
 * - Automatic error tracking and alerting
 * - Cache performance analysis
 * - Health status monitoring
 * - Structured logging with correlation IDs
 * - Performance trend analysis
 */
export class ObservabilityService {
  private logger: RequestLogger;
  private sessionMetrics = new Map<string, SessionMetrics>();
  private healthStatus!: HealthStatus;
  private startTime = Date.now();

  // Performance tracking
  private performanceBuffer: number[] = [];
  private errorBuffer: { timestamp: number; error: string }[] = [];
  private readonly maxBufferSize = 1000;

  constructor(logger: RequestLogger) {
    this.logger = logger;
    this.initializeHealthStatus();
    this.startHealthMonitoring();
  }

  /**
   * Start tracking a new session
   */
  startSession(sessionId: string, metadata?: Record<string, any>): void {
    const session: SessionMetrics = {
      sessionId,
      startTime: Date.now(),
      operations: [],
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      iterationCount: 0,
    };

    this.sessionMetrics.set(sessionId, session);

    this.logger.info('[Observability] Session started', {
      sessionId,
      metadata: metadata || {},
      timestamp: session.startTime,
    });
  }

  /**
   * Track an operation within a session
   */
  trackOperation(
    sessionId: string,
    operationType: 'node' | 'tool' | 'service' | 'cache',
    operationName: string,
    duration: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>,
  ): void {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) {
      this.logger.warn(
        '[Observability] Session not found for operation tracking',
        {
          sessionId,
          operationName,
        },
      );
      return;
    }

    const operation: OperationMetrics = {
      operationType,
      operationName,
      duration,
      success,
      error,
      metadata,
      timestamp: Date.now(),
    };

    session.operations.push(operation);

    if (!success) {
      session.errorCount++;
      this.trackError(error || 'Unknown error', sessionId, operationName);
    }

    // Update performance buffer
    this.performanceBuffer.push(duration);
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer.shift();
    }

    this.logger.info('[Observability] Operation tracked', {
      sessionId,
      operationType,
      operationName,
      duration,
      success,
      error,
    });
  }

  /**
   * Track cache performance
   */
  trackCacheOperation(sessionId: string, hit: boolean, key: string): void {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) return;

    if (hit) {
      session.cacheHits++;
    } else {
      session.cacheMisses++;
    }

    this.logger.info('[Observability] Cache operation tracked', {
      sessionId,
      hit,
      key: key.substring(0, 16),
      totalHits: session.cacheHits,
      totalMisses: session.cacheMisses,
    });
  }

  /**
   * End session tracking and calculate final metrics
   */
  endSession(
    sessionId: string,
    finalState: 'success' | 'error' | 'timeout',
  ): SessionMetrics | null {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) {
      this.logger.warn('[Observability] Session not found for ending', {
        sessionId,
      });
      return null;
    }

    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;
    session.finalState = finalState;

    // Calculate final metrics
    const metrics = this.calculateSessionMetrics(session);

    this.logger.info('[Observability] Session completed', {
      sessionId,
      ...metrics,
    });

    // Keep session for analysis (cleanup old sessions periodically)
    this.cleanupOldSessions();

    return session;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    this.updateHealthStatus();
    return { ...this.healthStatus };
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(): {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    totalSessions: number;
    activeSessions: number;
    cacheHitRate: number;
  } {
    const completedSessions = Array.from(this.sessionMetrics.values()).filter(
      (s) => s.finalState,
    );

    const totalCacheHits = completedSessions.reduce(
      (sum, s) => sum + s.cacheHits,
      0,
    );
    const totalCacheRequests = completedSessions.reduce(
      (sum, s) => sum + s.cacheHits + s.cacheMisses,
      0,
    );

    const sortedDurations = [...this.performanceBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    const recentErrors = this.errorBuffer.filter(
      (e) => Date.now() - e.timestamp < 300000, // Last 5 minutes
    );

    return {
      averageResponseTime:
        this.performanceBuffer.length > 0
          ? this.performanceBuffer.reduce((a, b) => a + b, 0) /
            this.performanceBuffer.length
          : 0,
      p95ResponseTime: sortedDurations[p95Index] || 0,
      p99ResponseTime: sortedDurations[p99Index] || 0,
      errorRate:
        this.performanceBuffer.length > 0
          ? recentErrors.length / this.performanceBuffer.length
          : 0,
      totalSessions: this.sessionMetrics.size,
      activeSessions: Array.from(this.sessionMetrics.values()).filter(
        (s) => !s.finalState,
      ).length,
      cacheHitRate:
        totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0,
    };
  }

  /**
   * Get detailed session metrics
   */
  getSessionMetrics(sessionId: string): SessionMetrics | null {
    return this.sessionMetrics.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionMetrics.entries())
      .filter(([_, session]) => !session.finalState)
      .map(([sessionId]) => sessionId);
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.sessionMetrics.clear();
    this.performanceBuffer = [];
    this.errorBuffer = [];
    this.logger.info('[Observability] All metrics cleared');
  }

  // Private helper methods

  private initializeHealthStatus(): void {
    this.healthStatus = {
      status: 'healthy',
      lastCheck: Date.now(),
      checks: {
        memory: { status: 'ok', usage: 0 },
        cache: { status: 'ok', hitRate: 0 },
        errors: { status: 'ok', recentErrorRate: 0 },
        performance: { status: 'ok', avgResponseTime: 0 },
      },
      uptime: 0,
    };
  }

  private startHealthMonitoring(): void {
    // Run health checks every 30 seconds
    setInterval(() => {
      this.updateHealthStatus();
    }, 30000);
  }

  private updateHealthStatus(): void {
    const analytics = this.getPerformanceAnalytics();

    // Memory check (simplified - in production use actual memory stats)
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    this.healthStatus.checks.memory = {
      status:
        memoryUsage > 500 ? 'critical' : memoryUsage > 200 ? 'warning' : 'ok',
      usage: memoryUsage,
    };

    // Cache performance check
    this.healthStatus.checks.cache = {
      status: analytics.cacheHitRate < 0.3 ? 'warning' : 'ok',
      hitRate: analytics.cacheHitRate,
    };

    // Error rate check
    this.healthStatus.checks.errors = {
      status:
        analytics.errorRate > 0.1
          ? 'critical'
          : analytics.errorRate > 0.05
            ? 'warning'
            : 'ok',
      recentErrorRate: analytics.errorRate,
    };

    // Performance check
    this.healthStatus.checks.performance = {
      status:
        analytics.averageResponseTime > 10000
          ? 'critical'
          : analytics.averageResponseTime > 5000
            ? 'warning'
            : 'ok',
      avgResponseTime: analytics.averageResponseTime,
    };

    // Overall status
    const criticalChecks = Object.values(this.healthStatus.checks).filter(
      (c) => c.status === 'critical',
    ).length;
    const warningChecks = Object.values(this.healthStatus.checks).filter(
      (c) => c.status === 'warning',
    ).length;

    this.healthStatus.status =
      criticalChecks > 0
        ? 'unhealthy'
        : warningChecks > 1
          ? 'degraded'
          : 'healthy';
    this.healthStatus.lastCheck = Date.now();
    this.healthStatus.uptime = Date.now() - this.startTime;
  }

  private trackError(
    error: string,
    sessionId?: string,
    operationName?: string,
  ): void {
    this.errorBuffer.push({
      timestamp: Date.now(),
      error,
    });

    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.shift();
    }

    this.logger.error('[Observability] Error tracked', {
      error,
      sessionId,
      operationName,
      timestamp: Date.now(),
    });
  }

  private calculateSessionMetrics(session: SessionMetrics): {
    operationCount: number;
    avgOperationTime: number;
    slowestOperation: string;
    cacheHitRate: number;
    successRate: number;
  } {
    const operations = session.operations;
    const totalCacheRequests = session.cacheHits + session.cacheMisses;

    const avgOperationTime =
      operations.length > 0
        ? operations.reduce((sum, op) => sum + op.duration, 0) /
          operations.length
        : 0;

    const slowestOperation = operations.reduce(
      (slowest, op) => (op.duration > slowest.duration ? op : slowest),
      operations[0] || { duration: 0, operationName: 'none' },
    );

    const successfulOperations = operations.filter((op) => op.success).length;

    return {
      operationCount: operations.length,
      avgOperationTime,
      slowestOperation: slowestOperation.operationName,
      cacheHitRate:
        totalCacheRequests > 0 ? session.cacheHits / totalCacheRequests : 0,
      successRate:
        operations.length > 0 ? successfulOperations / operations.length : 1,
    };
  }

  private cleanupOldSessions(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [sessionId, session] of this.sessionMetrics.entries()) {
      if (session.endTime && now - session.endTime > maxAge) {
        this.sessionMetrics.delete(sessionId);
      }
    }
  }
}

/**
 * Create a performance timer helper
 */
export function createPerformanceTimer(): {
  start: () => void;
  end: () => number;
} {
  let startTime: number;

  return {
    start: () => {
      startTime = Date.now();
    },
    end: () => {
      return Date.now() - startTime;
    },
  };
}

/**
 * Decorator for automatic operation tracking
 */
export function trackOperation(
  observabilityService: ObservabilityService,
  sessionId: string,
  operationType: 'node' | 'tool' | 'service' | 'cache',
  operationName: string,
) {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = createPerformanceTimer();
      timer.start();

      try {
        const result = await method.apply(this, args);
        const duration = timer.end();

        observabilityService.trackOperation(
          sessionId,
          operationType,
          operationName,
          duration,
          true,
          undefined,
          { args: args.length },
        );

        return result;
      } catch (error) {
        const duration = timer.end();
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        observabilityService.trackOperation(
          sessionId,
          operationType,
          operationName,
          duration,
          false,
          errorMessage,
        );

        throw error;
      }
    };
  };
}
