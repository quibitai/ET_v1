# Docker-Based Asana MCP Server Setup

This guide will help you set up a containerized Asana MCP server that can run locally and be deployed to production.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Asana Access Token
- Node.js 18+ (for local development)

### 1. Environment Setup

Create a `.env.local` file in the project root:

```env
# Required
ASANA_ACCESS_TOKEN=your_asana_personal_access_token

# Optional
DEFAULT_WORKSPACE_ID=your_default_workspace_id
ASANA_MCP_SERVER_URL=http://localhost:8080
```

### 2. Build and Run MCP Server

#### Option A: Docker Compose (Recommended)
```bash
# Start both MCP server and Next.js app
docker-compose -f docker-compose.dev.yml up --build

# Or just the MCP server
docker-compose -f docker-compose.dev.yml up asana-mcp --build
```

#### Option B: Manual Docker Build
```bash
# Build the MCP server
cd mcp-server-asana
docker build -t asana-mcp .

# Run the container
docker run -p 8080:8080 \
  -e ASANA_ACCESS_TOKEN=your_token \
  -e DEFAULT_WORKSPACE_ID=your_workspace_id \
  asana-mcp
```

### 3. Test the MCP Server

```bash
# Health check
curl http://localhost:8080/health

# List available tools
curl http://localhost:8080/tools

# Test a tool
curl -X POST http://localhost:8080/tools/asana/asana_list_workspaces \
  -H "Content-Type: application/json" \
  -d '{}'

# Test task search
curl -X POST http://localhost:8080/tools/asana/asana_search_tasks \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"text": "test", "limit": 5}}'
```

### 4. Integrate with Next.js App

Add to your Next.js environment variables:
```env
ASANA_MCP_SERVER_URL=http://localhost:8080
```

Use the MCP client in your app:
```typescript
import { AsanaMCPClient } from '@/lib/ai/mcp/AsanaMCPClient';

const mcpClient = new AsanaMCPClient({
  serverUrl: process.env.ASANA_MCP_SERVER_URL!,
});

// Use typed methods
const workspaces = await mcpClient.listWorkspaces();
const tasks = await mcpClient.searchTasks({ text: "urgent", limit: 10 });
```

## 🔧 Development Workflow

### Local Development
1. **Start MCP Server**: `docker-compose -f docker-compose.dev.yml up asana-mcp`
2. **Start Next.js App**: `npm run dev`
3. **Test Integration**: Your app can now call `http://localhost:8080/tools/asana/*`

### Hot Reload Development
For MCP server development with hot reload:
```bash
cd mcp-server-asana
npm install
npm run dev  # Uses tsx watch for hot reload
```

### Testing Tools
```bash
# Test individual tools
curl -X POST http://localhost:8080/tools/asana/asana_get_task \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"task_id": "your_task_id"}}'

# Test batch operations
curl -X POST http://localhost:8080/tools/asana/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"tool": "asana_list_workspaces", "arguments": {}},
      {"tool": "asana_search_tasks", "arguments": {"limit": 5}}
    ]
  }'
```

## 🚀 Production Deployment

### 1. Build Production Images
```bash
# Build MCP server image
cd mcp-server-asana
docker build -t your-registry/asana-mcp:latest .

# Push to registry
docker push your-registry/asana-mcp:latest
```

### 2. Deploy to Your Server
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  asana-mcp:
    image: your-registry/asana-mcp:latest
    restart: unless-stopped
    environment:
      - ASANA_ACCESS_TOKEN=${ASANA_ACCESS_TOKEN}
      - DEFAULT_WORKSPACE_ID=${DEFAULT_WORKSPACE_ID}
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. Update Next.js Environment
```env
# .env.production
ASANA_MCP_SERVER_URL=https://your-server.com:8080
```

## 📊 Available Tools

The MCP server provides 33+ Asana tools including:

- **Workspace Management**: `asana_list_workspaces`
- **Task Operations**: `asana_search_tasks`, `asana_get_task`, `asana_create_task`, `asana_update_task`
- **Project Operations**: `asana_search_projects`, `asana_get_project`, `asana_create_project`
- **Team Operations**: `asana_get_teams_for_workspace`, `asana_list_workspace_users`
- **Advanced Features**: `asana_get_project_hierarchy`, `asana_upload_attachment`

## 🔍 Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.dev.yml logs asana-mcp
   
   # Verify environment variables
   docker-compose -f docker-compose.dev.yml config
   ```

2. **Tools returning errors**
   ```bash
   # Check tool schema
   curl http://localhost:8080/tools/asana/asana_search_tasks/schema
   
   # Verify Asana token
   curl -H "Authorization: Bearer YOUR_TOKEN" https://app.asana.com/api/1.0/users/me
   ```

3. **Connection issues**
   ```bash
   # Test connectivity
   curl http://localhost:8080/health
   
   # Check Docker network
   docker network ls
   docker network inspect quibit-network
   ```

### Logs and Monitoring
```bash
# View live logs
docker-compose -f docker-compose.dev.yml logs -f asana-mcp

# Monitor resource usage
docker stats
```

## 🎯 Next Steps

1. **Remove Legacy Code**: Clean up old Asana integration files
2. **Implement Workflow Intelligence**: Build multi-step workflow orchestration
3. **Add Advanced Features**: Batch operations, parallel execution
4. **Production Deployment**: Deploy to your server infrastructure

## 📚 Architecture Benefits

- ✅ **Full Control**: Own the MCP server implementation
- ✅ **Easy Development**: Docker for consistent local testing
- ✅ **Flexible Deployment**: Deploy anywhere (your server, cloud, etc.)
- ✅ **Scalable**: Can scale MCP server independently
- ✅ **Maintainable**: Clear separation between tools and workflow logic
- ✅ **Production Ready**: Proven Docker deployment patterns 