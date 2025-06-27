#!/usr/bin/env tsx

/**
 * Update Echo Tango Specialist with Complete Google Workspace Tools
 *
 * This script updates the Echo Tango specialist to include all available
 * Google Workspace MCP tools plus existing core tools for maximum capability.
 */

import { db } from '../lib/db';
import { specialists } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { CONDENSED_ECHO_TANGO_PROMPT } from '../lib/ai/prompts/specialists/condensed';

/**
 * Complete tool configuration for Echo Tango specialist
 * Includes all Google Workspace tools, research tools, and creative tools
 */
const COMPLETE_ECHO_TANGO_TOOLS = [
  // Core Research & Knowledge Tools
  'tavilySearch',
  'searchInternalKnowledgeBase',
  'listDocuments',
  'getDocumentContents',
  'getMultipleDocuments',
  'queryDocumentRows',

  // Google Workspace - Gmail Tools
  'search_gmail_messages',
  'list_gmail_messages',
  'get_gmail_message_content',
  'get_gmail_thread_content',
  'send_gmail_message',
  'draft_gmail_message',
  'list_gmail_labels',
  'manage_gmail_label',
  'modify_gmail_message_labels',

  // Google Workspace - Drive Tools
  'search_drive_files',
  'get_drive_file_content',
  'list_drive_items',
  'create_drive_file',

  // Google Workspace - Calendar Tools
  'list_calendars',
  'get_events',
  'create_event',
  'modify_event',
  'delete_event',
  'get_event',

  // Google Workspace - Docs Tools
  'search_docs',
  'get_docs_content',
  'create_docs',
  'list_docs',

  // Google Workspace - Sheets Tools
  'list_sheets',
  'get_sheets_info',
  'read_sheets_values',
  'modify_sheets_values',
  'create_sheets',

  // Google Workspace - Forms Tools
  'create_forms',
  'get_forms',
  'get_forms_response',
  'list_forms_responses',

  // Google Workspace - Chat Tools
  'list_chat_spaces',
  'get_chat_messages',
  'send_chat_message',
  'search_chat_messages',

  // Project Management (Asana)
  'asana_get_user_info',
  'asana_list_projects',
  'asana_get_project_details',
  'asana_create_task',
  'asana_list_tasks',
  'asana_get_task_details',
  'asana_update_task',
  'asana_search',

  // Creative & Business Tools
  'createBudget',
  'googleCalendar', // Legacy support
  'requestSuggestions',
  'getMessagesFromOtherChat',

  // Utility Tools
  'getWeather',
];

async function updateEchoTangoSpecialist() {
  try {
    console.log(
      '🚀 Updating Echo Tango specialist with complete Google Workspace tools...',
    );
    console.log(
      `📊 Adding ${COMPLETE_ECHO_TANGO_TOOLS.length} tools to specialist`,
    );

    const result = await db
      .update(specialists)
      .set({
        name: 'Echo Tango',
        description:
          'Creative agency specialist with complete Google Workspace integration for video production and brand storytelling',
        personaPrompt: CONDENSED_ECHO_TANGO_PROMPT,
        defaultTools: COMPLETE_ECHO_TANGO_TOOLS,
      })
      .where(eq(specialists.id, 'echo-tango-specialist'))
      .returning();

    if (result.length === 0) {
      // If specialist doesn't exist, create it
      console.log(
        '🔧 Specialist not found, creating new Echo Tango specialist...',
      );

      await db.insert(specialists).values({
        id: 'echo-tango-specialist',
        name: 'Echo Tango',
        description:
          'Creative agency specialist with complete Google Workspace integration for video production and brand storytelling',
        personaPrompt: CONDENSED_ECHO_TANGO_PROMPT,
        defaultTools: COMPLETE_ECHO_TANGO_TOOLS,
      });

      console.log('✅ Echo Tango specialist created successfully!');
    } else {
      console.log('✅ Echo Tango specialist updated successfully!');
    }

    console.log('\n📋 Complete Tool Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n📧 Gmail Tools (9):');
    const gmailTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('gmail'),
    );
    gmailTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📁 Drive Tools (4):');
    const driveTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('drive'),
    );
    driveTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📅 Calendar Tools (6):');
    const calendarTools = COMPLETE_ECHO_TANGO_TOOLS.filter(
      (t) => t.includes('calendar') || t.includes('event'),
    );
    calendarTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📝 Docs Tools (4):');
    const docsTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('docs'),
    );
    docsTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📊 Sheets Tools (5):');
    const sheetsTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('sheets'),
    );
    sheetsTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📋 Forms Tools (4):');
    const formsTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('forms'),
    );
    formsTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n💬 Chat Tools (4):');
    const chatTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('chat'),
    );
    chatTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n🔍 Research Tools (6):');
    const researchTools = [
      'tavilySearch',
      'searchInternalKnowledgeBase',
      'listDocuments',
      'getDocumentContents',
      'getMultipleDocuments',
      'queryDocumentRows',
    ];
    researchTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n📊 Project Management Tools (8):');
    const asanaTools = COMPLETE_ECHO_TANGO_TOOLS.filter((t) =>
      t.includes('asana'),
    );
    asanaTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n🎨 Creative & Business Tools (6):');
    const creativeTools = [
      'createBudget',
      'googleCalendar',
      'requestSuggestions',
      'getMessagesFromOtherChat',
      'getWeather',
    ];
    creativeTools.forEach((tool) => console.log(`  • ${tool}`));

    console.log('\n🎯 Total Tool Count:', COMPLETE_ECHO_TANGO_TOOLS.length);
    console.log(
      '🚀 Echo Tango is now equipped with complete Google Workspace integration!',
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating Echo Tango specialist:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  updateEchoTangoSpecialist();
}
