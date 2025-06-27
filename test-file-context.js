/**
 * Test script to verify fileContext integration
 * This simulates what happens when a user uploads a file and asks for summarization
 */

const testFileContext = {
  filename: 'test-document.txt',
  contentType: 'text/plain',
  url: 'https://example.com/test-document.txt',
  extractedText: `This is a test document with sample content.

Key Points:
- First important point about the business
- Second critical insight for the company
- Third strategic recommendation

Conclusion:
This document contains valuable information for decision making.`,
};

const testBrainRequest = {
  id: 'test-chat-123',
  chatId: 'test-chat-123',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'summarize this document',
      createdAt: new Date().toISOString(),
    },
  ],
  fileContext: testFileContext,
  activeBitContextId: 'echo-tango-specialist',
  selectedChatModel: 'global-orchestrator',
};

console.log('🧪 Test FileContext Integration');
console.log('===============================');
console.log('Test Request:', JSON.stringify(testBrainRequest, null, 2));
console.log('');
console.log('Expected Behavior:');
console.log('1. ✅ Brain API should receive fileContext');
console.log('2. ✅ BrainOrchestrator should process fileContext');
console.log('3. ✅ SimpleGraph should receive fileContext in metadata');
console.log('4. ✅ Agent should include document content in system prompt');
console.log(
  '5. ✅ Agent should summarize directly without calling listDocuments',
);
console.log('');
console.log('To test: Send this request body to POST /api/brain');
