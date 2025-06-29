#!/usr/bin/env tsx

/**
 * Specialist Configuration Update Script
 *
 * Phase 2.1: Updates all specialist configurations with:
 * - Proper default_tools arrays for all specialists
 * - Google Workspace MCP tools integration
 * - Enhanced tool inheritance verification
 * - Correlation-aware logging for debugging
 *
 * Usage: npx tsx scripts/update-specialist-configurations.ts
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

import { db } from '@/lib/db';
import { specialists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface SpecialistUpdate {
  name: string;
  expectedTools: string[];
  description: string;
}

/**
 * Comprehensive tool configurations for each specialist
 */
const SPECIALIST_CONFIGURATIONS: SpecialistUpdate[] = [
  {
    name: 'echo-tango-specialist',
    description: 'Primary specialist with full tool access',
    expectedTools: [
      // Core Knowledge Tools
      'listDocuments',
      'enhancedListDocumentsTool',
      'getDocumentContents',
      'searchInternalKnowledgeBase',

      // Google Workspace MCP Tools - Gmail
      'search_gmail_messages',
      'list_gmail_messages',
      'send_gmail_message',
      'get_gmail_message_content',
      'get_gmail_thread_content',

      // Google Workspace MCP Tools - Drive
      'search_drive_files',
      'list_drive_items',
      'create_drive_file',
      'get_drive_file_content',

      // Google Workspace MCP Tools - Calendar
      'list_calendars',
      'get_events',
      'create_event',
      'modify_calendar_event',
      'delete_calendar_event',

      // Google Workspace MCP Tools - Docs
      'search_docs',
      'get_docs_content',
      'create_docs',
      'list_docs',

      // Google Workspace MCP Tools - Sheets
      'list_sheets',
      'get_sheets_info',
      'read_sheets_values',
      'modify_sheets_values',
      'create_sheets',

      // Google Workspace MCP Tools - Forms
      'create_forms',
      'get_forms',

      // Google Workspace MCP Tools - Chat
      'list_chat_spaces',
      'get_chat_messages',
      'send_chat_message',

      // Asana MCP Tools
      'get_user_info',
      'list_workspaces',
      'list_projects_in_workspace',
      'get_project_details',
      'list_tasks_in_project',
      'get_task_details',
      'create_task',
      'update_task',
      'list_my_tasks',

      // Web Search Tools
      'tavilySearch',

      // Utility Tools
      'getTimezone',
    ],
  },
  {
    name: 'chat-model',
    description: 'Conversational specialist with essential tools',
    expectedTools: [
      // Core Knowledge Tools
      'listDocuments',
      'enhancedListDocumentsTool',
      'getDocumentContents',
      'searchInternalKnowledgeBase',

      // Essential Google Workspace Tools
      'search_gmail_messages',
      'get_gmail_message_content',
      'search_drive_files',
      'get_drive_file_content',
      'get_events',
      'search_docs',
      'get_docs_content',

      // Essential Asana Tools
      'get_user_info',
      'list_my_tasks',
      'get_task_details',

      // Web Search
      'tavilySearch',

      // Utility Tools
      'getTimezone',
    ],
  },
  {
    name: 'test-model',
    description: 'Testing specialist with basic tool set',
    expectedTools: [
      // Core Knowledge Tools
      'listDocuments',
      'getDocumentContents',
      'searchInternalKnowledgeBase',

      // Basic Google Workspace Tools
      'search_drive_files',
      'get_drive_file_content',
      'get_events',

      // Basic Asana Tools
      'list_my_tasks',

      // Web Search
      'tavilySearch',
    ],
  },
];

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `specialist_update_${nanoid(10)}_${Date.now()}`;
}

/**
 * Log with correlation ID for debugging
 */
function logWithCorrelation(
  correlationId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: any,
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    correlationId,
    timestamp,
    level,
    message,
    ...data,
  };
  console.log(
    `[${correlationId}] [${level.toUpperCase()}] ${message}`,
    data ? JSON.stringify(data, null, 2) : '',
  );
}

/**
 * Update specialist configuration with enhanced logging
 */
async function updateSpecialistConfiguration(
  config: SpecialistUpdate,
  correlationId: string,
): Promise<void> {
  logWithCorrelation(
    correlationId,
    'info',
    `Updating specialist: ${config.name}`,
    {
      expectedToolsCount: config.expectedTools.length,
      description: config.description,
    },
  );

  try {
    // Check if specialist exists
    const existingSpecialist = await db
      .select()
      .from(specialists)
      .where(eq(specialists.name, config.name))
      .limit(1);

    if (existingSpecialist.length === 0) {
      logWithCorrelation(
        correlationId,
        'warn',
        `Specialist not found: ${config.name}`,
        {
          action: 'skipping_update',
        },
      );
      return;
    }

    const specialist = existingSpecialist[0];
    const currentTools = (specialist.defaultTools as string[]) || [];

    logWithCorrelation(correlationId, 'info', `Current specialist state`, {
      specialist: config.name,
      currentToolsCount: currentTools.length,
      currentTools: currentTools.slice(0, 10), // Show first 10 for brevity
      hasNullTools: specialist.defaultTools === null,
    });

    // Update with new tool configuration
    const updateResult = await db
      .update(specialists)
      .set({
        defaultTools: config.expectedTools,
      })
      .where(eq(specialists.name, config.name))
      .returning();

    if (updateResult.length > 0) {
      logWithCorrelation(
        correlationId,
        'info',
        `Successfully updated specialist: ${config.name}`,
        {
          toolsAdded: config.expectedTools.length - currentTools.length,
          newToolsCount: config.expectedTools.length,
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      logWithCorrelation(
        correlationId,
        'error',
        `Failed to update specialist: ${config.name}`,
        {
          reason: 'no_rows_affected',
        },
      );
    }
  } catch (error) {
    logWithCorrelation(
      correlationId,
      'error',
      `Error updating specialist: ${config.name}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    throw error;
  }
}

/**
 * Verify specialist tool configurations
 */
async function verifySpecialistConfigurations(
  correlationId: string,
): Promise<void> {
  logWithCorrelation(
    correlationId,
    'info',
    'Verifying specialist configurations...',
  );

  try {
    const allSpecialists = await db.select().from(specialists);

    logWithCorrelation(
      correlationId,
      'info',
      'Specialist verification results',
      {
        totalSpecialists: allSpecialists.length,
      },
    );

    for (const specialist of allSpecialists) {
      const expectedConfig = SPECIALIST_CONFIGURATIONS.find(
        (c) => c.name === specialist.name,
      );
      const hasProperTools =
        specialist.defaultTools && specialist.defaultTools.length > 0;

      logWithCorrelation(
        correlationId,
        'info',
        `Specialist: ${specialist.name}`,
        {
          hasExpectedConfig: !!expectedConfig,
          hasProperTools,
          toolsCount: specialist.defaultTools?.length || 0,
          isConfigured: hasProperTools && !!expectedConfig,
          status: hasProperTools ? '✅ CONFIGURED' : '❌ NEEDS_UPDATE',
        },
      );

      if (expectedConfig && hasProperTools) {
        // Verify tool coverage
        const expectedTools = expectedConfig.expectedTools;
        const actualTools = specialist.defaultTools || [];
        const missingTools = expectedTools.filter(
          (tool) => !actualTools.includes(tool),
        );
        const extraTools = actualTools.filter(
          (tool) => !expectedTools.includes(tool),
        );

        if (missingTools.length > 0 || extraTools.length > 0) {
          logWithCorrelation(
            correlationId,
            'warn',
            `Tool configuration mismatch for ${specialist.name}`,
            {
              missingTools: missingTools.length > 0 ? missingTools : undefined,
              extraTools: extraTools.length > 0 ? extraTools : undefined,
            },
          );
        } else {
          logWithCorrelation(
            correlationId,
            'info',
            `Perfect tool configuration for ${specialist.name} ✅`,
          );
        }
      }
    }
  } catch (error) {
    logWithCorrelation(correlationId, 'error', 'Error during verification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const correlationId = generateCorrelationId();

  logWithCorrelation(
    correlationId,
    'info',
    '🚀 Starting Phase 2.1: Specialist Configuration Update',
    {
      configurationsToUpdate: SPECIALIST_CONFIGURATIONS.length,
      timestamp: new Date().toISOString(),
    },
  );

  try {
    // Pre-update verification
    await verifySpecialistConfigurations(correlationId);

    // Update each specialist configuration
    for (const config of SPECIALIST_CONFIGURATIONS) {
      await updateSpecialistConfiguration(config, correlationId);
    }

    // Post-update verification
    logWithCorrelation(correlationId, 'info', '🔍 Post-update verification...');
    await verifySpecialistConfigurations(correlationId);

    logWithCorrelation(
      correlationId,
      'info',
      '✅ Phase 2.1 Specialist Configuration Update COMPLETED',
      {
        totalUpdates: SPECIALIST_CONFIGURATIONS.length,
        duration: `${Date.now() - Number.parseInt(correlationId.split('_')[2], 10)}ms`,
      },
    );
  } catch (error) {
    logWithCorrelation(correlationId, 'error', '❌ Phase 2.1 Update FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as updateSpecialistConfigurations };
