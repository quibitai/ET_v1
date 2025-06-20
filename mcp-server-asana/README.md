# MCP Server for Asana

A Docker-based Model Context Protocol (MCP) server implementation for Asana that provides comprehensive access to Asana's API functionality through 33 specialized tools.

## Overview

This MCP server enables AI models (like Claude) to interact with Asana workspaces, projects, tasks, and team management through a standardized protocol. It's built as a containerized solution for easy deployment and scalability.

## Features

- **Complete Asana API Coverage**: 33 tools covering all major Asana operations
- **Docker-based Deployment**: Easy local development and production deployment
- **Real-time API Integration**: Direct connection to Asana API v1.0 using SDK v3.0.12
- **Comprehensive Error Handling**: Robust error management and validation
- **Flexible Configuration**: Environment-based configuration for different deployments

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Asana Personal Access Token ([Get one here](https://app.asana.com/0/my-apps))
- Your Asana Workspace ID (optional but recommended)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd mcp-server-asana
```

### 2. Configure Environment

Create a `.env` file:

```bash
ASANA_ACCESS_TOKEN=your_asana_personal_access_token
DEFAULT_WORKSPACE_ID=your_workspace_id
NODE_ENV=development
PORT=8080
LOG_LEVEL=info
```

### 3. Start the Server

```bash
docker-compose -f docker-compose.dev.yml up --build
```

The server will be available at:
- **HTTP API**: `http://localhost:8080`
- **Health Check**: `http://localhost:8080/health`
- **Tools List**: `http://localhost:8080/tools`

## Available Tools

### Workspace Management
1. **`asana_list_workspaces`** - List all available workspaces

### Project Management
2. **`asana_search_projects`** - Search projects using name patterns
3. **`asana_list_projects`** - List all projects in a workspace
4. **`asana_get_project`** - Get detailed project information
5. **`asana_create_project`** - Create new projects
6. **`asana_get_project_task_counts`** - Get task counts for projects
7. **`asana_get_project_sections`** - Get project sections
8. **`asana_get_project_hierarchy`** - Get complete project structure

### Task Management
9. **`asana_search_tasks`** - Advanced task search with filtering
10. **`asana_get_task`** - Get detailed task information
11. **`asana_create_task`** - Create new tasks
12. **`asana_update_task`** - Update existing tasks
13. **`asana_delete_task`** - Delete tasks
14. **`asana_get_multiple_tasks_by_gid`** - Get multiple tasks by ID

### Task Relationships
15. **`asana_create_subtask`** - Create subtasks
16. **`asana_add_task_dependencies`** - Set task dependencies
17. **`asana_add_task_dependents`** - Set task dependents
18. **`asana_set_parent_for_task`** - Set task parent relationships

### Task Stories & Comments
19. **`asana_get_task_stories`** - Get task comments and stories
20. **`asana_create_task_story`** - Create comments on tasks

### Team & User Management
21. **`asana_get_teams_for_user`** - Get user's teams
22. **`asana_get_teams_for_workspace`** - Get workspace teams
23. **`asana_list_workspace_users`** - Get workspace users
24. **`asana_add_followers_to_task`** - Add task followers

### Project Organization
25. **`asana_create_section_for_project`** - Create project sections
26. **`asana_add_task_to_section`** - Add tasks to sections

### Project Status Management
27. **`asana_get_project_status`** - Get project status updates
28. **`asana_get_project_statuses`** - Get all project statuses
29. **`asana_create_project_status`** - Create status updates
30. **`asana_delete_project_status`** - Delete status updates

### Tags & Organization
31. **`asana_get_tags_for_workspace`** - Get workspace tags
32. **`asana_get_tasks_for_tag`** - Get tasks by tag

### Attachments
33. **`asana_get_attachments_for_object`** - List object attachments

## Tool Usage Examples

### Create a Task
```bash
curl -X POST http://localhost:8080/tools/asana/asana_create_task \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "1234567890",
    "name": "New Task",
    "notes": "Task description",
    "assignee": "me",
    "due_on": "2024-12-31"
  }'
```

### Search Tasks
```bash
curl -X POST http://localhost:8080/tools/asana/asana_search_tasks \
  -H "Content-Type: application/json" \
  -d '{
    "text": "urgent",
    "assignee": "me",
    "completed": false
  }'
```

### List Projects
```bash
curl -X POST http://localhost:8080/tools/asana/asana_list_projects \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Integration with AI Tools

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "asana": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-server-asana-dev", "node", "dist/index.js"],
      "env": {
        "ASANA_ACCESS_TOKEN": "your_token_here",
        "DEFAULT_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

### Example AI Queries

- "Show me all overdue tasks in the Marketing project"
- "Create a new task called 'Review Q4 Budget' in the Finance project"
- "List all active projects and their completion status"
- "Add John as a follower to the Website Redesign task"

## Architecture

### Components

- **`src/index.ts`** - Main server entry point and MCP protocol setup
- **`src/http-server.ts`** - HTTP API server for tool endpoints
- **`src/asana-client-wrapper.ts`** - Asana API client wrapper (665 lines)
- **`src/tool-handler.ts`** - Tool registration and routing (966 lines)
- **`src/prompt-handler.ts`** - MCP prompt management (609 lines)

### Key Features

- **Error Handling**: Comprehensive error management with detailed logging
- **Parameter Validation**: Zod schema validation for all tool inputs
- **Rate Limiting**: Built-in rate limiting for API calls
- **Caching**: Intelligent caching for frequently accessed data
- **Health Monitoring**: Health check endpoints and monitoring

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Run tests
npm test
```

### Testing Tools

```bash
# Test individual tools
curl -X POST http://localhost:8080/tools/asana/asana_list_workspaces \
  -H "Content-Type: application/json" -d '{}'

# Check server health
curl http://localhost:8080/health
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ASANA_ACCESS_TOKEN` | Yes | Your Asana personal access token |
| `DEFAULT_WORKSPACE_ID` | No | Default workspace ID (recommended) |
| `NODE_ENV` | No | Environment (development/production) |
| `PORT` | No | HTTP server port (default: 8080) |
| `LOG_LEVEL` | No | Logging level (default: info) |

### Getting Asana Credentials

1. **Personal Access Token**: Visit [Asana Developer Console](https://app.asana.com/0/my-apps)
2. **Workspace ID**: Found in your Asana workspace URL or use `asana_list_workspaces`

## Deployment

### Production Deployment

```bash
# Build production image
docker build -t mcp-server-asana:latest .

# Run in production
docker run -d \
  --name mcp-server-asana \
  -p 8080:8080 \
  -e ASANA_ACCESS_TOKEN=your_token \
  -e DEFAULT_WORKSPACE_ID=your_workspace \
  -e NODE_ENV=production \
  mcp-server-asana:latest
```

### Health Monitoring

The server provides several monitoring endpoints:

- `GET /health` - Basic health check
- `GET /tools` - List all available tools
- `GET /version` - Server version information

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify your `ASANA_ACCESS_TOKEN` is valid
2. **Workspace Access**: Ensure you have access to the specified workspace
3. **Rate Limiting**: The server handles rate limiting automatically
4. **Network Issues**: Check Docker network configuration

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug docker-compose up
```

### Tool Testing

Test individual tools using curl or the MCP Inspector:

```bash
npm run inspector  # Starts MCP Inspector on port 5173
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit a pull request

### Adding New Tools

1. Add method to `asana-client-wrapper.ts`
2. Define tool schema in `tool-handler.ts`
3. Add tool to `list_of_tools`
4. Implement handler in switch statement
5. Update documentation

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Documentation**: Comprehensive API documentation available
- **Community**: Join discussions and get help from the community

---

**Version**: 1.0.0  
**Asana API Version**: 1.0  
**Asana SDK Version**: 3.0.12  
**Node.js**: 20+  
**Docker**: Required for deployment 