/**
 * Health Monitoring System
 *
 * Comprehensive health monitoring with historical tracking,
 * alerting capabilities, and automatic recovery strategies.
 */

import type { HealthStatus } from '../BaseMCPClient';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';
  timestamp: Date;
  responseTime: number;
  details?: {
    version?: string;
    uptime?: number;
    memoryUsage?: number;
    activeConnections?: number;
  };
  error?: string;
}

export interface HealthHistory {
  service: string;
  checks: HealthCheckResult[];
  stats: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
    unreachableChecks: number;
    averageResponseTime: number;
    uptime: number; // percentage
    lastHealthyCheck?: Date;
    lastUnhealthyCheck?: Date;
  };
}

export interface HealthAlert {
  id: string;
  service: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthMonitorConfig {
  checkInterval: number;
  historySize: number;
  alertThresholds: {
    consecutiveFailures: number;
    responseTimeMs: number;
    uptimePercentage: number;
  };
  enableAutoRecovery: boolean;
}

export class HealthMonitor {
  private healthHistory: Map<string, HealthHistory> = new Map();
  private activeAlerts: Map<string, HealthAlert[]> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: HealthMonitorConfig;
  private alertHandlers: Array<(alert: HealthAlert) => void> = [];

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = {
      checkInterval: config.checkInterval || 60000, // 1 minute
      historySize: config.historySize || 100,
      alertThresholds: {
        consecutiveFailures: config.alertThresholds?.consecutiveFailures || 3,
        responseTimeMs: config.alertThresholds?.responseTimeMs || 5000,
        uptimePercentage: config.alertThresholds?.uptimePercentage || 95,
      },
      enableAutoRecovery: config.enableAutoRecovery !== false,
    };
  }

  /**
   * Start monitoring a service
   */
  startMonitoring(
    serviceName: string,
    healthCheckFn: () => Promise<HealthStatus>,
    interval?: number,
  ): void {
    // Stop existing monitoring if any
    this.stopMonitoring(serviceName);

    // Initialize history
    if (!this.healthHistory.has(serviceName)) {
      this.healthHistory.set(serviceName, {
        service: serviceName,
        checks: [],
        stats: {
          totalChecks: 0,
          healthyChecks: 0,
          degradedChecks: 0,
          unhealthyChecks: 0,
          unreachableChecks: 0,
          averageResponseTime: 0,
          uptime: 100,
        },
      });
    }

    // Perform initial check
    this.performHealthCheck(serviceName, healthCheckFn).catch(console.error);

    // Schedule periodic checks
    const checkInterval = interval || this.config.checkInterval;
    const intervalId = setInterval(() => {
      this.performHealthCheck(serviceName, healthCheckFn).catch(console.error);
    }, checkInterval);

    this.checkIntervals.set(serviceName, intervalId);
  }

  /**
   * Stop monitoring a service
   */
  stopMonitoring(serviceName: string): void {
    const intervalId = this.checkIntervals.get(serviceName);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(serviceName);
    }
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(
    serviceName: string,
    healthCheckFn: () => Promise<HealthStatus>,
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const healthStatus = await healthCheckFn();
      const responseTime = Date.now() - startTime;

      result = {
        service: serviceName,
        status: this.determineStatus(healthStatus, responseTime),
        timestamp: new Date(),
        responseTime,
        details: {
          version: healthStatus.version,
          uptime: healthStatus.uptime,
        },
      };
    } catch (error) {
      result = {
        service: serviceName,
        status: 'unreachable',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Update history
    this.updateHealthHistory(serviceName, result);

    // Check for alerts
    this.checkAlertConditions(serviceName, result);

    return result;
  }

  /**
   * Determine health status based on response
   */
  private determineStatus(
    healthStatus: HealthStatus,
    responseTime: number,
  ): HealthCheckResult['status'] {
    if (healthStatus.status !== 'ok') {
      return 'unhealthy';
    }

    if (responseTime > this.config.alertThresholds.responseTimeMs) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Update health history
   */
  private updateHealthHistory(
    serviceName: string,
    result: HealthCheckResult,
  ): void {
    const history = this.healthHistory.get(serviceName);
    if (!history) return;

    // Add new check result
    history.checks.push(result);

    // Limit history size
    if (history.checks.length > this.config.historySize) {
      history.checks.shift();
    }

    // Update statistics
    history.stats.totalChecks++;

    switch (result.status) {
      case 'healthy':
        history.stats.healthyChecks++;
        history.stats.lastHealthyCheck = result.timestamp;
        break;
      case 'degraded':
        history.stats.degradedChecks++;
        break;
      case 'unhealthy':
        history.stats.unhealthyChecks++;
        history.stats.lastUnhealthyCheck = result.timestamp;
        break;
      case 'unreachable':
        history.stats.unreachableChecks++;
        history.stats.lastUnhealthyCheck = result.timestamp;
        break;
    }

    // Calculate average response time
    const recentChecks = history.checks.slice(-10);
    history.stats.averageResponseTime =
      recentChecks.reduce((sum, check) => sum + check.responseTime, 0) /
      recentChecks.length;

    // Calculate uptime percentage
    const healthyAndDegraded =
      history.stats.healthyChecks + history.stats.degradedChecks;
    history.stats.uptime =
      (healthyAndDegraded / history.stats.totalChecks) * 100;
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(
    serviceName: string,
    result: HealthCheckResult,
  ): void {
    const history = this.healthHistory.get(serviceName);
    if (!history) return;

    const alerts = this.activeAlerts.get(serviceName) || [];

    // Check consecutive failures
    const recentChecks = history.checks.slice(
      -this.config.alertThresholds.consecutiveFailures,
    );
    const consecutiveFailures = recentChecks.every(
      (check) => check.status === 'unhealthy' || check.status === 'unreachable',
    );

    if (
      consecutiveFailures &&
      recentChecks.length === this.config.alertThresholds.consecutiveFailures
    ) {
      const alert: HealthAlert = {
        id: `${serviceName}-consecutive-failures-${Date.now()}`,
        service: serviceName,
        severity: 'critical',
        message: `Service ${serviceName} has failed ${this.config.alertThresholds.consecutiveFailures} consecutive health checks`,
        timestamp: new Date(),
        resolved: false,
      };
      this.raiseAlert(serviceName, alert);
    }

    // Check response time
    if (result.responseTime > this.config.alertThresholds.responseTimeMs * 2) {
      const alert: HealthAlert = {
        id: `${serviceName}-slow-response-${Date.now()}`,
        service: serviceName,
        severity: 'warning',
        message: `Service ${serviceName} response time (${result.responseTime}ms) exceeds threshold`,
        timestamp: new Date(),
        resolved: false,
      };
      this.raiseAlert(serviceName, alert);
    }

    // Check uptime
    if (history.stats.uptime < this.config.alertThresholds.uptimePercentage) {
      const alert: HealthAlert = {
        id: `${serviceName}-low-uptime-${Date.now()}`,
        service: serviceName,
        severity: 'error',
        message: `Service ${serviceName} uptime (${history.stats.uptime.toFixed(2)}%) below threshold`,
        timestamp: new Date(),
        resolved: false,
      };
      this.raiseAlert(serviceName, alert);
    }

    // Auto-resolve alerts if service is healthy
    if (result.status === 'healthy') {
      alerts
        .filter((alert) => !alert.resolved)
        .forEach((alert) => {
          alert.resolved = true;
          alert.resolvedAt = new Date();
        });
    }

    this.activeAlerts.set(serviceName, alerts);
  }

  /**
   * Raise an alert
   */
  private raiseAlert(serviceName: string, alert: HealthAlert): void {
    const alerts = this.activeAlerts.get(serviceName) || [];

    // Check if similar alert already exists
    const existingAlert = alerts.find(
      (a) => a.severity === alert.severity && !a.resolved,
    );

    if (!existingAlert) {
      alerts.push(alert);
      this.activeAlerts.set(serviceName, alerts);

      // Notify handlers
      this.alertHandlers.forEach((handler) => handler(alert));
    }
  }

  /**
   * Register alert handler
   */
  onAlert(handler: (alert: HealthAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Get health history for a service
   */
  getHealthHistory(serviceName: string): HealthHistory | undefined {
    return this.healthHistory.get(serviceName);
  }

  /**
   * Get all health histories
   */
  getAllHealthHistories(): HealthHistory[] {
    return Array.from(this.healthHistory.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(serviceName?: string): HealthAlert[] {
    if (serviceName) {
      return this.activeAlerts.get(serviceName) || [];
    }

    const allAlerts: HealthAlert[] = [];
    this.activeAlerts.forEach((alerts) => {
      allAlerts.push(...alerts.filter((a) => !a.resolved));
    });
    return allAlerts;
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    services: Array<{
      name: string;
      status: HealthCheckResult['status'];
      uptime: number;
      lastCheck?: Date;
      alerts: number;
    }>;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    totalAlerts: number;
  } {
    const services = Array.from(this.healthHistory.entries()).map(
      ([name, history]) => {
        const lastCheck = history.checks[history.checks.length - 1];
        const activeAlerts = this.getActiveAlerts(name);

        return {
          name,
          status: lastCheck?.status || 'unreachable',
          uptime: history.stats.uptime,
          lastCheck: lastCheck?.timestamp,
          alerts: activeAlerts.length,
        };
      },
    );

    const unhealthyServices = services.filter(
      (s) => s.status === 'unhealthy' || s.status === 'unreachable',
    );
    const degradedServices = services.filter((s) => s.status === 'degraded');

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices.length > 0) {
      overallHealth = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallHealth = 'degraded';
    }

    return {
      services,
      overallHealth,
      totalAlerts: this.getActiveAlerts().length,
    };
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    this.checkIntervals.forEach((_, serviceName) => {
      this.stopMonitoring(serviceName);
    });
    this.healthHistory.clear();
    this.activeAlerts.clear();
    this.alertHandlers = [];
  }
}
