/**
 * search-internal-knowledge-base Tool Tests
 * Phase 1, Test 1 of Systematic Tool Testing Plan
 *
 * Testing Focus:
 * - Knowledge retrieval accuracy
 * - Vector search performance
 * - Source attribution
 * - LangSmith traces for embedding calls
 * - Error handling and edge cases
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from 'vitest';
import { searchAndRetrieveKnowledgeBase } from '@/lib/ai/tools/search-internal-knowledge-base';

// Mock environment variables for testing
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
  OPENAI_API_KEY: 'test_openai_key',
};

// Mock observability service
vi.mock('@/lib/services/observabilityService', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  ANALYTICS_EVENTS: {
    TOOL_USED: 'tool_used',
  },
}));

// Mock Supabase client
const mockSupabaseRpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockSupabaseRpc,
  })),
}));

// Mock OpenAI embeddings
const mockEmbedQuery = vi.fn();
vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn(() => ({
    embedQuery: mockEmbedQuery,
  })),
}));

describe('search-internal-knowledge-base Tool Tests', () => {
  beforeAll(() => {
    // Set environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mock implementations
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
    mockSupabaseRpc.mockResolvedValue({
      data: [
        {
          content:
            'This is a sample document content about testing procedures.',
          similarity: 0.85,
          metadata: {
            file_title: 'Testing Guidelines.md',
            file_path: '/docs/testing-guidelines.md',
            uploaded_at: '2023-12-01T10:00:00Z',
          },
        },
      ],
      error: null,
    });
  });

  afterAll(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach((key) => {
      delete process.env[key];
    });
  });

  describe('Tool Definition and Schema', () => {
    it('should have correct tool name', () => {
      expect(searchAndRetrieveKnowledgeBase.name).toBe(
        'searchInternalKnowledgeBase',
      );
    });

    it('should have descriptive description', () => {
      expect(searchAndRetrieveKnowledgeBase.description).toContain(
        'searches the internal knowledge base',
      );
      expect(searchAndRetrieveKnowledgeBase.description).toContain(
        'FULL CONTENT',
      );
    });

    it('should have proper schema validation', () => {
      const schema = searchAndRetrieveKnowledgeBase.schema;
      expect(schema).toBeDefined();

      // Test schema parsing with valid input
      const validInput = {
        query: 'test query',
        match_count: 3,
        filter: { file_title: 'test.md' },
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });
  });

  describe('Basic Functionality', () => {
    it('should successfully search and return document content', async () => {
      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'testing procedures',
        match_count: 1,
        filter: {},
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Successfully retrieved document');
      expect(result).toContain('Testing Guidelines.md');
      expect(result).toContain('Similarity: 0.85');
      expect(result).toContain('This is a sample document content');

      // Verify embedding was called
      expect(mockEmbedQuery).toHaveBeenCalledWith('testing procedures');

      // Verify Supabase RPC was called correctly
      expect(mockSupabaseRpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        match_count: 1,
        filter: {},
      });
    });

    it('should handle multiple results and return top result', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [
          {
            content: 'First document content',
            similarity: 0.95,
            metadata: { file_title: 'Best Match.md' },
          },
          {
            content: 'Second document content',
            similarity: 0.75,
            metadata: { file_title: 'Second Match.md' },
          },
        ],
        error: null,
      });

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
        match_count: 5,
      });

      expect(result).toContain('Best Match.md');
      expect(result).toContain('Similarity: 0.95');
      expect(result).toContain('First document content');
      expect(result).not.toContain('Second Match.md');
    });

    it('should apply filters correctly', async () => {
      const filter = { file_title: 'specific-file.md' };

      await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
        match_count: 1,
        filter,
      });

      expect(mockSupabaseRpc).toHaveBeenCalledWith('match_documents', {
        query_embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        match_count: 1,
        filter,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle no results found', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'nonexistent content',
      });

      expect(result).toContain('No documents found');
      expect(result).toContain('nonexistent content');
      expect(result).toContain('Try a broader search term');
    });

    it('should handle Supabase RPC errors gracefully', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'PGRST000',
          details: 'Connection timeout',
        },
      });

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('Database connection failed');
      expect(parsedResult.metadata.errorType).toBe('rpc_error');
    });

    it('should handle embedding generation errors', async () => {
      mockEmbedQuery.mockRejectedValue(new Error('OpenAI API error'));

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('OpenAI API error');
    });

    it('should handle missing environment variables', async () => {
      // Temporarily remove env vars
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        'Supabase credentials are not configured',
      );

      // Restore env var
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });

    it('should handle documents with missing metadata', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: [
          {
            content: 'Document without metadata',
            similarity: 0.75,
            metadata: null,
          },
        ],
        error: null,
      });

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'test query',
      });

      expect(result).toContain('Unknown Title');
      expect(result).toContain('Document without metadata');
    });
  });

  describe('Performance and Observability', () => {
    it('should track analytics events for successful searches', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await searchAndRetrieveKnowledgeBase.func({
        query: 'performance test',
        match_count: 2,
        filter: { type: 'test' },
      });

      // Should track initial usage
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'searchInternalKnowledgeBase',
          query: 'performance test',
          matchCount: 2,
          hasFilter: true,
        }),
      });

      // Should track successful completion
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'searchInternalKnowledgeBase',
          success: true,
          resultsCount: 1,
          topSimilarity: 0.85,
        }),
      });
    });

    it('should track analytics events for errors', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Test error' },
      });

      await searchAndRetrieveKnowledgeBase.func({
        query: 'error test',
      });

      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'searchInternalKnowledgeBase',
          success: false,
          error: 'RPC error: Test error',
        }),
      });
    });

    it('should measure and report execution duration', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await searchAndRetrieveKnowledgeBase.func({
        query: 'duration test',
      });

      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          duration: expect.any(Number),
        }),
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex queries with special characters', async () => {
      const complexQuery = 'How to handle "quotes" and special chars: @#$%?';

      await searchAndRetrieveKnowledgeBase.func({
        query: complexQuery,
      });

      expect(mockEmbedQuery).toHaveBeenCalledWith(complexQuery);
    });

    it('should handle large content documents', async () => {
      const largeContent = 'A'.repeat(10000); // 10KB content
      mockSupabaseRpc.mockResolvedValue({
        data: [
          {
            content: largeContent,
            similarity: 0.9,
            metadata: { file_title: 'Large Document.md' },
          },
        ],
        error: null,
      });

      const result = await searchAndRetrieveKnowledgeBase.func({
        query: 'large document test',
      });

      expect(result).toContain(largeContent);
      expect(result.length).toBeGreaterThan(10000);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          searchAndRetrieveKnowledgeBase.func({
            query: `concurrent test ${i}`,
          }),
        );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toContain('Successfully retrieved document');
      });

      expect(mockEmbedQuery).toHaveBeenCalledTimes(5);
      expect(mockSupabaseRpc).toHaveBeenCalledTimes(5);
    });
  });
});
