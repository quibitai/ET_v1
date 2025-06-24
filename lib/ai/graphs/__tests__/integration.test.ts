/**
 * LangGraph Integration Tests
 *
 * Tests for the ModularLangGraphWrapper integration with the existing architecture
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ModularLangGraphWrapper,
  createModularLangGraphWrapper,
  shouldUseLangGraph,
  // Backwards compatibility aliases
  SimpleLangGraphWrapper,
  createLangGraphWrapper,
} from '../index';
import type { ModularLangGraphConfig } from '../ModularLangGraphWrapper';
import type { ChatOpenAI } from '@langchain/openai';

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Mock ChatOpenAI
const mockLLM = {
  modelName: 'gpt-4.1-mini',
  invoke: vi.fn(),
} as unknown as ChatOpenAI;

describe('LangGraph Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variable
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('shouldUseLangGraph', () => {
    it('should return true for complex patterns', () => {
      const complexPatterns = ['TOOL_OPERATION', 'MULTI_STEP', 'REASONING'];
      expect(shouldUseLangGraph(complexPatterns)).toBe(true);
    });

    it('should return false for simple patterns', () => {
      const simplePatterns = ['SIMPLE_QUERY', 'BASIC_RESPONSE'];
      expect(shouldUseLangGraph(simplePatterns)).toBe(false);
    });

    it('should return false for empty patterns', () => {
      expect(shouldUseLangGraph([])).toBe(false);
    });
  });

  describe('ModularLangGraphWrapper', () => {
    let config: ModularLangGraphConfig;

    beforeEach(() => {
      config = {
        llm: mockLLM,
        logger: mockLogger as any,
        tools: [],
        currentDateTime: new Date().toISOString(),
      };
    });

    it('should create wrapper successfully', () => {
      const wrapper = createModularLangGraphWrapper(config);
      expect(wrapper).toBeInstanceOf(ModularLangGraphWrapper);
    });

    it('should initialize with correct configuration', () => {
      const wrapper = createModularLangGraphWrapper(config);
      const retrievedConfig = wrapper.getConfig();

      expect(retrievedConfig.llm.modelName).toBe('gpt-4.1-mini');
      expect(retrievedConfig.currentDateTime).toBeDefined();
    });

    it('should log initialization without tools', () => {
      createModularLangGraphWrapper(config);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('ModularLangGraphWrapper'),
        expect.any(Object),
      );
    });

    it('should handle tools when provided', () => {
      const toolsConfig = {
        ...config,
        tools: [{ name: 'testTool', description: 'Test tool' }],
      };

      createModularLangGraphWrapper(toolsConfig);

      // Should attempt to bind tools
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Factory Functions', () => {
    it('should export required functions', () => {
      expect(typeof createLangGraphWrapper).toBe('function');
      expect(typeof shouldUseLangGraph).toBe('function');
    });

    it('should handle createGraphForPatterns', async () => {
      const { createGraphForPatterns } = await import('../index');

      const patterns = ['TOOL_OPERATION'];
      const config = {
        llm: mockLLM,
        logger: mockLogger as any,
        tools: [],
        currentDateTime: new Date().toISOString(),
      };

      const graph = createGraphForPatterns(patterns, config);
      expect(graph).toBeInstanceOf(ModularLangGraphWrapper);
    });
  });
});
