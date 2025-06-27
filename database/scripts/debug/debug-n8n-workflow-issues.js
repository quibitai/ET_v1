require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing environment variables');
}

const client = createClient(url, key);

async function debugWorkflowIssues() {
  console.log('🔍 Debugging N8N workflow issues...\n');

  // 1. Check document_metadata records with malformed schema
  console.log('📊 Checking document_metadata with malformed schema:');
  const { data: metadataRecords, error: metadataError } = await client
    .from('document_metadata')
    .select('id, title, schema, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (metadataError) {
    console.error('❌ Error fetching metadata:', metadataError);
    return;
  }

  console.log('\nRecent document_metadata records:');
  metadataRecords.forEach((record, i) => {
    console.log(`\n${i + 1}. ${record.title || 'No title'}`);
    console.log(`   ID: ${record.id}`);
    console.log(`   Schema: ${JSON.stringify(record.schema)}`);
    console.log(`   Created: ${record.created_at}`);
  });

  // 2. Check document_rows table for any records
  console.log('\n📋 Checking document_rows table:');
  const { data: rowsRecords, error: rowsError } = await client
    .from('document_rows')
    .select('id, dataset_id, row_data, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (rowsError) {
    console.error('❌ Error fetching document_rows:', rowsError);
  } else {
    console.log(`\nFound ${rowsRecords.length} document_rows records:`);
    if (rowsRecords.length === 0) {
      console.log(
        '   ❌ No document_rows found - this confirms the insertion issue',
      );
    } else {
      rowsRecords.forEach((row, i) => {
        console.log(`\n${i + 1}. Row ID: ${row.id}`);
        console.log(`   Dataset ID: ${row.dataset_id}`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Row data: ${JSON.stringify(row.row_data, null, 2)}`);
      });
    }
  }

  // 3. Check for orphaned document_metadata without corresponding document_rows
  console.log(
    '\n🔍 Checking for orphaned document_metadata (without document_rows):',
  );
  const { data: orphanedMetadata } = await client
    .from('document_metadata')
    .select(`
      id, 
      title, 
      created_at,
      document_rows!left(id)
    `)
    .is('document_rows.id', null)
    .order('created_at', { ascending: false });

  if (orphanedMetadata && orphanedMetadata.length > 0) {
    console.log(
      `\nFound ${orphanedMetadata.length} document_metadata records without document_rows:`,
    );
    orphanedMetadata.forEach((record, i) => {
      console.log(`${i + 1}. ${record.title} (ID: ${record.id})`);
    });
  } else {
    console.log('\n✅ No orphaned document_metadata found');
  }

  // 4. Test proper schema format
  console.log('\n🧪 Testing correct schema formats:');

  // Test what the schema should look like
  const testSchemas = [
    {
      name: 'Correct format',
      schema: { type: 'Income Statement (Profit and Loss)' },
    },
    { name: 'Array format', schema: ['Income Statement (Profit and Loss)'] },
    { name: 'String format', schema: 'Income Statement (Profit and Loss)' },
  ];

  for (const test of testSchemas) {
    console.log(`\n🔄 Testing ${test.name}:`);
    console.log(`   Schema: ${JSON.stringify(test.schema)}`);

    const testId = `test-schema-debug-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`;

    try {
      const { data, error } = await client
        .from('document_metadata')
        .insert({
          id: testId,
          title: `Test ${test.name}`,
          schema: test.schema,
          client_id: 'echo-tango',
        })
        .select();

      if (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      } else {
        console.log(`   ✅ Success: ${JSON.stringify(data[0].schema)}`);
        // Clean up
        await client.from('document_metadata').delete().eq('id', testId);
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
  }
}

async function suggestFixes() {
  console.log('\n💡 Suggested Fixes:\n');

  console.log('1. **Schema Format Issue:**');
  console.log('   Current N8N expression: {{ { "type": $json.schema[0] } }}');
  console.log('   Problem: This gets first character, not first array element');
  console.log('   ');
  console.log('   Fix options:');
  console.log('   a) If schema is ["Income Statement (Profit and Loss)"]:');
  console.log(
    '      Use: {{ { "type": $json.schema[0] } }} but ensure $json.schema is the array',
  );
  console.log('   ');
  console.log('   b) If schema is "Income Statement (Profit and Loss)":');
  console.log('      Use: {{ { "type": $json.schema } }}');
  console.log('   ');
  console.log('   c) If schema is coming from a different field:');
  console.log('      Check what field contains the actual schema value');

  console.log('\n2. **Document Rows Missing Issue:**');
  console.log('   - Check if "Insert Table Rows" node is actually executing');
  console.log(
    '   - Verify the dataset_id field matches the document_metadata.id',
  );
  console.log('   - Check if there are any errors in the N8N execution log');
  console.log('   - Ensure the row_data is properly formatted JSON');

  console.log('\n3. **Debugging Steps:**');
  console.log(
    '   a) In N8N, add a "Set" node before "Update Schema for Document Metadata"',
  );
  console.log('   b) Log the actual values: {{ JSON.stringify($json) }}');
  console.log('   c) Check what $json.schema actually contains');
  console.log(
    '   d) Verify the "Insert Table Rows" node has the correct dataset_id',
  );
}

async function main() {
  console.log('🚀 N8N Workflow Debug Tool\n');

  await debugWorkflowIssues();
  await suggestFixes();
}

if (require.main === module) {
  main().catch(console.error);
}
