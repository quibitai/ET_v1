# Simple, Modular Tool Registry System

## 🎯 **Overview**

This document describes the new **Unified Tool Registry System** - a simple, modular approach to tool registration and calling that follows best practices and solves the current tool selection issues.

## ❌ **Problems Solved**

### Current Issues Identified:
1. **Wrong Tool Selection**: LLM calling `googleCalendar` instead of Asana tools
2. **Complex Tool Loading**: Multiple scattered files with different patterns
3. **Poor Tool Descriptions**: Tools lack clear, LLM-friendly descriptions
4. **JSON Parsing Errors**: Tool result processing failures
5. **Database/Runtime Disconnect**: Database serves as source of truth but runtime loading is disconnected

### Root Cause:
The current system has **unclear tool descriptions** and **scattered tool registration logic**, making it difficult for the LLM to select the correct tools.

## ✅ **Solution Architecture**

### **Core Principles:**
1. **Single Source of Truth**: One registry for all tools
2. **Clear Tool Descriptions**: LLM-friendly names, descriptions, and examples
3. **Modular Design**: Easy to add/remove tools
4. **Type Safety**: Proper TypeScript interfaces
5. **Unified Interface**: Standard and MCP tools use same interface

### **Architecture:**
```
lib/ai/tools/registry/
├── types.ts                 # Core interfaces
├── UnifiedToolRegistry.ts   # Main registry class
├── ToolLoader.ts           # Tool loading service
├── index.ts                # Simple API exports
└── adapters/
    ├── AsanaToolAdapter.ts  # Asana MCP → Unified interface
    └── GoogleWorkspaceToolAdapter.ts  # Future
```

## 🔧 **Implementation**

### **1. Core Types** (`types.ts`)

```typescript
interface Tool {
  // Core identification
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  
  // LLM-friendly metadata
  usage: string;              // When to use this tool
  examples: string[];         // Example queries
  
  // Parameters & execution
  parameters: ToolParameter[];
  execute: (params, context) => Promise<ToolResult>;
  
  // Metadata
  source: 'standard' | 'mcp';
  isEnabled: boolean;
  requiresAuth?: boolean;
}
```

### **2. Unified Registry** (`UnifiedToolRegistry.ts`)

```typescript
class UnifiedToolRegistry {
  // Register tools
  registerTool(tool: Tool): void
  registerTools(tools: Tool[]): void
  
  // Discover tools
  getTools(filter?: ToolFilter): Tool[]
  findTools(query: string): Tool[]  // For LLM selection
  
  // Execute tools
  executeTool(name: string, params: any, context: ToolContext): Promise<ToolResult>
  
  // Utilities
  getStats(): RegistryStats
}
```

### **3. Tool Loader** (`ToolLoader.ts`)

```typescript
class ToolLoader {
  async initialize(): Promise<void>
  getTools(): Tool[]
  async getToolsForContext(context: ToolContext): Promise<Tool[]>
  
  private async loadStandardTools(): Promise<void>
  private async loadMCPTools(): Promise<void>
}
```

### **4. Simple API** (`index.ts`)

```typescript
// Initialize once at startup
export async function initializeTools(): Promise<void>

// Get tools (replaces getAvailableTools)
export async function getAvailableTools(context: ToolContext): Promise<Tool[]>

// Execute tools
export async function executeTool(name: string, params: any, context: ToolContext)

// Find tools for LLM selection
export function findTools(query: string): Tool[]
```

## 🚀 **Key Features**

### **1. Clear Tool Descriptions**
Each tool has:
- **Clear name**: `asana_list_projects` vs generic names
- **Display name**: "List Asana Projects"
- **Usage description**: "Use when user asks to see their projects"
- **Examples**: `["list my projects", "show me my asana projects"]`

### **2. Smart Tool Discovery**
```typescript
// LLM can find tools by:
findTools("asana projects")     // Returns asana_list_projects
findTools("list my tasks")      // Returns asana_list_tasks
findTools("web search")         // Returns tavilySearch
```

### **3. Unified Execution**
```typescript
// Same interface for all tools
const result = await executeTool('asana_list_projects', {}, context);
const result = await executeTool('tavilySearch', { query: 'news' }, context);
```

### **4. MCP Tool Adapters**
Converts MCP tools to unified interface:
```typescript
class AsanaToolAdapter {
  getTools(): Tool[] {
    return [
      {
        name: 'asana_list_projects',
        displayName: 'List Asana Projects',
        description: 'List all projects in Asana workspace',
        usage: 'Use when user asks to see their projects',
        examples: ['list my projects', 'show me my asana projects'],
        execute: async (params, context) => {
          return await this.mcpClient.listProjects(params.workspace_gid);
        }
      }
    ];
  }
}
```

## 📊 **Tool Categories**

```typescript
enum ToolCategory {
  // Productivity
  TASK_MANAGEMENT = 'task_management',
  PROJECT_MANAGEMENT = 'project_management',
  CALENDAR = 'calendar',
  EMAIL = 'email',
  
  // Information
  SEARCH = 'search',
  DOCUMENTS = 'documents',
  KNOWLEDGE = 'knowledge',
  
  // Communication
  MESSAGING = 'messaging',
  COLLABORATION = 'collaboration',
  
  // Utilities
  FILE_OPERATIONS = 'file_operations',
  DATA_ANALYSIS = 'data_analysis'
}
```

## 🔄 **Migration Path**

### **Phase 1: Implement Core System** ✅
- [x] Create unified types and interfaces
- [x] Implement UnifiedToolRegistry class
- [x] Create ToolLoader service
- [x] Build simple API exports

### **Phase 2: Create Tool Adapters** ✅
- [x] Asana tool adapter with clear descriptions
- [ ] Google Workspace tool adapter
- [ ] Standard tool wrappers

### **Phase 3: Replace Current System**
- [ ] Update brainOrchestrator to use new system
- [ ] Replace `getAvailableTools()` calls
- [ ] Update LangGraph tool loading
- [ ] Remove old tool loading logic

### **Phase 4: Optimize**
- [ ] Add tool caching
- [ ] Implement tool filtering by specialist
- [ ] Add tool usage analytics
- [ ] Performance optimizations

## 🧪 **Testing**

### **Test Endpoint**: `/api/test-unified-tools`
```typescript
// Test all functionality
const stats = getToolStats();
const tools = await getAvailableTools();
const asanaTools = findTools('asana');
const result = await executeTool('asana_list_projects', {}, context);
```

### **Expected Results**:
```json
{
  "stats": {
    "totalTools": 12,
    "enabledTools": 12,
    "toolsByCategory": {
      "project_management": 6,
      "task_management": 3,
      "search": 2,
      "knowledge": 1
    },
    "toolsBySource": {
      "mcp": 9,
      "standard": 3
    }
  }
}
```

## 🎯 **Benefits**

### **1. Improved LLM Tool Selection**
- Clear, descriptive tool names
- Usage examples that match user queries
- Proper categorization

### **2. Simplified Development**
- One place to register tools
- Consistent interface for all tools
- Easy to add new tools

### **3. Better Debugging**
- Clear tool registry statistics
- Unified error handling
- Centralized logging

### **4. Modular Architecture**
- Easy to disable/enable tools
- Clean separation of concerns
- Future-proof design

## 🚦 **Next Steps**

1. **Test the new system** with the test endpoint
2. **Create Google Workspace adapter** following Asana pattern
3. **Update brainOrchestrator** to use new `getAvailableTools()`
4. **Migrate LangGraph** to use unified tool registry
5. **Remove old tool loading code** once migration is complete

## 📝 **Usage Examples**

### **Initialize at Startup**
```typescript
import { initializeTools } from '@/lib/ai/tools/registry';

// In your app startup
await initializeTools();
```

### **Get Tools for LLM**
```typescript
import { getAvailableTools } from '@/lib/ai/tools/registry';

// In brain orchestrator
const tools = await getAvailableTools({
  userId: session.user.id,
  clientId: 'echo-tango'
});
```

### **Execute Tool**
```typescript
import { executeTool } from '@/lib/ai/tools/registry';

// In tool execution
const result = await executeTool('asana_list_projects', {}, context);
```

This system provides the **simplest, most modular tool registration and calling system** that aligns with best practices and solves the current tool selection issues. 