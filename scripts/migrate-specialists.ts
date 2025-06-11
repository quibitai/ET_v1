#!/usr/bin/env tsx

/**
 * Migration Script: Populate Specialists Table
 *
 * This script migrates existing specialist configurations from TypeScript files
 * into the new specialists database table for centralized management.
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { specialists } from '@/lib/db/schema';
import { specialistRegistry } from '@/lib/ai/prompts/specialists';

// Load environment variables
config({
  path: '.env.local',
});

async function migrateSpecialists() {
  console.log('🚀 Starting specialist configuration migration...');

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  try {
    // Get all existing specialist configs
    const existingSpecialists = Object.values(specialistRegistry);
    console.log(
      `📋 Found ${existingSpecialists.length} specialists to migrate:`,
    );

    for (const specialist of existingSpecialists) {
      console.log(`   - ${specialist.id} (${specialist.name})`);
    }

    // Insert each specialist into the database
    for (const specialist of existingSpecialists) {
      console.log(`\n📝 Migrating specialist: ${specialist.id}`);

      const specialistData = {
        id: specialist.id,
        name: specialist.name,
        description: specialist.description || null,
        personaPrompt: specialist.persona,
        defaultTools: specialist.defaultTools || [],
      };

      try {
        await db.insert(specialists).values(specialistData);
        console.log(`   ✅ Successfully migrated ${specialist.id}`);
      } catch (error: any) {
        if (error.code === '23505') {
          // Duplicate key error
          console.log(
            `   ⚠️  Specialist ${specialist.id} already exists, skipping...`,
          );
        } else {
          console.error(
            `   ❌ Error migrating ${specialist.id}:`,
            error.message,
          );
          throw error;
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const migratedSpecialists = await db.select().from(specialists);
    console.log(
      `✅ Found ${migratedSpecialists.length} specialists in database:`,
    );

    for (const specialist of migratedSpecialists) {
      console.log(`   - ${specialist.id}: ${specialist.name}`);
      console.log(
        `     Tools: ${(specialist.defaultTools as string[])?.length || 0} configured`,
      );
    }

    // Close the connection
    await connection.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await connection.end();
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateSpecialists()
    .then(() => {
      console.log('\n✨ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateSpecialists };
