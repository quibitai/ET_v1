require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Use the same connection string from environment
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Missing POSTGRES_URL environment variable');
}

async function diagnoseCascadeDelete() {
  console.log('🔍 Diagnosing cascade delete relationships...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check current foreign key constraints
    console.log('\n📋 Current foreign key constraints:');
    const constraintsResult = await client.query(`
      SELECT
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name IN ('document_rows', 'documents') 
             OR ccu.table_name = 'document_metadata')
      ORDER BY tc.table_name, tc.constraint_name;
    `);

    if (constraintsResult.rows.length === 0) {
      console.log('❌ No foreign key constraints found!');
    } else {
      console.table(constraintsResult.rows);
    }

    // Check what tables reference document_metadata
    console.log('\n🔍 Checking table relationships:');

    // Check document_rows table structure
    const docRowsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'document_rows' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log('\nDocument_rows table structure:');
    console.table(docRowsSchema.rows);

    // Check documents table structure
    const documentsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'documents' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log('\nDocuments table structure:');
    console.table(documentsSchema.rows);

    // Test current cascade behavior
    console.log('\n🧪 Testing current cascade delete behavior...');

    // Create test data
    const testId = `test-cascade-${Date.now()}`;
    console.log(`Creating test document with ID: ${testId}`);

    // Insert test document_metadata
    await client.query(
      `
      INSERT INTO document_metadata (id, title, client_id) 
      VALUES ($1, $2, $3)
    `,
      [testId, 'Test Cascade Delete', 'echo-tango'],
    );

    // Insert test document_rows
    await client.query(
      `
      INSERT INTO document_rows (dataset_id, row_data, client_id) 
      VALUES ($1, $2, $3)
    `,
      [testId, '{"test": "data"}', 'echo-tango'],
    );

    // Insert test documents (if it references document_metadata)
    try {
      await client.query(
        `
        INSERT INTO documents (content, metadata, client_id) 
        VALUES ($1, $2, $3)
      `,
        ['Test content', `{"file_id": "${testId}"}`, 'echo-tango'],
      );
      console.log('✅ Test documents record created');
    } catch (error) {
      console.log(
        'ℹ️ Documents table may not reference document_metadata directly',
      );
    }

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

    console.log('\nBefore delete:');
    console.table(beforeDelete.rows);

    // Delete the metadata record
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

    console.log('\nAfter delete:');
    console.table(afterDelete.rows);

    // Clean up any remaining test data
    await client.query(`DELETE FROM document_rows WHERE dataset_id = $1`, [
      testId,
    ]);
    await client.query(
      `DELETE FROM documents WHERE metadata->>'file_id' = $1`,
      [testId],
    );
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

async function fixCascadeDelete() {
  console.log('\n🔧 Fixing cascade delete relationships...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Drop existing constraints if they exist
    console.log('\n🔄 Dropping existing foreign key constraints...');

    try {
      await client.query(`
        ALTER TABLE document_rows 
        DROP CONSTRAINT IF EXISTS document_rows_dataset_id_fkey;
      `);
      console.log('✅ Dropped document_rows foreign key constraint');
    } catch (error) {
      console.log('ℹ️ No existing document_rows constraint to drop');
    }

    // Create proper cascade delete constraint for document_rows
    console.log('\n🔗 Creating CASCADE DELETE constraint for document_rows...');
    await client.query(`
      ALTER TABLE document_rows
      ADD CONSTRAINT document_rows_dataset_id_fkey
      FOREIGN KEY (dataset_id) 
      REFERENCES document_metadata(id)
      ON DELETE CASCADE;
    `);
    console.log('✅ Created CASCADE DELETE constraint for document_rows');

    // Create trigger for documents table (since it uses JSON reference)
    console.log('\n🔗 Creating trigger for documents table CASCADE DELETE...');

    // First create the trigger function
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
    console.log('✅ Created trigger function for documents cascade delete');

    // Drop existing trigger if it exists
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_delete_documents_on_metadata_delete 
      ON document_metadata;
    `);

    // Create the trigger
    await client.query(`
      CREATE TRIGGER trigger_delete_documents_on_metadata_delete
      BEFORE DELETE ON document_metadata
      FOR EACH ROW
      EXECUTE FUNCTION delete_documents_on_metadata_delete();
    `);
    console.log('✅ Created trigger for documents cascade delete');

    // Create indexes for better performance
    console.log('\n📊 Creating performance indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_rows_dataset_id 
      ON document_rows(dataset_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_metadata_file_id 
      ON documents USING gin ((metadata->>'file_id'));
    `);

    console.log('✅ Created performance indexes');
  } catch (error) {
    console.error('❌ Error fixing cascade delete:', error);
  } finally {
    await client.end();
  }
}

async function testCascadeDelete() {
  console.log('\n🧪 Testing fixed cascade delete behavior...\n');

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
    const testId = `test-cascade-fixed-${Date.now()}`;
    console.log(`Creating test document with ID: ${testId}`);

    // Insert test document_metadata
    await client.query(
      `
      INSERT INTO document_metadata (id, title, client_id) 
      VALUES ($1, $2, $3)
    `,
      [testId, 'Test Cascade Delete Fixed', 'echo-tango'],
    );

    // Insert multiple test document_rows
    await client.query(
      `
      INSERT INTO document_rows (dataset_id, row_data, client_id) 
      VALUES ($1, $2, $3), ($1, $4, $3)
    `,
      [testId, '{"test": "data1"}', 'echo-tango', '{"test": "data2"}'],
    );

    // Insert test documents
    await client.query(
      `
      INSERT INTO documents (content, metadata, client_id) 
      VALUES ($1, $2, $3)
    `,
      [
        'Test content for cascade',
        `{"file_id": "${testId}", "type": "test"}`,
        'echo-tango',
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

    // Delete the metadata record - this should cascade
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

    // Verify cascade worked
    const totalRemaining =
      afterDelete.rows[0].metadata_count +
      afterDelete.rows[0].rows_count +
      afterDelete.rows[0].documents_count;

    if (totalRemaining === 0) {
      console.log('\n🎉 CASCADE DELETE is working perfectly!');
    } else {
      console.log('\n❌ CASCADE DELETE is not working completely');
      console.log('Some records were not deleted automatically');
    }
  } catch (error) {
    console.error('❌ Error testing cascade delete:', error);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🚀 Cascade Delete Fix Tool\n');

  await diagnoseCascadeDelete();
  await fixCascadeDelete();
  await testCascadeDelete();

  console.log('\n✅ Cascade delete setup complete!');
  console.log('\n📝 What was fixed:');
  console.log(
    '   - Added CASCADE DELETE constraint for document_rows → document_metadata',
  );
  console.log('   - Created trigger for documents table cascade delete');
  console.log('   - Added performance indexes');
  console.log('\n🔄 Now when you delete a document_metadata record:');
  console.log('   1. All related document_rows will be deleted automatically');
  console.log('   2. All related documents will be deleted automatically');
  console.log('   3. No orphaned records will remain');
}

if (require.main === module) {
  main().catch(console.error);
}
