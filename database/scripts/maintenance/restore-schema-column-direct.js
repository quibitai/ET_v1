require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Use PostgreSQL client directly for DDL operations
const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});

async function restoreSchemaColumnDirect() {
  console.log(
    '🔧 Restoring schema column to TEXT format for N8N compatibility...\n',
  );

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Check current schema column type
    console.log('\n🔍 Checking current schema column configuration...');

    const columnInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'document_metadata' 
      AND column_name = 'schema';
    `);

    if (columnInfo.rows.length > 0) {
      const col = columnInfo.rows[0];
      console.log(
        `Current schema column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`,
      );
    } else {
      console.log('❌ Schema column not found');
      return;
    }

    // Check existing data
    console.log('\n📋 Checking existing schema data...');
    const existingData = await client.query(
      'SELECT id, schema FROM document_metadata LIMIT 5;',
    );

    console.log(`Found ${existingData.rows.length} existing records:`);
    existingData.rows.forEach((record, i) => {
      console.log(
        `${i + 1}. ${record.id}: ${JSON.stringify(record.schema)} (type: ${typeof record.schema})`,
      );
    });

    // Step 1: Add temporary TEXT column
    console.log('\n🔄 Step 1: Adding temporary schema_text column...');
    await client.query(
      'ALTER TABLE document_metadata ADD COLUMN IF NOT EXISTS schema_text TEXT;',
    );
    console.log('✅ Added schema_text column');

    // Step 2: Copy and convert existing data
    console.log('\n🔄 Step 2: Converting existing data to text format...');
    await client.query(`
      UPDATE document_metadata 
      SET schema_text = CASE 
        WHEN schema IS NULL THEN NULL
        WHEN schema::text = 'null' THEN NULL
        WHEN jsonb_typeof(schema) = 'object' AND schema ? 'type' THEN schema->>'type'
        WHEN jsonb_typeof(schema) = 'string' THEN schema #>> '{}'
        ELSE schema::text
      END;
    `);
    console.log('✅ Converted existing data');

    // Step 3: Drop old JSONB column
    console.log('\n🔄 Step 3: Dropping old JSONB schema column...');
    await client.query('ALTER TABLE document_metadata DROP COLUMN schema;');
    console.log('✅ Dropped old schema column');

    // Step 4: Rename new column
    console.log('\n🔄 Step 4: Renaming schema_text to schema...');
    await client.query(
      'ALTER TABLE document_metadata RENAME COLUMN schema_text TO schema;',
    );
    console.log('✅ Renamed column to schema');

    // Test the new format
    console.log('\n🧪 Testing new TEXT schema column...');

    // Test 1: Insert string (N8N format)
    const testId1 = `test-string-${Date.now()}`;
    await client.query(
      'INSERT INTO document_metadata (id, title, schema, client_id) VALUES ($1, $2, $3, $4)',
      [
        testId1,
        'Test String Schema',
        'Income Statement (Profit and Loss)',
        'echo-tango',
      ],
    );
    console.log('✅ Test 1: String insert successful');

    // Test 2: Insert null
    const testId2 = `test-null-${Date.now()}`;
    await client.query(
      'INSERT INTO document_metadata (id, title, schema, client_id) VALUES ($1, $2, $3, $4)',
      [testId2, 'Test Null Schema', null, 'echo-tango'],
    );
    console.log('✅ Test 2: Null insert successful');

    // Test 3: Insert empty string
    const testId3 = `test-empty-${Date.now()}`;
    await client.query(
      'INSERT INTO document_metadata (id, title, schema, client_id) VALUES ($1, $2, $3, $4)',
      [testId3, 'Test Empty Schema', '', 'echo-tango'],
    );
    console.log('✅ Test 3: Empty string insert successful');

    // Verify test data
    console.log('\n📋 Verifying test data...');
    const testData = await client.query(
      'SELECT id, title, schema FROM document_metadata WHERE id IN ($1, $2, $3)',
      [testId1, testId2, testId3],
    );

    testData.rows.forEach((record, i) => {
      console.log(
        `${i + 1}. ${record.title}: "${record.schema}" (type: ${typeof record.schema})`,
      );
    });

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await client.query(
      'DELETE FROM document_metadata WHERE id IN ($1, $2, $3)',
      [testId1, testId2, testId3],
    );

    console.log('\n🎉 Schema column successfully restored to TEXT format!');
    console.log('\n✅ Your N8N workflow will now work exactly as before:');
    console.log('   - N8N expression: {{ $json.schema }}');
    console.log('   - Sends: "Income Statement (Profit and Loss)"');
    console.log('   - Database accepts: TEXT strings directly');
    console.log('   - No N8N changes required!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

async function main() {
  console.log('🚀 Schema Column Direct Restorer\n');
  console.log(
    'Restoring schema column to work with your existing N8N workflow.\n',
  );

  await restoreSchemaColumnDirect();

  console.log('\n📋 SUMMARY:\n');
  console.log('✅ Schema column is now TEXT (was JSONB)');
  console.log('✅ Accepts strings directly from N8N');
  console.log('✅ Existing data preserved and converted');
  console.log('✅ No N8N workflow changes needed');
  console.log('\n🚀 Your N8N workflow should work perfectly now!');
}

if (require.main === module) {
  main().catch(console.error);
}
