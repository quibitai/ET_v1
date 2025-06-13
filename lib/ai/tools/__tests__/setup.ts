/**
 * Test Setup for AI Tools
 *
 * This file contains common test setup and mocks used across tool tests.
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';

// Mock observability service
vi.mock('@/lib/services/observabilityService', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  ANALYTICS_EVENTS: {
    TOOL_USED: 'tool_used',
  },
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(),
      order: vi.fn(),
      eq: vi.fn(),
      ilike: vi.fn(),
      limit: vi.fn(),
    })),
  })),
}));
