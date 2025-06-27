import { sql } from '../lib/db/client';

/**
 * Create the match_documents function required by N8N's Supabase Vector Store
 * This function performs vector similarity search with filtering
 */
async function createMatchDocumentsFunction() {
  console.log('🔧 Creating match_documents function for N8N Vector Store...');

  try {
    // Check if function already exists
    console.log('\n1️⃣ Checking for existing match_documents function...');

    const existingFunctions = await sql`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'match_documents';
    `;

    if (existingFunctions.length > 0) {
      console.log('⚠️  match_documents function already exists, recreating...');
    }

    // Create the match_documents function
    console.log('\n2️⃣ Creating match_documents function...');

    await sql`
      CREATE OR REPLACE FUNCTION match_documents(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.78,
        match_count int DEFAULT 10,
        filter jsonb DEFAULT '{}'
      )
      RETURNS TABLE(
        id bigint,
        content text,
        metadata jsonb,
        client_id text,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      #variable_conflict use_column
      BEGIN
        RETURN QUERY
        SELECT
          documents.id,
          documents.content,
          documents.metadata,
          documents.client_id,
          1 - (documents.embedding <=> query_embedding) AS similarity
        FROM documents
        WHERE documents.embedding <=> query_embedding < 1 - match_threshold
        AND (
          filter = '{}'::jsonb OR
          documents.metadata @> filter OR
          documents.client_id = (filter->>'client_id')::text
        )
        ORDER BY documents.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `;

    console.log('✅ match_documents function created successfully');

    // Test the function
    console.log('\n3️⃣ Testing match_documents function...');

    // Create a test embedding
    const testEmbedding = Array(1536)
      .fill(0)
      .map(() => Math.random() - 0.5);

    try {
      const testResults = await sql`
        SELECT * FROM match_documents(
          ${JSON.stringify(testEmbedding)}::vector,
          0.5,
          5,
          '{}'::jsonb
        );
      `;

      console.log(
        `✅ Function test successful - returned ${testResults.length} results`,
      );
    } catch (error) {
      console.log(
        '⚠️  Function test failed:',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Show function details
    console.log('\n4️⃣ Function details...');

    const functionInfo = await sql`
      SELECT 
        routine_name,
        data_type,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'match_documents';
    `;

    if (functionInfo.length > 0) {
      console.log('📋 Function Information:');
      console.log(`   Name: ${functionInfo[0].routine_name}`);
      console.log(`   Return Type: ${functionInfo[0].data_type}`);
      console.log('   Parameters:');
      console.log('   - query_embedding: vector(1536)');
      console.log('   - match_threshold: float (default 0.78)');
      console.log('   - match_count: int (default 10)');
      console.log('   - filter: jsonb (default {})');
    }

    console.log('\n🎯 N8N Vector Store Function:');
    console.log('✅ match_documents function created');
    console.log('✅ Supports vector similarity search');
    console.log('✅ Supports metadata filtering');
    console.log('✅ Supports client_id filtering');
    console.log('✅ Returns similarity scores');
    console.log('✅ Ready for N8N Supabase Vector Store');

    console.log('\n📝 Usage Examples:');
    console.log('-- Basic search:');
    console.log("SELECT * FROM match_documents('[0.1,0.2,...]'::vector);");
    console.log('');
    console.log('-- With threshold and limit:');
    console.log(
      "SELECT * FROM match_documents('[0.1,0.2,...]'::vector, 0.8, 5);",
    );
    console.log('');
    console.log('-- With client filtering:');
    console.log(
      'SELECT * FROM match_documents(\'[0.1,0.2,...]\'::vector, 0.8, 5, \'{"client_id": "echo-tango"}\');',
    );
  } catch (error) {
    console.error('❌ Error creating match_documents function:', error);
    throw error;
  }
}

// Run the script
createMatchDocumentsFunction()
  .then(() => {
    console.log('\n🎉 match_documents function successfully created!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to create match_documents function:', error);
    process.exit(1);
  });
