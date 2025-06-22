/**
 * LangChainToolService Unit Tests
 *
 * Testing Milestone 4-5: LangChain tool service tests
 * - Tool selection logic
 * - Client configuration handling
 * - Tool metadata and categorization
 * - Performance testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RequestLogger } from '../observabilityService';
import type { ClientConfig } from '@/lib/db/queries';

// Mock the tools module to avoid server-only imports
vi.mock('@/lib/ai/tools/index', () => ({
  availableTools: [
    { name: 'searchTool', description: 'Search for information' },
    { name: 'documentTool', description: 'Create and manage documents' },
    { name: 'asanaTool', description: 'Manage Asana tasks and projects' },
    { name: 'weatherTool', description: 'Get weather information' },
    { name: 'calendarTool', description: 'Manage calendar events' },
  ],
}));

import {
  LangChainToolService,
  createLangChainToolService,
  selectLangChainTools,
  LangChainToolCategory,
  type LangChainToolConfig,
} from '../langchainToolService';

// Mock logger
const mockLogger: RequestLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  correlationId: 'test-correlation-id',
  startTime: Date.now(),
  logTokenUsage: vi.fn(),
  logPerformanceMetrics: vi.fn(),
  finalize: vi.fn().mockReturnValue({
    correlationId: 'test-correlation-id',
    duration: 100,
    success: true,
    events: [],
  }),
};

// Mock client config
const mockClientConfig: ClientConfig = {
  id: 'test-client-id',
  name: 'Test Client',
  client_display_name: 'Test Client Display',
  configJson: {
    tool_configs: {
      testTool: { setting: 'value' },
    },
  },
};

describe('LangChainToolService', () => {
  let toolService: LangChainToolService;

  beforeEach(() => {
    vi.clearAllMocks();
    toolService = new LangChainToolService(mockLogger);
  });

  describe('selectTools', () => {
    it('should select all tools by default', async () => {
      const result = await toolService.selectTools();

      expect(result.tools).toBeDefined();
      expect(result.totalAvailable).toBeGreaterThan(0);
      expect(result.selected).toBe(result.tools.length);
      expect(result.selectionTime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.appliedFilters)).toBe(true);
      expect(typeof result.clientSpecificConfigs).toBe('boolean');
    });

    it('should return empty tools when tool execution is disabled', async () => {
      const config: LangChainToolConfig = {
        enableToolExecution: false,
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.tools).toEqual([]);
      expect(result.selected).toBe(0);
      expect(result.appliedFilters).toContain('tool_execution_disabled');
    });

    it('should limit tools when maxTools is specified', async () => {
      const config: LangChainToolConfig = {
        maxTools: 3,
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.tools.length).toBeLessThanOrEqual(3);
      expect(result.appliedFilters).toContain('count_limiting');
    });

    it('should apply client-specific configurations', async () => {
      const config: LangChainToolConfig = {
        clientConfig: mockClientConfig,
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.clientSpecificConfigs).toBe(true);
      expect(result.appliedFilters).toContain('client_filtering');
    });

    it('should apply context filtering', async () => {
      const config: LangChainToolConfig = {
        contextId: 'test-context-id',
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.appliedFilters).toContain('context_filtering');
    });

    it('should apply custom tool filters', async () => {
      const config: LangChainToolConfig = {
        toolFilters: ['search', 'document'],
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.appliedFilters).toContain('custom_filters');
      // Verify filtered tools contain the keywords
      result.tools.forEach((tool) => {
        const toolFilters = config.toolFilters || [];
        const containsFilter = toolFilters.some(
          (filter) =>
            tool.name.toLowerCase().includes(filter.toLowerCase()) ||
            tool.description?.toLowerCase().includes(filter.toLowerCase()),
        );
        expect(containsFilter).toBe(true);
      });
    });
  });

  describe('tool metadata and categorization', () => {
    it('should categorize tools correctly', () => {
      // Get tools by different categories
      const ragTools = toolService.getToolsByCategory(
        LangChainToolCategory.RAG,
      );
      const documentTools = toolService.getToolsByCategory(
        LangChainToolCategory.DOCUMENT,
      );
      const asanaTools = toolService.getToolsByCategory(
        LangChainToolCategory.ASANA,
      );

      expect(Array.isArray(ragTools)).toBe(true);
      expect(Array.isArray(documentTools)).toBe(true);
      expect(Array.isArray(asanaTools)).toBe(true);
    });

    it('should provide tool metadata', async () => {
      const result = await toolService.selectTools();

      if (result.tools.length > 0) {
        const firstTool = result.tools[0];
        const metadata = toolService.getToolMetadata(firstTool.name);

        expect(metadata).toBeDefined();
        expect(metadata?.name).toBe(firstTool.name);
        expect(metadata?.category).toBeDefined();
        expect(typeof metadata?.priority).toBe('number');
      }
    });

    it('should return undefined for non-existent tool metadata', () => {
      const metadata = toolService.getToolMetadata('non-existent-tool');
      expect(metadata).toBeUndefined();
    });
  });

  describe('performance and logging', () => {
    it('should log tool selection process', async () => {
      await toolService.selectTools();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting LangChain tool selection',
        expect.objectContaining({
          enableToolExecution: true,
          maxTools: 26,
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LangChain tool selection completed',
        expect.objectContaining({
          totalAvailable: expect.any(Number),
          selected: expect.any(Number),
          selectionTime: expect.any(String),
          appliedFilters: expect.any(Array),
          tools: expect.any(Array),
        }),
      );
    });

    it('should track selection performance', async () => {
      const result = await toolService.selectTools();

      expect(result.selectionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.selectionTime).toBe('number');
    });
  });

  describe('convenience functions', () => {
    it('should create service with createLangChainToolService', () => {
      const service = createLangChainToolService(mockLogger);
      expect(service).toBeInstanceOf(LangChainToolService);
    });

    it('should work with selectLangChainTools utility', async () => {
      const config: LangChainToolConfig = {
        maxTools: 3,
      };

      const result = await selectLangChainTools(mockLogger, config);

      expect(result.tools.length).toBeLessThanOrEqual(3);
      expect(result.totalAvailable).toBeGreaterThan(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty tool filters gracefully', async () => {
      const config: LangChainToolConfig = {
        toolFilters: [],
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      // Should not apply custom filters for empty array
      expect(result.appliedFilters).not.toContain('custom_filters');
    });

    it('should handle no available tools gracefully', async () => {
      // Mock the tools module to return an empty array
      vi.mock('@/lib/ai/tools/index', () => ({
        availableTools: [],
      }));

      const toolService = new LangChainToolService(mockLogger);
      const result = await toolService.selectTools();

      expect(result.tools).toEqual([]);
      expect(result.totalAvailable).toBe(0);
      expect(result.selected).toBe(0);
    });

    it('should handle client config without tool_configs', async () => {
      const config: LangChainToolConfig = {
        clientConfig: {
          ...mockClientConfig,
          configJson: {},
        },
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.clientSpecificConfigs).toBe(false);
    });

    it('should not apply context filtering if contextId is not in registry', async () => {
      const config: LangChainToolConfig = {
        contextId: 'non-existent-context',
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.appliedFilters).not.toContain('context_filtering');
    });

    it('should not apply custom filters if filter term is not found', async () => {
      const config: LangChainToolConfig = {
        toolFilters: ['nonexistentfilter'],
      };

      const toolService = new LangChainToolService(mockLogger, config);
      const result = await toolService.selectTools();

      expect(result.tools).toEqual([]);
      expect(result.selected).toBe(0);
    });
  });
});
