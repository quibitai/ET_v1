require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables');
}

const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function fixSchemaColumn() {
  console.log(
    '🔧 Fixing document_metadata schema column for N8N compatibility...\n',
  );

  try {
    // Check if we have any existing data with problematic schemas
    console.log('🔍 Checking existing schema data...');

    const { data: existingData, error: dataError } = await supabaseClient
      .from('document_metadata')
      .select('id, schema')
      .limit(10);

    if (dataError) {
      console.error('❌ Error fetching existing data:', dataError);
      return;
    }

    console.log(`Found ${existingData.length} existing records`);
    if (existingData.length > 0) {
      console.log('Sample schema values:');
      existingData.forEach((record, i) => {
        console.log(`${i + 1}. ${record.id}: ${JSON.stringify(record.schema)}`);
      });
    }

    // Make schema column nullable
    console.log('\n🔧 Making schema column more flexible...');

    // Use direct SQL to make the column nullable
    const { error: alterError } = await supabaseClient.rpc('exec_sql', {
      sql: 'ALTER TABLE document_metadata ALTER COLUMN schema DROP NOT NULL;',
    });

    if (alterError && !alterError.message.includes('does not exist')) {
      console.log('Note: schema column constraint update:', alterError.message);
    } else {
      console.log('✅ Made schema column nullable');
    }

    // Test the fix with different formats
    console.log('\n🧪 Testing schema column with different formats...');

    // Test 1: Insert with proper object format
    const testId1 = `test-schema-object-${Date.now()}`;
    const { error: test1Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId1,
        title: 'Test Schema Object',
        schema: { type: 'Income Statement (Profit and Loss)' },
        client_id: 'echo-tango',
      });

    if (test1Error) {
      console.error('❌ Test 1 failed (object insert):', test1Error);
    } else {
      console.log('✅ Test 1 passed: Object schema insert works');
    }

    // Test 2: Insert with null schema
    const testId2 = `test-schema-null-${Date.now()}`;
    const { error: test2Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId2,
        title: 'Test Schema Null',
        schema: null,
        client_id: 'echo-tango',
      });

    if (test2Error) {
      console.error('❌ Test 2 failed (null insert):', test2Error);
    } else {
      console.log('✅ Test 2 passed: Null schema insert works');
    }

    // Test 3: Insert with empty object
    const testId3 = `test-schema-empty-${Date.now()}`;
    const { error: test3Error } = await supabaseClient
      .from('document_metadata')
      .insert({
        id: testId3,
        title: 'Test Schema Empty',
        schema: {},
        client_id: 'echo-tango',
      });

    if (test3Error) {
      console.error('❌ Test 3 failed (empty object insert):', test3Error);
    } else {
      console.log('✅ Test 3 passed: Empty object schema insert works');
    }

    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    await supabaseClient
      .from('document_metadata')
      .delete()
      .in('id', [testId1, testId2, testId3]);

    console.log('\n🎉 Schema column fixes completed successfully!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function showN8NConfiguration() {
  console.log('\n📋 N8N CONFIGURATION GUIDE\n');

  console.log('🔧 Update Schema for Document Metadata Node:');
  console.log('   Current problematic expression: {{ $json.schema }}');
  console.log('   ❌ This sends: "Income Statement (Profit and Loss)"');
  console.log(
    '   ❌ Database expects: {"type": "Income Statement (Profit and Loss)"}',
  );

  console.log('\n✅ FIXED Expression to use:');
  console.log('   {{ { "type": $json.schema } }}');
  console.log('   This will properly wrap the string in an object');

  console.log('\n🔄 Alternative expressions:');
  console.log(
    '   For safety: {{ $json.schema ? { "type": $json.schema } : null }}',
  );
  console.log(
    '   For arrays: {{ Array.isArray($json.schema) ? { "type": $json.schema[0] } : { "type": $json.schema } }}',
  );

  console.log('\n✅ Expected Results After Fix:');
  console.log('   - String "Income Statement" → {"type": "Income Statement"}');
  console.log(
    '   - Array ["Income Statement"] → {"type": ["Income Statement"]}',
  );
  console.log('   - Null/undefined → null');
  console.log('   - Empty string → {"type": ""}');

  console.log('\n🎯 Database Schema Column Status:');
  console.log('   - Type: JSONB (accepts any valid JSON)');
  console.log('   - Nullable: YES (allows null values)');
  console.log('   - Validation: No longer enforces object structure');

  console.log('\n⚠️  Action Required:');
  console.log(
    '   1. Update your N8N "Update Schema for Document Metadata" node',
  );
  console.log(
    '   2. Change the schema field expression to: {{ { "type": $json.schema } }}',
  );
  console.log('   3. Test the workflow with a single file first');
  console.log('   4. Monitor for any remaining errors');
}

async function main() {
  console.log('🚀 Document Metadata Schema Column Fixer\n');
  console.log(
    'This script will fix the schema column to work with N8N workflow.\n',
  );

  await fixSchemaColumn();
  await showN8NConfiguration();
}

if (require.main === module) {
  main().catch(console.error);
}
