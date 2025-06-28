import { sql } from '../lib/db/client';

/**
 * Create the processed_google_drive_files table
 * This table tracks which Google Drive files have been processed by the N8N workflow
 * to prevent reprocessing and enable incremental updates.
 */
async function createProcessedGoogleDriveFilesTable() {
  console.log('🔧 Creating processed_google_drive_files table...');

  try {
    // Create the table with the exact structure needed by N8N workflow
    await sql`
      CREATE TABLE IF NOT EXISTS processed_google_drive_files (
        file_id TEXT PRIMARY KEY,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('✅ Table created successfully');

    // Add performance indexes
    console.log('🔧 Creating indexes...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_processed_google_drive_files_processed_at 
      ON processed_google_drive_files(processed_at);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_processed_google_drive_files_created_at 
      ON processed_google_drive_files(created_at);
    `;

    console.log('✅ Indexes created successfully');

    // Verify table structure
    console.log('🔍 Verifying table structure...');

    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'processed_google_drive_files'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Table structure:');
    console.table(tableInfo);

    // Check if table is empty and show example usage
    const count = await sql`
      SELECT COUNT(*) as count FROM processed_google_drive_files;
    `;

    console.log(`📊 Current record count: ${count[0].count}`);

    console.log('\n📝 Table Usage:');
    console.log(
      '- N8N workflow queries: SELECT file_id FROM processed_google_drive_files',
    );
    console.log(
      '- N8N workflow inserts: INSERT INTO processed_google_drive_files (file_id, processed_at) VALUES ($1, NOW()) ON CONFLICT (file_id) DO NOTHING',
    );
    console.log(
      '- Purpose: Track processed Google Drive files to prevent reprocessing',
    );
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

// Run the script
createProcessedGoogleDriveFilesTable()
  .then(() => {
    console.log('\n🎉 processed_google_drive_files table setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });
