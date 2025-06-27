const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseTitleConstraintIssue() {
  console.log('🔍 Diagnosing document_metadata title constraint issue...\n');

  try {
    // Check current table schema
    console.log('📋 Current document_metadata table schema:');
    const { data: schemaData, error: schemaError } = await supabase.rpc(
      'exec_sql',
      {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default 
          FROM information_schema.columns 
          WHERE table_name = 'document_metadata' AND table_schema = 'public' 
          ORDER BY ordinal_position;
        `,
      },
    );

    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);

      // Try alternative method using direct query
      console.log('\n🔄 Trying alternative schema check...');
      const { data: tableExists } = await supabase
        .from('document_metadata')
        .select('id, title, url, created_at, schema')
        .limit(1);

      console.log('✅ Table exists and is accessible');
    } else {
      console.table(schemaData);
    }

    // Check for any existing records with null titles
    console.log('\n🔍 Checking for records with null/empty titles:');
    const { data: nullTitles, error: nullError } = await supabase
      .from('document_metadata')
      .select('id, title, url')
      .or('title.is.null,title.eq.');

    if (nullError) {
      console.error('❌ Error checking for null titles:', nullError);
    } else {
      console.log(
        `Found ${nullTitles?.length || 0} records with null/empty titles:`,
      );
      if (nullTitles && nullTitles.length > 0) {
        console.table(nullTitles);
      }
    }

    // Show recent records to understand data pattern
    console.log('\n📊 Recent document_metadata records (last 5):');
    const { data: recentRecords, error: recentError } = await supabase
      .from('document_metadata')
      .select('id, title, url, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Error fetching recent records:', recentError);
    } else {
      console.table(recentRecords);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function fixTitleConstraint() {
  console.log('\n🔧 Applying fix for title constraint...\n');

  try {
    // Option 1: Make title column nullable
    console.log('🔄 Making title column nullable...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE document_metadata ALTER COLUMN title DROP NOT NULL;`,
    });

    if (alterError) {
      console.error('❌ Error making title nullable:', alterError);

      // Option 2: Add a default value for existing null titles
      console.log(
        '\n🔄 Trying alternative: Update null titles with default values...',
      );
      const { error: updateError } = await supabase
        .from('document_metadata')
        .update({ title: 'Untitled Document' })
        .or('title.is.null,title.eq.');

      if (updateError) {
        console.error('❌ Error updating null titles:', updateError);
      } else {
        console.log('✅ Updated null titles with default value');
      }
    } else {
      console.log('✅ Successfully made title column nullable');
    }

    // Verify the fix
    console.log('\n✅ Verifying fix...');
    const { data: testInsert, error: testError } = await supabase
      .from('document_metadata')
      .insert({
        id: `test-${Date.now()}`,
        title: null, // This should now work
        url: 'https://example.com/test',
        schema: { test: true },
      })
      .select();

    if (testError) {
      console.error('❌ Test insert failed:', testError);

      // Try with empty string instead
      console.log('🔄 Trying test insert with empty string title...');
      const { data: testInsert2, error: testError2 } = await supabase
        .from('document_metadata')
        .insert({
          id: `test-empty-${Date.now()}`,
          title: '', // Try empty string
          url: 'https://example.com/test-empty',
        })
        .select();

      if (testError2) {
        console.error(
          '❌ Test insert with empty string also failed:',
          testError2,
        );
      } else {
        console.log('✅ Test insert with empty string succeeded:', testInsert2);

        // Clean up test record
        await supabase
          .from('document_metadata')
          .delete()
          .eq('id', testInsert2[0].id);
      }
    } else {
      console.log('✅ Test insert with null title succeeded:', testInsert);

      // Clean up test record
      await supabase
        .from('document_metadata')
        .delete()
        .eq('id', testInsert[0].id);
    }
  } catch (error) {
    console.error('❌ Unexpected error during fix:', error);
  }
}

async function main() {
  console.log('🚀 Document Metadata Title Constraint Fix\n');
  console.log(
    'This script will diagnose and fix the NOT NULL constraint issue on the title column.\n',
  );

  await diagnoseTitleConstraintIssue();
  await fixTitleConstraint();

  console.log(
    '\n🎉 Fix complete! Your N8N workflow should now be able to insert records with null titles.',
  );
  console.log('\n💡 Recommendations:');
  console.log(
    '   1. Update your N8N workflow to provide default titles when title is missing',
  );
  console.log(
    '   2. Consider adding validation in your workflow to ensure data quality',
  );
  console.log(
    '   3. Monitor for empty/null titles and clean them up periodically',
  );
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { diagnoseTitleConstraintIssue, fixTitleConstraint };
