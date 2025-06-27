#!/usr/bin/env tsx

/**
 * Client Configuration Cleanup Script
 *
 * This script removes the obsolete 'specialistPrompts' key from client configurations
 * since specialist prompts are now stored in the dedicated specialists table.
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({
  path: '.env.local',
});

async function cleanupClientConfig() {
  console.log('🧹 Starting client config cleanup...');

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  try {
    // 1. Fetch all client records to check for specialistPrompts
    console.log('📋 Fetching all client records...');
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        config_json: clients.config_json,
      })
      .from(clients);

    console.log(`Found ${allClients.length} client(s) to check:`);
    for (const client of allClients) {
      console.log(`   - ${client.id}: ${client.name}`);
    }

    let updatedCount = 0;
    let skippedCount = 0;

    // 2. Process each client
    for (const clientData of allClients) {
      console.log(
        `\n🔍 Processing client: ${clientData.id} (${clientData.name})`,
      );

      const config = clientData.config_json as any;

      // 3. Check if the redundant key exists
      if (config?.specialistPrompts) {
        console.log(
          `   ⚠️  Found obsolete 'specialistPrompts' key with ${Object.keys(config.specialistPrompts).length} specialist(s)`,
        );

        // Log what we're removing for audit purposes
        const specialistIds = Object.keys(config.specialistPrompts);
        console.log(
          `   📝 Removing specialist prompts for: ${specialistIds.join(', ')}`,
        );

        // 4. Create a clean copy of the config without specialistPrompts
        const { specialistPrompts, ...cleanConfig } = config;

        // 5. Update the record in the database with the cleaned config
        await db
          .update(clients)
          .set({ config_json: cleanConfig })
          .where(eq(clients.id, clientData.id));

        console.log(
          `   ✅ Successfully removed 'specialistPrompts' key and updated client record`,
        );
        updatedCount++;
      } else {
        console.log(
          `   ✅ No 'specialistPrompts' key found. Configuration is already clean.`,
        );
        skippedCount++;
      }
    }

    // 6. Summary
    console.log('\n📊 Cleanup Summary:');
    console.log(`   - Updated clients: ${updatedCount}`);
    console.log(`   - Already clean clients: ${skippedCount}`);
    console.log(`   - Total clients processed: ${allClients.length}`);

    if (updatedCount > 0) {
      console.log('\n🎉 Client configuration cleanup completed successfully!');
      console.log(
        '✨ Specialist prompts are now exclusively managed via the specialists table.',
      );
    } else {
      console.log(
        '\n✅ All client configurations were already clean. No updates needed.',
      );
    }

    // Close the connection
    await connection.end();
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await connection.end();
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupClientConfig()
    .then(() => {
      console.log('\n✨ Cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupClientConfig };
