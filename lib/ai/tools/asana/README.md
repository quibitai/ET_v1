# Modern Asana Tool Implementation

## Overview

This is a completely rewritten, modular Asana integration following clean architecture principles and best practices. The implementation replaces all previous Asana tool versions with a single, coherent system.

## Architecture

### Core Principles
- **Modular Design**: Each component has a single responsibility under 200 LOC
- **Production-Ready**: Comprehensive error handling, rate limiting, and retry logic
- **Type Safety**: Full TypeScript coverage with comprehensive type definitions
- **Clean Architecture**: Clear separation between API client, operations, and integration layers

### Directory Structure

```
lib/ai/tools/asana/
├── core/                    # Core infrastructure
│   ├── auth-validator.ts    # Authentication validation (moved to lib/ai/core/)
│   ├── config.ts           # Configuration management
│   ├── types.ts            # TypeScript type definitions
│   └── client.ts           # API client with rate limiting
├── operations/             # Business logic operations
│   ├── tasks.ts            # Task CRUD operations
│   └── (future: projects.ts, users.ts, etc.)
├── integration/            # LangChain integration layer
│   └── tool-factory-simple.ts  # Creates LangChain tools
└── README.md              # This file
```

## Components

### 1. Authentication Validator (`lib/ai/core/auth-validator.ts`)
- Validates all API keys on application startup
- Fail-fast behavior for configuration errors
- Specific validation for OpenAI and Asana credentials

### 2. Configuration (`core/config.ts`)
- Centralized configuration management
- Environment variable resolution
- Production-ready defaults and validation

### 3. Type Definitions (`core/types.ts`)
- Comprehensive TypeScript types for all Asana entities
- API response types and error handling
- Tool execution context and result types

### 4. API Client (`core/client.ts`)
- Production-ready HTTP client with rate limiting (1500 req/min)
- Exponential backoff retry logic
- Comprehensive error handling and recovery

### 5. Task Operations (`operations/tasks.ts`)
- Complete CRUD operations for Asana tasks
- Consistent error handling and result formatting
- Support for filtering, pagination, and field selection

### 6. Tool Factory (`integration/tool-factory-simple.ts`)
- Creates LangChain DynamicStructuredTool instances
- Integrates all operations into a cohesive tool set
- Proper schema validation and error reporting

## Features

### Current Tools
1. **asana_list_tasks** - List and filter tasks
2. **asana_create_task** - Create new tasks with full options
3. **asana_update_task** - Update existing tasks
4. **asana_get_task_details** - Get detailed task information with optional subtasks

### Key Capabilities
- **Rate Limiting**: Respects Asana's 1500 requests/minute limit
- **Error Recovery**: Automatic retry with exponential backoff
- **Type Safety**: Full TypeScript coverage prevents runtime errors
- **Comprehensive Logging**: Detailed execution tracking
- **Flexible Querying**: Support for all major Asana API parameters

## Configuration

### Required Environment Variables
```bash
ASANA_PAT=your_personal_access_token
ASANA_DEFAULT_WORKSPACE_GID=your_workspace_gid
OPENAI_API_KEY=sk-proj-your_project_key
```

### Optional Environment Variables
```bash
ASANA_DEFAULT_TEAM_GID=your_team_gid
ASANA_REQUEST_TIMEOUT_MS=30000
ASANA_RATE_LIMIT_PER_MINUTE=1500
ASANA_RATE_LIMIT_PER_HOUR=90000
ASANA_ENABLE_WORKFLOWS=true
ASANA_ENABLE_SEMANTIC_RESOLUTION=true
ASANA_ENABLE_ERROR_RECOVERY=true
ASANA_ENABLE_RESPONSE_ENHANCEMENT=true
```

## Usage

### Basic Integration
```typescript
import { createAsanaTools } from '@/lib/ai/tools/asana/integration/tool-factory-simple';

// Create tools for a specific session
const tools = createAsanaTools(sessionId);

// Tools are ready for LangChain integration
const agent = createAgent({
  tools: [...otherTools, ...tools],
  // ... other config
});
```

### Direct API Usage
```typescript
import { getAsanaConfig } from '@/lib/ai/tools/asana/core/config';
import { AsanaApiClient } from '@/lib/ai/tools/asana/core/client';
import { TaskOperations } from '@/lib/ai/tools/asana/operations/tasks';

const config = getAsanaConfig();
const client = new AsanaApiClient(config);
const taskOps = new TaskOperations(client);

// Use operations directly
const result = await taskOps.listTasks({ assignee: 'me' }, context);
```

## Migration from Previous Implementations

### What Was Removed
- `archive/asana-tool-legacy/` - Legacy 2158-line monolithic implementation
- `lib/ai/tools/asana/function-calling-tools.ts` - 666-line conflicting implementation
- `lib/ai/tools/asana/modern-asana-tool.ts` - 796-line previous attempt
- All MCP/Native references and configurations

### What Was Preserved
- All core functionality (create, read, update, delete tasks)
- LangChain integration patterns
- Error handling principles
- Rate limiting and retry logic

### Benefits of New Implementation
1. **Maintainability**: Files under 200 LOC, clear separation of concerns
2. **Reliability**: Production-ready error handling and recovery
3. **Testability**: Modular design enables comprehensive unit testing
4. **Extensibility**: Easy to add new operations (projects, users, etc.)
5. **Performance**: Efficient rate limiting and request optimization

## Error Handling

### Authentication Errors
- Validated on startup with clear error messages
- Specific guidance for common issues (truncated keys, wrong format)

### API Errors
- Automatic retry for transient errors (429, 5xx)
- Detailed error context and suggestions
- Graceful degradation for non-critical failures

### Tool Errors
- Comprehensive error logging with context
- User-friendly error messages
- Correlation IDs for debugging

## Future Enhancements

### Planned Operations Modules
- `operations/projects.ts` - Project management operations
- `operations/users.ts` - User and team operations
- `operations/search.ts` - Advanced search capabilities

### Planned Services
- `services/intent-processor.ts` - Natural language intent parsing
- `services/workflow-manager.ts` - Complex multi-step operations
- `services/response-enhancer.ts` - Rich response formatting

### Planned Features
- Semantic task resolution
- Multi-step workflow execution
- Advanced caching strategies
- Real-time webhook integration

## Development Guidelines

### Adding New Operations
1. Create new file in `operations/` directory
2. Keep under 200 LOC per file
3. Follow the TaskOperations pattern
4. Add comprehensive TypeScript types
5. Include error handling and logging

### Testing Strategy
1. Unit tests for each operation module
2. Integration tests for API client
3. End-to-end tests for tool factory
4. Mock Asana API for consistent testing

### Code Quality Standards
- TypeScript strict mode enabled
- ESLint/Prettier configuration
- No console.log in production code
- Comprehensive error handling
- Clear documentation and comments

This implementation provides a solid foundation for all Asana integration needs while maintaining clean architecture and production-ready quality. 