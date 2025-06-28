const { Client } = require('pg');

// Use the same connection string from environment
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Missing POSTGRES_URL environment variable');
}

async function fixTitleConstraint() {
  console.log('🔧 Fixing document_metadata title constraint directly...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check current constraint
    console.log('\n📋 Checking current table schema...');
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'document_metadata' AND table_schema = 'public' 
      ORDER BY ordinal_position;
    `);

    console.table(schemaResult.rows);

    // Make title column nullable
    console.log('\n🔄 Making title column nullable...');
    await client.query(
      'ALTER TABLE document_metadata ALTER COLUMN title DROP NOT NULL;',
    );
    console.log(
      '✅ Successfully removed NOT NULL constraint from title column',
    );

    // Verify the change
    console.log('\n✅ Verifying schema change...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'document_metadata' AND table_schema = 'public' 
      ORDER BY ordinal_position;
    `);

    console.table(verifyResult.rows);

    // Test insert with null title
    console.log('\n🧪 Testing insert with null title...');
    const testId = `test-${Date.now()}`;
    await client.query(
      `
      INSERT INTO document_metadata (id, title, url, client_id) 
      VALUES ($1, NULL, $2, $3)
    `,
      [testId, 'https://example.com/test', 'echo-tango'],
    );

    console.log('✅ Successfully inserted record with null title');

    // Clean up test record
    await client.query('DELETE FROM document_metadata WHERE id = $1', [testId]);
    console.log('✅ Cleaned up test record');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('\n🎉 Database connection closed');
  }
}

async function main() {
  console.log('🚀 Direct Database Schema Fix for document_metadata\n');
  console.log(
    'This will make the title column nullable to fix N8N workflow issues.\n',
  );

  await fixTitleConstraint();

  console.log(
    '\n✅ Fix complete! Your N8N workflow should now work with Excel documents.',
  );
  console.log('\n📝 What was changed:');
  console.log(
    '   - Removed NOT NULL constraint from document_metadata.title column',
  );
  console.log('   - N8N can now insert records with null titles');
  console.log('   - Existing data remains unchanged');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixTitleConstraint };
