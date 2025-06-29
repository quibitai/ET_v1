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
import { GoogleWorkspaceMCPClient } from './GoogleWorkspaceMCPClient';
import { HealthMonitor } from './health/HealthMonitor';
import type { HealthAlert } from './health/HealthMonitor';
import { StreamingMCPWrapper } from './streaming/StreamingMCPWrapper';
import { ToolRegistry } from '../tools/registry/ToolRegistry';
import type {
  StreamingToolRequest,
  StreamingToolResponse,
} from './streaming/types';

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
  consecutiveFailures?: number;
  circuitBreakerOpenUntil?: Date;
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
  private toolRegistry: ToolRegistry;
  private streamingWrappers: Map<string, StreamingMCPWrapper> = new Map();

  constructor(config: MultiMCPConfig = {}) {
    this.config = {
      services: config.services || {},
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      autoDiscovery: config.autoDiscovery !== false,
    };

    // Initialize tool registry for streaming support
    this.toolRegistry = new ToolRegistry();

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

    // Google Workspace service
    if (
      process.env.GOOGLE_CLIENT_SECRETS ||
      process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL
    ) {
      this.registerService(
        'google-workspace',
        new GoogleWorkspaceMCPClient(),
        10,
      );
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
      case 'google-workspace':
        return new GoogleWorkspaceMCPClient(config);
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

    // Create streaming wrapper for the service
    this.createStreamingWrapper(name, client);

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
    const toolRoutingEntries = Array.from(this.toolRouting.entries());
    for (const [toolName, routes] of toolRoutingEntries) {
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
   * Enhanced execute tool with circuit breaker awareness
   */
  async executeTool(toolName: string, args?: any): Promise<any> {
    const routes = this.toolRouting.get(toolName);
    if (!routes || routes.length === 0) {
      throw new Error(`No service registered for tool: ${toolName}`);
    }

    // Try services in priority order, respecting circuit breaker state
    let lastError: Error | null = null;
    for (const route of routes) {
      const status = this.serviceStatus.get(route.service);

      // Skip unavailable services or those in circuit breaker state
      if (
        status &&
        (!status.available || this.isServiceInCircuitBreaker(status))
      ) {
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

        // Mark service as potentially unavailable and update failure count
        if (status) {
          status.available = false;
          status.consecutiveFailures = (status.consecutiveFailures || 0) + 1;

          // Open circuit breaker if too many failures
          if (status.consecutiveFailures >= 3) {
            const circuitBreakerDuration = 5 * 60 * 1000; // 5 minutes
            status.circuitBreakerOpenUntil = new Date(
              Date.now() + circuitBreakerDuration,
            );
            console.warn(
              `[MultiMCPClient] CIRCUIT BREAKER OPENED for ${route.service} due to tool execution failure`,
            );
          }

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

    const toolRoutingEntries = Array.from(this.toolRouting.entries());
    for (const [toolName, routes] of toolRoutingEntries) {
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
   * ENHANCED: Circuit breaker pattern for failed services
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const registration = this.services.get(serviceName);
    if (!registration) return;

    try {
      // Check if service is in circuit breaker state
      const existingStatus = this.serviceStatus.get(serviceName);
      if (existingStatus && this.isServiceInCircuitBreaker(existingStatus)) {
        console.log(
          `[MultiMCPClient] Service ${serviceName} in circuit breaker - skipping health check`,
        );
        return;
      }

      const health = await registration.client.healthCheck();
      const isAvailable = health.status === 'ok' || health.status === 'healthy';

      const serviceStatus: ServiceStatus = {
        name: serviceName,
        available: isAvailable,
        health,
        lastChecked: new Date(),
        supportedTools: registration.client.supportedTools,
      };

      // Reset consecutive failures on success
      if (isAvailable) {
        serviceStatus.consecutiveFailures = 0;
        serviceStatus.circuitBreakerOpenUntil = undefined;
      } else {
        // Increment failure count
        const currentFailures = existingStatus?.consecutiveFailures || 0;
        serviceStatus.consecutiveFailures = currentFailures + 1;

        // Open circuit breaker after 3 consecutive failures
        if (serviceStatus.consecutiveFailures >= 3) {
          const circuitBreakerDuration = 5 * 60 * 1000; // 5 minutes
          serviceStatus.circuitBreakerOpenUntil = new Date(
            Date.now() + circuitBreakerDuration,
          );
          console.warn(
            `[MultiMCPClient] CIRCUIT BREAKER OPENED for ${serviceName} - will retry in 5 minutes`,
          );
        }
      }

      this.serviceStatus.set(serviceName, serviceStatus);
    } catch (error) {
      const existingStatus = this.serviceStatus.get(serviceName);
      const currentFailures = existingStatus?.consecutiveFailures || 0;

      const serviceStatus: ServiceStatus = {
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
        consecutiveFailures: currentFailures + 1,
      };

      // Open circuit breaker after 3 consecutive failures
      if ((serviceStatus.consecutiveFailures || 0) >= 3) {
        const circuitBreakerDuration = 5 * 60 * 1000; // 5 minutes
        serviceStatus.circuitBreakerOpenUntil = new Date(
          Date.now() + circuitBreakerDuration,
        );
        console.warn(
          `[MultiMCPClient] CIRCUIT BREAKER OPENED for ${serviceName} - will retry in 5 minutes`,
        );
      }

      this.serviceStatus.set(serviceName, serviceStatus);
    }
  }

  /**
   * Check if service is in circuit breaker state
   */
  private isServiceInCircuitBreaker(status: ServiceStatus): boolean {
    if (!status.circuitBreakerOpenUntil) return false;

    const now = new Date();
    if (now < status.circuitBreakerOpenUntil) {
      return true; // Circuit breaker still open
    } else {
      // Circuit breaker can be closed - reset state
      status.circuitBreakerOpenUntil = undefined;
      status.consecutiveFailures = 0;
      console.log(
        `[MultiMCPClient] Circuit breaker closed for ${status.name} - attempting recovery`,
      );
      return false;
    }
  }

  /**
   * Enhanced service status interface with circuit breaker support
   */
  private updateServiceStatusInterface(): void {
    // This method exists to document the enhanced ServiceStatus interface
    // ServiceStatus now includes:
    // - consecutiveFailures?: number
    // - circuitBreakerOpenUntil?: Date
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
    const serviceEntries = Array.from(this.services.entries());
    for (const [name, registration] of serviceEntries) {
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
    const registrations = Array.from(this.services.values());
    for (const registration of registrations) {
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

    const serviceEntries = Array.from(this.services.entries());
    for (const [name, registration] of serviceEntries) {
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
   * Create streaming wrapper for a service
   */
  private async createStreamingWrapper(
    serviceName: string,
    client: BaseMCPClient,
  ): Promise<void> {
    try {
      // Create wrapper (manifests will be loaded on demand)
      const wrapper = new StreamingMCPWrapper(client);
      this.streamingWrappers.set(serviceName, wrapper);
    } catch (error) {
      console.warn(
        `Failed to create streaming wrapper for ${serviceName}:`,
        error,
      );
    }
  }

  /**
   * Execute tool with streaming support
   */
  async executeStreamingTool(
    request: StreamingToolRequest,
  ): Promise<StreamingToolResponse | null> {
    const routes = this.getToolRouting(request.toolName);

    if (routes.length === 0) {
      throw new Error(`Tool ${request.toolName} not available in any service`);
    }

    // Try services in priority order, respecting circuit breaker state
    for (const route of routes) {
      const service = this.services.get(route.service);
      const status = this.serviceStatus.get(route.service);

      if (
        !service?.enabled ||
        !status?.available ||
        this.isServiceInCircuitBreaker(status)
      ) {
        continue;
      }

      try {
        // Get tool manifest
        const manifest = await this.toolRegistry.getToolManifest(
          request.toolName,
          route.service,
        );

        // Check if tool supports streaming
        if (!manifest?.streamingSupported) {
          continue; // Try next service
        }

        // Create wrapper with manifest
        const streamingWrapper = new StreamingMCPWrapper(
          route.client,
          manifest,
        );

        return await streamingWrapper.executeStreaming(request);
      } catch (error) {
        console.warn(`Streaming execution failed on ${route.service}:`, error);
        continue; // Try next service
      }
    }

    return null;
  }

  /**
   * Get streaming tools available across all services
   */
  async getStreamingTools(): Promise<
    Array<{
      toolName: string;
      service: string;
      manifest: any;
    }>
  > {
    const streamingTools: Array<{
      toolName: string;
      service: string;
      manifest: any;
    }> = [];

    try {
      const allStreamingTools = await this.toolRegistry.getStreamingTools();

      for (const manifest of allStreamingTools) {
        // Check if service is available and not in circuit breaker
        const service = this.services.get(manifest.service);
        const status = this.serviceStatus.get(manifest.service);

        if (
          service?.enabled &&
          status?.available &&
          !this.isServiceInCircuitBreaker(status)
        ) {
          streamingTools.push({
            toolName: manifest.id,
            service: manifest.service,
            manifest,
          });
        }
      }
    } catch (error) {
      console.error('Failed to get streaming tools:', error);
    }

    return streamingTools;
  }

  /**
   * Check if a tool supports streaming
   */
  async isStreamingSupported(
    toolName: string,
    serviceName?: string,
  ): Promise<boolean> {
    try {
      const manifest = await this.toolRegistry.getToolManifest(
        toolName,
        serviceName,
      );
      return manifest?.streamingSupported || false;
    } catch {
      return false;
    }
  }

  /**
   * Get enhanced service health summary with circuit breaker information
   */
  getServiceHealthSummary(): any {
    const serviceStatuses = Array.from(this.serviceStatus.values());

    return {
      totalServices: serviceStatuses.length,
      availableServices: serviceStatuses.filter((s) => s.available).length,
      healthyServices: serviceStatuses.filter(
        (s) => s.available && !this.isServiceInCircuitBreaker(s),
      ).length,
      circuitBreakerOpen: serviceStatuses.filter((s) =>
        this.isServiceInCircuitBreaker(s),
      ),
      recentFailures: serviceStatuses.filter(
        (s) => (s.consecutiveFailures || 0) > 0,
      ),
      healthyServiceNames: serviceStatuses
        .filter((s) => s.available && !this.isServiceInCircuitBreaker(s))
        .map((s) => s.name),
      unhealthyServiceNames: serviceStatuses
        .filter((s) => !s.available || this.isServiceInCircuitBreaker(s))
        .map((s) => s.name),
    };
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void {
    this.stopHealthMonitoring();
    this.services.clear();
    this.toolRouting.clear();
    this.serviceStatus.clear();
    this.streamingWrappers.clear();
  }
}
