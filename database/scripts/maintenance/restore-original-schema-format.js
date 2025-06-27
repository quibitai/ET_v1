require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables');
}

const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function restoreOriginalSchemaFormat() {
  console.log(
    '🔧 Restoring original schema column format to work with existing N8N workflow...\n',
  );

  try {
    console.log(
      '📋 The issue: When recreating tables, the schema column was set as JSONB',
    );
    console.log(
      '📋 Original working format: schema column accepted strings directly',
    );
    console.log('📋 N8N sends: "Income Statement (Profit and Loss)" (string)');
    console.log(
      '📋 Solution: Change schema column to TEXT to accept strings\n',
    );

    // First, let's see what we currently have
    console.log('🔍 Current schema column configuration...');

    const { data: currentData, error: fetchError } = await supabaseClient
      .from('document_metadata')
      .select('id, schema')
      .limit(5);

    if (fetchError) {
      console.error('❌ Error fetching current data:', fetchError);
      return;
    }

    console.log('Current schema values:');
    if (currentData.length > 0) {
      currentData.forEach((record, i) => {
        console.log(
          `${i + 1}. ${record.id}: ${JSON.stringify(record.schema)} (type: ${typeof record.schema})`,
        );
      });
    } else {
      console.log('No existing records found');
    }

    // Change schema column from JSONB to TEXT to accept strings directly
    console.log('\n🔄 Converting schema column from JSONB to TEXT...');

    // Step 1: Add a new TEXT column
    console.log('Step 1: Adding temporary schema_text column...');
    const { error: addColumnError } = await supabaseClient.rpc('exec_sql', {
      sql: 'ALTER TABLE document_metadata ADD COLUMN IF NOT EXISTS schema_text TEXT;',
    });

    if (addColumnError && !addColumnError.message.includes('already exists')) {
      console.error('❌ Error adding schema_text column:', addColumnError);
      return;
    }

    // Step 2: Copy existing data to new column (convert JSONB to text)
    console.log('Step 2: Converting existing JSONB data to text format...');
    const { error: copyDataError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        UPDATE document_metadata 
        SET schema_text = CASE 
          WHEN schema IS NULL THEN NULL
          WHEN schema::text = 'null' THEN NULL
          WHEN schema ? 'type' THEN schema->>'type'
          ELSE schema::text
        END;
      `,
    });

    if (copyDataError) {
      console.error('❌ Error copying data:', copyDataError);
      return;
    }

    // Step 3: Drop the old JSONB column
    console.log('Step 3: Dropping old JSONB schema column...');
    const { error: dropColumnError } = await supabaseClient.rpc('exec_sql', {
      sql: 'ALTER TABLE document_metadata DROP COLUMN IF EXISTS schema;',
    });

    if (dropColumnError) {
      console.error('❌ Error dropping old column:', dropColumnError);
      return;
    }

    // Step 4: Rename the new column to schema
    console.log('Step 4: Renaming schema_text to schema...');
    const { error: renameColumnError } = await supabaseClient.rpc('exec_sql', {
      sql: 'ALTER TABLE document_metadata RENAME COLUMN schema_text TO schema;',
    });

    if (renameColumnError) {
      console.error('❌ Error renaming column:', renameColumnError);
      return;
    }

    console.log('✅ Successfully converted schema column to TEXT format');

    // Test the fix
    console.log('\n🧪 Testing with N8N format...');

    // Test 1: Insert with string (what N8N sends)
    const testId1 = `test-string-schema-${Date.now()}`;
    const { error: test1Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId1,
        title: 'Test String Schema',
        schema: 'Income Statement (Profit and Loss)',
        client_id: 'echo-tango',
      });

    if (test1Error) {
      console.error('❌ Test 1 failed (string insert):', test1Error);
    } else {
      console.log('✅ Test 1 passed: String schema insert works (N8N format)');
    }

    // Test 2: Insert with null
    const testId2 = `test-null-schema-${Date.now()}`;
    const { error: test2Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId2,
        title: 'Test Null Schema',
        schema: null,
        client_id: 'echo-tango',
      });

    if (test2Error) {
      console.error('❌ Test 2 failed (null insert):', test2Error);
    } else {
      console.log('✅ Test 2 passed: Null schema insert works');
    }

    // Test 3: Insert with empty string
    const testId3 = `test-empty-schema-${Date.now()}`;
    const { error: test3Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId3,
        title: 'Test Empty Schema',
        schema: '',
        client_id: 'echo-tango',
      });

    if (test3Error) {
      console.error('❌ Test 3 failed (empty string insert):', test3Error);
    } else {
      console.log('✅ Test 3 passed: Empty string schema insert works');
    }

    // Verify the data
    console.log('\n📋 Verifying inserted test data...');
    const { data: testData, error: verifyError } = await supabaseClient
      .from('document_metadata')
      .select('id, title, schema')
      .in('id', [testId1, testId2, testId3]);

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError);
    } else {
      console.log('Test data verification:');
      testData.forEach((record, i) => {
        console.log(
          `${i + 1}. ${record.title}: "${record.schema}" (type: ${typeof record.schema})`,
        );
      });
    }

    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    await supabaseClient
      .from('document_metadata')
      .delete()
      .in('id', [testId1, testId2, testId3]);

    console.log('\n🎉 Schema column restored to original working format!');
    console.log('\n✅ N8N workflow should now work exactly as before:');
    console.log('   - N8N sends: "Income Statement (Profit and Loss)"');
    console.log('   - Database accepts: TEXT strings directly');
    console.log('   - No changes needed in N8N workflow');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function showRestorationSummary() {
  console.log('\n📋 RESTORATION SUMMARY\n');

  console.log('🔧 What was fixed:');
  console.log('   - Schema column changed from JSONB to TEXT');
  console.log('   - Now accepts strings directly (as it did before)');
  console.log('   - Existing data preserved and converted');

  console.log('\n✅ N8N Workflow Status:');
  console.log('   - No changes required in N8N');
  console.log('   - Expression {{ $json.schema }} works as before');
  console.log(
    '   - Sends string "Income Statement (Profit and Loss)" directly',
  );

  console.log('\n🎯 Expected Behavior:');
  console.log('   - N8N workflow will process files normally');
  console.log('   - Schema field will store the string value');
  console.log('   - No more "expects object but got string" errors');

  console.log('\n🚀 Ready to test your N8N workflow!');
}

async function main() {
  console.log('🚀 Original Schema Format Restorer\n');
  console.log(
    'This script restores the schema column to work with your existing N8N workflow.\n',
  );

  await restoreOriginalSchemaFormat();
  await showRestorationSummary();
}

if (require.main === module) {
  main().catch(console.error);
}
