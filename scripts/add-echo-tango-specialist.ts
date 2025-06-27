#!/usr/bin/env tsx

import { db } from '../lib/db';
import { specialists } from '../lib/db/schema';
import { CONDENSED_ECHO_TANGO_PROMPT } from '../lib/ai/prompts/specialists/condensed';

async function addEchoTangoSpecialist() {
  try {
    console.log('🚀 Adding Echo Tango specialist to database...');

    const result = await db
      .insert(specialists)
      .values({
        id: 'echo-tango-specialist',
        name: 'Echo Tango',
        description:
          'Creative agency specialist for video production and brand storytelling',
        personaPrompt: CONDENSED_ECHO_TANGO_PROMPT,
        defaultTools: [
          'tavilySearch',
          'searchInternalKnowledgeBase',
          'listDocuments',
          'getFileContents',
          'asana_list_projects',
          'asana_get_project_details',
          'asana_create_task',
        ],
      })
      .onConflictDoUpdate({
        target: specialists.id,
        set: {
          name: 'Echo Tango',
          description:
            'Creative agency specialist for video production and brand storytelling',
          personaPrompt: CONDENSED_ECHO_TANGO_PROMPT,
          defaultTools: [
            'tavilySearch',
            'searchInternalKnowledgeBase',
            'listDocuments',
            'getFileContents',
            'asana_list_projects',
            'asana_get_project_details',
            'asana_create_task',
          ],
        },
      });

    console.log('✅ Echo Tango specialist added/updated successfully!');
    console.log('📋 Specialist details:');
    console.log('- ID: echo-tango-specialist');
    console.log('- Name: Echo Tango');
    console.log(
      '- Description: Creative agency specialist for video production and brand storytelling',
    );
    console.log(
      '- Tools: tavilySearch, searchInternalKnowledgeBase, listDocuments, getFileContents, asana tools',
    );
    console.log('🎯 Performance: ~50% token reduction with condensed prompt');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding Echo Tango specialist:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  addEchoTangoSpecialist();
}
