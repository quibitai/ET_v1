import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as fs from 'node:fs';
import * as path from 'node:path';

config({
  path: '.env.local',
});

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log('⏳ Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './lib/db/migrations' });

  // Run custom migration to drop deprecated tables
  // DISABLED: File removed during cleanup - deprecated tables already dropped
  /*
  try {
    console.log('⏳ Running custom migration to drop deprecated tables...');
    const dropTablesSQL = fs.readFileSync(
      path.join(process.cwd(), 'lib/db/migrations/drop_deprecated_tables.sql'),
      'utf8',
    );

    await connection.unsafe(dropTablesSQL);
    console.log('✅ Deprecated tables dropped successfully');
  } catch (err) {
    console.error('⚠️ Error running custom migration:', err);
    // Continue execution even if this fails
  }
  */

  // Run custom migration to enforce client_id NOT NULL constraints
  try {
    console.log(
      '⏳ Running custom migration to enforce client_id NOT NULL constraints...',
    );
    const clientIdMigrationPath = path.join(
      process.cwd(),
      'lib/db/migrations/0007_enforce_not_null.sql',
    );

    if (fs.existsSync(clientIdMigrationPath)) {
      const clientIdMigrationSQL = fs.readFileSync(
        clientIdMigrationPath,
        'utf8',
      );
      await connection.unsafe(clientIdMigrationSQL);
      console.log('✅ client_id NOT NULL constraints applied successfully');
    } else {
      console.warn(
        '⚠️ client_id migration file not found at:',
        clientIdMigrationPath,
      );
    }
  } catch (err) {
    console.error('⚠️ Error enforcing client_id NOT NULL constraints:', err);
    // Continue execution even if this fails
  }

  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
