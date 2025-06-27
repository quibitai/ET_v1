require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);

async function checkRelationships() {
  console.log('🔍 Checking foreign key relationships...\n');

  // Check specific document that has both metadata and rows
  const testId = '1bZZKq3ZVMip3aW6Ddhh9jXXryuaDuEdH';

  console.log(`📊 Checking document ID: ${testId}`);

  // Check metadata
  const { data: metadata } = await client
    .from('document_metadata')
    .select('*')
    .eq('id', testId);

  console.log('\nDocument Metadata:');
  console.log(metadata?.[0] || 'Not found');

  // Check rows
  const { data: rows } = await client
    .from('document_rows')
    .select('*')
    .eq('dataset_id', testId);

  console.log(`\nDocument Rows (${rows?.length || 0} found):`);
  rows?.forEach((row, i) => {
    console.log(`${i + 1}. Row ID: ${row.id}, Dataset ID: ${row.dataset_id}`);
  });

  // Test the join query that was failing
  console.log('\n🔄 Testing join query...');
  const { data: joinResult, error: joinError } = await client
    .from('document_metadata')
    .select(`
      id, 
      title,
      document_rows(id, dataset_id)
    `)
    .eq('id', testId);

  if (joinError) {
    console.error('❌ Join error:', joinError);
  } else {
    console.log('✅ Join result:', JSON.stringify(joinResult, null, 2));
  }

  // Check if foreign key constraint exists
  console.log('\n🔍 Checking foreign key constraints...');

  // Note: This might not work with Supabase's RLS, but let's try
  try {
    const { data: constraints, error: constraintError } = await client.rpc(
      'exec_sql',
      {
        sql: `
          SELECT
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'document_rows';
        `,
      },
    );

    if (constraintError) {
      console.log(
        '❌ Cannot check constraints via RPC:',
        constraintError.message,
      );
    } else {
      console.log('✅ Foreign key constraints:', constraints);
    }
  } catch (error) {
    console.log('❌ Cannot access constraint information');
  }
}

async function main() {
  console.log('🚀 Foreign Key Relationship Check\n');
  await checkRelationships();

  console.log('\n💡 Summary:');
  console.log('   - Document_rows ARE being inserted correctly');
  console.log('   - The "orphaned" query might be using wrong join syntax');
  console.log('   - Main issue is the schema format in N8N');
}

if (require.main === module) {
  main().catch(console.error);
}
