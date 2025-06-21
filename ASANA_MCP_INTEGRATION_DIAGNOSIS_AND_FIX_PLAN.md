# Asana MCP Integration: Diagnosis and Fix Plan

## 🚨 **Current Issues Identified**

### **Error 1: Database Registration Missing**
```
[McpToolFactory] Failed to create tools for Asana {
  error: "MCP server 'Asana' not found in database"
}
```
**Root Cause**: Legacy system expects 'Asana' entry in `mcpServers` table, but new system bypasses database.

### **Error 2: ServiceName Undefined**
```
TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at AsanaMCPClient.detectServerUrl (lib/ai/mcp/BaseMCPClient.ts:124:39)
```
**Root Cause**: Constructor inheritance issue where `serviceName` is undefined during base class initialization.

### **Error 3: Tool Loading Conflicts**
Multiple Asana implementations causing conflicts:
- New: `createAsanaTools()` with `AsanaMCPClient`
- Legacy: `McpToolFactory` with database lookup
- Old: `nativeAsana` and `modernAsana` configs

## 🎯 **Step-by-Step Fix Plan**

### **Phase 1: Fix Constructor Inheritance Issue (CRITICAL)**

**Problem**: `BaseMCPClient` constructor calls `detectServerUrl()` before `AsanaMCPClient` sets `serviceName`

**Solution**: Move auto-detection to after inheritance chain completes

```typescript
// In BaseMCPClient.ts
constructor(config: MCPClientConfig = {}) {
  // Don't auto-detect during construction
  this.config = this.mergeConfig(config);
  // ... rest of initialization without detectServerUrl()
}

// Add lazy initialization
protected ensureConfigured(): void {
  if (!this.config.serverUrl) {
    this.config.serverUrl = this.detectServerUrl();
  }
}

// In AsanaMCPClient.ts
constructor(config: AsanaMCPConfig = {}) {
  super(config);
  // Now serviceName is set, we can safely auto-detect
  this.ensureConfigured();
}
```

### **Phase 2: Fix Tool Loading Path Selection**

**Problem**: `getUserMcpTools()` tries both development and production paths

**Solution**: Force development path when new MCP client is available

```typescript
// In lib/ai/tools/index.ts - Fix line 51
const envAsanaToken = process.env.ASANA_ACCESS_TOKEN;

// Always prefer new MCP implementation
const useNewMcpClient = true; // Force new implementation

if (envAsanaToken && useNewMcpClient) {
  try {
    const { createAsanaTools } = await import('./mcp/asana');
    const asanaTools = await createAsanaTools(userId, 'env-session');
    
    if (asanaTools.length > 0) {
      allMcpTools.push(...asanaTools);
      // Skip database lookup for Asana since we have tools
      const nonAsanaIntegrations = integrations.filter(i => 
        i.serverName !== 'Asana' && i.serverName !== 'asana'
      );
      // Process only non-Asana integrations...
    }
  } catch (error) {
    console.error('[MCP] New Asana client failed, falling back to database');
    // Fall back to database lookup
  }
}
```

### **Phase 3: Clean Up Legacy References**

**Files to Clean/Update:**

1. **Remove nativeAsana configs**:
   - `scripts/testAllTools.ts` (line 58)
   - `scripts/updateClientToolConfigs.ts` (lines 40, 172)

2. **Remove modernAsana references**:
   - Update `TOOL_CALLING_OPTIMIZATION_REPORT.md`
   - Clean `lib/services/modernToolService.ts` (lines 455-468)

3. **Update database if needed**:
   - Either add 'Asana' server entry OR
   - Modify code to skip database lookup for new MCP

### **Phase 4: Verification Steps**

1. **Test Constructor Fix**:
```bash
# Test AsanaMCPClient creation
npm run test:mcp-asana
```

2. **Test Tool Loading**:
```bash
# Verify tools load without database errors
curl -X POST http://localhost:3000/api/test-tool-loading
```

3. **Test Full Integration**:
```bash
# Test complete MCP architecture
curl -X POST http://localhost:3000/api/test-mcp-architecture
```

## 🔧 **Immediate Fixes to Apply**

### **1. Fix BaseMCPClient Constructor (URGENT)**

The inheritance issue must be fixed first, as it prevents any MCP client from working.

### **2. Update Tool Loading Logic**

Modify `getUserMcpTools()` to prefer new implementation and skip database lookup when new client works.

### **3. Set Environment Variable**

Ensure `ASANA_ACCESS_TOKEN` is set to enable development mode path.

### **4. Clean Legacy Code**

Remove conflicting `nativeAsana` and `modernAsana` references to prevent confusion.

## 📊 **Expected Results After Fixes**

✅ **AsanaMCPClient.create()** works without inheritance errors  
✅ **Tool loading** uses new MCP implementation consistently  
✅ **33 Asana tools** available with manifest metadata  
✅ **No database conflicts** or legacy system interference  
✅ **Streaming capabilities** work for supported tools  
✅ **Health monitoring** tracks MCP server status  

## 🚀 **Next Steps After Fix**

1. **Remove old implementations** completely
2. **Add other MCP services** (Notion, Slack) using same pattern
3. **Enable production database** registration if needed
4. **Enhance streaming** for more tools
5. **Add comprehensive monitoring** dashboards

---

*This plan addresses all identified issues systematically and ensures the new MCP architecture works as designed.* 