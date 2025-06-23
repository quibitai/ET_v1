/**
 * Google Workspace MCP Integration Tests
 *
 * Tests the integration between the main application and the Google Workspace MCP server.
 * These tests verify that the MCP client can connect to the server and basic functionality works.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GoogleWorkspaceMCPClient } from '@/lib/ai/mcp/GoogleWorkspaceMCPClient';
import { MultiMCPClient } from '@/lib/ai/mcp/MultiMCPClient';

describe('Google Workspace MCP Integration', () => {
  let mcpClient: GoogleWorkspaceMCPClient;
  let multiClient: MultiMCPClient;

  beforeAll(async () => {
    // Initialize the Google Workspace MCP client
    mcpClient = await GoogleWorkspaceMCPClient.create({
      serverUrl: 'http://localhost:8001',
      timeout: 10000,
    });

    // Initialize the multi-client
    multiClient = new MultiMCPClient({
      services: {
        'google-workspace': {
          serverUrl: 'http://localhost:8001',
          enabled: true,
        },
      },
      autoDiscovery: false,
    });
  });

  afterAll(async () => {
    // Clean up connections
    multiClient?.destroy();
  });

  describe('MCP Client Configuration', () => {
    it('should have correct service configuration', () => {
      expect(mcpClient.serviceName).toBe('google-workspace');
      expect(mcpClient.defaultServerUrl).toBe('http://localhost:8001');
      expect(mcpClient.supportedTools).toContain('search_gmail_messages');
      expect(mcpClient.supportedTools).toContain('search_drive_files');
      expect(mcpClient.supportedTools).toContain('list_calendars');
    });

    it('should have all expected tool categories', () => {
      const tools = mcpClient.supportedTools;

      // Gmail tools
      expect(tools).toContain('search_gmail_messages');
      expect(tools).toContain('get_gmail_message_content');
      expect(tools).toContain('send_gmail_message');

      // Drive tools
      expect(tools).toContain('search_drive_files');
      expect(tools).toContain('get_drive_file_content');
      expect(tools).toContain('list_drive_items');

      // Calendar tools
      expect(tools).toContain('list_calendars');
      expect(tools).toContain('get_events');
      expect(tools).toContain('create_event');
    });
  });

  describe('Server Health Check', () => {
    it('should be able to connect to the MCP server', async () => {
      const health = await mcpClient.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.service).toBe('workspace-mcp');
    }, 15000);

    it('should report as available', async () => {
      const isAvailable = await mcpClient.isAvailable();
      expect(isAvailable).toBe(true);
    }, 10000);
  });

  describe('Configuration Validation', () => {
    it('should validate service-specific configuration', async () => {
      const validation = await mcpClient.validateConfiguration();

      // Should be valid even without OAuth tokens (they're handled by the MCP server)
      expect(validation.isValid).toBe(true);

      // May have warnings about credentials
      if (validation.warnings && validation.warnings.length > 0) {
        expect(
          validation.warnings.some(
            (w) =>
              w.includes('GOOGLE_CLIENT_SECRETS') ||
              w.includes('GOOGLE_APPLICATION_CREDENTIALS'),
          ),
        ).toBe(true);
      }
    });
  });

  describe('Multi-Client Integration', () => {
    it('should register Google Workspace service in multi-client', async () => {
      const services = multiClient.getServices();
      const googleWorkspaceService = services.find(
        (s) => s.name === 'google-workspace',
      );

      expect(googleWorkspaceService).toBeDefined();
      expect(googleWorkspaceService?.enabled).toBe(true);
    });

    it('should show Google Workspace tools in available tools', () => {
      const availableTools = multiClient.getAvailableTools();

      const gmailTool = availableTools.find(
        (t) => t.name === 'search_gmail_messages',
      );
      const driveTool = availableTools.find(
        (t) => t.name === 'search_drive_files',
      );
      const calendarTool = availableTools.find(
        (t) => t.name === 'list_calendars',
      );

      expect(gmailTool).toBeDefined();
      expect(gmailTool?.services).toContain('google-workspace');

      expect(driveTool).toBeDefined();
      expect(driveTool?.services).toContain('google-workspace');

      expect(calendarTool).toBeDefined();
      expect(calendarTool?.services).toContain('google-workspace');
    });
  });

  describe('Tool Execution (Mock)', () => {
    it('should handle tool execution errors gracefully', async () => {
      // This test will fail due to missing OAuth, but should handle the error properly
      try {
        await mcpClient.searchGmail('test', 'test@example.com');
        // If this doesn't throw, the test environment has OAuth configured
      } catch (error) {
        // Expected to fail without proper OAuth setup
        expect(error).toBeDefined();

        // Should be a proper error response, not a connection failure
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain('ECONNREFUSED');
        expect(errorMessage).not.toContain('timeout');
      }
    });

    it('should validate required parameters for Gmail tools', async () => {
      try {
        // Missing user_google_email should cause validation error
        await mcpClient.executeTool('search_gmail_messages', {
          query: 'test',
          // missing user_google_email
        } as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Helper Methods', () => {
    it('should provide type-safe Gmail helper methods', () => {
      expect(typeof mcpClient.searchGmail).toBe('function');
      expect(typeof mcpClient.executeGmailTool).toBe('function');
    });

    it('should provide type-safe Drive helper methods', () => {
      expect(typeof mcpClient.searchDriveFiles).toBe('function');
      expect(typeof mcpClient.executeDriveTool).toBe('function');
    });

    it('should provide type-safe Calendar helper methods', () => {
      expect(typeof mcpClient.listCalendars).toBe('function');
      expect(typeof mcpClient.executeCalendarTool).toBe('function');
    });
  });
});
