# Quibit RAG System - Advanced AI Orchestration Platform

A production-ready, hybrid RAG (Retrieval-Augmented Generation) system with sophisticated AI orchestration, featuring intelligent routing between LangChain and LangGraph execution paths, dynamic specialist personas, and comprehensive tool integration.

## 🎯 **System Overview**

This application implements a **hybrid brain orchestrator** that intelligently routes queries between different AI execution paths based on complexity analysis and pattern detection. The system combines the reliability of traditional LangChain agents with the advanced reasoning capabilities of LangGraph for complex multi-step workflows.

### **Core Innovation: Hybrid Brain Architecture**
- **BrainOrchestrator**: Central coordination service with intelligent routing
- **Query Classification**: Pattern-based analysis for optimal execution path selection
- **LangGraph Integration**: Advanced state management for complex reasoning workflows
- **Specialist System**: Dynamic AI personas with client-specific context and tool access
- **Memory Management**: Sophisticated conversational memory with context bleeding prevention

## 🏗️ **Architecture Deep Dive**

### **Brain Orchestrator - Central Coordination**
```
User Query → Query Classification → Path Selection → Execution → Response
              ↓                     ↓              ↓
         Pattern Analysis      LangChain vs    Tool Selection
         (TOOL_OPERATION,      LangGraph vs    Context Injection
          MULTI_STEP,          Vercel AI       Memory Management
          REASONING, etc.)
```

**Key Components:**
- **BrainOrchestrator** (`lib/services/brainOrchestrator.ts`): Central routing and coordination
- **QueryClassifier**: Pattern detection for execution path determination
- **LangChain Bridge** (`lib/services/langchainBridge.ts`): Tool execution and agent management
- **Context Services**: Memory, specialist, and client configuration management

### **LangGraph Integration - Advanced Reasoning**
For complex queries requiring multi-step reasoning, the system automatically routes to LangGraph:

```typescript
// Automatic LangGraph activation patterns:
- TOOL_OPERATION: Complex tool workflows
- MULTI_STEP: Sequential reasoning tasks  
- REASONING: Analytical queries requiring deep thought
- KNOWLEDGE_RETRIEVAL: Multi-source content synthesis
- WORKFLOW: Multi-phase operations
```

**LangGraph Features:**
- **State Management**: Proper graph state with message history and UI events
- **Conditional Routing**: Smart transitions between agent and tool nodes
- **Artifact Generation**: Real-time document and content creation
- **Error Recovery**: Robust error handling with fallback strategies

### **Specialist System - Dynamic AI Personas**
```typescript
// Specialist Configuration Example
export const chatModelConfig: SpecialistConfig = {
  id: 'chat-model',
  name: 'General Chat Assistant',
  persona: clientAwarePersonaPrompt, // Dynamically injected
  defaultTools: [/* 26+ available tools */],
  clientContext: {
    displayName: '{client_display_name}',
    mission: '{client_core_mission_statement}',
    customInstructions: '...'
  }
};
```

## 🚀 **Core Features**

### **🧠 Hybrid AI Orchestration**
- **Intelligent Routing**: Automatic path selection based on query complexity
- **Execution Strategies**: LangChain AgentExecutor, LangGraph workflows, or Vercel AI
- **Pattern Recognition**: Advanced query classification for optimal processing
- **Fallback Logic**: Robust error recovery with multiple execution paths

### **🔧 Comprehensive Tool Ecosystem (26+ Tools)**

**Document & Knowledge Management:**
- `searchInternalKnowledgeBase` - Semantic search across knowledge base
- `getFileContents` - Direct document access and retrieval
- `createDocument` - Dynamic document generation
- `updateDocument` - Content modification and versioning
- `listDocuments` - Knowledge base exploration
- `queryDocumentRows` - Structured data queries

**Asana Project Management Suite (12 Tools):**
- `asana_get_user_info` - User profile and permissions
- `asana_list_projects` - Project discovery and listing
- `asana_get_project_details` - Detailed project information
- `asana_create_project` - New project creation
- `asana_list_tasks` - Task management and filtering
- `asana_get_task_details` - Comprehensive task information
- `asana_create_task` - Task creation with dependencies
- `asana_update_task` - Task modification and status updates
- `asana_list_users` - Team member management
- `asana_search_entity` - Cross-entity search capabilities
- `asana_list_subtasks` - Hierarchical task management
- `asana_add_followers` - Team collaboration features

**External Integrations:**
- `tavilySearch` - Real-time web search with source attribution
- `tavilyExtract` - Deep content extraction from web sources
- `googleCalendar` - Full calendar integration and scheduling
- `getWeatherTool` - Location-based weather information

**Cross-Context Communication:**
- `getMessagesFromOtherChat` - Inter-conversation context sharing
- `requestSuggestions` - AI-powered response suggestions

### **💾 Advanced Memory Management**
- **Conversational Memory**: Persistent context across sessions
- **Context Bleeding Prevention**: Intelligent filtering of problematic patterns
- **Cross-UI Context**: Seamless context sharing between interface components
- **Client-Specific Memory**: Tailored memory management per client configuration

### **🎭 Dynamic Specialist Personas**
- **Client-Aware Branding**: Automatic injection of client display names and missions
- **Custom Instructions**: Client-specific behavioral guidelines
- **Tool Access Control**: Specialist-specific tool permissions and preferences
- **Contextual Adaptation**: Dynamic persona adjustment based on conversation context

## 🛠️ **Technology Stack**

### **Core Technologies**
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **Styling**: Tailwind CSS with custom component library
- **AI/ML**: Hybrid LangChain + LangGraph + Vercel AI SDK architecture
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js with session management
- **Deployment**: Vercel with edge functions

### **AI Architecture**
- **Orchestration**: Custom BrainOrchestrator with intelligent routing
- **State Management**: LangGraph state graphs for complex reasoning
- **Tool Integration**: 26+ specialized tools with context-aware selection
- **Context Management**: Multi-tiered context with specialist personas
- **Memory Systems**: Conversation persistence with bleeding prevention

## 📁 **Project Structure**

```
ET_v001/
├── app/                          # Next.js app directory
│   ├── (auth)/                  # Authentication routes
│   ├── (chat)/                  # Chat interface and API routes
│   │   └── api/
│   │       ├── documents/       # Document management endpoints
│   │       ├── files/           # File upload and processing
│   │       └── history/         # Conversation history
│   ├── api/
│   │   ├── brain/              # 🧠 Main brain orchestrator endpoint
│   │   ├── chat/               # Chat processing endpoints
│   │   └── messages/           # Message management
│   └── components/             # Page-level components
├── components/                  # Reusable UI components
│   ├── chat-header.tsx         # Specialist selection interface
│   └── ui/                     # Base UI component library
├── lib/                        # 🏗️ Core application logic
│   ├── ai/                     # AI/ML functionality
│   │   ├── graphs/             # 🔀 LangGraph implementations
│   │   │   ├── base.ts         # Base graph factory
│   │   │   ├── simpleLangGraphWrapper.ts  # Main LangGraph wrapper
│   │   │   └── types.ts        # Graph state definitions
│   │   ├── tools/              # 🛠️ 26+ Tool integrations
│   │   │   ├── asana/          # Comprehensive Asana integration
│   │   │   ├── document/       # Knowledge base tools
│   │   │   ├── external/       # Web search, calendar, weather
│   │   │   └── index.ts        # Tool registry and selection
│   │   ├── prompts/            # 📝 Prompt management
│   │   │   ├── core/           # Base prompt composition
│   │   │   ├── specialists/    # Specialist persona definitions
│   │   │   └── loader.ts       # Dynamic prompt loading
│   │   └── executors/          # Agent execution logic
│   ├── services/               # 🎯 Business logic services
│   │   ├── brainOrchestrator.ts     # 🧠 Central coordination service
│   │   ├── langchainBridge.ts       # LangChain integration bridge
│   │   ├── contextService.ts        # Context processing and management
│   │   ├── messageService.ts        # Message formatting and filtering
│   │   ├── observabilityService.ts  # Logging and monitoring
│   │   └── validationService.ts     # Request validation
│   ├── db/                     # Database layer
│   │   ├── queries.ts          # Database operations
│   │   └── repositories/       # Data access patterns
│   └── validation/             # Schema validation
├── context/                    # React context providers
├── hooks/                      # Custom React hooks
└── types/                      # TypeScript type definitions
```

## 🚀 **Installation & Setup**

### **Prerequisites**
- Node.js 18+
- PostgreSQL database
- Required API keys (see Environment Variables)

### **Quick Start**
```bash
# Clone the repository
git clone <repository-url>
cd ET_v001

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configurations

# Run database migrations
pnpm run db:migrate

# Start development server
pnpm run dev
```

### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AI/ML Services
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Tool Integrations
TAVILY_API_KEY="tvly-..."
GOOGLE_CALENDAR_CLIENT_ID="..."
GOOGLE_CALENDAR_CLIENT_SECRET="..."
ASANA_ACCESS_TOKEN="..."
WEATHER_API_KEY="..."
```

## 🔧 **Configuration & Customization**

### **Brain Orchestrator Configuration**
```typescript
const orchestratorConfig: BrainOrchestratorConfig = {
  enableHybridRouting: true,           // Enable intelligent path selection
  enableLangGraph: true,               // Enable complex reasoning
  langGraphForComplexQueries: true,    // Pattern-based LangGraph routing
  enableClassification: true,          // Query pattern analysis
  fallbackToLangChain: true,          // Error recovery
  maxRetries: 2,                      // Retry attempts
  timeoutMs: 30000,                   // Request timeout
};
```

### **Specialist Configuration**
```typescript
// Add new specialists in lib/ai/prompts/specialists/
export const customSpecialistConfig: SpecialistConfig = {
  id: 'custom-specialist',
  name: 'Custom Specialist',
  description: 'Specialized for specific domain',
  persona: `# Role: Custom Domain Expert...`,
  defaultTools: ['tool1', 'tool2', ...],
};
```

## 🧪 **Usage Examples**

### **Complex Multi-Step Reasoning (LangGraph)**
```
User: "Analyze our Q4 project timeline, check for conflicts with team calendars, 
and create a summary document with recommendations"

System Flow:
1. Query Classification → MULTI_STEP + TOOL_OPERATION patterns detected
2. Route to LangGraph → Complex reasoning workflow activated
3. Tool Sequence:
   - asana_list_projects (Q4 projects)
   - googleCalendar (team availability)
   - createDocument (summary generation)
4. State Management → Maintains context across tool calls
5. Response → Comprehensive analysis with source attribution
```

### **Simple Information Retrieval (LangChain)**
```
User: "What's the weather in San Francisco?"

System Flow:
1. Query Classification → Simple information request
2. Route to LangChain → Direct tool execution
3. Tool: getWeatherTool
4. Response → Current weather data
```

### **Specialist Context Example**
```
User Context: Echo Tango client, chat-model specialist active
System Behavior:
- Injects "Echo Tango" branding in responses
- Applies client-specific mission statement
- Uses client custom instructions
- Accesses full tool suite with Echo Tango context
```

## 📊 **Development & Monitoring**

### **Available Scripts**
```bash
pnpm run dev          # Start development server
pnpm run build        # Build for production  
pnpm run start        # Start production server
pnpm run test         # Run test suite
pnpm run db:migrate   # Run database migrations
pnpm run db:studio    # Open database studio
pnpm run lint         # Run linting
pnpm run type-check   # TypeScript type checking
```

### **Observability Features**
- **Request Correlation**: Unique correlation IDs for request tracing
- **Performance Metrics**: Execution time tracking per component
- **Tool Usage Analytics**: Comprehensive tool usage statistics
- **Error Tracking**: Structured error logging with context
- **Pattern Analysis**: Query classification metrics and insights

### **Testing Strategy**
- **Unit Tests**: Individual service and component testing
- **Integration Tests**: End-to-end workflow validation
- **Tool Tests**: Comprehensive tool integration testing
- **LangGraph Tests**: State graph execution validation

## 🚀 **Deployment**

### **Vercel Deployment (Recommended)**
```bash
# Install Vercel CLI
pnpm i -g vercel

# Deploy to Vercel
vercel

# Configure environment variables in Vercel dashboard
# Set up database connection and API keys
```

### **Production Configuration**
- **Database**: Configure PostgreSQL with connection pooling
- **API Keys**: Set all required service API keys
- **Monitoring**: Enable error tracking and performance monitoring
- **Caching**: Configure edge caching for optimal performance

## 🎯 **Key Architectural Decisions**

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

## 📈 **Performance & Scalability**

### **Optimization Features**
- **Intelligent Routing**: Optimal execution path selection for performance
- **Tool Selection**: Context-aware tool filtering reduces noise and latency
- **Memory Management**: Efficient conversation history with smart truncation
- **Streaming Responses**: Real-time response generation for better UX
- **Edge Functions**: Fast response times with Vercel Edge Runtime

### **Monitoring & Analytics**
- **Request Tracing**: Full request lifecycle visibility
- **Tool Usage Metrics**: Comprehensive tool performance analytics
- **Pattern Recognition**: Query classification effectiveness tracking
- **Error Rates**: System reliability and failure pattern analysis

## 🤝 **Contributing & Maintenance**

### **Code Quality Standards**
- **TypeScript**: Full type safety with strict configuration
- **Modular Design**: Clean separation of concerns with service layers
- **Documentation**: Comprehensive inline documentation and type definitions
- **Testing**: Extensive test coverage for critical components
- **Linting**: Biome for fast linting and consistent formatting

### **Architecture Principles**
- **Single Responsibility**: Each service has a clear, focused purpose
- **Dependency Injection**: Services are composable and testable
- **Error Boundaries**: Comprehensive error handling at all levels
- **Observability**: Every component includes proper logging and metrics
- **Scalability**: Architecture supports horizontal and vertical scaling

---

**Built with ❤️ as a next-generation RAG platform** | **Last Updated**: January 2025

*This system represents a significant advancement in RAG architecture, combining the reliability of traditional approaches with cutting-edge reasoning capabilities for production-ready AI applications.*