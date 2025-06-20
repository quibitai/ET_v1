/**
 * Multi MCP Client
 *
 * Manages multiple MCP service clients and provides unified access to all services.
 * Supports dynamic service discovery, health monitoring, and intelligent routing.
 */

import type {
  MCPClientConfig,
  HealthStatus,
  BaseMCPClient,
} from './BaseMCPClient';
import { AsanaMCPClient } from './AsanaMCPClient';
import { HealthMonitor } from './health/HealthMonitor';
import type { HealthAlert } from './health/HealthMonitor';

export interface ServiceRegistration {
  name: string;
  client: BaseMCPClient;
  priority?: number;
  enabled?: boolean;
}

export interface MultiMCPConfig {
  services?: {
    [serviceName: string]: MCPClientConfig & { enabled?: boolean };
  };
  healthCheckInterval?: number;
  autoDiscovery?: boolean;
}

export interface ServiceStatus {
  name: string;
  available: boolean;
  health?: HealthStatus;
  lastChecked: Date;
  supportedTools: string[];
}

export interface ToolRoutingInfo {
  service: string;
  client: BaseMCPClient;
  toolName: string;
  priority: number;
}

/**
 * Multi-service MCP client manager
 */
export class MultiMCPClient {
  private services: Map<string, ServiceRegistration> = new Map();
  private toolRouting: Map<string, ToolRoutingInfo[]> = new Map();
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private healthMonitor: HealthMonitor;
  private config: Required<MultiMCPConfig>;

  constructor(config: MultiMCPConfig = {}) {
    this.config = {
      services: config.services || {},
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      autoDiscovery: config.autoDiscovery !== false,
    };

    // Initialize health monitor
    this.healthMonitor = new HealthMonitor({
      checkInterval: this.config.healthCheckInterval,
      alertThresholds: {
        consecutiveFailures: 3,
        responseTimeMs: 5000,
        uptimePercentage: 95,
      },
    });

    // Register alert handler
    this.healthMonitor.onAlert((alert: HealthAlert) => {
      console.warn(
        `[MultiMCPClient] Health Alert: ${alert.severity} - ${alert.message}`,
      );
    });

    // Initialize default services if auto-discovery is enabled
    if (this.config.autoDiscovery) {
      this.initializeDefaultServices();
    }

    // Initialize configured services
    this.initializeConfiguredServices();

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize default services based on environment
   */
  private initializeDefaultServices(): void {
    // Asana service
    if (process.env.ASANA_ACCESS_TOKEN || process.env.ASANA_MCP_SERVER_URL) {
      this.registerService('asana', new AsanaMCPClient(), 10);
    }

    // Future services can be added here
    // if (process.env.NOTION_ACCESS_TOKEN) {
    //   this.registerService('notion', new NotionMCPClient(), 10);
    // }
  }

  /**
   * Initialize services from configuration
   */
  private initializeConfiguredServices(): void {
    for (const [serviceName, serviceConfig] of Object.entries(
      this.config.services,
    )) {
      if (serviceConfig.enabled === false) continue;

      try {
        const client = this.createServiceClient(serviceName, serviceConfig);
        if (client) {
          this.registerService(serviceName, client);
        }
      } catch (error) {
        console.error(`Failed to initialize service ${serviceName}:`, error);
      }
    }
  }

  /**
   * Create a service client based on service name
   */
  private createServiceClient(
    serviceName: string,
    config: MCPClientConfig,
  ): BaseMCPClient | null {
    switch (serviceName.toLowerCase()) {
      case 'asana':
        return new AsanaMCPClient(config);
      // Add more services as they're implemented
      default:
        console.warn(`Unknown service type: ${serviceName}`);
        return null;
    }
  }

  /**
   * Register a service
   */
  registerService(name: string, client: BaseMCPClient, priority = 0): void {
    this.services.set(name, {
      name,
      client,
      priority,
      enabled: true,
    });

    // Update tool routing
    this.updateToolRouting(name, client, priority);

    // Register with health monitor
    this.healthMonitor.startMonitoring(
      name,
      () => client.healthCheck(),
      this.config.healthCheckInterval,
    );

    // Initial status check
    this.checkServiceHealth(name).catch(console.error);
  }

  /**
   * Unregister a service
   */
  unregisterService(name: string): void {
    this.services.delete(name);
    this.serviceStatus.delete(name);

    // Stop health monitoring
    this.healthMonitor.stopMonitoring(name);

    // Remove from tool routing
    for (const [toolName, routes] of this.toolRouting.entries()) {
      const filtered = routes.filter((route) => route.service !== name);
      if (filtered.length === 0) {
        this.toolRouting.delete(toolName);
      } else {
        this.toolRouting.set(toolName, filtered);
      }
    }
  }

  /**
   * Update tool routing for a service
   */
  private updateToolRouting(
    serviceName: string,
    client: BaseMCPClient,
    priority: number,
  ): void {
    for (const toolName of client.supportedTools) {
      const routes = this.toolRouting.get(toolName) || [];

      // Remove existing route for this service
      const filtered = routes.filter((route) => route.service !== serviceName);

      // Add new route
      filtered.push({
        service: serviceName,
        client,
        toolName,
        priority,
      });

      // Sort by priority (higher first)
      filtered.sort((a, b) => b.priority - a.priority);

      this.toolRouting.set(toolName, filtered);
    }
  }

  /**
   * Get a specific service client
   */
  getService<T extends BaseMCPClient>(name: string): T | null {
    const registration = this.services.get(name);
    return (registration?.client as T) || null;
  }

  /**
   * Get all registered services
   */
  getServices(): ServiceRegistration[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service status
   */
  getServiceStatus(name?: string): ServiceStatus | ServiceStatus[] {
    if (name) {
      return (
        this.serviceStatus.get(name) || {
          name,
          available: false,
          lastChecked: new Date(),
          supportedTools: [],
        }
      );
    }
    return Array.from(this.serviceStatus.values());
  }

  /**
   * Execute a tool on the appropriate service
   */
  async executeTool(toolName: string, args?: any): Promise<any> {
    const routes = this.toolRouting.get(toolName);
    if (!routes || routes.length === 0) {
      throw new Error(`No service registered for tool: ${toolName}`);
    }

    // Try services in priority order
    let lastError: Error | null = null;
    for (const route of routes) {
      const status = this.serviceStatus.get(route.service);

      // Skip unavailable services
      if (status && !status.available) {
        continue;
      }

      try {
        const result = await route.client.executeTool(toolName, {
          arguments: args,
        });
        if (result.success) {
          return result.result;
        }
        lastError = new Error(result.error || 'Tool execution failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Mark service as potentially unavailable
        if (status) {
          status.available = false;
          // Trigger immediate health check
          this.checkServiceHealth(route.service).catch(console.error);
        }
      }
    }

    throw (
      lastError ||
      new Error(`Tool ${toolName} execution failed on all services`)
    );
  }

  /**
   * Get available tools across all services
   */
  getAvailableTools(): Array<{
    name: string;
    services: string[];
    available: boolean;
  }> {
    const toolMap = new Map<string, Set<string>>();

    for (const [toolName, routes] of this.toolRouting.entries()) {
      const services = new Set<string>();
      let available = false;

      for (const route of routes) {
        services.add(route.service);
        const status = this.serviceStatus.get(route.service);
        if (status?.available) {
          available = true;
        }
      }

      toolMap.set(toolName, services);
    }

    return Array.from(toolMap.entries()).map(([name, services]) => ({
      name,
      services: Array.from(services),
      available: Array.from(services).some((service) => {
        const status = this.serviceStatus.get(service);
        return status?.available || false;
      }),
    }));
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const registration = this.services.get(serviceName);
    if (!registration) return;

    try {
      const health = await registration.client.healthCheck();
      const isAvailable = health.status === 'ok';

      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: isAvailable,
        health,
        lastChecked: new Date(),
        supportedTools: registration.client.supportedTools,
      });
    } catch (error) {
      this.serviceStatus.set(serviceName, {
        name: serviceName,
        available: false,
        health: {
          status: 'error',
          service: serviceName,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        lastChecked: new Date(),
        supportedTools: registration.client.supportedTools,
      });
    }
  }

  /**
   * Check health of all services
   */
  async checkAllServicesHealth(): Promise<void> {
    const promises = Array.from(this.services.keys()).map((serviceName) =>
      this.checkServiceHealth(serviceName),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.config.healthCheckInterval <= 0) return;

    // Register all services with the health monitor
    for (const [name, registration] of this.services.entries()) {
      this.healthMonitor.startMonitoring(
        name,
        () => registration.client.healthCheck(),
        this.config.healthCheckInterval,
      );
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    this.healthMonitor.stopAll();
  }

  /**
   * Get routing information for a tool
   */
  getToolRouting(toolName: string): ToolRoutingInfo[] {
    return this.toolRouting.get(toolName) || [];
  }

  /**
   * Enable/disable a service
   */
  setServiceEnabled(name: string, enabled: boolean): void {
    const registration = this.services.get(name);
    if (registration) {
      registration.enabled = enabled;

      if (!enabled) {
        // Mark as unavailable immediately
        const status = this.serviceStatus.get(name);
        if (status) {
          status.available = false;
        }
      } else {
        // Trigger health check when re-enabled
        this.checkServiceHealth(name).catch(console.error);
      }
    }
  }

  /**
   * Clear all caches across services
   */
  clearAllCaches(): void {
    for (const registration of this.services.values()) {
      registration.client.clearCache();
    }
  }

  /**
   * Get aggregated cache statistics
   */
  getCacheStats(): {
    [service: string]: {
      size: number;
      hits: number;
      misses: number;
      hitRate: number;
    };
  } {
    const stats: any = {};

    for (const [name, registration] of this.services.entries()) {
      stats[name] = registration.client.getCacheStats();
    }

    return stats;
  }

  /**
   * Get health monitoring summary
   */
  getHealthSummary() {
    return this.healthMonitor.getHealthSummary();
  }

  /**
   * Get health history for a service
   */
  getHealthHistory(serviceName: string) {
    return this.healthMonitor.getHealthHistory(serviceName);
  }

  /**
   * Get active health alerts
   */
  getHealthAlerts(serviceName?: string) {
    return this.healthMonitor.getActiveAlerts(serviceName);
  }

  /**
   * Register health alert handler
   */
  onHealthAlert(handler: (alert: HealthAlert) => void) {
    this.healthMonitor.onAlert(handler);
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void {
    this.stopHealthMonitoring();
    this.services.clear();
    this.toolRouting.clear();
    this.serviceStatus.clear();
  }
}
