require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});

async function fixProcessedFilesOrphanCleanup() {
  console.log('🔧 Fixing processed_google_drive_files orphan cleanup...\n');

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Step 1: Identify orphaned processed files
    console.log('\n🔍 Step 1: Identifying orphaned processed files...');

    const orphanQuery = `
      SELECT pgf.file_id, pgf.processed_at
      FROM processed_google_drive_files pgf
      LEFT JOIN document_metadata dm ON pgf.file_id = dm.id
      WHERE dm.id IS NULL;
    `;

    const orphanResult = await client.query(orphanQuery);

    console.log(`Found ${orphanResult.rows.length} orphaned processed files:`);
    if (orphanResult.rows.length > 0) {
      orphanResult.rows.forEach((row, i) => {
        console.log(
          `${i + 1}. ${row.file_id} (processed: ${row.processed_at})`,
        );
      });
    } else {
      console.log('No orphaned processed files found.');
    }

    // Step 2: Clean up orphaned processed files
    if (orphanResult.rows.length > 0) {
      console.log('\n🧹 Step 2: Cleaning up orphaned processed files...');

      const deleteOrphansQuery = `
        DELETE FROM processed_google_drive_files 
        WHERE file_id NOT IN (
          SELECT id FROM document_metadata WHERE id IS NOT NULL
        );
      `;

      const deleteResult = await client.query(deleteOrphansQuery);
      console.log(
        `✅ Deleted ${deleteResult.rowCount} orphaned processed file records`,
      );
    }

    // Step 3: Create trigger for automatic cleanup
    console.log('\n🔧 Step 3: Creating automatic cleanup trigger...');

    // Create trigger function
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION cleanup_processed_files_on_metadata_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete corresponding processed file record when document_metadata is deleted
        DELETE FROM processed_google_drive_files 
        WHERE file_id = OLD.id;
        
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await client.query(triggerFunction);
    console.log('✅ Created cleanup trigger function');

    // Create the trigger
    const createTrigger = `
      DROP TRIGGER IF EXISTS trigger_cleanup_processed_files ON document_metadata;
      CREATE TRIGGER trigger_cleanup_processed_files
        AFTER DELETE ON document_metadata
        FOR EACH ROW
        EXECUTE FUNCTION cleanup_processed_files_on_metadata_delete();
    `;

    await client.query(createTrigger);
    console.log('✅ Created automatic cleanup trigger');

    // Step 4: Test the trigger
    console.log('\n🧪 Step 4: Testing automatic cleanup...');

    // Insert test data
    const testFileId = `test-cleanup-${Date.now()}`;

    await client.query(
      'INSERT INTO document_metadata (id, title, client_id) VALUES ($1, $2, $3)',
      [testFileId, 'Test Cleanup', 'echo-tango'],
    );

    await client.query(
      'INSERT INTO processed_google_drive_files (file_id) VALUES ($1)',
      [testFileId],
    );

    console.log('✅ Inserted test data');

    // Verify both records exist
    const beforeDelete = await client.query(
      'SELECT COUNT(*) as count FROM processed_google_drive_files WHERE file_id = $1',
      [testFileId],
    );
    console.log(
      `Before delete: ${beforeDelete.rows[0].count} processed file record(s)`,
    );

    // Delete from document_metadata (should trigger cleanup)
    await client.query('DELETE FROM document_metadata WHERE id = $1', [
      testFileId,
    ]);

    // Verify processed file was also deleted
    const afterDelete = await client.query(
      'SELECT COUNT(*) as count FROM processed_google_drive_files WHERE file_id = $1',
      [testFileId],
    );
    console.log(
      `After delete: ${afterDelete.rows[0].count} processed file record(s)`,
    );

    if (afterDelete.rows[0].count === '0') {
      console.log('✅ Automatic cleanup working correctly!');
    } else {
      console.log('❌ Automatic cleanup not working');
    }

    // Step 5: Show current state
    console.log('\n📋 Step 5: Current database state...');

    const metadataCount = await client.query(
      'SELECT COUNT(*) as count FROM document_metadata',
    );
    const processedCount = await client.query(
      'SELECT COUNT(*) as count FROM processed_google_drive_files',
    );

    console.log(`Document metadata records: ${metadataCount.rows[0].count}`);
    console.log(`Processed files records: ${processedCount.rows[0].count}`);

    // Check for any remaining mismatches
    const mismatchCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM processed_google_drive_files WHERE file_id NOT IN (SELECT id FROM document_metadata)) as orphaned_processed,
        (SELECT COUNT(*) FROM document_metadata WHERE id NOT IN (SELECT file_id FROM processed_google_drive_files)) as unprocessed_metadata
    `);

    const { orphaned_processed, unprocessed_metadata } = mismatchCheck.rows[0];

    if (orphaned_processed === '0' && unprocessed_metadata === '0') {
      console.log('✅ No mismatches found - databases are in sync');
    } else {
      console.log(`⚠️  Found mismatches:`);
      console.log(`   - Orphaned processed files: ${orphaned_processed}`);
      console.log(`   - Unprocessed metadata: ${unprocessed_metadata}`);
    }

    console.log('\n🎉 Processed files orphan cleanup completed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

async function showN8NWorkflowFix() {
  console.log('\n📋 N8N WORKFLOW ANALYSIS\n');

  console.log('🔍 Issue Identified:');
  console.log(
    '   - Your "Delete Orphan from Metadata" node only deletes from document_metadata',
  );
  console.log(
    '   - It does NOT delete corresponding processed_google_drive_files records',
  );
  console.log(
    '   - This causes files to remain "filtered out" even after deletion',
  );

  console.log('\n✅ Solution Applied:');
  console.log(
    '   - Cleaned up existing orphaned processed_google_drive_files records',
  );
  console.log('   - Added automatic trigger for future deletions');
  console.log(
    '   - Now when document_metadata is deleted, processed_google_drive_files is auto-cleaned',
  );

  console.log('\n🔧 Optional N8N Workflow Enhancement:');
  console.log('   You could add a node after "Delete Orphan from Metadata":');
  console.log('   ```sql');
  console.log(
    '   DELETE FROM processed_google_drive_files WHERE file_id = $1;',
  );
  console.log('   ```');
  console.log('   But the database trigger now handles this automatically.');

  console.log('\n🚀 Expected Behavior:');
  console.log('   - Files deleted from document_metadata will be reprocessed');
  console.log('   - No more "ghost" processed file records');
  console.log(
    '   - N8N workflow will work correctly for deleted/re-added files',
  );
}

async function main() {
  console.log('🚀 Processed Files Orphan Cleanup Fixer\n');
  console.log(
    'Fixing the mismatch between document_metadata and processed_google_drive_files.\n',
  );

  await fixProcessedFilesOrphanCleanup();
  await showN8NWorkflowFix();
}

if (require.main === module) {
  main().catch(console.error);
}
