# Quibit RAG System - Advanced Architecture Overview

> **Version 3.0.0** - Brain Orchestrator Hybrid System  
> **Last Updated**: January 2025

## 🎯 **Executive Summary**

The Quibit RAG system represents a significant advancement in AI orchestration architecture, featuring a sophisticated **Brain Orchestrator** that intelligently routes queries between different AI execution paths based on complexity analysis and pattern detection. This hybrid approach combines the reliability of traditional LangChain agents with the advanced reasoning capabilities of LangGraph for complex multi-step workflows.

## 🏗️ **Core Architecture: Hybrid Brain Orchestration**

### **Central Coordination Pattern**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Brain Orchestrator                          │
│  ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Query         │  │ Pattern         │  │ Path            │    │
│  │ Classification│  │ Analysis        │  │ Selection       │    │
│  └───────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌───────────────┐ ┌───────────┐ ┌─────────────┐
            │   LangGraph   │ │ LangChain │ │ Vercel AI   │
            │   (Complex)   │ │(Standard) │ │  (Simple)   │
            └───────────────┘ └───────────┘ └─────────────┘
```

### **Key Innovation: Pattern-Based Routing**

The Brain Orchestrator analyzes incoming queries for complexity patterns and routes them to the optimal execution engine:

- **🔀 LangGraph Path**: Multi-step reasoning, complex tool workflows, artifact generation
- **🔗 LangChain Path**: Standard agent execution with tool calling
- **⚡ Vercel AI Path**: Simple queries and fallback scenarios

## 🧠 **Brain Orchestrator - Central Coordination Service**

**Location**: `lib/services/brainOrchestrator.ts`

The Brain Orchestrator is the system's nerve center, responsible for:

### **Request Processing Pipeline**
1. **Context Extraction**: Parse user input and conversation history via `ContextService`
2. **Query Classification**: Analyze patterns via `QueryClassifier` 
3. **Path Selection**: Route to optimal execution engine
4. **Execution Coordination**: Manage streaming and context propagation
5. **Memory Storage**: Persist interactions via `MessageService`

### **Configuration Interface**
```typescript
interface BrainOrchestratorConfig {
  enableHybridRouting: boolean;           // Enable intelligent routing
  enableLangGraph: boolean;               // Complex reasoning capability
  langGraphForComplexQueries: boolean;    // Pattern-based LangGraph activation
  enableClassification: boolean;          // Query analysis
  fallbackToLangChain: boolean;          // Error recovery strategy
  maxRetries: number;                    // Resilience configuration
  timeoutMs: number;                     // Performance boundaries
  clientConfig?: ClientConfig;           // Client-specific settings
  session?: Session;                     // User context
}
```

## 🔀 **LangGraph Integration - Advanced Reasoning Engine**

**Location**: `lib/ai/graphs/simpleLangGraphWrapper.ts`

### **State Management Architecture**
```typescript
const GraphStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),        // Message accumulation
  }),
  input: Annotation<string>(),             // Current user input
  agent_outcome: Annotation<AIMessage>(),  // LLM responses
  ui: Annotation<UIMessage[]>(),           // Artifact generation events
  _lastToolExecutionResults: Annotation<any[]>(), // Tool outputs
});
```

### **Graph Workflow Design**
```typescript
// Node definitions for state transitions
workflow.addNode('agent', this.callModelNode);     // LLM interaction
workflow.addNode('tools', this.executeToolsNode);  // Tool execution

// Conditional routing logic
workflow.addConditionalEdges('agent', this.shouldExecuteTools, {
  use_tools: 'tools',   // Continue to tool execution
  finish: END,          // Complete workflow
});

workflow.addEdge('tools', 'agent');  // Return to agent after tools
```

### **Pattern Detection for LangGraph Activation**
The system automatically routes to LangGraph when these patterns are detected:

- **`TOOL_OPERATION`**: Complex tool workflows requiring coordination
- **`MULTI_STEP`**: Sequential reasoning tasks with dependencies  
- **`REASONING`**: Analytical queries requiring deep analysis
- **`KNOWLEDGE_RETRIEVAL`**: Multi-source content synthesis
- **`WORKFLOW`**: Multi-phase operations with state persistence

## 🎭 **Specialist System - Dynamic AI Personas**

### **Specialist Configuration Architecture**
**Location**: `lib/ai/prompts/specialists/`

```typescript
interface SpecialistConfig {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description: string;           // Purpose description
  persona: string;              // Core prompt template
  defaultTools: string[];       // Available tool set
  clientContext?: {             // Client-specific configuration
    displayName: string;
    mission: string;
    customInstructions: string;
  };
}
```

### **Dynamic Prompt Composition**
**Location**: `lib/ai/prompts/loader.ts`

The system dynamically composes prompts by:
1. **Loading Base Persona**: Specialist-specific instructions
2. **Injecting Client Context**: Branding, mission statements, custom guidelines
3. **Adding Tool Instructions**: Context-aware tool usage guidance
4. **Temporal Context**: Current date/time for relevance

### **Context Flow Pattern**
```
Client Request → Specialist Selection → Context Injection → Prompt Composition
                                                                    ↓
                Tool Access Control ← Memory Management ← Conversation History
```

## 🛠️ **Tool Ecosystem - 26+ Integrated Capabilities**

### **Tool Categories and Architecture**
**Location**: `lib/ai/tools/`

#### **Document & Knowledge Management (6 tools)**
- `searchInternalKnowledgeBase` - Semantic search across knowledge base
- `getFileContents` - Direct document access and retrieval
- `createDocument` - Dynamic document generation with templates
- `updateDocument` - Content modification and versioning
- `listDocuments` - Knowledge base exploration and discovery
- `queryDocumentRows` - Structured data queries and analysis

#### **Asana Project Management Suite (12 tools)**
- **User Management**: `asana_get_user_info`, `asana_list_users`
- **Project Operations**: `asana_list_projects`, `asana_get_project_details`, `asana_create_project`
- **Task Management**: `asana_list_tasks`, `asana_get_task_details`, `asana_create_task`, `asana_update_task`
- **Workflow Features**: `asana_list_subtasks`, `asana_add_followers`, `asana_set_dependencies`
- **Search & Discovery**: `asana_search_entity`

#### **External Integrations (5 tools)**
- `tavilySearch` - Real-time web search with source attribution
- `tavilyExtract` - Deep content extraction from web sources
- `googleCalendar` - Full calendar integration and scheduling
- `getWeatherTool` - Location-based weather information
- `getMessagesFromOtherChat` - Cross-conversation context sharing

### **Intelligent Tool Selection**
**Location**: `lib/services/modernToolService.ts`

```typescript
export async function selectRelevantTools(
  context: ToolContext,
  maxTools: number = 10
): Promise<any[]> {
  // Semantic analysis of user query
  // Client configuration considerations  
  // Specialist context preferences
  // Tool availability and permissions
}
```

## 💾 **Memory & Context Management**

### **Context Service Architecture**
**Location**: `lib/services/contextService.ts`

```typescript
interface ProcessedContext {
  activeBitContextId?: string;           // Current specialist
  selectedChatModel: string;             // AI model configuration
  memoryContext: any[];                  // Conversation history
  clientConfig?: ClientConfig;           // Client-specific settings
  userTimezone?: string;                 // Temporal context
}
```

### **Memory Management Features**
- **Conversational Memory**: Persistent context across sessions
- **Context Bleeding Prevention**: Intelligent filtering of problematic patterns
- **Cross-UI Context**: Seamless context sharing between interface components
- **Client-Specific Memory**: Tailored memory management per client configuration

### **Message Processing Pipeline**
**Location**: `lib/services/messageService.ts`

```typescript
public convertToLangChainFormat(messages: UIMessage[]): LangChainMessage[] {
  // Filter context bleeding patterns
  const filteredHistory = this.filterContextBleedingPatterns(messages);
  
  // Convert to LangChain format
  return filteredHistory.map(message => ({
    type: message.role === 'user' ? 'human' : 'ai',
    content: this.sanitizeContent(message.content),
  }));
}
```

## 🔄 **Request Flow & Streaming Architecture**

### **Complete Request Lifecycle**
```
1. Request Reception (Brain API)
   ↓
2. Validation & Authentication
   ↓
3. Context Processing (ContextService)
   ↓
4. Query Classification (QueryClassifier)
   ↓
5. Path Selection (BrainOrchestrator)
   ↓ ↓ ↓
   LangGraph ← LangChain ← Vercel AI
   ↓
6. Tool Selection & Execution
   ↓
7. Context Injection & Memory Management
   ↓
8. Streaming Response Generation
   ↓
9. Memory Storage & Cleanup
```

### **Streaming Implementation**
**Location**: `lib/services/langchainBridge.ts`

The system provides unified streaming across all execution paths:

- **LangGraph Streaming**: State graph events with UI artifact generation
- **LangChain Streaming**: Traditional agent executor with tool calling
- **Vercel AI Streaming**: Simple query responses with fallback support

### **Context Propagation Pattern**
```typescript
const langGraphConfig = {
  configurable: {
    dataStream: dataStreamWriter,    // For artifact generation
    session: contextConfig.session, // User authentication context
  },
  runId: uuidv4(),                  // Request correlation
  callbacks: callbacks,            // Monitoring hooks
};
```

## 📊 **Observability & Performance**

### **Comprehensive Monitoring**
**Location**: `lib/services/observabilityService.ts`

```typescript
interface RequestLogger {
  correlationId: string;           // Unique request tracking
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}
```

### **Performance Metrics**
- **Request Correlation**: Unique correlation IDs for request tracing
- **Execution Timing**: Path selection and component performance
- **Tool Analytics**: Usage patterns and selection effectiveness
- **Pattern Recognition**: Query classification accuracy and insights
- **Memory Performance**: Context processing and storage efficiency

### **Error Recovery Strategies**
```typescript
enum ErrorRecoveryStrategy {
  RETRY = 'retry',                    // Automatic retry with backoff
  SKIP = 'skip',                     // Skip problematic step
  FALLBACK = 'fallback',             // Route to alternative path
  HUMAN_INTERVENTION = 'human_intervention', // Require manual input
  ABORT = 'abort'                    // Terminate request
}
```

## 🚀 **Deployment & Scalability**

### **Production Architecture**
- **Vercel Edge Functions**: Fast response times with global distribution
- **PostgreSQL**: Robust data persistence with connection pooling
- **Redis Caching**: Session and context caching for performance
- **CDN Integration**: Static asset optimization and delivery

### **Scalability Features**
- **Horizontal Scaling**: Stateless service architecture
- **Intelligent Caching**: Context and tool result caching
- **Load Balancing**: Automatic request distribution
- **Resource Optimization**: Efficient memory and computation usage

## 🔧 **Configuration & Customization**

### **Client Configuration Interface**
```typescript
interface ClientConfig {
  id: string;
  client_display_name: string;
  client_core_mission?: string;
  customInstructions?: string;
  configJson?: {
    orchestrator_client_context?: string;
    available_bit_ids?: string[];
    specialist_configurations?: SpecialistConfig[];
  };
}
```

### **Environment Configuration**
```bash
# Core Services
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."

# AI Services
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Tool Integrations
TAVILY_API_KEY="tvly-..."
ASANA_ACCESS_TOKEN="..."
GOOGLE_CALENDAR_CLIENT_ID="..."
WEATHER_API_KEY="..."
```

## 🎯 **Architectural Decisions & Rationale**

### **Why Hybrid Orchestration?**
- **Optimal Performance**: Route simple queries to fast paths, complex queries to advanced reasoning
- **Reliability**: Multiple execution paths provide robust fallback options
- **Scalability**: Different patterns can be optimized independently
- **Flexibility**: Easy to add new execution strategies without breaking existing functionality

### **Why LangGraph for Complex Reasoning?**
- **State Management**: Proper state persistence across multi-step workflows
- **Conditional Logic**: Smart routing between different processing nodes
- **Error Recovery**: Robust error handling with retry and fallback strategies
- **Observability**: Clear visibility into complex reasoning processes

### **Why Specialist System?**
- **Client Customization**: Tailored AI behavior per client without code changes
- **Context Optimization**: Specialized prompts and tool access for specific use cases
- **Maintainability**: Centralized persona management with dynamic composition
- **Scalability**: Easy addition of new specialists without system changes

## 🔮 **Future Roadmap**

### **Planned Enhancements**
- **Multi-Modal Support**: Image, audio, and video processing capabilities
- **Advanced Analytics**: ML-powered usage pattern analysis and optimization
- **Enhanced Security**: Advanced authentication and authorization features
- **API Ecosystem**: Extended API surface for third-party integrations

### **Scalability Improvements**
- **Microservices Migration**: Service decomposition for independent scaling
- **Advanced Caching**: ML-powered predictive caching strategies
- **Performance Optimization**: Query optimization and resource management
- **Monitoring Enhancement**: Real-time performance dashboards and alerting

---

**Architecture Version**: 3.0.0 - Brain Orchestrator Hybrid System  
**Documentation Last Updated**: January 2025  
**System Status**: Production Ready

*This architecture represents a significant advancement in RAG system design, combining proven reliability with cutting-edge AI orchestration capabilities for enterprise-ready applications.* 