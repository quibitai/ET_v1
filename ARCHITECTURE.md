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
2. **"Get or Create" Chat**: Ensure a `Chat` record exists in the database before processing to prevent race conditions.
3. **Query Classification**: Analyze patterns via `QueryClassifier` 
4. **Path Selection**: Route to optimal execution engine
5. **Execution Coordination**: Manage streaming and context propagation
6. **Memory Storage**: Persist interactions via `MessageService`

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

### **Database-Driven Configuration**
**Location**: `lib/db/schema.ts` (see `specialists` table)

Specialist configurations, including their persona prompts and default toolsets, are no longer stored in static files. They are now fully managed in the database, allowing for real-time updates through the admin interface without requiring a system redeployment.

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

## 🎛️ **Admin Interface Architecture**

### **Consolidated Dashboard Design**
**Location**: `app/admin/page.tsx`, `app/admin/components/`

The admin interface has been completely redesigned as a single-page application with a modern tabbed interface, consolidating all administrative functions into one cohesive dashboard.

```typescript
// Admin Dashboard Component Architecture
AdminDashboard
├── TabsRoot (Shadcn UI Tabs)
│   ├── OverviewTab
│   │   ├── MetricsCards (System health indicators)
│   │   └── QuickActions (Administrative shortcuts)
│   ├── ConfigurationTab
│   │   ├── ClientEditor (CRUD operations)
│   │   └── SpecialistEditor
│   │       ├── BasicInfoTab (Name, description, context ID)
│   │       ├── ToolsCapabilitiesTab (Visual tool selection)
│   │       └── AIPersonaTab (Prompt editing with AI enhancement)
│   └── ObservabilityTab
│       ├── AnalyticsCharts (Performance metrics)
│       └── SystemMetrics (Real-time monitoring)
```

### **Enhanced Specialist Management**

#### **Visual Tool Selection Interface**
The specialist editor features a revolutionary tool selection system:

```typescript
interface ToolCategory {
  name: string;
  description: string;
  tools: ToolDefinition[];
  selectedCount: number;
}

const toolCategories: ToolCategory[] = [
  {
    name: "Search & Knowledge",
    tools: ["searchInternalKnowledgeBase", "getFileContents", "listDocuments"],
    selectedCount: 0
  },
  {
    name: "Document Management", 
    tools: ["createDocument", "updateDocument"],
    selectedCount: 0
  },
  {
    name: "Project Management",
    tools: ["asana_get_user_info", "asana_create_project", /* 5 more */],
    selectedCount: 0
  },
  {
    name: "Utilities",
    tools: ["tavilyExtract", "getWeatherTool", "requestSuggestions"],
    selectedCount: 0
  }
];
```

**Tool Selection Features:**
- **Visual Checkboxes**: Intuitive selection interface with real-time feedback
- **Category Grouping**: Organized by functionality with expand/collapse
- **Real-time Counters**: Dynamic count display for selected tools per category
- **Tool Descriptions**: Detailed capability explanations for informed selection
- **Bulk Operations**: Select/deselect all tools within categories

#### **AI-Powered Prompt Enhancement**
**Location**: `app/api/admin/refine-prompt/route.ts`

The admin interface includes an AI enhancement system for prompt optimization:

```typescript
interface PromptEnhancementRequest {
  currentPrompt: string;
  selectedTools: string[];
  specialistContext: {
    name: string;
    description: string;
    contextId: string;
  };
}

interface PromptEnhancementResponse {
  enhancedPrompt: string;
  improvements: string[];
  toolIntegrations: ToolIntegration[];
}
```

**Enhancement Process:**
1. **Context Analysis**: Analyze current prompt and selected tools
2. **Capability Mapping**: Map tools to specific prompt instructions
3. **Best Practices**: Apply proven prompt engineering techniques
4. **Integration**: Seamlessly incorporate tool-specific guidance
5. **Preservation**: Maintain core specialist personality and identity

### **Technical Implementation**

#### **Component Architecture**
```typescript
// Server Components for Performance
export default async function AdminDashboard() {
  const clients = await getClients();
  const specialists = await getSpecialists();
  const metrics = await getSystemMetrics();
  
  return (
    <div className="h-screen flex flex-col">
      <AdminHeader />
      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList />
        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full overflow-y-auto">
            <OverviewTab metrics={metrics} />
          </TabsContent>
          <TabsContent value="configuration" className="h-full overflow-y-auto">
            <ConfigurationTab clients={clients} specialists={specialists} />
          </TabsContent>
          <TabsContent value="observability" className="h-full overflow-y-auto">
            <ObservabilityTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

#### **Responsive Design & Accessibility**
- **Viewport Constraints**: Proper height management with `h-screen` and overflow handling
- **Mobile-First**: Responsive design optimized for all screen sizes
- **Keyboard Navigation**: Full accessibility with tab order and focus management
- **Screen Reader Support**: Proper ARIA labels and semantic HTML structure
- **Professional Styling**: Consistent Shadcn UI components with custom theming

#### **Real-time Updates**
```typescript
// Server Actions for Immediate Updates
export async function updateSpecialist(formData: FormData) {
  'use server';
  
  const specialistData = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    personaPrompt: formData.get('personaPrompt') as string,
    defaultTools: JSON.parse(formData.get('defaultTools') as string),
  };
  
  await db.update(specialists)
    .set(specialistData)
    .where(eq(specialists.id, specialistData.id));
    
  revalidatePath('/admin');
  return { success: true };
}
```

### **Security & Authentication**

#### **Role-Based Access Control**
```typescript
// Admin Access Validation
export function isAdminUser(email: string): boolean {
  const adminPatterns = ['admin', 'hayden', 'adam@quibit.ai'];
  return adminPatterns.some(pattern => 
    email.toLowerCase().includes(pattern.toLowerCase())
  );
}

// Middleware Protection
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !isAdminUser(session.user.email)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}
```

#### **Data Validation & Sanitization**
- **Input Validation**: Comprehensive form validation with Zod schemas
- **SQL Injection Prevention**: Parameterized queries with Drizzle ORM
- **XSS Protection**: Content sanitization and CSP headers
- **CSRF Protection**: Built-in NextAuth.js CSRF protection

### **Performance Optimizations**

#### **Database Operations**
```typescript
// Optimized Queries with Proper Indexing
export async function getSpecialistsWithMetrics() {
  return await db
    .select({
      id: specialists.id,
      name: specialists.name,
      description: specialists.description,
      toolCount: sql<number>`json_array_length(${specialists.defaultTools})`,
      lastUpdated: specialists.updatedAt,
    })
    .from(specialists)
    .orderBy(desc(specialists.updatedAt));
}
```

#### **Client-Side Optimizations**
- **Server Components**: Reduced client-side JavaScript bundle
- **Streaming**: Progressive loading of admin interface components
- **Caching**: Intelligent caching of configuration data
- **Lazy Loading**: On-demand loading of heavy components

### **Monitoring & Observability**

#### **Admin Activity Logging**
```typescript
interface AdminAction {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: 'CLIENT' | 'SPECIALIST';
  resourceId: string;
  changes: Record<string, any>;
  timestamp: Date;
}

export async function logAdminAction(action: AdminAction) {
  await db.insert(adminAuditLog).values(action);
}
```

#### **System Health Monitoring**
- **Real-time Metrics**: Live system performance indicators
- **Configuration Tracking**: Version control for all configuration changes
- **Error Monitoring**: Comprehensive error tracking and alerting
- **Usage Analytics**: Admin interface usage patterns and optimization insights

## 💾 **Database & ORM Architecture**

### **Explicit Relationship Management with Drizzle ORM**
**Location**: `lib/db/relations.ts`

A critical component of the system's stability is the explicit definition of all table relationships for the Drizzle ORM. Foreign key constraints are defined in `lib/db/schema.ts`, but Drizzle's query builder requires additional, explicit `relations` definitions to perform joins and eager loading.

To solve this and prevent circular dependencies, all relations are managed in a dedicated `lib/db/relations.ts` file.

**Example `chatRelations` Definition**:
```typescript
export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
  client: one(clients, {
    fields: [chat.clientId],
    references: [clients.id],
  }),
  messages: many(message),
  // ... other relations
}));
```
This architecture ensures that the ORM has a clear, unambiguous understanding of the data model, preventing runtime errors and ensuring query integrity.

---

**Architecture Version**: 3.0.0 - Brain Orchestrator Hybrid System  
**Documentation Last Updated**: January 2025  
**System Status**: Production Ready

*This architecture represents a significant advancement in RAG system design, combining proven reliability with cutting-edge AI orchestration capabilities for enterprise-ready applications.* 