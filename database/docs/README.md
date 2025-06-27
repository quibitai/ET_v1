# Database Documentation

## Directory Structure

### `migrations/`
Active Drizzle migration files. These are automatically applied by the Drizzle migration system.

### `migrations/deprecated/`
Old or deprecated migration files that are no longer needed.

### `scripts/setup/`
Scripts for initial database setup, seeding data, and creating MCP integrations.

### `scripts/maintenance/`
Scripts for database maintenance, repairs, and schema fixes.

### `scripts/debug/`
Testing and debugging scripts for troubleshooting database issues.

### `scripts/archived/`
Completed scripts that are kept for reference but no longer actively used.

### `backups/`
Database schema and data backups.

## Best Practices

1. **Migrations**: Use Drizzle's migration system for schema changes
2. **Backups**: Regular backups are created automatically
3. **Scripts**: Organize scripts by purpose and archive when complete
4. **Testing**: Test all database changes in development first

## Current Schema

The current database schema includes:
- User management (User, Clients)
- Chat system (Chat, Message_v2, Vote_v2)
- Knowledge base (document_metadata, document_rows, documents)
- MCP integrations (mcp_servers, user_mcp_integrations)
- Analytics and monitoring (analytics_events, conversational_memory)
- N8N workflow state (n8n_workflow_state, processed_google_drive_files)

## Maintenance

- Schema backups are created before major changes
- Unused tables are periodically cleaned up
- Migration files are organized and deprecated ones archived
