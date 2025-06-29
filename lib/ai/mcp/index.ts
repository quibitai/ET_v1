/**
 * MCP (Model Context Protocol) Client Library
 *
 * This module provides a unified interface for interacting with multiple
 * MCP services through Docker-based servers.
 */

// Base classes and types
export {
  BaseMCPClient,
  type MCPClientConfig,
  type MCPToolRequest,
  type MCPToolResponse,
  type MCPBatchRequest,
  type MCPBatchResponse,
  type ValidationResult,
  type HealthStatus,
} from './BaseMCPClient';

// Service-specific clients
export {
  AsanaMCPClient,
  type AsanaMCPConfig,
  type AsanaWorkspace,
  type AsanaTask,
  type AsanaProject,
} from './AsanaMCPClient';

export {
  GoogleWorkspaceMCPClient,
  type GoogleWorkspaceMCPConfig,
  GMAIL_TOOLS,
  DRIVE_TOOLS,
  CALENDAR_TOOLS,
  DOCS_TOOLS,
  SHEETS_TOOLS,
  FORMS_TOOLS,
  CHAT_TOOLS,
} from './GoogleWorkspaceMCPClient';

// Multi-service manager
export {
  MultiMCPClient,
  type MultiMCPConfig,
  type ServiceRegistration,
  type ServiceStatus,
  type ToolRoutingInfo,
} from './MultiMCPClient';

// Import for factory function
import { MultiMCPClient } from './MultiMCPClient';
import type { MultiMCPConfig } from './MultiMCPClient';

// Convenience factory function
export async function createMCPClient(
  config?: MultiMCPConfig,
): Promise<MultiMCPClient> {
  const client = new MultiMCPClient(config);

  // Wait for initial health checks
  await client.checkAllServicesHealth();

  return client;
}
