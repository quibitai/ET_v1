#!/usr/bin/env npx tsx

/**
 * Production Message Deduplication Test
 *
 * Tests the exact LangSmith trace scenario to verify our fixes prevent
 * the quadruple HUMAN message duplication issue in production.
 */

import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import {
  deduplicateMessages,
  cleanGraphState,
  getStatePerformanceMetrics,
} from '../lib/ai/graphs/state/StateValidator';

// Simulate the exact LangSmith trace scenario
const createLangSmithTraceState = () => {
  const duplicateMessage =
    "Search the web for LWCC in Baton Rouge and using the client research examples in the knowledge base, create a research report document on how they align with Echo Tango's Ideal Clients.";

  return {
    messages: [
      new HumanMessage(duplicateMessage),
      new HumanMessage(duplicateMessage),
      new HumanMessage(duplicateMessage),
      new HumanMessage(duplicateMessage), // 4 identical messages like in LangSmith
      new AIMessage(
        'searchInternalKnowledgeBase call_kjbKzr9zrPpJqL7I8tlFKZR4',
      ),
      new ToolMessage(
        'Found relevant documents...',
        'call_kjbKzr9zrPpJqL7I8tlFKZR4',
      ),
      new AIMessage('listDocuments call_de0wRfv8CQOz07Mt0L1XmUul'),
      new ToolMessage(
        'Document list retrieved...',
        'call_de0wRfv8CQOz07Mt0L1XmUul',
      ),
    ],
    metadata: {
      correlationId: 'test_production_1751244000000',
      brainRequest: { activeBitContextId: 'echo-tango-specialist' },
      processedContext: { selectedChatModel: 'gpt-4.1-mini' },
    },
  };
};

async function testProductionMessageFix() {
  console.log('🚀 Production Message Deduplication Test');
  console.log('==========================================\n');

  const correlationId = 'test_production_1751244000000';

  // Step 1: Create problematic state (like LangSmith trace)
  const problematicState = createLangSmithTraceState();

  console.log('📊 BEFORE: Problematic State Analysis');
  console.log('-------------------------------------');
  const beforeMetrics = getStatePerformanceMetrics(problematicState as any);
  console.log('Original state metrics:', {
    messageCount: beforeMetrics.messageCount,
    duplicateMessages: beforeMetrics.duplicateMessages,
    estimatedTokens: beforeMetrics.estimatedTokens,
    humanMessages: problematicState.messages.filter(
      (m) => m._getType() === 'human',
    ).length,
  });

  // Count specific duplicates
  const humanMessages = problematicState.messages.filter(
    (m) => m._getType() === 'human',
  );
  const uniqueContent = new Set(humanMessages.map((m) => m.content));
  console.log('Human message analysis:', {
    totalHumanMessages: humanMessages.length,
    uniqueContent: uniqueContent.size,
    duplicatesDetected: humanMessages.length - uniqueContent.size,
  });

  // Step 2: Apply our StateValidator fix
  console.log('\n🔧 APPLYING: StateValidator Fix');
  console.log('-------------------------------');
  const cleanedState = cleanGraphState(problematicState as any, correlationId);

  // Step 3: Analyze results
  console.log('\n📈 AFTER: Fixed State Analysis');
  console.log('------------------------------');
  const afterMetrics = getStatePerformanceMetrics(cleanedState);
  console.log('Cleaned state metrics:', {
    messageCount: afterMetrics.messageCount,
    duplicateMessages: afterMetrics.duplicateMessages,
    estimatedTokens: afterMetrics.estimatedTokens,
    humanMessages: cleanedState.messages.filter((m) => m._getType() === 'human')
      .length,
  });

  // Verify fix effectiveness
  const cleanedHumanMessages = cleanedState.messages.filter(
    (m) => m._getType() === 'human',
  );
  const cleanedUniqueContent = new Set(
    cleanedHumanMessages.map((m) => m.content),
  );

  console.log('Fixed human message analysis:', {
    totalHumanMessages: cleanedHumanMessages.length,
    uniqueContent: cleanedUniqueContent.size,
    duplicatesRemaining:
      cleanedHumanMessages.length - cleanedUniqueContent.size,
  });

  // Step 4: Calculate improvements
  console.log('\n📊 IMPROVEMENT ANALYSIS');
  console.log('----------------------');
  const messageReduction =
    beforeMetrics.messageCount - afterMetrics.messageCount;
  const tokenSavings =
    beforeMetrics.estimatedTokens - afterMetrics.estimatedTokens;
  const duplicateReduction =
    beforeMetrics.duplicateMessages - afterMetrics.duplicateMessages;
  const percentageReduction = (
    (tokenSavings / beforeMetrics.estimatedTokens) *
    100
  ).toFixed(1);

  console.log('Performance improvements:', {
    messagesRemoved: messageReduction,
    tokensSaved: tokenSavings,
    duplicatesEliminated: duplicateReduction,
    tokenReductionPercentage: `${percentageReduction}%`,
  });

  // Step 5: Test messageModifier function (used in createReactAgent)
  console.log('\n🧪 TESTING: messageModifier Function');
  console.log('-----------------------------------');
  const originalMessages = problematicState.messages;
  const deduplicatedMessages = deduplicateMessages(originalMessages);

  console.log('messageModifier results:', {
    originalCount: originalMessages.length,
    deduplicatedCount: deduplicatedMessages.length,
    messagesRemoved: originalMessages.length - deduplicatedMessages.length,
  });

  // Step 6: Verify production readiness
  console.log('\n✅ PRODUCTION READINESS CHECK');
  console.log('-----------------------------');

  const checks = {
    duplicatesEliminated: afterMetrics.duplicateMessages === 0,
    significantTokenSavings: tokenSavings > 100,
    messageCountReduced: messageReduction > 0,
    stateIntegrityMaintained:
      (cleanedState.metadata as any)?.correlationId === correlationId,
    messageModifierWorking:
      deduplicatedMessages.length < originalMessages.length,
  };

  const allChecksPassed = Object.values(checks).every(
    (check) => check === true,
  );

  console.log('Production readiness checks:', checks);
  console.log(
    `\n${allChecksPassed ? '🎉' : '❌'} Overall Status: ${allChecksPassed ? 'READY FOR PRODUCTION' : 'NEEDS ATTENTION'}`,
  );

  if (allChecksPassed) {
    console.log('\n🚀 SUCCESS: Message deduplication fix verified!');
    console.log(
      'The quadruple HUMAN message issue from LangSmith traces is resolved.',
    );
    console.log(
      `Expected production impact: ${percentageReduction}% token reduction`,
    );
  } else {
    console.log('\n⚠️  WARNING: Some checks failed. Review implementation.');
  }

  return {
    success: allChecksPassed,
    metrics: {
      before: beforeMetrics,
      after: afterMetrics,
      improvement: {
        messageReduction,
        tokenSavings,
        duplicateReduction,
        percentageReduction: Number.parseFloat(percentageReduction),
      },
    },
    checks,
  };
}

// Run the test
testProductionMessageFix()
  .then((result) => {
    console.log('\n📋 TEST COMPLETED');
    console.log('=================');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
