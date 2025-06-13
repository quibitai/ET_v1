/**
 * Test Script: Synthesis Node Streaming Validation
 *
 * This script tests the synthesis node streaming functionality
 * to ensure it works correctly before deploying to production.
 */

async function testSynthesisNode() {
  const testData = {
    userQuery:
      "Search the web for LWCC in Baton Rouge and using the client research examples in the knowledge base, create a research report document on how they align with Echo Tango's Ideal Clients.",
    toolResults: `Tool: tavilySearch
Result: Louisiana Workers' Compensation Corporation (LWCC) is a private, nonprofit mutual insurance company based in Baton Rouge, Louisiana. It is the largest workers' compensation carrier in Louisiana, serving the long-term interests of Louisiana businesses rather than shareholders.

Tool: searchInternalKnowledgeBase
Result: Echo Tango's ideal clients are mid-size to large enterprises with sufficient marketing budgets for brand-building and digital media projects. They value storytelling as a strategic business tool and prioritize authenticity, innovation, community engagement, and long-term relationship building.

Tool: getDocumentContents
Result: Detailed ideal client profile showing Echo Tango works with organizations seeking collaborative, purpose-driven partnerships in the Baton Rouge and greater Louisiana market.`,
  };

  try {
    console.log('🧪 Testing Synthesis Node Streaming...');
    console.log('Query:', `${testData.userQuery.substring(0, 100)}...`);
    console.log('Tool Results Length:', testData.toolResults.length);

    const response = await fetch('http://localhost:3000/api/test-synthesis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    console.log('\n✅ Test Results:');
    console.log('Success:', result.success);
    console.log('Method:', result.method);
    console.log('Duration:', `${result.duration}ms`);
    console.log('Response Length:', result.responseLength);
    console.log('\n📄 Response Preview:');
    console.log(result.preview);

    if (result.streamError) {
      console.log('\n⚠️  Stream Error:', result.streamError);
    }

    // Validate response quality
    const hasTitle = result.response?.includes('# Research Report');
    const hasContent = result.responseLength > 500;
    const noGenericText = !result.response?.includes(
      'How can I assist you today',
    );

    console.log('\n🔍 Quality Checks:');
    console.log('Has Report Title:', hasTitle ? '✅' : '❌');
    console.log('Sufficient Content:', hasContent ? '✅' : '❌');
    console.log('No Generic Text:', noGenericText ? '✅' : '❌');

    const overallSuccess =
      result.success && hasTitle && hasContent && noGenericText;
    console.log(
      '\n🎯 Overall Test Result:',
      overallSuccess ? '✅ PASS' : '❌ FAIL',
    );

    return overallSuccess;
  } catch (error) {
    console.error('❌ Test Failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSynthesisNode()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testSynthesisNode };
