require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing environment variables');
}

const client = createClient(url, key);

async function clearProcessedFiles() {
  console.log('🔍 Investigating processed files table...\n');

  try {
    // Check current state of processed_google_drive_files
    console.log('📊 Current processed_google_drive_files table:');
    const { data: processedFiles, error: fetchError } = await client
      .from('processed_google_drive_files')
      .select('file_id, processed_at')
      .order('processed_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching processed files:', fetchError);
      return;
    }

    console.log(`Found ${processedFiles.length} processed files:`);
    if (processedFiles.length > 0) {
      processedFiles.slice(0, 10).forEach((file, i) => {
        console.log(
          `${i + 1}. ${file.file_id} (processed: ${file.processed_at})`,
        );
      });
      if (processedFiles.length > 10) {
        console.log(`... and ${processedFiles.length - 10} more files`);
      }
    }

    // Check if knowledge base tables are actually empty
    console.log('\n🔍 Checking knowledge base tables:');

    const { data: metadataCount } = await client
      .from('document_metadata')
      .select('id', { count: 'exact', head: true });

    const { data: rowsCount } = await client
      .from('document_rows')
      .select('id', { count: 'exact', head: true });

    const { data: documentsCount } = await client
      .from('documents')
      .select('id', { count: 'exact', head: true });

    console.log(`📋 Knowledge base status:`);
    console.log(
      `   - document_metadata: ${metadataCount?.length || 0} records`,
    );
    console.log(`   - document_rows: ${rowsCount?.length || 0} records`);
    console.log(`   - documents: ${documentsCount?.length || 0} records`);

    // If knowledge base is empty but processed files exist, offer to clear
    const knowledgeBaseEmpty =
      (metadataCount?.length || 0) === 0 &&
      (rowsCount?.length || 0) === 0 &&
      (documentsCount?.length || 0) === 0;

    if (knowledgeBaseEmpty && processedFiles.length > 0) {
      console.log('\n⚠️  MISMATCH DETECTED:');
      console.log('   - Knowledge base is empty (0 documents)');
      console.log(
        `   - But ${processedFiles.length} files are marked as processed`,
      );
      console.log('   - This will prevent N8N from reprocessing any files');

      console.log('\n🔧 Clearing processed_google_drive_files table...');

      const { error: deleteError } = await client
        .from('processed_google_drive_files')
        .delete()
        .neq('file_id', 'impossible-value'); // Delete all records

      if (deleteError) {
        console.error('❌ Error clearing processed files:', deleteError);
      } else {
        console.log('✅ Successfully cleared all processed file records');
        console.log(
          '🎉 N8N workflow will now reprocess all Google Drive files',
        );
      }
    } else if (!knowledgeBaseEmpty) {
      console.log(
        '\n✅ Knowledge base contains data - processed files table is correct',
      );
    } else {
      console.log(
        '\n✅ Both knowledge base and processed files are empty - no action needed',
      );
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function showN8NWorkflowStatus() {
  console.log('\n📋 N8N WORKFLOW STATUS AFTER CLEARING\n');

  console.log('🔄 What happens next in your N8N workflow:');
  console.log(
    '   1. "Get Processed IDs from Postgres" will return empty results',
  );
  console.log('   2. All Google Drive files will be considered "new"');
  console.log('   3. Files will be processed through the full pipeline:');
  console.log('      - Content extraction');
  console.log('      - Document metadata creation');
  console.log('      - Row data insertion');
  console.log('      - Vector embeddings (if configured)');
  console.log('   4. Files will be marked as processed again');

  console.log('\n⚠️  Important Notes:');
  console.log('   - This will reprocess ALL files in your Google Drive');
  console.log('   - Large numbers of files may take significant time');
  console.log('   - Consider running the workflow manually first to test');
  console.log('   - Monitor for any processing errors');

  console.log('\n🎯 Expected Outcome:');
  console.log(
    '   Your knowledge base will be fully repopulated with all Google Drive content',
  );
}

async function main() {
  console.log('🚀 Processed Files Table Cleaner\n');
  console.log('This script will clear the processed_google_drive_files table');
  console.log(
    'so N8N can reprocess all files after knowledge base deletion.\n',
  );

  await clearProcessedFiles();
  await showN8NWorkflowStatus();
}

if (require.main === module) {
  main().catch(console.error);
}
