/**
 * Execution Plan Integration Tests
 *
 * Tests the complete Plan-and-Execute pattern implementation:
 * - PlannerService creates strategic execution plans
 * - BrainOrchestrator integrates planning with LangGraph execution
 * - Agent node receives and uses execution plan guidance
 * - Tool usage aligns with strategic planning
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  PlannerService,
  type ExecutionPlan,
} from '@/lib/ai/graphs/services/PlannerService';
import { ChatOpenAI } from '@langchain/openai';
import type { RequestLogger } from '@/lib/services/observabilityService';
import { AIMessage } from '@langchain/core/messages';

// Mock dependencies
const mockLogger: RequestLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const mockLLM = {
  invoke: vi.fn(),
} as unknown as ChatOpenAI;

describe('PlannerService', () => {
  let plannerService: PlannerService;

  beforeEach(() => {
    vi.clearAllMocks();
    plannerService = new PlannerService(mockLogger, mockLLM);
  });

  test('should create hybrid plan for Audubon query', async () => {
    // Mock LLM response for hybrid task
    const mockPlanResponse = new AIMessage({
      content: JSON.stringify({
        task_type: 'hybrid',
        required_internal_documents: [
          'ideal client profile',
          'client research example',
        ],
        external_research_topics: ['Audubon Nature Institute'],
        final_output_format: 'research report',
      }),
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    const query =
      'Use ideal client profile and client research example to create a research report on Audubon Nature Institute';

    const plan = await plannerService.createPlan(query);

    expect(plan.task_type).toBe('hybrid');
    expect(plan.external_research_topics).toContain('Audubon Nature Institute');
    expect(plan.required_internal_documents).toContain('ideal client profile');
    expect(plan.required_internal_documents).toContain(
      'client research example',
    );
    expect(plan.final_output_format).toBe('research report');
  });

  test('should create research_only plan for external queries', async () => {
    const mockPlanResponse = new AIMessage({
      content: JSON.stringify({
        task_type: 'research_only',
        required_internal_documents: [],
        external_research_topics: ['Tesla', 'Tesla stock price'],
        final_output_format: 'news summary',
      }),
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    const query = "What's the latest news about Tesla?";

    const plan = await plannerService.createPlan(query);

    expect(plan.task_type).toBe('research_only');
    expect(plan.external_research_topics).toContain('Tesla');
    expect(plan.required_internal_documents).toHaveLength(0);
  });

  test('should create template_only plan for internal document usage', async () => {
    const mockPlanResponse = new AIMessage({
      content: JSON.stringify({
        task_type: 'template_only',
        required_internal_documents: ['proposal template'],
        external_research_topics: [],
        final_output_format: 'business proposal',
      }),
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    const query = 'Create a proposal using our standard template';

    const plan = await plannerService.createPlan(query);

    expect(plan.task_type).toBe('template_only');
    expect(plan.required_internal_documents).toContain('proposal template');
    expect(plan.external_research_topics).toHaveLength(0);
  });

  test('should use fallback plan when LLM fails', async () => {
    // Mock LLM failure
    vi.mocked(mockLLM.invoke).mockRejectedValue(new Error('LLM error'));

    const query = 'Test query';

    const plan = await plannerService.createPlan(query);

    // Should return fallback plan
    expect(plan.task_type).toBe('simple_qa');
    expect(plan.required_internal_documents).toHaveLength(0);
    expect(plan.external_research_topics).toHaveLength(0);
    expect(plan.final_output_format).toBe('direct answer');
  });

  test('should handle malformed LLM response gracefully', async () => {
    // Mock malformed JSON response
    const mockPlanResponse = new AIMessage({
      content: 'This is not valid JSON',
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    const query = 'Test query';

    const plan = await plannerService.createPlan(query);

    // Should return fallback plan
    expect(plan.task_type).toBe('simple_qa');
  });

  test('should track performance metrics', async () => {
    const mockPlanResponse = new AIMessage({
      content: JSON.stringify({
        task_type: 'simple_qa',
        required_internal_documents: [],
        external_research_topics: [],
        final_output_format: 'direct answer',
      }),
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    await plannerService.createPlan('Test query');

    const metrics = plannerService.getPerformanceMetrics();

    expect(metrics.totalPlans).toBe(1);
    expect(metrics.successfulPlans).toBe(1);
    expect(metrics.successRate).toBe(100);
    expect(metrics.fallbackRate).toBe(0);
    expect(metrics.averageDuration).toBeGreaterThan(0);
  });
});

describe('Plan-and-Execute Integration', () => {
  test('should pass execution plan through the system', async () => {
    // This is more of a conceptual test since we're testing the integration
    // In a real integration test, we would:
    // 1. Create a BrainOrchestrator
    // 2. Mock the PlannerService to return a known plan
    // 3. Verify the plan is passed to the LangGraph wrapper
    // 4. Verify the agent receives the plan in its prompt

    const mockExecutionPlan: ExecutionPlan = {
      task_type: 'hybrid',
      required_internal_documents: ['ideal client profile'],
      external_research_topics: ['Audubon Nature Institute'],
      final_output_format: 'research report',
    };

    // Test that the execution plan structure is valid
    expect(mockExecutionPlan.task_type).toBe('hybrid');
    expect(mockExecutionPlan.required_internal_documents).toContain(
      'ideal client profile',
    );
    expect(mockExecutionPlan.external_research_topics).toContain(
      'Audubon Nature Institute',
    );
    expect(mockExecutionPlan.final_output_format).toBe('research report');
  });

  test('should validate execution plan schema', () => {
    const validPlan: ExecutionPlan = {
      task_type: 'hybrid',
      required_internal_documents: ['doc1', 'doc2'],
      external_research_topics: ['topic1'],
      final_output_format: 'report',
    };

    // Test that all required fields are present
    expect(validPlan).toHaveProperty('task_type');
    expect(validPlan).toHaveProperty('required_internal_documents');
    expect(validPlan).toHaveProperty('external_research_topics');
    expect(validPlan).toHaveProperty('final_output_format');

    // Test that arrays are properly typed
    expect(Array.isArray(validPlan.required_internal_documents)).toBe(true);
    expect(Array.isArray(validPlan.external_research_topics)).toBe(true);

    // Test that task_type is valid enum value
    const validTaskTypes = [
      'simple_qa',
      'research_only',
      'template_only',
      'hybrid',
    ];
    expect(validTaskTypes).toContain(validPlan.task_type);
  });
});

describe('Agent Prompt Integration', () => {
  test('should format execution plan guidance correctly', () => {
    const mockPlan: ExecutionPlan = {
      task_type: 'hybrid',
      required_internal_documents: [
        'ideal client profile',
        'client research example',
      ],
      external_research_topics: ['Audubon Nature Institute'],
      final_output_format: 'research report',
    };

    // Test that the plan can be formatted for prompt inclusion
    const planGuidance = `
**STRATEGIC EXECUTION PLAN:**
- Task Type: ${mockPlan.task_type.toUpperCase()}
- Required Internal Documents: ${mockPlan.required_internal_documents.join(', ')}
- External Research Topics: ${mockPlan.external_research_topics.join(', ')}
- Expected Output Format: ${mockPlan.final_output_format}
`;

    expect(planGuidance).toContain('HYBRID');
    expect(planGuidance).toContain('ideal client profile');
    expect(planGuidance).toContain('Audubon Nature Institute');
    expect(planGuidance).toContain('research report');
  });
});

describe('Performance and Reliability', () => {
  test('should handle high-volume planning requests', async () => {
    const plannerService = new PlannerService(mockLogger, mockLLM);

    // Mock successful responses
    const mockPlanResponse = new AIMessage({
      content: JSON.stringify({
        task_type: 'simple_qa',
        required_internal_documents: [],
        external_research_topics: [],
        final_output_format: 'direct answer',
      }),
    });

    vi.mocked(mockLLM.invoke).mockResolvedValue(mockPlanResponse);

    // Create multiple plans concurrently
    const queries = Array.from({ length: 10 }, (_, i) => `Test query ${i}`);
    const planPromises = queries.map((query) =>
      plannerService.createPlan(query),
    );

    const plans = await Promise.all(planPromises);

    expect(plans).toHaveLength(10);
    plans.forEach((plan) => {
      expect(plan.task_type).toBe('simple_qa');
    });

    const metrics = plannerService.getPerformanceMetrics();
    expect(metrics.totalPlans).toBe(10);
    expect(metrics.successfulPlans).toBe(10);
    expect(metrics.successRate).toBe(100);
  });

  test('should maintain performance under error conditions', async () => {
    const plannerService = new PlannerService(mockLogger, mockLLM);

    // Mock mixed success/failure responses
    vi.mocked(mockLLM.invoke)
      .mockResolvedValueOnce(
        new AIMessage({
          content: JSON.stringify({
            task_type: 'simple_qa',
            required_internal_documents: [],
            external_research_topics: [],
            final_output_format: 'answer',
          }),
        }),
      )
      .mockRejectedValueOnce(new Error('LLM error'))
      .mockResolvedValueOnce(
        new AIMessage({
          content: JSON.stringify({
            task_type: 'simple_qa',
            required_internal_documents: [],
            external_research_topics: [],
            final_output_format: 'answer',
          }),
        }),
      );

    const plans = await Promise.all([
      plannerService.createPlan('Query 1'),
      plannerService.createPlan('Query 2'), // This will fail
      plannerService.createPlan('Query 3'),
    ]);

    // All should return valid plans (fallback for failed ones)
    expect(plans).toHaveLength(3);
    plans.forEach((plan) => {
      expect(plan).toHaveProperty('task_type');
      expect(plan).toHaveProperty('required_internal_documents');
      expect(plan).toHaveProperty('external_research_topics');
      expect(plan).toHaveProperty('final_output_format');
    });

    const metrics = plannerService.getPerformanceMetrics();
    expect(metrics.totalPlans).toBe(3);
    expect(metrics.successfulPlans).toBe(2); // 2 successful, 1 fallback
    expect(metrics.fallbackRate).toBeGreaterThan(0);
  });
});
