/**
 * ToolCache Service Tests
 *
 * Comprehensive test suite for the extracted ToolCache service.
 */

import { ToolCache } from '../ToolCache';
import type { ToolCall } from '../ToolCache';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('ToolCache', () => {
  let toolCache: ToolCache;

  beforeEach(() => {
    toolCache = new ToolCache(mockLogger as any);
    jest.clearAllMocks();
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for identical tool calls', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      const key1 = toolCache.generateKey(toolCall);
      const key2 = toolCache.generateKey(toolCall);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different tool calls', () => {
      const toolCall1: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      const toolCall2: ToolCall = {
        id: '2',
        name: 'testTool',
        args: { param1: 'value2' },
      };

      const key1 = toolCache.generateKey(toolCall1);
      const key2 = toolCache.generateKey(toolCall2);

      expect(key1).not.toBe(key2);
    });

    it('should normalize listDocuments calls', () => {
      const toolCall1: ToolCall = {
        id: '1',
        name: 'listDocuments',
        args: { filter: 'all' },
      };

      const toolCall2: ToolCall = {
        id: '2',
        name: 'listDocuments',
        args: { filter: 'recent' },
      };

      const key1 = toolCache.generateKey(toolCall1);
      const key2 = toolCache.generateKey(toolCall2);

      expect(key1).toBe(key2);
      expect(key1).toBe('listDocuments:all');
    });

    it('should normalize LWCC search queries', () => {
      const toolCall1: ToolCall = {
        id: '1',
        name: 'tavilySearch',
        args: { query: 'LWCC company profile mission' },
      };

      const toolCall2: ToolCall = {
        id: '2',
        name: 'tavilySearch',
        args: { query: 'LWCC leadership news services' },
      };

      const key1 = toolCache.generateKey(toolCall1);
      const key2 = toolCache.generateKey(toolCall2);

      expect(key1).toBe('tavilySearch:lwcc_comprehensive_search');
      expect(key2).toBe('tavilySearch:lwcc_comprehensive_search');
    });
  });

  describe('Cache Operations', () => {
    it('should cache and retrieve tool results', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      const result = 'test result';

      // Cache the result
      toolCache.set(toolCall, result);

      // Retrieve the result
      const cached = toolCache.get(toolCall);

      expect(cached).toBe(result);
    });

    it('should return undefined for non-cached tools', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      const result = toolCache.get(toolCall);

      expect(result).toBeUndefined();
    });

    it('should track cache statistics', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      // Miss
      toolCache.get(toolCall);

      // Set and hit
      toolCache.set(toolCall, 'result');
      toolCache.get(toolCall);

      const stats = toolCache.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple tool calls efficiently', () => {
      const toolCalls: ToolCall[] = [
        { id: '1', name: 'tool1', args: {} },
        { id: '2', name: 'tool2', args: {} },
        { id: '3', name: 'tool1', args: {} }, // Duplicate
      ];

      // Cache first tool
      toolCache.set(toolCalls[0], 'result1');

      const { cached, toExecute } = toolCache.getCachedResults(toolCalls);

      expect(cached).toHaveLength(2); // tool1 cached twice (same cache key)
      expect(toExecute).toHaveLength(1); // only tool2 needs execution
      expect(toExecute[0].name).toBe('tool2');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache completely', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      toolCache.set(toolCall, 'result');
      expect(toolCache.size()).toBe(1);

      toolCache.clear();
      expect(toolCache.size()).toBe(0);

      const result = toolCache.get(toolCall);
      expect(result).toBeUndefined();
    });

    it('should reset statistics on clear', () => {
      const toolCall: ToolCall = {
        id: '1',
        name: 'testTool',
        args: { param1: 'value1' },
      };

      toolCache.get(toolCall); // Miss
      toolCache.clear();

      const stats = toolCache.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
