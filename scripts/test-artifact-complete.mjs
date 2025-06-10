#!/usr/bin/env node
/**
 * Comprehensive test for the complete artifact streaming architecture
 * This tests the full flow: frontend -> backend -> artifact generation -> streaming -> UI
 */

const TEST_ENDPOINT = 'http://localhost:3000/api/test-artifact-complete';

async function testCompleteArtifactFlow() {
  console.log('🧪 Testing Complete Artifact Flow...\n');

  try {
    console.log(`📡 Making request to: ${TEST_ENDPOINT}`);

    const response = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Response received, processing stream...\n');

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;
    const artifactEvents = [];
    const textChunks = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            eventCount++;

            // Parse different stream parts
            if (line.startsWith('0:')) {
              // Text chunk - this should NOT appear when artifacts are streaming
              const textContent = JSON.parse(line.slice(2));
              textChunks.push(textContent);
              console.log(
                `❌ UNEXPECTED TEXT: "${textContent.substring(0, 50)}..."`,
              );
            } else if (line.startsWith('2:')) {
              // Data event - artifact events should be here
              const dataContent = JSON.parse(line.slice(2));
              if (Array.isArray(dataContent)) {
                dataContent.forEach((event) => {
                  artifactEvents.push(event);
                  if (event.type === 'artifact' && event.props) {
                    const { eventType, documentId, contentChunk } = event.props;
                    console.log(
                      `✅ ARTIFACT EVENT: ${eventType} (${documentId}) ${contentChunk ? `- "${contentChunk.substring(0, 30)}..."` : ''}`,
                    );
                  }
                });
              }
            } else {
              console.log(`📊 OTHER EVENT: ${line.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('\n📈 STREAMING RESULTS:');
    console.log(`   Total Events: ${eventCount}`);
    console.log(`   Artifact Events: ${artifactEvents.length}`);
    console.log(`   Text Chunks: ${textChunks.length}`);

    // Analyze results
    const artifactStartEvents = artifactEvents.filter(
      (e) => e.props?.eventType === 'artifact-start',
    );
    const artifactChunkEvents = artifactEvents.filter(
      (e) => e.props?.eventType === 'artifact-chunk',
    );
    const artifactEndEvents = artifactEvents.filter(
      (e) => e.props?.eventType === 'artifact-end',
    );

    console.log(`   - artifact-start: ${artifactStartEvents.length}`);
    console.log(`   - artifact-chunk: ${artifactChunkEvents.length}`);
    console.log(`   - artifact-end: ${artifactEndEvents.length}`);

    // Check for success criteria
    const success =
      artifactStartEvents.length === 1 &&
      artifactChunkEvents.length > 0 &&
      artifactEndEvents.length === 1 &&
      textChunks.length === 0; // This is the key test - NO text duplication

    if (success) {
      console.log('\n🎉 SUCCESS: Artifact streaming working correctly!');
      console.log('   ✅ Artifact UI events properly streamed');
      console.log('   ✅ No content duplication in main chat');
      console.log('   ✅ Complete artifact lifecycle (start -> chunks -> end)');
    } else {
      console.log('\n❌ ISSUES DETECTED:');
      if (textChunks.length > 0) {
        console.log(
          `   - Found ${textChunks.length} text chunks (should be 0 during artifacts)`,
        );
      }
      if (artifactStartEvents.length !== 1) {
        console.log(
          `   - Expected 1 artifact-start, got ${artifactStartEvents.length}`,
        );
      }
      if (artifactEndEvents.length !== 1) {
        console.log(
          `   - Expected 1 artifact-end, got ${artifactEndEvents.length}`,
        );
      }
    }

    return success;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testCompleteArtifactFlow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
