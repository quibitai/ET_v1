# Docker Setup Guide for MCP Server Asana

This guide provides step-by-step instructions for running the MCP Server Asana in Docker for local testing.

## Prerequisites

1. **Docker and Docker Compose installed**
   ```bash
   # Check if Docker is installed
   docker --version
   docker-compose --version
   ```

2. **Asana Access Token**
   - Get your personal access token from: https://app.asana.com/0/my-apps
   - Documentation: https://developers.asana.com/docs/personal-access-token

3. **Default Workspace ID (Optional)**
   - Find your workspace ID in the Asana URL when you're in your workspace
   - Or use the `asana_list_workspaces` tool to get available workspaces

## Quick Start

### 1. Set Environment Variables

Create a `.env` file in the `mcp-server-asana/` directory:

```bash
# Navigate to the mcp-server-asana directory
cd mcp-server-asana

# Create environment file
cat > .env << EOF
ASANA_ACCESS_TOKEN=your_asana_personal_access_token_here
DEFAULT_WORKSPACE_ID=your_default_workspace_id_here
NODE_ENV=development
PORT=8080
LOG_LEVEL=info
EOF
```

**Important**: Replace `your_asana_personal_access_token_here` with your actual Asana token.

### 2. Build and Start the Container

```bash
# Build and start the container
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode (background)
docker-compose -f docker-compose.dev.yml up --build -d
```

### 3. Verify the Container is Running

```bash
# Check container status
docker-compose -f docker-compose.dev.yml ps

# Check container logs
docker-compose -f docker-compose.dev.yml logs -f

# Test the health endpoint
curl http://localhost:8080/health
```

## Alternative: Direct Docker Commands

If you prefer using Docker directly instead of Docker Compose:

```bash
# Build the image
docker build -t mcp-server-asana:dev .

# Run the container
docker run -d \
  --name mcp-server-asana-dev \
  -p 8080:8080 \
  -e ASANA_ACCESS_TOKEN="your_token_here" \
  -e DEFAULT_WORKSPACE_ID="your_workspace_id" \
  -e NODE_ENV=development \
  -e LOG_LEVEL=info \
  mcp-server-asana:dev

# Check logs
docker logs -f mcp-server-asana-dev

# Stop the container
docker stop mcp-server-asana-dev
docker rm mcp-server-asana-dev
```

## Testing the MCP Server

### 1. Health Check
```bash
curl http://localhost:8080/health
# Expected response: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### 2. List Available Tools
```bash
curl http://localhost:8080/tools
# Should return a list of all available Asana tools
```

### 3. Test a Tool (List Workspaces)
```bash
curl -X POST http://localhost:8080/tools/asana_list_workspaces \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4. Test MCP Protocol Directly
```bash
# List tools via MCP protocol
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## Development Workflow

### Hot Reload Development
For development with hot reload, you can mount your source code:

```bash
# Stop the current container
docker-compose -f docker-compose.dev.yml down

# Start with volume mounting for live reload
docker-compose -f docker-compose.dev.yml up --build
```

The Docker Compose file already includes volume mounts for development.

### Rebuilding After Changes
```bash
# Rebuild and restart
docker-compose -f docker-compose.dev.yml up --build --force-recreate

# Or rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

## Integration with Next.js App

Once the Docker container is running, you can test integration with your Next.js app:

```typescript
// Test the AsanaMCPClient
import { AsanaMCPClient } from '../lib/ai/mcp/AsanaMCPClient';

const client = new AsanaMCPClient('http://localhost:8080');
const workspaces = await client.listWorkspaces();
console.log('Available workspaces:', workspaces);
```

## Troubleshooting

### Container Won't Start
```bash
# Check container logs
docker-compose -f docker-compose.dev.yml logs

# Check if port 8080 is already in use
lsof -i :8080
# Or on Linux: netstat -tulpn | grep 8080
```

### Authentication Issues
```bash
# Verify your token works directly with Asana API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://app.asana.com/api/1.0/users/me
```

### Permission Errors
```bash
# Check if files have correct permissions
ls -la mcp-server-asana/

# Fix permissions if needed
chmod 644 mcp-server-asana/package.json
chmod 644 mcp-server-asana/Dockerfile
```

### Container Health Check Failing
```bash
# Check if the health endpoint responds
docker exec mcp-server-asana-dev wget -qO- http://localhost:8080/health

# Check container internal logs
docker exec mcp-server-asana-dev cat /app/logs/app.log
```

## Stopping the Container

```bash
# Stop and remove containers
docker-compose -f docker-compose.dev.yml down

# Stop and remove containers + volumes
docker-compose -f docker-compose.dev.yml down -v

# Remove the built image
docker rmi mcp-server-asana:dev
```

## Production Deployment

For production deployment, create a separate `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  mcp-server-asana:
    build: .
    container_name: mcp-server-asana-prod
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - ASANA_ACCESS_TOKEN=${ASANA_ACCESS_TOKEN}
      - DEFAULT_WORKSPACE_ID=${DEFAULT_WORKSPACE_ID}
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Next Steps

1. **Test All Tools**: Use the MCP Inspector or curl to test all available tools
2. **Integration Testing**: Test the AsanaMCPClient with your Next.js app
3. **Performance Testing**: Monitor memory and CPU usage under load
4. **Production Deployment**: Deploy to your server infrastructure

For more details, see the main README.md and LANGRAPH_REFACTOR_ROADMAP_v5.2.0.md files. 