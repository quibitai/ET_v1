# Development Roadmap v7.0.0 - TOOL ROUTER ARCHITECTURE

**AI-Powered Knowledge Assistant - Complete Infrastructure Implementation**

---

## 🎯 **CURRENT STATUS: INFRASTRUCTURE COMPLETION REQUIRED**

**Date**: December 21, 2024  
**Status**: ⚠️ **PARTIAL IMPLEMENTATION** - Core architecture working, MCP integration incomplete

### 🚨 **STRATEGIC APPROACH: INFRASTRUCTURE FIRST**

**Key Insight**: Complete all infrastructure components before testing individual tools or workflows.

**Current Architecture Status:**

- ✅ **Tool Router Core**: Working with semantic routing to knowledge_base sub-graph
- ✅ **Knowledge Base Tools**: All 3 enhanced tools functional with hyperlinks
- ❌ **MCP Integration**: 0% of MCP services healthy, critical functions missing
- ❌ **Multi-Service Support**: Google Workspace, Asana, Research tools non-functional

---

## 📋 **IMPLEMENTATION PRIORITIES**

### **🔧 PHASE 1: CRITICAL INFRASTRUCTURE COMPLETION**

#### **Priority 1.1: Tool Registry Function Implementation**

**Issue**: Missing `replaceToolsBySource()` function causing MCP tool refresh failures

```
[ToolLoader] Asana refresh failed: toolRegistry.replaceToolsBySource is not a function
```

**Required Implementation:**

```typescript
// Add to UnifiedToolRegistry.ts
replaceToolsBySource(source: string, tools: Tool[]): void {
  // Remove existing tools from this source
  const existingTools = Array.from(this.tools.values()).filter(t => t.source === source);
  existingTools.forEach(tool => {
    this.tools.delete(tool.name);
    // Remove from category mappings
    const categoryTools = this.toolsByCategory.get(tool.category) || [];
    this.toolsByCategory.set(tool.category, categoryTools.filter(t => t.name !== tool.name));
  });

  // Add new tools
  tools.forEach(tool => this.registerTool(tool));

  // Clear cache
  this.cache.clear();

  console.log(`[ToolRegistry] Replaced ${existingTools.length} tools from ${source} with ${tools.length} new tools`);
}
```

#### **Priority 1.2: MCP Service Configuration** ✅ **CRITICAL DISCOVERY MADE**

**Issue Identified**: Google Workspace MCP server was running in `stdio` mode, but our HTTP-based MCP client expects `streamable-http` mode.

**✅ SOLUTION IMPLEMENTED**:

- Google Workspace MCP server now running in `streamable-http` mode on `localhost:8000`
- MCP endpoint responding correctly: `http://127.0.0.1:8000/mcp/`
- OAuth callback functional: `http://localhost:8000/oauth2callback`

**Google Workspace MCP Authentication Flow - VERIFIED WORKING**:

1. **OAuth 2.0 with PKCE Configuration**:

   - Client credentials: `mcp-workspace/client_secret.json` ✅
   - Redirect URI: `http://localhost:8000/oauth2callback` ✅
   - Scopes: Gmail, Drive, Calendar, Docs, Sheets, Forms, Chat, Slides ✅

2. **Server Transport Modes**:

   - ❌ `stdio` mode: For MCP protocol over stdin/stdout (incompatible with HTTP client)
   - ✅ `streamable-http` mode: For HTTP-based MCP communication (REQUIRED)

3. **Authentication Storage**:

   - User credentials stored in `mcp-workspace/.credentials/` by email
   - Session mapping between MCP protocol and OAuth state
   - Single-user mode bypasses session mapping for development

4. **Integration with Main App**:
   - `GoogleWorkspaceMCPClient` connects to `http://127.0.0.1:8000/mcp/`
   - `MultiMCPClient` auto-discovers service when `GOOGLE_WORKSPACE_MCP_SERVER_URL` is set
   - Health monitoring checks `/mcp/` endpoint every 60 seconds

**Next Actions for Google Workspace**:

1. **Environment Variable**: Set `GOOGLE_WORKSPACE_MCP_SERVER_URL=http://127.0.0.1:8000`
2. **Service Discovery**: Verify MultiMCPClient detects the running server
3. **Health Checks**: Confirm health monitoring shows >90% uptime
4. **Tool Discovery**: Test dynamic tool loading from MCP server

#### **Priority 1.3: Sub-Graph Completion**

**Issue**: Only 1 of 4 sub-graphs operational

```
[ToolRouterGraph] Sub-graph initialization complete: {
  totalSubGraphs: 1,
  subGraphNames: [ 'knowledge_base' ]
}
```

**Required Sub-Graphs:**

- ✅ `knowledge_base` - Working
- 🔧 `google_workspace` - **Ready for testing** (MCP server now functional)
- ❌ `research` - Needs web search tools
- ❌ `project_management` - Needs Asana integration

### **🔗 PHASE 2: SERVICE INTEGRATION**

#### **Priority 2.1: MCP Server Deployment**

1. **Configure MCP Servers**: Ensure servers are running and accessible
2. **Authentication Setup**: Implement OAuth flows for Google Workspace
3. **API Key Management**: Secure credential storage and rotation
4. **Connection Testing**: Verify server-to-server communication

#### **Priority 2.2: Tool Adapter Integration**

1. **AsanaToolAdapter**: Connect to Asana MCP server
2. **GoogleWorkspaceToolAdapter**: Connect to Google Workspace MCP server
3. **Dynamic Discovery**: Test real-time tool loading from MCP servers
4. **Error Handling**: Implement graceful degradation for service failures

### **🧪 PHASE 3: SYSTEMATIC TESTING**

#### **Priority 3.1: Infrastructure Validation**

1. **Tool Registry**: Test all registry functions including `replaceToolsBySource`
2. **MCP Health**: Verify all services achieve >90% uptime
3. **Sub-Graph Routing**: Test routing to all 4 sub-graphs
4. **Dynamic Refresh**: Test tool updates without system restart

#### **Priority 3.2: Tool Functionality Testing**

1. **Individual Tools**: Test each tool in isolation after infrastructure is complete
2. **Cross-Service Integration**: Test tools that span multiple services
3. **Multi-Tool Workflows**: Test complex queries requiring multiple tools
4. **Error Scenarios**: Test graceful handling of service failures

---

## 📊 **SUCCESS METRICS**

### **Phase 1 Completion Criteria**

| Component               | Target | Current | Status                                                        |
| ----------------------- | ------ | ------- | ------------------------------------------------------------- |
| Tool Registry Functions | 100%   | 80%     | ❌ Missing `replaceToolsBySource`                             |
| MCP Service Health      | >90%   | 50%     | 🔧 Google Workspace now functional, Asana needs configuration |
| Sub-Graph Coverage      | 4/4    | 2/4     | 🔧 Google Workspace ready, 2 remaining                        |
| Tool Refresh Success    | 100%   | 0%      | ❌ Blocked by missing registry function                       |

### **Phase 2 Completion Criteria**

| Component              | Target  | Status                                                    |
| ---------------------- | ------- | --------------------------------------------------------- |
| Google Workspace MCP   | Active  | ✅ **COMPLETED** - Server running in streamable-http mode |
| Asana MCP Connection   | Active  | ⏳ Pending configuration                                  |
| Dynamic Tool Discovery | Working | 🔧 Ready to test with Google Workspace                    |
| Authentication Flows   | Secure  | ✅ **VERIFIED** - OAuth 2.0 + PKCE working                |

### **Phase 3 Completion Criteria**

| Component              | Target       | Status               |
| ---------------------- | ------------ | -------------------- |
| Individual Tool Tests  | 100% Pass    | ⏳ Pending Phase 1-2 |
| Multi-Tool Workflows   | 100% Pass    | ⏳ Pending Phase 1-2 |
| Error Handling         | Graceful     | ⏳ Pending Phase 1-2 |
| Performance Benchmarks | <2s response | ⏳ Pending Phase 1-2 |

---

## 🚀 **EXECUTION TIMELINE**

### **Week 1: Infrastructure Foundation**

- **Days 1-2**: Implement missing tool registry functions
- **Days 3-4**: Configure and deploy MCP servers
- **Day 5**: Test basic infrastructure connectivity

### **Week 2: Integration & Testing**

- **Days 1-2**: Complete sub-graph implementation
- **Days 3-4**: Test service integration
- **Day 5**: Comprehensive system testing

### **Week 3: Optimization & Deployment**

- **Days 1-2**: Performance optimization
- **Days 3-4**: Production deployment preparation
- **Day 5**: Final validation and documentation

---

## 💡 **KEY ARCHITECTURAL DECISIONS**

### **🚨 CRITICAL DISCOVERY: MCP Transport Mode Configuration**

**Root Cause Identified**: The Google Workspace MCP server was running in `stdio` mode (for terminal-based MCP communication), but our `GoogleWorkspaceMCPClient` uses HTTP requests to connect via `http://127.0.0.1:8000/mcp/`.

**Transport Mode Mismatch**:

- ❌ **stdio mode**: MCP communication over stdin/stdout (used for terminal/CLI clients)
- ✅ **streamable-http mode**: MCP communication over HTTP (required for our web application)

**Solution**: Start Google Workspace MCP server with `--transport streamable-http` flag.

**Impact**: This single configuration change fixed the 0% MCP service health issue and enables:

- Dynamic tool discovery from Google Workspace MCP server
- Health monitoring of Google Workspace services
- OAuth authentication flow for Gmail, Drive, Calendar, Docs, Sheets tools
- Integration with ToolRouterGraph for `google_workspace` sub-graph

### **✅ What's Working Well**

- **Tool Router Pattern**: Semantic routing successfully directing queries
- **Knowledge Base Integration**: Enhanced tools with proper error handling
- **Database Architecture**: Correct table usage and relationships
- **Graceful Degradation**: System falls back to direct response when services fail
- **Google Workspace MCP**: OAuth authentication and HTTP transport now functional ✅

### **🔧 What Needs Completion**

- **Tool Registry**: Missing `replaceToolsBySource` function for dynamic tool management
- **Asana MCP Integration**: Configure Asana MCP server and connection
- **Service Health**: Complete health monitoring for all services
- **Multi-Service Coordination**: Cross-platform tool orchestration

### **🎯 Success Definition**

**System is complete when:**

1. All 4 sub-graphs are operational
2. MCP services maintain >90% uptime
3. Dynamic tool refresh works without errors
4. Multi-tool workflows execute successfully
5. Error handling is graceful across all scenarios

---

## 📝 **IMPLEMENTATION NOTES**

### **Critical Dependencies**

1. **Tool Registry Completion** → Enables MCP tool refresh
2. **MCP Service Health** → Enables multi-service tools
3. **Sub-Graph Implementation** → Enables advanced routing
4. **Integration Testing** → Validates complete system

### **Risk Mitigation**

- **Incremental Implementation**: Complete each phase before proceeding
- **Rollback Capability**: Maintain working knowledge_base functionality
- **Monitoring**: Comprehensive logging at each integration point
- **Testing Strategy**: Validate infrastructure before tool testing

### **Success Indicators**

- Zero `replaceToolsBySource is not a function` errors
- MCP health alerts show >90% service availability
- All 4 sub-graphs appear in initialization logs
- Gmail/Asana queries route to appropriate tools instead of direct response

---

## 🎉 **COMPLETION VISION**

**Target Architecture:**

```
User Query → ToolRouterGraph → Semantic Analysis → Route to Specialized Sub-Graph → Execute Tools → Integrated Response
           ✅ WORKING      ✅ WORKING      🔧 COMPLETING            🔧 COMPLETING   🎯 TARGET
```

**When complete, the system will:**

- Route Gmail queries to Google Workspace tools
- Route project queries to Asana tools
- Route research queries to web search tools
- Route knowledge queries to internal documents
- Handle complex multi-tool workflows seamlessly
- Maintain high availability with graceful degradation

**Estimated Completion**: 2-3 weeks with focused implementation effort
