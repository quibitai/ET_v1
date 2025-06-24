# Development Roadmap v6.0.0 - Production-Ready RAG Application

> **Single Source of Truth** - Supersedes all previous roadmaps and planning documents  
> **Created**: January 2025  
> **Focus**: Simplified, production-ready architecture with MCP integration  

## 🎯 Executive Summary

**Current State Assessment**: The existing architecture is over-engineered with a 3,766-line `SimpleLangGraphWrapper`, complex service layers, and theoretical abstractions that are hindering production deployment. This roadmap implements a **radical simplification** based on industry best practices.

**New Approach**: 
- **MCP-First Architecture**: Simple, stateless MCP servers following official TypeScript SDK patterns
- **Simplified LangGraph**: Replace complex wrappers with straightforward node-based patterns
- **Production-Focused**: Every task directly contributes to Vercel deployment readiness
- **Best Practices Alignment**: Follow proven patterns from official documentation

## 🚨 Critical Issues Resolution Plan

### Issue #1: Asana MCP Docker Environment Variables
**Problem**: Container cannot access Asana PAT from `.env.local`  
**Root Cause**: Improper Docker Compose environment variable mapping

**Solution**:
```yaml
# docker-compose.yml - Fix environment variable passing
services:
  asana-mcp:
    build: ./mcp-server-asana
    environment:
      - ASANA_ACCESS_TOKEN=${ASANA_ACCESS_TOKEN}
    env_file:
      - .env.local
    ports:
      - "8080:8080"
```

**Verification**: `docker logs asana-mcp` should show successful token loading

### Issue #2: Google Workspace MCP Unavailability
**Problem**: AI agent cannot reach Google Workspace MCP  
**Root Cause**: Service discovery and authentication issues

**Solution**:
```typescript
// Implement health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      oauth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
      credentials: fs.existsSync('./credentials.json') ? 'found' : 'missing'
    }
  });
});
```

**Verification**: `curl http://localhost:8001/health` returns 200 with service status

### Issue #3: LangGraph Agent Complexity
**Problem**: 3,766-line wrapper violates best practices  
**Root Cause**: Over-abstraction and unnecessary service layers

**Solution**: Replace with simple StateGraph pattern:
```typescript
// Simple LangGraph implementation
const workflow = new StateGraph(MessagesState)
  .addNode("agent", callModel)
  .addNode("tools", executeTools)
  .addConditionalEdges("agent", shouldContinue, {
    "continue": "tools",
    "end": END
  })
  .addEdge("tools", "agent")
  .compile();
```

### Issue #4: Inconsistent Agent Responses
**Problem**: No standardized response schema  
**Root Cause**: Multiple formatting layers creating inconsistency

**Solution**: Single response formatter:
```typescript
interface StandardResponse {
  content: string;
  sources?: Array<{ title: string; url: string }>;
  actions?: Array<{ type: string; data: any }>;
  metadata: { timestamp: string; model: string; tools_used: string[] };
}
```

### Issue #5: Inaccurate Tool Calling
**Problem**: Unreliable tool invocation logic  
**Root Cause**: Complex routing and schema validation

**Solution**: Direct tool execution pattern:
```typescript
async function executeTools(state: MessagesState) {
  const results = [];
  for (const toolCall of state.messages[-1].tool_calls) {
    const tool = toolRegistry.get(toolCall.name);
    const result = await tool.invoke(toolCall.args);
    results.push(new ToolMessage({ content: result, tool_call_id: toolCall.id }));
  }
  return { messages: results };
}
```

## 📅 Week 1: Foundation & Critical Fixes

### Day 1-2: Docker & Environment Setup
**Objective**: Fix MCP containerization and environment variable handling

**Tasks**:
- [ ] **Fix Asana MCP Docker Configuration**
  - Update `docker-compose.yml` with proper environment variable mapping
  - Add health check endpoints to both MCP servers
  - Test container startup with `docker-compose up --build`
  - Verify environment variables are accessible inside containers

- [ ] **Google Workspace MCP Connectivity**
  - Implement OAuth 2.0 flow with proper credential handling
  - Add service discovery endpoint at `/mcp/capabilities`
  - Configure networking between Next.js app and MCP containers
  - Test end-to-end connectivity with `curl` commands

**Acceptance Criteria**:
- Both MCP servers start successfully with `docker-compose up`
- Health endpoints return 200 status
- Environment variables properly loaded in containers
- MCP servers accessible from Next.js application

### Day 3: Complete LangGraph Transition
**Objective**: Finish transitioning from SimpleLangGraphWrapper to ModularLangGraphWrapper

**Current State**: ✅ ModularLangGraphWrapper (510 lines) already created with excellent architecture!

**Remaining Tasks**:
- [ ] **Update Main Exports** in `lib/ai/graphs/index.ts`:
  ```typescript
  // Replace SimpleLangGraphWrapper exports
  export { ModularLangGraphWrapper, createModularLangGraphWrapper } from './ModularLangGraphWrapper';
  export type { ModularLangGraphConfig } from './ModularLangGraphWrapper';
  ```
- [ ] **Update LangChain Bridge** in `lib/services/langchainBridge.ts`:
  ```typescript
  import type { ModularLangGraphWrapper } from '@/lib/ai/graphs/ModularLangGraphWrapper';
  ```
- [ ] **Update Tests** to use new wrapper
- [ ] **Remove old file** `simpleLangGraphWrapper.ts` (3,415 lines) once transition confirmed

**Acceptance Criteria**:
- All imports updated to use ModularLangGraphWrapper
- Existing functionality preserved (caching, metrics, streaming)
- Tests passing with new wrapper
- Old monolithic file removed

### Day 4-5: Integration Testing
**Objective**: Ensure all components work together

**Tasks**:
- [ ] **End-to-End Testing**
  - Test Asana tool execution through simplified LangGraph
  - Verify Google Workspace tools respond correctly
  - Test knowledge base tools (non-MCP) still function
  - Validate streaming responses work properly

**Acceptance Criteria**:
- All tool categories execute successfully
- Response times under 3 seconds for simple queries
- No memory leaks during extended testing
- Error messages are user-friendly

## 📅 Week 2: Production Deployment

### Day 6-8: Vercel Deployment Setup
**Objective**: Deploy application to Vercel with proper configuration

**Tasks**:
- [ ] **Environment Configuration**
  - Configure Vercel environment variables for all services
  - Set up proper secret management for API keys
  - Configure build environment for MCP server dependencies
  - Test deployment with staging environment

- [ ] **Docker Integration with Vercel**
  - Configure Vercel to work with external MCP services
  - Set up proper networking for MCP server communication
  - Implement fallback mechanisms for MCP unavailability
  - Add health monitoring for deployed services

**Acceptance Criteria**:
- Application deploys successfully to Vercel
- All environment variables properly configured
- MCP servers accessible from deployed application
- Health monitoring shows all services operational

### Day 9-10: Google OAuth Integration
**Objective**: Implement secure authentication limited to echotango.co workspace

**Tasks**:
- [ ] **OAuth 2.0 Implementation**
  - Configure Google OAuth for echotango.co domain restriction
  - Implement NextAuth.js with Google provider
  - Add user session management with proper scopes
  - Test authentication flow end-to-end

- [ ] **Security Configuration**
  - Implement domain restriction middleware
  - Add proper CSRF protection
  - Configure secure session storage
  - Test unauthorized access scenarios

**Acceptance Criteria**:
- Only echotango.co users can authenticate
- User sessions persist properly across requests
- Unauthorized access attempts are blocked
- Authentication flow works on deployed environment

## 📅 Week 3: Stabilization & Polish

### Day 11-12: Response Standardization
**Objective**: Implement consistent response formatting across all tools

**Tasks**:
- [ ] **Standard Response Schema**
  - Implement unified response interface
  - Add consistent error formatting
  - Implement source attribution for all responses
  - Add response validation

- [ ] **Error Handling**
  - Implement global error boundary
  - Add proper error logging and monitoring
  - Create user-friendly error messages
  - Add retry mechanisms for transient failures

**Acceptance Criteria**:
- All responses follow consistent format
- Error messages are helpful and actionable
- Source attribution works for all content types
- System gracefully handles all error scenarios

### Day 13-14: Performance & Monitoring
**Objective**: Optimize performance and add monitoring

**Tasks**:
- [ ] **Performance Optimization**
  - Implement response caching where appropriate
  - Optimize tool execution for common queries
  - Add request/response compression
  - Profile and optimize hot paths

- [ ] **Monitoring Implementation**
  - Add application performance monitoring
  - Implement health check endpoints
  - Add usage analytics and error tracking
  - Create operational dashboards

**Acceptance Criteria**:
- Response times under 2 seconds for 95% of queries
- System handles 10+ concurrent users
- All errors properly logged and monitored
- Performance metrics available in real-time

## 🏗️ Simplified Architecture Guidelines

### MCP Server Pattern
**Follow Official TypeScript SDK Patterns**:
```typescript
// Simple, stateless MCP server
const server = new McpServer({
  name: "asana-server",
  version: "1.0.0"
});

server.registerTool("create_task", {
  title: "Create Asana Task",
  inputSchema: { title: z.string(), project: z.string() }
}, async ({ title, project }) => ({
  content: [{ type: "text", text: await createTask(title, project) }]
}));
```

### LangGraph Agent Pattern
**Simple Node-Based Implementation**:
```typescript
// Replace complex wrapper with simple pattern
const agent = new StateGraph(MessagesState)
  .addNode("llm", async (state) => ({
    messages: [await model.invoke(state.messages)]
  }))
  .addNode("tools", executeTools)
  .addConditionalEdges("llm", shouldContinue)
  .compile();
```

### Tool Execution Pattern
**Direct, Simple Tool Calls**:
```typescript
// No complex routing or validation layers
const tools = {
  asana_create_task: async (args) => asanaMCP.createTask(args),
  search_knowledge: async (args) => searchKnowledgeBase(args),
  // ... other tools
};
```

## 🎯 Success Metrics

### End of Week 1
- [ ] Both MCP servers running in Docker with proper environment variables
- [ ] LangGraph agent simplified to under 200 lines
- [ ] All existing tools working with new architecture
- [ ] Response times under 3 seconds

### End of Week 2  
- [ ] Application successfully deployed to Vercel
- [ ] Google OAuth working with echotango.co restriction
- [ ] All MCP tools accessible from deployed application
- [ ] Authentication flow working end-to-end

### End of Week 3
- [ ] Consistent response formatting across all tools
- [ ] Comprehensive error handling and monitoring
- [ ] Performance optimized for production load
- [ ] Full documentation and operational procedures

## 🔧 Implementation Priorities

### Immediate (Days 1-2)
1. Fix Docker environment variable issues
2. Establish MCP server connectivity
3. Verify Google Workspace MCP authentication

### Short-term (Days 3-7)
1. Simplify LangGraph architecture
2. Implement direct tool execution
3. Complete integration testing

### Medium-term (Days 8-14)
1. Deploy to Vercel production
2. Implement OAuth authentication
3. Add monitoring and error handling

## 🚫 What to Remove

### Delete Complex Abstractions
- [ ] Remove `SimpleLangGraphWrapper` (3,766 lines)
- [ ] Delete service layer abstractions
- [ ] Remove complex routing logic
- [ ] Eliminate unnecessary state management

### Simplify Tool System
- [ ] Remove complex schema validation
- [ ] Delete tool manifest system
- [ ] Simplify tool registration
- [ ] Remove intermediate formatting layers

### Streamline Configuration
- [ ] Remove client-specific configuration complexity
- [ ] Simplify specialist system
- [ ] Delete unnecessary environment variables
- [ ] Remove complex feature flags

## 📋 Daily Checklist Template

### Daily Standup Questions
1. What critical issue did I resolve yesterday?
2. What production blocker am I tackling today?
3. What simplified approach can I implement?
4. Are we closer to Vercel deployment?

### Daily Success Criteria
- [ ] At least one critical issue resolved
- [ ] Code complexity reduced (fewer lines, simpler patterns)
- [ ] All existing functionality preserved
- [ ] Progress toward production deployment measurable

---

**Next Steps**: Begin with Day 1 tasks immediately. This roadmap supersedes all previous planning documents and serves as the single source of truth for production deployment.

**Remember**: Every decision should prioritize simplicity, production readiness, and alignment with industry best practices. When in doubt, choose the simpler approach. 