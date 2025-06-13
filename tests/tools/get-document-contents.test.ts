/**
 * Get Document Contents Tool Tests
 * Phase 1, Test 3 of Systematic Tool Testing Plan
 *
 * Testing Focus:
 * - Document content retrieval
 * - Fuzzy title matching fallback
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
import { getDocumentContentsTool } from '@/lib/ai/tools/get-document-contents';

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
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockIlike = vi.fn();
const mockLimit = vi.fn();

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: () => ({
      select: mockSelect,
      ilike: mockIlike,
      limit: mockLimit,
    }),
  })),
}));

describe('Get Document Contents Tool Tests', () => {
  beforeAll(() => {
    // Set environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mock implementations
    mockRpc.mockResolvedValue({
      data: [{ document_text: 'Test document content' }],
      error: null,
    });

    mockSelect.mockReturnValue({
      ilike: mockIlike.mockReturnValue({
        limit: mockLimit.mockResolvedValue({
          data: [
            {
              id: 'doc1',
              title: 'Test Document',
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
      expect(getDocumentContentsTool.name).toBe('getDocumentContents');
    });

    it('should have descriptive description', () => {
      expect(getDocumentContentsTool.description).toContain(
        'Retrieves the full text content',
      );
      expect(getDocumentContentsTool.description).toContain('knowledge base');
    });

    it('should have proper schema validation', () => {
      const schema = getDocumentContentsTool.schema;
      expect(schema).toBeDefined();

      // Test schema parsing with valid input
      const validInput = {
        document_id: 'test-doc-id',
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });
  });

  describe('Basic Functionality', () => {
    it('should successfully retrieve document content by ID', async () => {
      const result = await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBe('Test document content');
      expect(parsedResult.metadata.content_length).toBe(20);
      expect(parsedResult.metadata.document_id).toBe('test-doc-id');
    });

    it('should fall back to title search when ID not found', async () => {
      // First RPC call fails (no content found)
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await getDocumentContentsTool.func({
        document_id: 'Test Document',
      });

      // Should attempt title search
      expect(mockSelect).toHaveBeenCalledWith('id, title');
      expect(mockIlike).toHaveBeenCalledWith('title', '%Test%Document%');
      expect(mockLimit).toHaveBeenCalledWith(1);

      // Should retry RPC with matched ID
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenLastCalledWith(
        'get_aggregated_document_content',
        { p_file_id: 'doc1' },
      );
    });

    it('should handle empty content gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('No content found');
      expect(parsedResult.metadata.reason).toBe('empty_content');
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: {
          message: 'RPC function error',
          code: 'P0001',
          details: 'Function execution failed',
        },
      });

      const result = await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('RPC function error');
      expect(parsedResult.metadata.errorType).toBe('rpc_error');
    });

    it('should handle title lookup errors', async () => {
      // First RPC call fails (no content)
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Title lookup fails
      mockSelect.mockReturnValue({
        ilike: mockIlike.mockReturnValue({
          limit: mockLimit.mockResolvedValue({
            data: null,
            error: {
              message: 'Database error',
              code: 'PGRST000',
            },
          }),
        }),
      });

      const result = await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        'Error looking up document by title',
      );
      expect(parsedResult.metadata.errorType).toBe('title_lookup_error');
    });

    it('should handle missing environment variables', async () => {
      // Temporarily remove env vars
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';

      const result = await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        'Supabase credentials are not configured',
      );

      // Restore env var
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });

    it('should handle document not found', async () => {
      // First RPC call fails (no content)
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Title lookup returns no results
      mockSelect.mockReturnValue({
        ilike: mockIlike.mockReturnValue({
          limit: mockLimit.mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await getDocumentContentsTool.func({
        document_id: 'nonexistent-doc',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('No document found matching');
      expect(parsedResult.metadata.reason).toBe('not_found');
    });
  });

  describe('Performance and Observability', () => {
    it('should track analytics events for successful queries', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });

      // Should track initial usage
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'getDocumentContents',
          documentId: 'test-doc-id',
        }),
      });

      // Should track successful completion
      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'getDocumentContents',
          success: true,
          contentLength: 20,
        }),
      });
    });

    it('should track analytics events for errors', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Test error' },
      });

      await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
      });

      expect(trackEvent).toHaveBeenCalledWith({
        eventName: 'tool_used',
        properties: expect.objectContaining({
          toolName: 'getDocumentContents',
          success: false,
          error: expect.stringContaining('Test error'),
        }),
      });
    });

    it('should measure and report execution duration', async () => {
      const { trackEvent } = await import(
        '@/lib/services/observabilityService'
      );

      await getDocumentContentsTool.func({
        document_id: 'test-doc-id',
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
    it('should handle large document content', async () => {
      const largeContent = 'A'.repeat(1000000); // 1MB of content
      mockRpc.mockResolvedValue({
        data: [{ document_text: largeContent }],
        error: null,
      });

      const result = await getDocumentContentsTool.func({
        document_id: 'large-doc',
      });
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBe(largeContent);
      expect(parsedResult.metadata.content_length).toBe(1000000);
    });

    it('should handle special characters in document titles', async () => {
      await getDocumentContentsTool.func({
        document_id: 'Test & Document (v2.0)',
      });

      expect(mockIlike).toHaveBeenCalledWith(
        'title',
        '%Test%&%Document%(v2.0)%',
      );
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          getDocumentContentsTool.func({
            document_id: `doc${i}`,
          }),
        );

      const results = await Promise.all(promises);

      results.forEach((result) => {
        const parsedResult = JSON.parse(result);
        expect(parsedResult.success).toBe(true);
        expect(parsedResult.content).toBe('Test document content');
      });

      expect(mockRpc).toHaveBeenCalledTimes(5);
    });
  });
});
