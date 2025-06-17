# LangGraph Modular Architecture

This directory contains the modular LangGraph implementation for the Quibit RAG system, replacing the monolithic `SimpleLangGraphWrapper.ts` with a clean, maintainable architecture.

## 🏗️ **Directory Structure**

```
lib/ai/graphs/
├── nodes/              # Individual graph node implementations
│   ├── agent.ts        # Agent decision-making node
│   ├── tools.ts        # Tool execution node  
│   └── generateResponse.ts # Unified response generation node
├── prompts/            # LangGraph-specific prompt templates
│   ├── agent.prompt.ts      # Agent reasoning prompts
│   ├── synthesis.prompt.ts  # Comprehensive analysis prompts
│   ├── simpleResponse.prompt.ts # Direct response prompts
│   ├── conversational.prompt.ts # Interactive dialogue prompts
│   └── loader.ts           # Graph prompt loading service
├── services/           # Business logic services
│   ├── DocumentAnalysisService.ts # Document scenario analysis
│   └── ContextService.ts          # Context optimization
├── state.ts           # Graph state definitions and utilities
├── router.ts          # Conditional routing logic
├── graph.ts           # Graph assembly and compilation
└── README.md          # This documentation
```

## 📋 **Implementation Status**

### ✅ **Phase 1 Complete: Project Restructuring & Prompt Externalization**

- [x] **Directory Structure**: Created modular file organization
- [x] **State Management**: Extracted and enhanced `GraphStateAnnotation` with observability features
- [x] **Prompt Templates**: Externalized all hardcoded prompts into dedicated templates
  - Agent reasoning prompts with tool usage guidelines
  - Synthesis prompts for comprehensive analysis
  - Simple response prompts for direct answers
  - Conversational prompts for interactive dialogue
- [x] **Prompt Service**: Created graph-specific prompt loading service
- [x] **Type Definitions**: Enhanced type safety with utility functions
- [x] **Documentation**: Comprehensive README and inline documentation

### 🚧 **Next: Phase 2 - Node Logic & Router Refactoring**

## 🔄 **Architecture Overview**

The graph follows a **ReAct (Reason-Act-Observe) pattern**:

```
START → Agent → Tools → Agent → Generate Response → END
                ↑_______|        |
                                 ↓
                               END
```

### **Control Flow Principles**

1. **Agent Node**: Analyzes queries and decides on actions (tools vs. final response)
2. **Tools Node**: Executes requested tools and returns results
3. **Agent Node**: Processes tool results and decides next action
4. **Generate Response Node**: Creates final formatted responses
5. **Router**: Manages flow between nodes with corrected logic

**Key Principle**: Tools ALWAYS return to Agent for result processing (ReAct pattern).

## 📝 **Enhanced State Management**

### **Core State Fields**
```typescript
export const GraphStateAnnotation = Annotation.Root({
  messages: BaseMessage[],           // Message history
  input: string,                     // User input
  agent_outcome: AIMessage,          // Agent's response
  ui: UIMessage[],                   // UI streaming messages
  iterationCount: number,            // Execution tracking
  needsSynthesis: boolean,           // Response complexity flag
  
  // NEW: Enhanced observability
  response_mode: 'synthesis' | 'simple' | 'conversational',
  node_execution_trace: string[],    // Node execution path
  tool_workflow_state: {...},       // Tool execution tracking
});
```

### **State Utilities**
```typescript
// Utility functions for state management
getLastHumanMessage(state: GraphState): string
getToolMessages(state: GraphState): BaseMessage[]
hasToolCalls(state: GraphState): boolean
getExecutionTrace(state: GraphState): string
isReadyForResponse(state: GraphState): boolean
```

## 🎯 **Prompt Templates**

### **Agent Prompt** (`prompts/agent.prompt.ts`)
- **Purpose**: Guide agent decision-making for tool usage
- **Features**: Tool usage guidelines, response flow control
- **Context**: Available tools, response mode, current date

### **Synthesis Prompt** (`prompts/synthesis.prompt.ts`)
- **Purpose**: Comprehensive analysis and report generation
- **Features**: Academic rigor, citation guidelines, structured formatting
- **Context**: User query, tool results, references

### **Simple Response Prompt** (`prompts/simpleResponse.prompt.ts`)
- **Purpose**: Direct, concise answers to straightforward queries
- **Features**: Clear formatting, natural citations, focused responses
- **Context**: User query, available information

### **Conversational Prompt** (`prompts/conversational.prompt.ts`)
- **Purpose**: Natural, engaging dialogue responses
- **Features**: Warm tone, follow-up questions, accessible explanations
- **Context**: Conversation history, user query, information

## ⚙️ **Prompt Service Integration**

### **Graph Prompt Loader**
```typescript
// Load graph-specific prompts
await loadGraphPrompt({
  nodeType: 'agent' | 'synthesis' | 'simple' | 'conversational',
  state: GraphState,
  currentDateTime: string,
  availableTools: string[],
});

// Determine appropriate response mode
const mode = determineResponseMode(userQuery);
// Returns: 'synthesis' | 'simple' | 'conversational'
```

### **Integration with Existing System**
- Graph prompts are **separate** from specialist prompts
- Specialist prompts (stored in database) handle persona/role definitions
- Graph prompts handle node execution logic and response generation
- Both systems can work together for enhanced functionality

## 🔧 **Development Guidelines**

### **Adding New Nodes**
1. Create node function in `nodes/[name].ts`
2. Create prompt template in `prompts/[name].prompt.ts`
3. Add prompt formatter function
4. Update router logic if needed
5. Add to graph assembly in `graph.ts`
6. Update this documentation

### **Modifying Prompts**
1. Edit the appropriate prompt template file
2. Test with various scenarios
3. Update formatter function if parameters change
4. Document any breaking changes

### **State Management**
1. All state changes should be immutable
2. Use the provided utility functions
3. Add new state fields to `GraphStateAnnotation` if needed
4. Update type definitions accordingly

## 🧪 **Testing Strategy**

### **Logical Milestone Testing**
- **Phase 1**: Verify state extraction and prompt loading
- **Phase 2**: Test individual node functions
- **Phase 3**: Validate routing logic
- **Phase 4**: End-to-end integration testing

### **Test Coverage Areas**
- State utility functions
- Prompt template loading
- Error handling and fallbacks
- Integration with existing systems

## 🎉 **Benefits of This Architecture**

### **Maintainability**
- **200 LOC Rule**: Each file stays focused and manageable
- **Clear Separation**: Distinct responsibilities for each component
- **Easy Testing**: Individual components can be tested in isolation

### **Extensibility**
- **New Nodes**: Easy to add specialized processing nodes
- **Custom Prompts**: Simple to create domain-specific prompt templates
- **Enhanced Routing**: Router logic can be extended for complex scenarios

### **Observability**
- **Execution Tracing**: Track which nodes execute and in what order
- **Performance Monitoring**: Measure individual node execution times
- **Error Tracking**: Isolate failures to specific components

### **Development Velocity**
- **Parallel Development**: Multiple developers can work on different components
- **Focused Debugging**: Issues are isolated to specific nodes
- **Rapid Iteration**: Changes to one component don't affect others

---

## 🚀 **Next Steps**

Ready to begin **Phase 2: Node Logic & Router Refactoring**

This involves:
1. Creating functional node implementations
2. Implementing the corrected router logic
3. Building the graph assembly system
4. Extracting business logic to services

The foundation is now solid for the major architectural transformation! 