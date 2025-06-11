# Client Configuration in Quibit RAG

This document explains the implementation of the client-aware configuration in Quibit RAG, focusing on the `config_json` column and new top-level context fields in the Clients table.

## Overview

The Clients table in the database now has several ways to store client-specific configurations:

1. `client_display_name` (TEXT, NOT NULL) - User-facing name of the client company (e.g., "Echo Tango Creative Agency")
2. `client_core_mission` (TEXT, NULLABLE) - Short description of the client's main business
3. `customInstructions` (TEXT column) - Simple text-based instructions for the client
4. `config_json` (JSONB column) - Structured configuration data including specialist prompts and hierarchical context

## Schema Structure

The `config_json` column is a flexible JSON structure with the following format:

```json
{
  "orchestrator_client_context": "Extra context for orchestrator prompt logic.",
  "available_bit_ids": ["chat-model", "echo-tango-specialist"],
  "tool_configs": {
    "n8n": { "webhook_url": "...", "api_key": "..." }
  }
}
```

### Field Descriptions

- **client_display_name**: User-facing name for the client (e.g., "Echo Tango Creative Agency").
- **client_core_mission**: Short description of the client's business or mission. Used for prompt context.
- **customInstructions**: General client-wide guidelines for prompt assembly.
- **config_json.orchestrator_client_context**: String with extra context for orchestrator prompt logic.
- **config_json.available_bit_ids**: Array of active bit/specialist IDs for this client. This is the source of truth for enabled specialists.
- **config_json.tool_configs**: Object for tool-specific configuration (e.g., API keys, endpoints).

### Architecture Update
- **Specialist Prompts**: Specialist persona prompts are now managed exclusively through the dedicated `specialists` table in the database. Individual client overrides for specialist prompts have been removed to simplify configuration management.
- **available_bit_ids**: This is the sole source of truth for the list of enabled/available bits for a client.

## Implementation Details

### Database Schema

Added to `lib/db/schema.ts`:
```typescript
export const clients = pgTable('Clients', {
  // ... other fields
  client_display_name: text('client_display_name').notNull(),
  client_core_mission: text('client_core_mission'),
  customInstructions: text('customInstructions'),
  config_json: json('config_json'), // Structured configuration for orchestrator context, available bit IDs, and tool configs
});
```

### ClientConfig Type

Updated in `lib/db/queries.ts`:
```typescript
export type ClientConfig = {
  id: string;
  name: string;
  client_display_name: string;
  client_core_mission?: string | null;
  customInstructions?: string | null;
  configJson?: {
    orchestrator_client_context?: string | null;
    available_bit_ids?: string[] | null;
    tool_configs?: Record<string, any> | null;
  } | null;
};
```

## Testing

You can test the `config_json` and new columns using the `test_config_json.ts` script:

```bash
# Make sure the POSTGRES_URL environment variable is set
export POSTGRES_URL="postgres://your_connection_string"

# Run the test script
npx tsx test_config_json.ts
```

## Benefits

This implementation provides:

- Flexible, hierarchical client customization through structured JSON and top-level fields
- Backward compatibility with existing text-based instructions
- Clear hierarchy for prompt assembly and context injection
- Enhanced debugging with detailed logging
- Future extensibility for additional configuration options and multi-client support 