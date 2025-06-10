# Quibit RAG System Documentation

> Comprehensive documentation for the advanced hybrid RAG system with Brain Orchestrator

**Status**: Active  
**Last Updated**: 2025-01-15  
**Version**: 3.0.0 - Brain Orchestrator Architecture

## Overview

This directory contains comprehensive documentation for the Quibit RAG system featuring a sophisticated **Brain Orchestrator** with hybrid AI routing, LangGraph integration for complex reasoning, and dynamic specialist personas.

## Documentation Structure

### Core Architecture
- **[System Architecture](../ARCHITECTURE.md)** - Complete system overview
- **[Hybrid Architecture](../HYBRID_ARCHITECTURE.md)** - Brain Orchestrator design
- **[LangGraph Integration](../LANGGRAPH_INTEGRATION_SUMMARY.md)** - Advanced reasoning workflows
- **[API Reference](./api/)** - Complete endpoint documentation

### AI & Orchestration
- **[Tools Documentation](./TOOLS.md)** - 26+ available tools and integrations
- **[Prompt System](./PROMPT_SYSTEM.md)** - Dynamic prompt composition and specialists
- **[Model Selection](./MODEL_SELECTION.md)** - AI model configuration and routing
- **[LangGraph Usage](./LANGGRAPH_USAGE.md)** - Complex reasoning implementation

### Development & Configuration
- **[Configuration Guide](./configuration-json-guide.md)** - Client and specialist configuration
- **[Debugging Guide](./debugging.md)** - Troubleshooting Brain Orchestrator
- **[Message Handling](./MESSAGE_HANDLING.md)** - Context and memory management
- **[Prompt Architecture](./prompt-architecture-guide.md)** - Advanced prompt composition

### Migration & Updates
- **[v2.5.0 Migration](./MIGRATION_GUIDE_v2.5.0.md)** - Vercel AI SDK migration
- **[v2.4.0 Migration](./MIGRATION_GUIDE_v2.4.0.md)** - Asana integration updates
- **[v2.3.0 Migration](./MIGRATION_GUIDE_v2.3.0.md)** - Tool architecture changes

## Current System Architecture (v3.0.0)

### **Brain Orchestrator Hybrid System**
The core innovation featuring:
- **Intelligent Routing**: Pattern-based query classification for optimal execution paths
- **LangGraph Integration**: Advanced state management for complex multi-step reasoning
- **Specialist System**: Dynamic AI personas with client-specific context injection
- **Memory Management**: Sophisticated conversational memory with context bleeding prevention

### **Technology Stack**
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **AI Orchestration**: Custom BrainOrchestrator with hybrid LangChain + LangGraph
- **State Management**: LangGraph state graphs for complex workflows
- **Database**: PostgreSQL with Drizzle ORM
- **Tools**: 26+ integrated tools with intelligent selection

### **Execution Paths**
1. **LangGraph Path**: Complex reasoning, multi-step workflows, tool operations
2. **LangChain Path**: Standard agent execution with tool calling
3. **Vercel AI Path**: Simple queries and fallback scenarios

## Key Features (v3.0.0)

### **🧠 Brain Orchestrator**
- **Query Classification**: Automatic pattern detection (TOOL_OPERATION, MULTI_STEP, REASONING)
- **Hybrid Routing**: Intelligent path selection based on query complexity
- **Context Management**: Multi-tiered context with specialist personas
- **Error Recovery**: Robust fallback strategies with multiple execution paths

### **🔀 LangGraph Integration**
- **State Management**: Proper graph state with message history and UI events
- **Conditional Routing**: Smart transitions between agent and tool nodes
- **Artifact Generation**: Real-time document and content creation
- **Complex Workflows**: Multi-step reasoning with maintained context

### **🎭 Specialist System**
- **Dynamic Personas**: Client-configurable AI specialists with custom instructions
- **Context Injection**: Automatic branding and mission statement integration
- **Tool Access Control**: Specialist-specific tool permissions and preferences
- **Prompt Composition**: Dynamic prompt loading with client context

### **🛠️ Advanced Tool Ecosystem**
- **26+ Tools Available**: Document management, Asana integration, external APIs
- **Intelligent Selection**: Context-aware tool filtering and relevance scoring
- **Cross-Context Communication**: Inter-conversation context sharing capabilities
- **Modular Architecture**: Easy tool addition and configuration

### **💾 Memory & Context**
- **Conversational Memory**: Persistent context across sessions
- **Context Bleeding Prevention**: Intelligent filtering of problematic patterns
- **Cross-UI Context**: Seamless context sharing between interface components
- **Client-Specific Memory**: Tailored memory management per client configuration

## Getting Started

### **For System Understanding**
1. **Architecture Overview**: Start with `../README.md` for system overview
2. **Brain Orchestrator**: Review `../HYBRID_ARCHITECTURE.md` for orchestration details
3. **LangGraph Integration**: Check `../LANGGRAPH_INTEGRATION_SUMMARY.md` for reasoning workflows
4. **Specialist System**: Read `./PROMPT_SYSTEM.md` for persona configuration

### **For Development**
1. **API Documentation**: Review `./api/` for endpoint specifications
2. **Tool Integration**: Check `./TOOLS.md` for available integrations
3. **Configuration**: Use `./configuration-json-guide.md` for setup
4. **Debugging**: Reference `./debugging.md` for troubleshooting

### **For Customization**
1. **Client Configuration**: Configure specialists and tools per client
2. **Prompt Customization**: Add custom instructions and branding
3. **Tool Selection**: Configure specialist-specific tool access
4. **Memory Settings**: Adjust conversation memory and context handling

## Architecture Highlights

### **Request Flow**
```
User Query → BrainOrchestrator → Query Classification → Path Selection
                                          ↓
                        Pattern Analysis (TOOL_OPERATION, MULTI_STEP, etc.)
                                          ↓
          LangGraph (Complex) ←→ LangChain (Standard) ←→ Vercel AI (Simple)
                                          ↓
                        Context Injection + Tool Selection + Memory Management
                                          ↓
                            Streaming Response with Artifacts
```

### **Service Architecture**
- **BrainOrchestrator** (`lib/services/brainOrchestrator.ts`): Central coordination
- **LangChain Bridge** (`lib/services/langchainBridge.ts`): Agent execution
- **Context Service** (`lib/services/contextService.ts`): Memory and client context
- **Message Service** (`lib/services/messageService.ts`): Conversation processing

## Contributing to Documentation

Please follow our [Documentation Style Guide](../DOCUMENTATION_STYLE_GUIDE.md) when contributing:

- Use clear, concise language with architecture-specific terminology
- Include code examples and configuration snippets
- Update version information and architectural diagrams
- Follow the Brain Orchestrator documentation patterns

## Performance & Monitoring

- **Request Correlation**: Unique correlation IDs for request tracing
- **Execution Metrics**: Path selection and performance timing
- **Tool Analytics**: Usage patterns and selection effectiveness
- **Pattern Recognition**: Query classification accuracy and insights

## Support & Resources

- **System Architecture**: Comprehensive guides in this documentation
- **Implementation Examples**: Code samples and configuration templates
- **Troubleshooting**: Detailed debugging guides and error resolution
- **Migration Support**: Version upgrade paths and compatibility guides

---

**Last Updated**: 2025-01-15  
**Architecture Version**: 3.0.0 - Brain Orchestrator Hybrid System  
**Maintained by**: Quibit Development Team 