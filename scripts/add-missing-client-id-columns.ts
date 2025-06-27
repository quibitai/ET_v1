import { sql } from '../lib/db/client';

/**
 * Add missing client_id columns to knowledge base tables
 * Based on the N8N workflow analysis, these tables need client_id for multi-tenant support
 */
async function addMissingClientIdColumns() {
  console.log('🔧 Checking and adding missing client_id columns...');

  try {
    // Check current structure of document_metadata
    console.log('\n1️⃣ Checking document_metadata table...');
    const metadataColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'document_metadata'
      ORDER BY ordinal_position;
    `;

    console.log('Current columns in document_metadata:');
    console.table(metadataColumns);

    const hasMetadataClientId = metadataColumns.some(
      (col) => col.column_name === 'client_id',
    );

    if (!hasMetadataClientId) {
      console.log('➕ Adding client_id column to document_metadata...');
      await sql`
        ALTER TABLE document_metadata 
        ADD COLUMN IF NOT EXISTS client_id TEXT NOT NULL DEFAULT 'echo-tango';
      `;
      console.log('✅ Added client_id to document_metadata');
    } else {
      console.log('✅ client_id already exists in document_metadata');
    }

    // Check current structure of document_rows
    console.log('\n2️⃣ Checking document_rows table...');
    const rowsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'document_rows'
      ORDER BY ordinal_position;
    `;

    console.log('Current columns in document_rows:');
    console.table(rowsColumns);

    const hasRowsClientId = rowsColumns.some(
      (col) => col.column_name === 'client_id',
    );

    if (!hasRowsClientId) {
      console.log('➕ Adding client_id column to document_rows...');
      await sql`
        ALTER TABLE document_rows 
        ADD COLUMN IF NOT EXISTS client_id TEXT NOT NULL DEFAULT 'echo-tango';
      `;
      console.log('✅ Added client_id to document_rows');
    } else {
      console.log('✅ client_id already exists in document_rows');
    }

    // Check current structure of documents (Supabase vector store)
    console.log('\n3️⃣ Checking documents table...');
    const documentsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position;
    `;

    console.log('Current columns in documents:');
    console.table(documentsColumns);

    const hasDocumentsClientId = documentsColumns.some(
      (col) => col.column_name === 'client_id',
    );

    if (!hasDocumentsClientId) {
      console.log('➕ Adding client_id column to documents...');
      await sql`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS client_id TEXT NOT NULL DEFAULT 'echo-tango';
      `;
      console.log('✅ Added client_id to documents');
    } else {
      console.log('✅ client_id already exists in documents');
    }

    // Add indexes for client_id columns for performance
    console.log('\n4️⃣ Adding indexes for client_id columns...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_document_metadata_client_id 
      ON document_metadata(client_id);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_document_rows_client_id 
      ON document_rows(client_id);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_client_id 
      ON documents(client_id);
    `;

    console.log('✅ Client ID indexes created');

    // Verify the N8N workflow queries will work
    console.log('\n5️⃣ Testing N8N workflow compatibility...');

    // Test the delete query from N8N workflow
    try {
      await sql`
        SELECT COUNT(*) as count 
        FROM documents 
        WHERE metadata->>'file_id' LIKE '%test%' AND client_id = 'echo-tango';
      `;
      console.log('✅ N8N documents delete query format is compatible');
    } catch (error) {
      console.log(
        '⚠️  N8N documents delete query may need adjustment:',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test the document_rows delete query from N8N workflow
    try {
      await sql`
        SELECT COUNT(*) as count 
        FROM document_rows 
        WHERE dataset_id = 'test' AND client_id = 'echo-tango';
      `;
      console.log('✅ N8N document_rows delete query format is compatible');
    } catch (error) {
      console.log(
        '⚠️  N8N document_rows delete query may need adjustment:',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Show final table structures
    console.log('\n📋 Final table structures:');

    const finalMetadata = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'document_metadata'
      ORDER BY ordinal_position;
    `;

    const finalRows = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'document_rows'
      ORDER BY ordinal_position;
    `;

    const finalDocuments = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position;
    `;

    console.log('\n📊 document_metadata:');
    console.table(finalMetadata);

    console.log('\n📊 document_rows:');
    console.table(finalRows);

    console.log('\n📊 documents:');
    console.table(finalDocuments);

    console.log('\n🎯 N8N Workflow Compatibility:');
    console.log('✅ All tables now have client_id columns');
    console.log('✅ Default client_id set to "echo-tango"');
    console.log('✅ Indexes added for performance');
    console.log('✅ Multi-tenant support enabled');
  } catch (error) {
    console.error('❌ Error adding client_id columns:', error);
    throw error;
  }
}

// Run the script
addMissingClientIdColumns()
  .then(() => {
    console.log(
      '\n🎉 Client ID columns successfully added to all knowledge base tables!',
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to add client ID columns:', error);
    process.exit(1);
  });
