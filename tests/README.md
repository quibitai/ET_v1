# Test Suite Documentation

This directory contains the comprehensive test suite for Echo Tango v1, updated as part of the Phase 4, Task 4.2 audit and expansion.

## Test Structure

### Core Application Tests
- `chat.test.ts` - Original chat functionality tests (legacy Playwright tests)
- `chat-wrapper.test.ts` - Updated tests for the refactored ChatWrapper architecture
- `auth.test.ts` - Authentication and authorization tests
- `reasoning.test.ts` - AI reasoning capability tests

### Admin Interface Tests
- `admin/configuration.test.ts` - Tests for client and specialist configuration management
- `admin/observability.test.ts` - Tests for the analytics and monitoring dashboard

### Prompt System Tests
- `prompts/loader.test.ts` - Tests for the updated database-based prompt loading system
- `prompts/integration-client-aware.test.ts` - Integration tests for client-aware prompt generation
- `prompts/orchestrator.test.ts` - Tests for the orchestrator prompt system
- `prompts/tools-config.test.ts` - Tests for tool configuration and selection
- `prompts/integration.test.ts` - General prompt integration tests
- `prompts/system.test.ts` - System-level prompt tests

### Page Object Models
- `pages/chat.ts` - Page object model for chat interface interactions

### Tool-Specific Tests
- `asana/` - Tests for Asana integration functionality

### Test Utilities
- `prompts/basic.ts` - Basic test prompts and fixtures (artifact references removed)
- `prompts/utils.ts` - Utility functions for prompt testing (artifact handling removed)
- `auth.setup.ts` - Authentication setup for tests
- `reasoning.setup.ts` - Reasoning capability test setup

## Recent Changes (Phase 4.2 Audit)

### Deleted Obsolete Tests
- ❌ `tests/pages/artifact.ts` - Removed artifact page helper (feature removed)
- ❌ `app/api/brain/__tests__/route.test.ts` - Removed disabled brain API tests

### Updated for Refactored Architecture
- ✅ Updated all test configurations to use `chat-model` instead of `document-editor`
- ✅ Removed artifact-related test prompts and handlers
- ✅ Created new `chat-wrapper.test.ts` for refactored chat architecture
- ✅ Updated prompt loader tests to work with database-based specialists

### New Feature Tests
- ✅ Added comprehensive admin configuration tests
- ✅ Added observability dashboard tests with analytics verification
- ✅ Added authentication protection tests for admin routes

## Running Tests

### All Tests
```bash
pnpm run test
```

### Specific Test Categories
```bash
# Chat functionality tests
pnpm run test chat

# Admin interface tests  
pnpm run test admin

# Prompt system tests
pnpm run test prompts

# Authentication tests
pnpm run test auth
```

### Playwright E2E Tests
```bash
# Run with UI
pnpm run test:e2e --ui

# Run headless
pnpm run test:e2e
```

## Test Requirements

### Prerequisites
- Development server running on `localhost:3000` or `localhost:3001`
- Test database with sample data
- Admin user credentials for admin interface tests

### Environment Variables
Ensure these are set in your test environment:
- Database connection strings
- Authentication secrets
- API keys for external services (for integration tests)

## Test Coverage Goals

The test suite aims to achieve:
- ✅ **Core Chat Functionality**: Message sending, receiving, tool usage
- ✅ **Authentication & Authorization**: Login, session management, role-based access
- ✅ **Admin Interface**: Configuration management, user interface functionality
- ✅ **Observability**: Analytics tracking, dashboard display, data visualization
- ✅ **Prompt System**: Database-based loading, client-aware generation
- ✅ **Tool Integration**: External API calls, error handling, response processing

## Adding New Tests

When adding new features, ensure you:
1. Create corresponding test files in the appropriate directory
2. Follow the existing naming convention (`feature.test.ts`)
3. Add page object models for UI components in `pages/`
4. Update this README with new test descriptions
5. Ensure new admin features have both functionality and authentication tests

## Troubleshooting

### Common Issues
- **Database Connection**: Ensure test database is running and accessible
- **Authentication**: Check that test user credentials are valid
- **Port Conflicts**: Verify development server is running on expected port
- **Missing Dependencies**: Run `pnpm install` to ensure all test dependencies are available

### Debug Mode
Run tests with debug output:
```bash
DEBUG=true pnpm run test
```

For Playwright tests with browser debugging:
```bash
pnpm run test:e2e --debug
``` 