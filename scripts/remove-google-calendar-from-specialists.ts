#!/usr/bin/env tsx
/**
 * Database Migration Script: Remove Google Calendar N8N Tool from Specialists
 *
 * This script removes the legacy 'googleCalendar' tool from specialist default_tools
 * and replaces it with Google Workspace MCP calendar tools.
 *
 * Part of Phase 1.1: Google Calendar N8N Tool Removal
 * Development Roadmap v9.0.0
 */

import { db } from '@/lib/db/client';
import { specialists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Google Workspace MCP calendar tools to replace googleCalendar
const GOOGLE_WORKSPACE_CALENDAR_TOOLS = [
  'list_calendars',
  'get_events',
  'create_event',
  'modify_calendar_event',
  'delete_calendar_event',
];

interface SpecialistRecord {
  id: string;
  name: string;
  defaultTools: string[] | null;
}

async function removeGoogleCalendarFromSpecialists() {
  console.log('🔧 Starting Google Calendar tool removal migration...');

  try {
    // Get all specialists
    const allSpecialists = await db.select().from(specialists);
    console.log(`📊 Found ${allSpecialists.length} specialists to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const specialist of allSpecialists) {
      const defaultTools = specialist.defaultTools as string[] | null;

      if (!defaultTools || !Array.isArray(defaultTools)) {
        console.log(
          `⚠️  Specialist '${specialist.name}' has no default_tools array - skipping`,
        );
        skippedCount++;
        continue;
      }

      // Check if googleCalendar exists in the tools array
      const hasGoogleCalendar = defaultTools.includes('googleCalendar');

      if (!hasGoogleCalendar) {
        console.log(
          `✅ Specialist '${specialist.name}' doesn't have googleCalendar - skipping`,
        );
        skippedCount++;
        continue;
      }

      console.log(`🔄 Updating specialist '${specialist.name}'...`);
      console.log(`   Current tools: ${defaultTools.length} tools`);
      console.log(`   Has googleCalendar: ${hasGoogleCalendar}`);

      // Remove googleCalendar and add Google Workspace calendar tools
      const updatedTools = defaultTools
        .filter((tool) => tool !== 'googleCalendar')
        .concat(GOOGLE_WORKSPACE_CALENDAR_TOOLS)
        // Remove duplicates in case some tools already exist
        .filter((tool, index, array) => array.indexOf(tool) === index);

      console.log(`   Updated tools: ${updatedTools.length} tools`);
      console.log(`   Removed: googleCalendar`);
      console.log(`   Added: ${GOOGLE_WORKSPACE_CALENDAR_TOOLS.join(', ')}`);

      // Update the specialist in the database
      await db
        .update(specialists)
        .set({
          defaultTools: updatedTools,
        })
        .where(eq(specialists.id, specialist.id));

      updatedCount++;
      console.log(`✅ Successfully updated specialist '${specialist.name}'`);
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total specialists: ${allSpecialists.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(
      '✅ Google Calendar tool removal migration completed successfully!',
    );

    return {
      success: true,
      totalSpecialists: allSpecialists.length,
      updated: updatedCount,
      skipped: skippedCount,
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  removeGoogleCalendarFromSpecialists()
    .then((result) => {
      console.log('\n🎉 Migration completed successfully!', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

export { removeGoogleCalendarFromSpecialists };
