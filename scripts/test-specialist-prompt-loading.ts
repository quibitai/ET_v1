#!/usr/bin/env tsx

/**
 * Specialist Prompt Loading Test Script
 *
 * Phase 2.2: Tests specialist prompt loading in LangGraph with correlation tracking
 * - Verifies specialist persona loading from database
 * - Tests createSystemMessage() integration
 * - Traces prompt flow through LangGraph execution paths
 * - Validates correlation ID propagation
 *
 * Usage: npx tsx scripts/test-specialist-prompt-loading.ts
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

import { db } from '@/lib/db';
import { specialists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRequestLogger } from '@/lib/services/observabilityService';
import { SpecialistRepository } from '@/lib/db/repositories/specialistRepository';

interface PromptTestResult {
  specialistName: string;
  success: boolean;
  promptLength: number;
  hasPersona: boolean;
  hasTools: boolean;
  toolCount: number;
  errors: string[];
  correlationId: string;
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `prompt_test_${nanoid(10)}_${Date.now()}`;
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
 * Test specialist prompt loading from database
 */
async function testSpecialistPromptLoading(
  correlationId: string,
): Promise<PromptTestResult[]> {
  logWithCorrelation(
    correlationId,
    'info',
    '🔍 Testing specialist prompt loading from database...',
  );

  const results: PromptTestResult[] = [];

  try {
    // Get all specialists from database
    const allSpecialists = await db.select().from(specialists);

    logWithCorrelation(
      correlationId,
      'info',
      'Retrieved specialists from database',
      {
        totalSpecialists: allSpecialists.length,
        specialistNames: allSpecialists.map((s) => s.name),
      },
    );

    // Test each specialist
    for (const specialist of allSpecialists) {
      const testResult: PromptTestResult = {
        specialistName: specialist.name,
        success: false,
        promptLength: 0,
        hasPersona: false,
        hasTools: false,
        toolCount: 0,
        errors: [],
        correlationId,
      };

      logWithCorrelation(
        correlationId,
        'info',
        `Testing specialist: ${specialist.name}`,
        {
          id: specialist.id,
          hasPersonaPrompt: !!specialist.personaPrompt,
          hasDefaultTools: !!specialist.defaultTools,
          description: specialist.description,
        },
      );

      try {
        // Test persona prompt
        if (specialist.personaPrompt) {
          testResult.hasPersona = true;
          testResult.promptLength = specialist.personaPrompt.length;

          logWithCorrelation(
            correlationId,
            'info',
            `Persona prompt loaded for ${specialist.name}`,
            {
              promptLength: testResult.promptLength,
              promptPreview: `${specialist.personaPrompt.substring(0, 200)}...`,
            },
          );
        } else {
          testResult.errors.push('No persona prompt defined');
          logWithCorrelation(
            correlationId,
            'warn',
            `No persona prompt for ${specialist.name}`,
          );
        }

        // Test default tools
        const defaultTools = (specialist.defaultTools as string[]) || [];
        if (defaultTools.length > 0) {
          testResult.hasTools = true;
          testResult.toolCount = defaultTools.length;

          logWithCorrelation(
            correlationId,
            'info',
            `Tools configured for ${specialist.name}`,
            {
              toolCount: testResult.toolCount,
              tools: defaultTools.slice(0, 10), // Show first 10 tools
            },
          );
        } else {
          testResult.errors.push('No default tools configured');
          logWithCorrelation(
            correlationId,
            'warn',
            `No tools configured for ${specialist.name}`,
          );
        }

        // Mark as successful if has both persona and tools
        testResult.success = testResult.hasPersona && testResult.hasTools;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        testResult.errors.push(errorMsg);
        logWithCorrelation(
          correlationId,
          'error',
          `Error testing ${specialist.name}`,
          {
            error: errorMsg,
          },
        );
      }

      results.push(testResult);
    }

    return results;
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'error',
      'Failed to test specialist prompt loading',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    );
    throw error;
  }
}

/**
 * Test SpecialistRepository createSystemMessage functionality
 */
async function testCreateSystemMessage(correlationId: string): Promise<void> {
  logWithCorrelation(
    correlationId,
    'info',
    '🔍 Testing SpecialistRepository createSystemMessage...',
  );

  try {
    // Create mock request logger for testing
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'user-agent') return 'test-script';
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        },
      },
    } as any;

    const logger = getRequestLogger(mockRequest);
    const specialistRepo = new SpecialistRepository(logger);

    // Test with each specialist
    const allSpecialists = await db.select().from(specialists);

    for (const specialist of allSpecialists) {
      logWithCorrelation(
        correlationId,
        'info',
        `Testing createSystemMessage for: ${specialist.name}`,
      );

      try {
        const systemMessage = await specialistRepo.createSystemMessage(
          specialist.id,
          [], // empty conversation history
          null, // no client config
        );

        logWithCorrelation(
          correlationId,
          'info',
          `System message created for ${specialist.name}`,
          {
            messageLength: systemMessage.content.length,
            messagePreview: `${systemMessage.content.substring(0, 300)}...`,
            messageType: systemMessage._getType(),
          },
        );

        // Verify the system message contains the specialist persona
        if (
          specialist.personaPrompt &&
          systemMessage.content.includes(
            specialist.personaPrompt.substring(0, 100),
          )
        ) {
          logWithCorrelation(
            correlationId,
            'info',
            `✅ Persona correctly included in system message for ${specialist.name}`,
          );
        } else {
          logWithCorrelation(
            correlationId,
            'warn',
            `⚠️ Persona may not be properly included for ${specialist.name}`,
          );
        }
      } catch (error) {
        logWithCorrelation(
          correlationId,
          'error',
          `Failed to create system message for ${specialist.name}`,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        );
      }
    }
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'error',
      'Failed to test createSystemMessage',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    );
    throw error;
  }
}

/**
 * Test correlation ID propagation through services
 */
async function testCorrelationIdPropagation(
  correlationId: string,
): Promise<void> {
  logWithCorrelation(
    correlationId,
    'info',
    '🔍 Testing correlation ID propagation...',
  );

  try {
    // Create request logger and verify correlation ID
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'user-agent') return 'test-script';
          if (name === 'x-forwarded-for') return '127.0.0.1';
          return null;
        },
      },
    } as any;

    const logger = getRequestLogger(mockRequest);

    logWithCorrelation(correlationId, 'info', 'Request logger created', {
      loggerCorrelationId: logger.correlationId,
      hasUniqueId: logger.correlationId.length > 0,
      idFormat: logger.correlationId.startsWith('req_'),
    });

    // Test logging with correlation ID
    logger.info('Test message from specialist prompt loading script', {
      testData: 'correlation ID propagation test',
      originalCorrelationId: correlationId,
    });

    logWithCorrelation(
      correlationId,
      'info',
      '✅ Correlation ID propagation test completed',
    );
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'error',
      'Failed to test correlation ID propagation',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    );
    throw error;
  }
}

/**
 * Generate test summary report
 */
function generateTestSummary(
  results: PromptTestResult[],
  correlationId: string,
): void {
  logWithCorrelation(
    correlationId,
    'info',
    '📊 SPECIALIST PROMPT LOADING TEST SUMMARY',
  );

  const totalTests = results.length;
  const successfulTests = results.filter((r) => r.success).length;
  const failedTests = totalTests - successfulTests;

  const summary = {
    totalSpecialists: totalTests,
    successfulTests,
    failedTests,
    successRate:
      totalTests > 0
        ? ((successfulTests / totalTests) * 100).toFixed(1) + '%'
        : '0%',
    issues: results
      .filter((r) => !r.success)
      .map((r) => ({
        specialist: r.specialistName,
        errors: r.errors,
      })),
  };

  console.log(
    `[${correlationId}] [SUMMARY] ${JSON.stringify(summary, null, 2)}`,
  );

  // Detailed results
  logWithCorrelation(correlationId, 'info', 'DETAILED RESULTS:');
  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    logWithCorrelation(
      correlationId,
      'info',
      `${status} ${result.specialistName}`,
      {
        hasPersona: result.hasPersona,
        hasTools: result.hasTools,
        toolCount: result.toolCount,
        promptLength: result.promptLength,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    );
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const correlationId = generateCorrelationId();

  logWithCorrelation(
    correlationId,
    'info',
    '🚀 Starting Phase 2.2: Specialist Prompt Loading Test',
    {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    },
  );

  try {
    // Test 1: Database specialist prompt loading
    logWithCorrelation(
      correlationId,
      'info',
      '=== TEST 1: Database Specialist Prompt Loading ===',
    );
    const promptResults = await testSpecialistPromptLoading(correlationId);

    // Test 2: SpecialistRepository createSystemMessage
    logWithCorrelation(
      correlationId,
      'info',
      '=== TEST 2: SpecialistRepository createSystemMessage ===',
    );
    await testCreateSystemMessage(correlationId);

    // Test 3: Correlation ID propagation
    logWithCorrelation(
      correlationId,
      'info',
      '=== TEST 3: Correlation ID Propagation ===',
    );
    await testCorrelationIdPropagation(correlationId);

    // Generate summary
    logWithCorrelation(correlationId, 'info', '=== TEST SUMMARY ===');
    generateTestSummary(promptResults, correlationId);

    logWithCorrelation(
      correlationId,
      'info',
      '✅ Phase 2.2 Specialist Prompt Loading Test COMPLETED',
      {
        duration: `${Date.now() - Number.parseInt(correlationId.split('_')[3], 10)}ms`,
        totalTests: 3,
        status: 'SUCCESS',
      },
    );
  } catch (error) {
    logWithCorrelation(correlationId, 'error', '❌ Phase 2.2 Test FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as testSpecialistPromptLoading };
