#!/usr/bin/env npx tsx

/**
 * LangSmith Trace Simulation Test
 *
 * This test simulates the exact scenario from the LangSmith trace screenshot
 * where we see 3 identical HUMAN messages in the output section.
 *
 * The fix should prevent createReactAgent from adding duplicate messages
 * during its internal execution loop.
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  deduplicateMessages,
  cleanGraphState,
} from '../lib/ai/graphs/state/StateValidator';
import type { GraphState } from '../lib/ai/graphs/state';

interface TestState extends Partial<GraphState> {
  messages: any[];
  input: string;
  metadata?: any;
}

async function simulateLangSmithTraceScenario() {
  console.log('🔍 LangSmith Trace Simulation Test');
  console.log('==================================');

  // Simulate the exact state that would cause the triplicate issue
  // This represents what happens when createReactAgent processes the same input multiple times
  const correlationId = `trace_${Date.now()}_simulation`;

  console.log(
    `[${correlationId}] Simulating problematic state that causes LangSmith trace duplicates...`,
  );

  // Step 1: Create initial state (what would be passed to createReactAgent)
  const initialState: TestState = {
    input: 'List files in the knowledge base.',
    messages: [new HumanMessage('List files in the knowledge base.')],
    metadata: {
      correlationId,
      userQuery: 'List files in the knowledge base.',
    },
  };

  console.log('\n📊 INITIAL STATE:');
  console.log('------------------');
  console.log('Input:', initialState.input);
  console.log(
    'Messages:',
    initialState.messages.map((m) => `${m._getType()}: "${m.content}"`),
  );

  // Step 2: Simulate what createReactAgent does internally (this is where duplication happens)
  // createReactAgent automatically adds the input as a new HumanMessage to the messages array
  const agentProcessedState: TestState = {
    ...initialState,
    messages: [
      ...initialState.messages,
      // This is what createReactAgent adds automatically - causing duplication!
      new HumanMessage(initialState.input),
      new HumanMessage(initialState.input), // Simulating multiple internal iterations
      new HumanMessage(initialState.input), // This creates the triplicate issue
    ],
  };

  console.log('\n❌ PROBLEMATIC STATE (After createReactAgent processing):');
  console.log('--------------------------------------------------------');
  console.log(
    'Messages:',
    agentProcessedState.messages.map(
      (m, i) => `${i}: ${m._getType()}: "${m.content}"`,
    ),
  );
  console.log(
    'Total HUMAN messages:',
    agentProcessedState.messages.filter((m) => m._getType() === 'human').length,
  );
  console.log(
    'Unique HUMAN content:',
    new Set(
      agentProcessedState.messages
        .filter((m) => m._getType() === 'human')
        .map((m) => m.content),
    ).size,
  );

  // Step 3: Apply our fix - clear input field before passing to createReactAgent
  const fixedInputState: TestState = {
    ...initialState,
    input: '', // CRITICAL FIX: Clear input to prevent createReactAgent from adding it again
  };

  console.log('\n🔧 FIXED INPUT STATE (Clear input field):');
  console.log('-----------------------------------------');
  console.log('Input:', `"${fixedInputState.input}" (cleared)`);
  console.log(
    'Messages:',
    fixedInputState.messages.map((m) => `${m._getType()}: "${m.content}"`),
  );

  // Step 4: Apply state validation to problematic state
  const cleanedState = cleanGraphState(
    {
      ...agentProcessedState,
      // Add required GraphState properties with defaults
      agent_outcome: undefined,
      ui: [],
      _lastToolExecutionResults: [],
      toolForcingCount: 0,
      iterationCount: 0,
      needsSynthesis: true,
      response_mode: 'synthesis' as const,
      node_execution_trace: [],
      tool_workflow_state: {
        documentsListed: false,
        documentsRetrieved: [],
        webSearchCompleted: false,
        extractionCompleted: false,
        multiDocAnalysisCompleted: false,
      },
      metadata: agentProcessedState.metadata || {},
    },
    correlationId,
  );

  console.log('\n✅ CLEANED STATE (After StateValidator):');
  console.log('----------------------------------------');
  console.log(
    'Messages:',
    cleanedState.messages.map(
      (m, i) => `${i}: ${m._getType()}: "${m.content}"`,
    ),
  );
  console.log(
    'Total HUMAN messages:',
    cleanedState.messages.filter((m) => m._getType() === 'human').length,
  );
  console.log(
    'Unique HUMAN content:',
    new Set(
      cleanedState.messages
        .filter((m) => m._getType() === 'human')
        .map((m) => m.content),
    ).size,
  );

  // Step 5: Calculate improvement metrics
  const originalHumanCount = agentProcessedState.messages.filter(
    (m) => m._getType() === 'human',
  ).length;
  const cleanedHumanCount = cleanedState.messages.filter(
    (m) => m._getType() === 'human',
  ).length;
  const duplicatesRemoved = originalHumanCount - cleanedHumanCount;
  const tokenSavings = duplicatesRemoved * 9; // Approximate tokens per message
  const percentageReduction = (
    (duplicatesRemoved / originalHumanCount) *
    100
  ).toFixed(1);

  console.log('\n📈 IMPROVEMENT METRICS:');
  console.log('----------------------');
  console.log('Original HUMAN messages:', originalHumanCount);
  console.log('Cleaned HUMAN messages:', cleanedHumanCount);
  console.log('Duplicates removed:', duplicatesRemoved);
  console.log('Estimated token savings:', tokenSavings);
  console.log('Percentage reduction:', `${percentageReduction}%`);

  // Step 6: Verify fix effectiveness
  const isFixed = cleanedHumanCount === 1 && duplicatesRemoved >= 2;

  console.log('\n🎯 FIX VERIFICATION:');
  console.log('--------------------');
  console.log('Expected: 1 HUMAN message');
  console.log('Actual:', cleanedHumanCount, 'HUMAN messages');
  console.log(
    'Duplicates eliminated:',
    duplicatesRemoved >= 2 ? '✅ YES' : '❌ NO',
  );
  console.log('LangSmith trace issue resolved:', isFixed ? '✅ YES' : '❌ NO');

  // Step 7: Test messageModifier function (used in createReactAgent)
  console.log('\n🧪 MESSAGE MODIFIER TEST:');
  console.log('-------------------------');
  const modifierResult = deduplicateMessages(agentProcessedState.messages);
  console.log('Original count:', agentProcessedState.messages.length);
  console.log('After messageModifier:', modifierResult.length);
  console.log(
    'Modifier effectiveness:',
    modifierResult.length <= 2 ? '✅ WORKING' : '❌ NEEDS FIX',
  );

  // Final summary
  console.log('\n🎉 TEST SUMMARY:');
  console.log('================');

  if (isFixed && modifierResult.length <= 2) {
    console.log('✅ SUCCESS: LangSmith trace duplication issue RESOLVED');
    console.log('✅ Both state cleaning and messageModifier are working');
    console.log(
      '✅ Expected production impact: Eliminate triplicate HUMAN messages',
    );
    console.log('✅ Token efficiency improved by', `${percentageReduction}%`);
  } else {
    console.log('❌ FAILURE: Issue not fully resolved');
    console.log('❌ Additional debugging required');
  }

  return {
    success: isFixed && modifierResult.length <= 2,
    originalCount: originalHumanCount,
    cleanedCount: cleanedHumanCount,
    duplicatesRemoved,
    tokenSavings,
    percentageReduction: Number.parseFloat(percentageReduction),
  };
}

// Run the test
simulateLangSmithTraceScenario()
  .then((result) => {
    console.log('\n📋 Final Result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
