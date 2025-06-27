/**
 * List Documents Tool Tests
 * Phase 1, Test 2 of Systematic Tool Testing Plan
 *
 * Testing Focus:
 * - Document metadata retrieval
 * - Filter functionality
 * - Error handling
 * - Performance metrics
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
import { listDocumentsTool } from '@/lib/ai/tools/list-documents';
import { StandardizedResponseFormatter } from '@/lib/ai/services/StandardizedResponseFormatter';

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
};

// Mock observability service
vi.mock('@/lib/services/observabilityService', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  ANALYTICS_EVENTS: {
    TOOL_USED: 'tool_used',
  },
}));

// Initialize mock functions
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: [
              {
                id: 'doc1',
                title: 'Test Document 1',
                url: 'https://example.com/doc1',
                created_at: '2024-01-01T00:00:00Z',
                schema: 'markdown',
              },
              {
                id: 'doc2',
                title: 'Test Document 2',
                url: 'https://example.com/doc2',
                created_at: '2024-01-02T00:00:00Z',
                schema: 'pdf',
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

describe('List Documents Tool Tests', () => {
  beforeAll(() => {
    // Set environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockSelect.mockReturnValue({
      order: mockOrder.mockReturnValue({
        eq: mockEq.mockReturnValue({
          data: [
            {
              id: 'doc1',
              title: 'Test Document 1',
              url: 'https://example.com/doc1',
              created_at: '2024-01-01T00:00:00Z',
              schema: 'markdown',
            },
            {
              id: 'doc2',
              title: 'Test Document 2',
              url: 'https://example.com/doc2',
              created_at: '2024-01-02T00:00:00Z',
              schema: 'pdf',
            },
          ],
          error: null,
        }),
      }),
    });
  });

  afterAll(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach((key) => {
      process.env[key] = '';
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(listDocumentsTool.name).toBe('listDocuments');
    });

    it('should have descriptive description', () => {
      expect(listDocumentsTool.description).toContain(
        'Lists all available documents',
      );
      expect(listDocumentsTool.description).toContain('knowledge base');
    });

    it('should have proper schema validation', () => {
      const schema = listDocumentsTool.schema;
      expect(schema).toBeDefined();

      // Test schema parsing with valid input
      const validInput = {
        filter: { schema: 'markdown' },
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });
  });

  describe('Basic Functionality', () => {
    it('should successfully list documents without filter', async () => {
      const result = await listDocumentsTool.func({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.available_documents).toHaveLength(2);
      expect(parsedResult.total_count).toBe(2);

      // Verify document structure
      const doc = parsedResult.available_documents[0];
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('title');
      expect(doc).toHaveProperty('url');
      expect(doc).toHaveProperty('created_at');
      expect(doc).toHaveProperty('schema');
    });

    it('should apply filters correctly', async () => {
      const filter = { schema: 'markdown' };

      await listDocumentsTool.func({ filter });

      expect(mockSelect).toHaveBeenCalledWith(
        'id, title, url, created_at, schema',
      );
      expect(mockOrder).toHaveBeenCalledWith('title');
      expect(mockEq).toHaveBeenCalledWith('schema', 'markdown');
    });

    it('should handle empty results', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await listDocumentsTool.func({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain('No documents found');
      expect(parsedResult.available_documents).toHaveLength(0);
      expect(parsedResult.total_count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: null,
            error: {
              message: 'Database connection failed',
              code: 'PGRST000',
              details: 'Connection timeout',
            },
          }),
        }),
      });

      const result = await listDocumentsTool.func({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('Failed to fetch documents');
      expect(parsedResult.metadata.errorType).toBe('database_error');
    });

    it('should handle missing environment variables', async () => {
      // Temporarily remove env vars
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';

      const result = await listDocumentsTool.func({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        'Supabase credentials are not configured',
      );

      // Restore env vars
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });

    it('should handle invalid filter values', async () => {
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: null,
            error: {
              message: 'Invalid input syntax',
              code: '22P02',
            },
          }),
        }),
      });

      const result = await listDocumentsTool.func({
        filter: { invalid_column: 'value' },
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('Failed to fetch documents');
      expect(parsedResult.metadata.code).toBe('22P02');
    });
  });

  describe('Performance and Observability', () => {
    it('should track analytics events for successful queries', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await listDocumentsTool.func({
        filter: { schema: 'markdown' },
      });

      // Should track initial usage
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'listDocuments',
          hasFilter: true,
        }),
      });

      // Should track successful completion
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'listDocuments',
          success: true,
          documentCount: 2,
        }),
      });
    });

    it('should track analytics events for errors', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );
      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: null,
            error: { message: 'Test error' },
          }),
        }),
      });

      await listDocumentsTool.func({});

      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'listDocuments',
          success: false,
          error: expect.stringContaining('Test error'),
        }),
      });
    });

    it('should measure and report execution duration', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await listDocumentsTool.func({});

      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          duration: expect.any(Number),
        }),
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple filters', async () => {
      const filter = {
        schema: 'markdown',
        url: 'https://example.com',
      };

      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockImplementation((key, value) => ({
            eq: mockEq,
            data: [
              {
                id: 'doc1',
                title: 'Test Document 1',
                url: 'https://example.com',
                created_at: '2024-01-01T00:00:00Z',
                schema: 'markdown',
              },
            ],
            error: null,
          })),
        }),
      });

      await listDocumentsTool.func({ filter });

      expect(mockSelect).toHaveBeenCalledWith(
        'id, title, url, created_at, schema',
      );
      expect(mockOrder).toHaveBeenCalledWith('title');
      expect(mockEq).toHaveBeenCalledWith('schema', 'markdown');
      expect(mockEq).toHaveBeenCalledWith('url', 'https://example.com');
    });

    it('should handle large result sets', async () => {
      // Create array of 100 documents
      const largeDataSet = Array.from({ length: 100 }, (_, i) => ({
        id: `doc${i}`,
        title: `Test Document ${i}`,
        url: `https://example.com/doc${i}`,
        created_at: new Date().toISOString(),
        schema: i % 2 === 0 ? 'markdown' : 'pdf',
      }));

      mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          eq: mockEq.mockReturnValue({
            data: largeDataSet,
            error: null,
          }),
        }),
      });

      const result = await listDocumentsTool.func({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.available_documents).toHaveLength(100);
      expect(parsedResult.total_count).toBe(100);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => listDocumentsTool.func({}));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        const parsedResult = JSON.parse(result);
        expect(parsedResult.success).toBe(true);
        expect(parsedResult.available_documents).toHaveLength(2);
      });

      expect(mockSelect).toHaveBeenCalledTimes(5);
      expect(mockOrder).toHaveBeenCalledTimes(5);
    });
  });

  describe('Response Formatting Integration', () => {
    it('should format as a clean list when responseType is list', () => {
      const toolResults = [
        {
          name: 'listDocuments',
          content: JSON.stringify({
            available_documents: [
              {
                id: 'doc1',
                title: 'Test Document 1',
                url: 'https://example.com/doc1',
                created_at: '2024-01-01T00:00:00Z',
                schema: 'markdown',
                clickable_link: '[Test Document 1](https://example.com/doc1)',
              },
              {
                id: 'doc2',
                title: 'Test Document 2',
                url: 'https://example.com/doc2',
                created_at: '2024-01-02T00:00:00Z',
                schema: 'pdf',
                clickable_link: '[Test Document 2](https://example.com/doc2)',
              },
            ],
            formatted_list:
              '- [Test Document 1](https://example.com/doc1)\n- [Test Document 2](https://example.com/doc2)',
          }),
          metadata: { responseType: 'list' },
        },
      ];
      const options: import(
        '@/lib/ai/services/StandardizedResponseFormatter'
      ).FormattingOptions = {
        contentType: 'document_list',
        userQuery: 'list documents',
      };
      const output = StandardizedResponseFormatter.formatToolResults(
        toolResults,
        options,
      );
      expect(output).toContain('- [Test Document 1](https://example.com/doc1)');
      expect(output).toContain('- [Test Document 2](https://example.com/doc2)');
      expect(output).not.toMatch(/Executive Summary|Overview|Recommendations/);
    });
  });
});
