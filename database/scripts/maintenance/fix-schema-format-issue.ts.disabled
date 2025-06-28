const { createClient } = require('@supabase/supabase-js');

// Environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing environment variables');
}

const client = createClient(url, key);

async function testSchemaFormats() {
  console.log('🔍 Testing schema formats for N8N compatibility...\n');

  // Test the failing array format
  console.log(
    '❌ Testing failing format: ["Income Statement (Profit and Loss)"]',
  );
  try {
    const testId1 = `test-array-${Date.now()}`;
    const result1 = await client.from('document_metadata').insert({
      id: testId1,
      title: 'Test Array Format',
      schema: ['Income Statement (Profit and Loss)'],
      client_id: 'echo-tango',
    });

    if (result1.error) {
      console.log('   Error:', result1.error.message);
    } else {
      console.log('   ✅ Array format works!');
      await client.from('document_metadata').delete().eq('id', testId1);
    }
  } catch (error) {
    console.log('   Exception:', error.message);
  }

  // Test object format
  console.log(
    '\n✅ Testing object format: { "type": "Income Statement (Profit and Loss)" }',
  );
  try {
    const testId2 = `test-object-${Date.now()}`;
    const result2 = await client.from('document_metadata').insert({
      id: testId2,
      title: 'Test Object Format',
      schema: { type: 'Income Statement (Profit and Loss)' },
      client_id: 'echo-tango',
    });

    if (result2.error) {
      console.log('   Error:', result2.error.message);
    } else {
      console.log('   ✅ Object format works!');
      await client.from('document_metadata').delete().eq('id', testId2);
    }
  } catch (error) {
    console.log('   Exception:', error.message);
  }

  // Check existing records
  console.log('\n📊 Checking existing schema formats:');
  const existing = await client
    .from('document_metadata')
    .select('id, title, schema')
    .limit(3);

  if (existing.data) {
    existing.data.forEach((record, i) => {
      console.log(`\n${i + 1}. ${record.title}`);
      console.log(`   Schema:`, JSON.stringify(record.schema));
    });
  }
}

async function main() {
  console.log('🚀 Schema Format Fix for N8N Issue\n');

  await testSchemaFormats();

  console.log('\n💡 Solution:');
  console.log('   In your N8N "Update Schema for Document Metadata" node:');
  console.log('   Change from: ["Income Statement (Profit and Loss)"]');
  console.log(
    '   Change to:   { "type": "Income Statement (Profit and Loss)" }',
  );
  console.log('\n   Or use this expression in N8N:');
  console.log('   {{ { "type": $json.schema[0] } }}');
}

if (require.main === module) {
  main().catch(console.error);
}
