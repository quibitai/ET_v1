# 🚨 PRODUCTION STREAMING CONFIGURATION REFERENCE
## Version 1.0.0 - Critical System Documentation

### ⚠️ **WARNING: DO NOT MODIFY WITHOUT EXTREME CAUTION**
This document captures the **exact streaming configuration** that took weeks to perfect. Any changes to these components could break frontend streaming functionality and significantly slow response times.

**Last Updated**: January 2025  
**Working Status**: ✅ **FULLY FUNCTIONAL** - Streaming works end-to-end  
**Critical Path**: Frontend → Brain API → BrainOrchestrator → LangChain → SimpleLangGraphWrapper

---

## 🎯 **STREAMING ARCHITECTURE OVERVIEW**

### **Complete Request Flow**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   useChat Hook   │    │  /api/brain     │    │ BrainOrchestrator│
│   (Frontend)     │◄──►│  (API Route)    │◄──►│  (Service)      │
│   @ai-sdk/react  │    │  ReadableStream │    │  AsyncGenerator │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ StreamProtocol   │    │ Data Stream     │    │ LangChain Bridge│
│ 'data'           │    │ Format 0:"text" │    │ SimpleLangGraph │
│ onResponse       │    │ Manual Encoding │    │ streamEvents    │
│ onFinish         │    │ 10ms Delays     │    │ on_chat_model   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 📱 **FRONTEND STREAMING (ChatWrapper.tsx)**

### **Critical useChat Configuration**
```typescript
// File: components/chat-wrapper.tsx (Lines 108-160)
const {
  messages, input, isLoading, error, append, data,
  setInput, setMessages, stop, reload, status,
  handleSubmit: originalHandleSubmit,
} = useChat({
  id,
  api: '/api/brain',                    // ✅ CRITICAL: Must point to brain API
  initialMessages,
  generateId: generateUUID,
  sendExtraMessageFields: true,
  streamProtocol: 'data',               // ✅ CRITICAL: Must be 'data' not 'text'
  
  onError: (error) => {
    console.error('🚨 [ChatWrapper useChat Error]', error);
  },
  
  experimental_prepareRequestBody: ({    // ✅ CRITICAL: Injects context
    messages, requestData, requestBody
  }) => {
    const body = {
      id: id,
      chatId: id,
      messages: messages,
      fileContext: fileContext,           // File upload context
      artifactContext: null,
      collapsedArtifactsContext: null,
      activeBitContextId: effectiveActiveBitContextId,
      ...requestBody,
    };
    return body;
  },
  
  onResponse: (response) => {             // ✅ CRITICAL: Response monitoring
    console.log('📡 [ChatWrapper Response]', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      contentType: response.headers.get('content-type'),
    });
  },
  
  onFinish: async (message) => {          // ✅ CRITICAL: Post-stream processing
    // Prevents duplicate processing
    const messageKey = `${message.id}-${message.role}`;
    if (onFinishProcessedRef.current.has(messageKey)) return;
    onFinishProcessedRef.current.add(messageKey);
    
    // New chat detection and cache refresh
    const isNewChat = message.role === 'assistant' && initialMessages.length === 0;
    if (isNewChat) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await mutateChatHistory();
    }
    
    clearFileContext();
    setTimeout(() => {
      onFinishProcessedRef.current.delete(messageKey);
    }, 5000);
  },
});
```

### **Critical Frontend Components**
- **Messages Display**: `components/messages.tsx` - Shows streaming with `status === 'streaming'`
- **Status Tracking**: Uses `status` and `isLoading` for UI state
- **Stream Data**: `streamData` prop passes real-time updates to `PreviewMessage`

---

## 🔗 **API LAYER STREAMING (Brain Route)**

### **Critical Brain API Implementation**
```typescript
// File: app/api/brain/route.ts (Lines 65-140)
export async function POST(req: NextRequest) {
  // ... validation logic ...
  
  const orchestrator = new BrainOrchestrator(logger);
  const rawStreamPromise = orchestrator.stream(request, clientConfig);
  
  // ✅ CRITICAL: Manual ReadableStream creation for Vercel AI SDK
  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let assistantContent = '';           // Accumulate for database saving
      
      try {
        const rawStream = await rawStreamPromise;
        for await (const chunk of rawStream) {
          const text = chunk instanceof Uint8Array 
            ? decoder.decode(chunk) 
            : String(chunk);
          
          assistantContent += text;
          
          // ✅ CRITICAL: Vercel AI SDK data stream format
          const escapedText = JSON.stringify(text).slice(1, -1);
          const dataStreamPart = `0:"${escapedText}"\n`;
          controller.enqueue(encoder.encode(dataStreamPart));
          
          // ✅ CRITICAL: 10ms delay prevents chunk batching
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        
        // Save assistant message after streaming completes
        if (assistantContent.trim() && request.chatId) {
          await saveMessagesWithMemory({ /* ... */ });
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });
  
  // ✅ CRITICAL: Response headers for streaming
  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',           // Disable proxy buffering
      'X-Proxy-Buffering': 'no',
    },
  });
}
```

---

## ⚙️ **SERVICE LAYER STREAMING (BrainOrchestrator)**

### **Critical Orchestrator Flow**
```typescript
// File: lib/services/brainOrchestrator.ts (Lines 60-140)
public async stream(
  request: BrainRequest,
  config: ClientConfig | null,
): Promise<AsyncGenerator<Uint8Array>> {
  
  // Query classification and planning
  const classification = await this.queryClassifier.classifyQuery(userInput);
  
  // ✅ CRITICAL: Workflow detection (Phase 2 integration)
  if (classification.workflowDetection?.isWorkflow && 
      classification.workflowDetection.confidence >= 0.6) {
    // TODO: Implement workflow streaming in Phase 3
    // Currently falls through to LangChain for multi-step handling
  }
  
  if (classification.shouldUseLangChain) {
    // ✅ CRITICAL: Context processing and system prompt building
    const context = await this.contextService.processContext(request);
    const conversationHistory = await this.buildLangChainConversationHistory(context, request);
    const baseSystemPrompt = await loadPrompt({ /* ... */ });
    const contextAdditions = this.contextService.createContextPromptAdditions(context);
    const systemPrompt = baseSystemPrompt + contextAdditions;
    
    // ✅ CRITICAL: LangChain bridge configuration
    const langChainConfig: LangChainBridgeConfig = {
      contextId: request.activeBitContextId,
      clientConfig: config,
      forceToolCall: classification.forceToolCall,
      maxIterations: 10,
      verbose: true,
      executionPlan: executionPlan,        // Strategic planning integration
    };
    
    const agent = await createLangChainAgent(systemPrompt, langChainConfig, this.logger, session);
    
    // ✅ CRITICAL: Returns raw AsyncGenerator from LangChain
    return streamLangChainAgent(agent, userInput, conversationHistory, this.logger, request, classification, executionPlan);
  }
  
  return this.createEmptyStream();
}
```

---

## 🤖 **LANGCHAIN STREAMING (LangChain Bridge)**

### **Critical LangChain Implementation**
```typescript
// File: lib/services/langchainBridge.ts (Lines 120-180)
export async function streamLangChainAgent(
  agent: LangChainAgent,
  input: string,
  chatHistory: any[],
  logger: RequestLogger,
  brainRequest?: BrainRequest,
  queryClassification?: any,
  executionPlan?: ExecutionPlan,
): Promise<AsyncGenerator<Uint8Array>> {
  
  // ✅ CRITICAL: Message formatting for LangChain
  const messages = chatHistory.map((msg) => {
    if (msg.role === 'user') return new HumanMessage(msg.content);
    if (msg.role === 'assistant') return new AIMessage(msg.content);
    return new SystemMessage(msg.content);
  });
  
  const wrapperConfig = agent.langGraphWrapper.getConfig();
  const fullConversation: BaseMessage[] = [
    new SystemMessage(wrapperConfig.systemPrompt),
    ...messages,
    new HumanMessage(input),
  ];
  
  // ✅ CRITICAL: Synthesis determination
  const needsSynthesis = determineIfSynthesisNeeded(input, queryClassification, logger, executionPlan);
  
  // ✅ CRITICAL: RunnableConfig with metadata
  const runnableConfig: any = {
    metadata: {
      fileContext: brainRequest?.fileContext,
      brainRequest: brainRequest,
      executionPlan: executionPlan,
    },
  };
  
  // ✅ CRITICAL: Direct stream return from SimpleLangGraphWrapper
  return agent.langGraphWrapper.stream(fullConversation, runnableConfig, needsSynthesis);
}
```

---

## 🧠 **LANGGRAPH STREAMING (SimpleLangGraphWrapper)**

### **Critical LangGraph Stream Implementation**
```typescript
// File: lib/ai/graphs/simpleLangGraphWrapper.ts (Lines 3119-3227)
async *streamWithRealTimeTokens(
  inputMessages: BaseMessage[],
  config?: any,
): AsyncGenerator<Uint8Array, void, unknown> {
  
  const encoder = new TextEncoder();
  let tokenCount = 0;
  let hasStreamedContent = false;
  
  try {
    // ✅ CRITICAL: LangGraph streamEvents configuration
    const events = this.graph.streamEvents(
      { messages: inputMessages },
      { version: 'v1', ...config }
    );
    
    for await (const event of events) {
      // ✅ CRITICAL: Stream LLM tokens in real-time
      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        if (chunk?.content) {
          hasStreamedContent = true;
          tokenCount++;
          yield encoder.encode(chunk.content);
        }
      }
      
      // ✅ CRITICAL: Stream tool execution results
      if (event.event === 'on_tool_end') {
        const toolOutput = event.data?.output;
        if (typeof toolOutput === 'string' && toolOutput.trim()) {
          hasStreamedContent = true;
          yield encoder.encode(`\n\n**Tool Result:** ${toolOutput}\n\n`);
        }
      }
    }
    
    // ✅ CRITICAL: Fallback for non-streaming content
    if (!hasStreamedContent) {
      const result = await this.graph.invoke({ messages: inputMessages }, config);
      const finalMessage = result.messages[result.messages.length - 1];
      
      if (finalMessage?.content) {
        const content = finalMessage.content;
        // Character-by-character streaming for smooth UX
        for (let i = 0; i < content.length; i += 3) {
          const chunk = content.slice(i, i + 3);
          yield encoder.encode(chunk);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    }
  } catch (error) {
    yield encoder.encode('⚠️ Streaming error occurred. Please try again.');
  }
}
```

---

## 🛡️ **CRITICAL CONFIGURATION ELEMENTS**

### **🚨 DO NOT MODIFY THESE VALUES**

1. **Stream Protocol**: `streamProtocol: 'data'` (NOT 'text')
2. **API Endpoint**: `/api/brain` (NOT /api/chat)
3. **Data Format**: `0:"escaped_text"\n` (Vercel AI SDK format)
4. **Chunk Delays**: `10ms` delays prevent batching
5. **Response Headers**: Specific anti-buffering headers required
6. **Error Handling**: Graceful fallbacks for non-streaming content
7. **Message Accumulation**: Must accumulate content for database saving
8. **Context Passing**: `experimental_prepareRequestBody` for file context

### **🔧 Performance Optimizations**
- **Token Buffering**: 3-character chunks for smooth streaming
- **Memory Management**: Cleanup processed message keys after 5 seconds
- **Cache Invalidation**: Automatic chat history refresh for new chats
- **Error Recovery**: Multiple fallback paths for stream failures

### **🧪 Test Endpoints**
- **Stream Test**: `/test-stream` page with isolated useChat hook
- **Health Check**: `/api/brain` GET endpoint for service status
- **Debug Logging**: Comprehensive console logging throughout pipeline

---

## ⚠️ **PHASE 3 STREAMING PROTECTION REQUIREMENTS**

### **Mandatory Safeguards for MCP Enhancement**

1. **NO MODIFICATIONS** to existing streaming pipeline components
2. **ADDITIVE ONLY** - New streaming features must be separate layers
3. **PRESERVE INTERFACES** - Keep all existing method signatures
4. **MAINTAIN DELAYS** - Keep 10ms chunk delays and timing
5. **PROTECT HEADERS** - Do not modify response headers
6. **GUARD FORMATS** - Maintain Vercel AI SDK data stream format
7. **TEST CONTINUOUSLY** - Validate streaming after each change

### **Approved Enhancement Areas**
- ✅ Add ToolManifest metadata (non-intrusive)
- ✅ Create BaseMCPClient abstraction (service layer only)
- ✅ Add selective streaming wrappers (new components)
- ✅ Enhance tool discovery (metadata layer only)

### **FORBIDDEN MODIFICATIONS**
- ❌ Change useChat configuration
- ❌ Modify brain API route streaming logic
- ❌ Alter LangChain bridge stream methods
- ❌ Change SimpleLangGraphWrapper streaming
- ❌ Modify data stream encoding format
- ❌ Change response headers or timing

---

## 🚨 **EMERGENCY ROLLBACK PROCEDURE**

If streaming breaks during Phase 3 implementation:

1. **Immediate**: Revert to last working commit
2. **Identify**: Check which component was modified
3. **Isolate**: Comment out new functionality
4. **Restore**: Ensure all critical configurations match this document
5. **Test**: Validate streaming works end-to-end
6. **Investigate**: Determine root cause before re-implementing

---

*Last Updated: January 2025*  
*Status: PRODUCTION READY - DO NOT BREAK*  
*Contact: Development Team for any streaming-related modifications* 