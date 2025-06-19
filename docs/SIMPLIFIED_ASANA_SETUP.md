# Simplified Asana MCP Setup - Community Server

## 🎯 **Overview**

You're absolutely right! For the **community MCP server** (`npm:@roychri/mcp-server-asana`), we don't need complex OAuth flows. The community server only requires a **Personal Access Token (PAT)**.

## 🚫 **What We DON'T Need**

- ❌ OAuth 2.0 flows
- ❌ Redirect URIs  
- ❌ Client ID/Secret
- ❌ Database token storage
- ❌ Refresh tokens
- ❌ Complex authentication endpoints

## ✅ **What We DO Need**

- ✅ Asana Personal Access Token
- ✅ Environment variable: `ASANA_ACCESS_TOKEN`
- ✅ Community MCP server: `npm:@roychri/mcp-server-asana`

## 🔧 **Simple Setup**

### **Step 1: Get Your Asana Personal Access Token**

1. Visit: https://app.asana.com/0/my-apps
2. Click "Create New Personal Access Token"
3. Give it a name like "RAG System MCP"
4. Copy the token

### **Step 2: Add to Environment Variables**

Add to your `.env.local`:

```bash
# Community MCP Server - Simple Personal Access Token Approach
ASANA_ACCESS_TOKEN=your_asana_personal_access_token_here

# MCP Server URL - Community npm package  
ASANA_MCP_SERVER_URL=npm:@roychri/mcp-server-asana

# Optional: Asana workspace settings
ASANA_WORKSPACE_GID=your_workspace_gid
ASANA_DEFAULT_TEAM_GID=your_team_gid
```

### **Step 3: Update Database Configuration**

Run this to update your MCP server configuration:

```bash
pnpm tsx scripts/seed-asana-mcp.ts
```

### **Step 4: Remove OAuth Dependencies (Optional)**

Since you're using the community MCP, you can remove:

- `/api/integrations/asana/connect`
- `/api/integrations/asana/callback`  
- OAuth environment variables
- User authentication flow for Asana

## 🏗️ **How It Works**

### **Before (Over-engineered OAuth)**
```
User → OAuth Flow → Database → Encrypted Tokens → MCP Server
```

### **After (Simple PAT)**
```
User → Environment Variable → MCP Server
```

### **Code Flow**
```typescript
// McpToolFactory now checks:
1. Is this a community MCP server (npm: URL)?
2. Is ASANA_ACCESS_TOKEN set in environment?
3. If yes → use environment token
4. If no → fallback to database OAuth tokens
```

## 🎛️ **Migration Path**

### **Option A: Pure Environment Variable (Recommended for Dev)**
- Set `ASANA_ACCESS_TOKEN` in environment
- Remove OAuth configuration
- Works immediately for all users

### **Option B: Hybrid Approach (Production-Ready)**
- Keep OAuth for official Asana MCP server users
- Add environment variable support for community MCP users
- Users can choose their preferred approach

## 🧪 **Testing**

After setting up, test with:

```bash
# Check if Asana tools are available
curl http://localhost:3000/api/test-asana-mcp
```

## 📋 **Environment Variable Reference**

```bash
# Required for Community MCP
ASANA_ACCESS_TOKEN=your_personal_access_token

# Required for MCP configuration
ASANA_MCP_SERVER_URL=npm:@roychri/mcp-server-asana

# Optional Asana settings
ASANA_WORKSPACE_GID=your_workspace_gid
ASANA_DEFAULT_TEAM_GID=your_team_gid

# Not needed for Community MCP (leave empty)
ASANA_OAUTH_CLIENT_ID=
ASANA_OAUTH_CLIENT_SECRET=
ASANA_OAUTH_AUTHORIZATION_URL=
ASANA_OAUTH_TOKEN_URL=
ASANA_OAUTH_REDIRECT_URI=
```

## 🎯 **Benefits of This Approach**

1. **Simplicity**: No complex OAuth flows
2. **Development Speed**: Immediate setup  
3. **Fewer Dependencies**: No database requirements for tokens
4. **Community MCP Compatibility**: Matches how the community server works
5. **User Experience**: No authentication prompts needed

## 🔄 **When to Use OAuth vs PAT**

### **Use Personal Access Token (PAT) When:**
- Using community MCP server (`npm:@roychri/mcp-server-asana`)
- Development/testing environment
- Single user or small team
- Want simple setup

### **Use OAuth When:**
- Using official Asana MCP server (`https://mcp.asana.com`)
- Production multi-user application
- Need per-user token management
- Enterprise security requirements

## 🚀 **Next Steps**

1. **Immediate**: Add `ASANA_ACCESS_TOKEN` to your environment
2. **Test**: Verify Asana tools work without OAuth
3. **Clean up**: Remove unused OAuth code (optional)
4. **Document**: Update team on simplified approach

The modified `McpToolFactory` now supports both approaches automatically! 