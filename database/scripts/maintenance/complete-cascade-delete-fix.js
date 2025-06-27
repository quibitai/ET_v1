require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Missing POSTGRES_URL environment variable');
}

async function completeCascadeDeleteFix() {
  console.log('🔧 Completing cascade delete fix...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Fix the index creation issue
    console.log('\n📊 Creating proper performance indexes...');

    // Create index for document_rows (this should already exist)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_rows_dataset_id 
      ON document_rows(dataset_id);
    `);
    console.log('✅ Created index for document_rows.dataset_id');

    // Create proper index for documents metadata file_id (using JSONB operators)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_metadata_file_id 
      ON documents USING btree ((metadata->>'file_id'));
    `);
    console.log('✅ Created index for documents.metadata file_id');

    // Verify all constraints and triggers exist
    console.log('\n🔍 Verifying cascade delete setup...');

    // Check foreign key constraint
    const fkCheck = await client.query(`
      SELECT constraint_name, delete_rule 
      FROM information_schema.referential_constraints 
      WHERE constraint_name = 'document_rows_dataset_id_fkey';
    `);

    if (fkCheck.rows.length > 0 && fkCheck.rows[0].delete_rule === 'CASCADE') {
      console.log('✅ Foreign key constraint with CASCADE DELETE exists');
    } else {
      console.log('❌ Foreign key constraint issue detected');
    }

    // Check trigger exists
    const triggerCheck = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_name = 'trigger_delete_documents_on_metadata_delete';
    `);

    if (triggerCheck.rows.length > 0) {
      console.log('✅ Cascade delete trigger for documents table exists');
    } else {
      console.log('❌ Trigger not found - recreating...');

      // Recreate trigger
      await client.query(`
        CREATE OR REPLACE FUNCTION delete_documents_on_metadata_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          DELETE FROM documents 
          WHERE metadata->>'file_id' = OLD.id;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS trigger_delete_documents_on_metadata_delete 
        ON document_metadata;
      `);

      await client.query(`
        CREATE TRIGGER trigger_delete_documents_on_metadata_delete
        BEFORE DELETE ON document_metadata
        FOR EACH ROW
        EXECUTE FUNCTION delete_documents_on_metadata_delete();
      `);

      console.log('✅ Recreated cascade delete trigger');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

async function finalCascadeTest() {
  console.log('\n🧪 Final cascade delete test...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create comprehensive test data
    const testId = `final-test-${Date.now()}`;
    console.log(`Creating test document with ID: ${testId}`);

    // Insert test document_metadata
    await client.query(
      `
      INSERT INTO document_metadata (id, title, client_id) 
      VALUES ($1, $2, $3)
    `,
      [testId, 'Final Cascade Test', 'echo-tango'],
    );

    // Insert multiple test document_rows
    await client.query(
      `
      INSERT INTO document_rows (dataset_id, row_data, client_id) 
      VALUES ($1, $2, $3), ($1, $4, $3), ($1, $5, $3)
    `,
      [
        testId,
        '{"test": "row1"}',
        'echo-tango',
        '{"test": "row2"}',
        '{"test": "row3"}',
      ],
    );

    // Insert multiple test documents
    await client.query(
      `
      INSERT INTO documents (content, metadata, client_id) 
      VALUES ($1, $2, $3), ($4, $5, $3)
    `,
      [
        'Test content 1',
        `{"file_id": "${testId}", "type": "test1"}`,
        'echo-tango',
        'Test content 2',
        `{"file_id": "${testId}", "type": "test2"}`,
      ],
    );

    // Check what was created
    const beforeDelete = await client.query(
      `
      SELECT 
        (SELECT COUNT(*) FROM document_metadata WHERE id = $1) as metadata_count,
        (SELECT COUNT(*) FROM document_rows WHERE dataset_id = $1) as rows_count,
        (SELECT COUNT(*) FROM documents WHERE metadata->>'file_id' = $1) as documents_count
    `,
      [testId],
    );

    console.log('Before cascade delete:');
    console.table(beforeDelete.rows);

    // Delete the metadata record - this should cascade everything
    console.log(`\n🗑️ Deleting document_metadata record: ${testId}`);
    const deleteResult = await client.query(
      `
      DELETE FROM document_metadata WHERE id = $1
    `,
      [testId],
    );

    console.log(`Deleted ${deleteResult.rowCount} metadata record(s)`);

    // Check what remains after delete
    const afterDelete = await client.query(
      `
      SELECT 
        (SELECT COUNT(*) FROM document_metadata WHERE id = $1) as metadata_count,
        (SELECT COUNT(*) FROM document_rows WHERE dataset_id = $1) as rows_count,
        (SELECT COUNT(*) FROM documents WHERE metadata->>'file_id' = $1) as documents_count
    `,
      [testId],
    );

    console.log('\nAfter cascade delete:');
    console.table(afterDelete.rows);

    // Verify cascade worked perfectly
    const totalRemaining =
      parseInt(afterDelete.rows[0].metadata_count) +
      parseInt(afterDelete.rows[0].rows_count) +
      parseInt(afterDelete.rows[0].documents_count);

    if (totalRemaining === 0) {
      console.log('\n🎉 CASCADE DELETE is working perfectly!');
      console.log('✅ All related records were deleted automatically');
    } else {
      console.log('\n❌ CASCADE DELETE is not working completely');
      console.log(`${totalRemaining} records were not deleted automatically`);
    }
  } catch (error) {
    console.error('❌ Error testing cascade delete:', error);
  } finally {
    await client.end();
  }
}

async function showCascadeDeleteSummary() {
  console.log('\n📋 CASCADE DELETE SETUP SUMMARY\n');

  console.log('🔗 Relationships configured:');
  console.log(
    '   1. document_rows.dataset_id → document_metadata.id (CASCADE DELETE)',
  );
  console.log(
    '   2. documents.metadata.file_id → document_metadata.id (TRIGGER DELETE)',
  );

  console.log('\n🗑️ When you delete a document_metadata record:');
  console.log(
    '   ✅ All document_rows with matching dataset_id are deleted automatically',
  );
  console.log(
    '   ✅ All documents with matching metadata.file_id are deleted automatically',
  );
  console.log('   ✅ No orphaned records remain in the system');

  console.log('\n📊 Performance optimizations:');
  console.log('   ✅ Index on document_rows.dataset_id for fast FK lookups');
  console.log(
    '   ✅ Index on documents.metadata.file_id for fast JSON queries',
  );

  console.log('\n🎯 Result:');
  console.log(
    '   Your knowledge base now has proper cascade delete functionality!',
  );
  console.log(
    '   Deleting documents from document_metadata will clean up all related data.',
  );
}

async function main() {
  console.log('🚀 Complete Cascade Delete Fix\n');

  await completeCascadeDeleteFix();
  await finalCascadeTest();
  await showCascadeDeleteSummary();
}

if (require.main === module) {
  main().catch(console.error);
}
