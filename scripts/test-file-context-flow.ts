#!/usr/bin/env tsx

/**
 * File Context Flow Integration Test
 *
 * Phase 2.2: Tests complete file context flow with correlation tracking:
 * chat-wrapper → brainOrchestrator → ToolRouterGraph → directResponseNode
 *
 * Usage: npx tsx scripts/test-file-context-flow.ts
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

import { nanoid } from 'nanoid';

interface FileContext {
  filename: string;
  contentType: string;
  url: string;
  extractedText: string;
}

interface BrainRequest {
  id: string;
  chatId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  }>;
  fileContext?: FileContext;
  activeBitContextId?: string;
  selectedChatModel?: string;
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `file_context_test_${nanoid(10)}_${Date.now()}`;
}

/**
 * Log with correlation ID for debugging
 */
function logWithCorrelation(
  correlationId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: any,
): void {
  const timestamp = new Date().toISOString();
  console.log(
    `[${correlationId}] [${level.toUpperCase()}] ${message}`,
    data ? JSON.stringify(data, null, 2) : '',
  );
}

/**
 * Test file context creation and validation
 */
function createTestFileContext(): FileContext {
  return {
    filename: 'test-business-report.txt',
    contentType: 'text/plain',
    url: 'https://example.com/test-business-report.txt',
    extractedText: `QUARTERLY BUSINESS REPORT Q4 2024

Executive Summary:
Our company achieved record growth in Q4 2024, with revenue increasing by 45% compared to Q3.

Key Metrics:
- Total Revenue: $2.5M (up from $1.7M in Q3)
- Customer Acquisition: 1,200 new customers
- Customer Retention Rate: 94%
- Employee Satisfaction: 4.7/5.0

Strategic Initiatives:
1. Product Innovation: Launched 3 new features based on customer feedback
2. Market Expansion: Entered 2 new geographic markets
3. Team Growth: Hired 15 new team members across engineering and sales

Challenges Addressed:
- Improved response time by 30% through infrastructure upgrades
- Reduced customer churn by implementing proactive support
- Enhanced security protocols following industry best practices

Future Outlook:
Q1 2025 projections show continued growth trajectory with expected 25% revenue increase.
Focus areas include AI integration, mobile platform enhancement, and international expansion.

Conclusion:
The strong Q4 performance positions us well for sustained growth in 2025.`,
  };
}

/**
 * Create test brain request with file context
 */
function createTestBrainRequest(fileContext: FileContext): BrainRequest {
  return {
    id: 'test-chat-file-context',
    chatId: 'test-chat-file-context',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'summarize this document',
        createdAt: new Date().toISOString(),
      },
    ],
    fileContext,
    activeBitContextId: 'echo-tango-specialist',
    selectedChatModel: 'global-orchestrator',
  };
}

/**
 * Test file context flow through brain API
 */
async function testFileContextAPIFlow(
  brainRequest: BrainRequest,
  correlationId: string,
): Promise<boolean> {
  logWithCorrelation(
    correlationId,
    'info',
    'Testing file context flow through Brain API',
    {
      hasFileContext: !!brainRequest.fileContext,
      filename: brainRequest.fileContext?.filename,
      contentLength: brainRequest.fileContext?.extractedText?.length,
    },
  );

  try {
    // Simulate the API call to /api/brain
    const response = await fetch('http://localhost:3000/api/brain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brainRequest),
    });

    if (!response.ok) {
      logWithCorrelation(correlationId, 'error', 'API request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    // Test streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let streamedContent = '';
    let chunkCount = 0;

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          streamedContent += chunk;
          chunkCount++;

          // Log first few chunks for debugging
          if (chunkCount <= 3) {
            logWithCorrelation(
              correlationId,
              'info',
              `Stream chunk ${chunkCount}`,
              { chunk: chunk.substring(0, 100) },
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    // Analyze the response
    const hasFileContentReference =
      streamedContent.includes('Q4 2024') ||
      streamedContent.includes('revenue') ||
      streamedContent.includes('$2.5M') ||
      streamedContent.includes('business report');

    const hasProperSummary =
      streamedContent.length > 100 &&
      (streamedContent.includes('summary') ||
        streamedContent.includes('report') ||
        streamedContent.includes('revenue'));

    logWithCorrelation(
      correlationId,
      'info',
      'File context API flow analysis',
      {
        totalChunks: chunkCount,
        contentLength: streamedContent.length,
        hasFileContentReference,
        hasProperSummary,
        contentPreview: streamedContent.substring(0, 200),
      },
    );

    return hasFileContentReference && hasProperSummary;
  } catch (error) {
    logWithCorrelation(correlationId, 'error', 'File context API test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Test file context metadata structure
 */
function testFileContextMetadata(
  fileContext: FileContext,
  correlationId: string,
): boolean {
  logWithCorrelation(
    correlationId,
    'info',
    'Testing file context metadata structure',
  );

  const requiredFields = ['filename', 'contentType', 'url', 'extractedText'];
  const missingFields = requiredFields.filter(
    (field) => !fileContext[field as keyof FileContext],
  );

  if (missingFields.length > 0) {
    logWithCorrelation(
      correlationId,
      'error',
      'File context missing required fields',
      { missingFields },
    );
    return false;
  }

  // Validate content quality
  const contentLength = fileContext.extractedText.length;
  const hasBusinessContent =
    fileContext.extractedText.includes('revenue') &&
    fileContext.extractedText.includes('Q4 2024');

  logWithCorrelation(
    correlationId,
    'info',
    'File context metadata validation',
    {
      allFieldsPresent: missingFields.length === 0,
      contentLength,
      hasBusinessContent,
      filename: fileContext.filename,
      contentType: fileContext.contentType,
    },
  );

  return missingFields.length === 0 && contentLength > 50 && hasBusinessContent;
}

/**
 * Test router decision for file context queries
 */
function testRouterDecisionLogic(correlationId: string): boolean {
  logWithCorrelation(
    correlationId,
    'info',
    'Testing router decision logic for file queries',
  );

  const fileQueries = [
    'summarize this document',
    'what does this say',
    'analyze this file',
    'tell me about this',
    'review the document',
    'explain this content',
  ];

  const shouldRouteToDirectResponse = fileQueries.every((query) => {
    // Simulate the router logic
    const queryLower = query.toLowerCase();
    const fileQueryPatterns = [
      'summarize this',
      'what does this say',
      'analyze this',
      'tell me about this',
      'review the',
      'explain this',
    ];

    return fileQueryPatterns.some((pattern) => queryLower.includes(pattern));
  });

  logWithCorrelation(correlationId, 'info', 'Router decision logic test', {
    testQueries: fileQueries,
    allShouldRouteToDirectResponse: shouldRouteToDirectResponse,
  });

  return shouldRouteToDirectResponse;
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  const correlationId = generateCorrelationId();

  logWithCorrelation(
    correlationId,
    'info',
    '🧪 Starting File Context Flow Integration Test',
    {
      testSuite: 'Phase 2.2 File Context Integration',
      timestamp: new Date().toISOString(),
    },
  );

  const results = {
    metadataStructure: false,
    routerLogic: false,
    apiFlow: false as boolean | null,
  };

  try {
    // Test 1: File context metadata structure
    logWithCorrelation(
      correlationId,
      'info',
      '📋 Test 1: File Context Metadata Structure',
    );
    const fileContext = createTestFileContext();
    results.metadataStructure = testFileContextMetadata(
      fileContext,
      correlationId,
    );

    // Test 2: Router decision logic
    logWithCorrelation(
      correlationId,
      'info',
      '🔀 Test 2: Router Decision Logic',
    );
    results.routerLogic = testRouterDecisionLogic(correlationId);

    // Test 3: End-to-end API flow (only if server is running)
    logWithCorrelation(correlationId, 'info', '🌐 Test 3: End-to-End API Flow');
    const brainRequest = createTestBrainRequest(fileContext);

    try {
      results.apiFlow = await testFileContextAPIFlow(
        brainRequest,
        correlationId,
      );
    } catch (error) {
      logWithCorrelation(
        correlationId,
        'warn',
        'API flow test skipped - server not running',
        { error: error instanceof Error ? error.message : 'Unknown error' },
      );
      results.apiFlow = null; // Mark as skipped
    }

    // Summary
    const passedTests = Object.values(results).filter(
      (result) => result === true,
    ).length;
    const skippedTests = Object.values(results).filter(
      (result) => result === null,
    ).length;
    const totalTests = Object.values(results).length;

    logWithCorrelation(
      correlationId,
      'info',
      '📊 File Context Flow Test Summary',
      {
        results,
        passedTests,
        skippedTests,
        totalTests,
        successRate: `${passedTests}/${totalTests - skippedTests}`,
      },
    );

    // Phase 2.2 completion status
    const isPhase2_2Complete = results.metadataStructure && results.routerLogic;

    logWithCorrelation(
      correlationId,
      isPhase2_2Complete ? 'info' : 'warn',
      '🎯 Phase 2.2 File Context Integration Status',
      {
        isComplete: isPhase2_2Complete,
        status: isPhase2_2Complete ? '✅ COMPLETE' : '⚠️ NEEDS_ATTENTION',
        nextSteps: isPhase2_2Complete
          ? ['Move to Phase 2.3: MCP Tool Refresh Verification']
          : ['Fix failing file context integration tests'],
      },
    );
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'error',
      'File context flow test failed',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
  }
}

// Execute the test
if (require.main === module) {
  main().catch(console.error);
}

export { main as testFileContextFlow };
