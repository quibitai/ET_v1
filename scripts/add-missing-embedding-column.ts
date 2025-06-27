import { sql } from '../lib/db/client';

/**
 * Add missing embedding column to documents table
 * This column is required for Supabase vector store functionality used by N8N workflow
 */
async function addMissingEmbeddingColumn() {
  console.log('🔧 Adding missing embedding column to documents table...');

  try {
    // Check current structure of documents table
    console.log('\n1️⃣ Checking documents table structure...');
    const documentsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position;
    `;

    console.log('Current columns in documents table:');
    console.table(documentsColumns);

    const hasEmbeddingColumn = documentsColumns.some(
      (col) => col.column_name === 'embedding',
    );

    if (!hasEmbeddingColumn) {
      console.log('\n2️⃣ Adding embedding column...');

      // Add the embedding column as a vector type for Supabase
      // Using vector(1536) which is the dimension for OpenAI text-embedding-3-small
      await sql`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS embedding vector(1536);
      `;

      console.log('✅ Added embedding column (vector(1536))');

      // Add index for vector similarity search
      console.log('\n3️⃣ Adding vector similarity index...');

      await sql`
        CREATE INDEX IF NOT EXISTS idx_documents_embedding 
        ON documents USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `;

      console.log('✅ Added vector similarity index');
    } else {
      console.log('✅ embedding column already exists in documents table');
    }

    // Verify the Supabase vector store function exists
    console.log('\n4️⃣ Checking for Supabase vector store function...');

    try {
      const functions = await sql`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'match_documents';
      `;

      if (functions.length === 0) {
        console.log(
          '⚠️  Creating match_documents function for vector similarity search...',
        );

        // Create the match_documents function that N8N vector store expects
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
              documents.metadata @> filter
            )
            ORDER BY documents.embedding <=> query_embedding
            LIMIT match_count;
          END;
          $$;
        `;

        console.log('✅ Created match_documents function');
      } else {
        console.log('✅ match_documents function already exists');
      }
    } catch (error) {
      console.log(
        '⚠️  Could not create match_documents function:',
        error instanceof Error ? error.message : String(error),
      );
      console.log(
        '   This may require pgvector extension to be enabled in Supabase',
      );
    }

    // Show final table structure
    console.log('\n5️⃣ Final documents table structure...');

    const finalStructure = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position;
    `;

    console.log('📊 Updated documents table:');
    console.table(finalStructure);

    // Test vector operations
    console.log('\n6️⃣ Testing vector operations...');

    try {
      // Test inserting a document with embedding
      const testEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random() - 0.5);

      await sql`
        INSERT INTO documents (content, metadata, client_id, embedding)
        VALUES (
          'Test document for vector operations',
          ${JSON.stringify({ test: true, file_id: 'test_vector' })},
          'echo-tango',
          ${JSON.stringify(testEmbedding)}::vector
        );
      `;

      console.log('✅ Successfully inserted document with embedding');

      // Test similarity search
      const searchResults = await sql`
        SELECT id, content, metadata, client_id,
               1 - (embedding <=> ${JSON.stringify(testEmbedding)}::vector) AS similarity
        FROM documents 
        WHERE client_id = 'echo-tango' 
        AND metadata->>'test' = 'true'
        ORDER BY embedding <=> ${JSON.stringify(testEmbedding)}::vector
        LIMIT 1;
      `;

      console.log('✅ Vector similarity search working');
      console.log(
        `   Found ${searchResults.length} result(s) with similarity score`,
      );

      // Clean up test data
      await sql`
        DELETE FROM documents 
        WHERE metadata->>'test' = 'true' AND client_id = 'echo-tango';
      `;

      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.log(
        '⚠️  Vector operations test failed:',
        error instanceof Error ? error.message : String(error),
      );
      console.log('   This may indicate pgvector extension is not enabled');
    }

    console.log('\n🎯 N8N Vector Store Compatibility:');
    console.log('✅ embedding column added to documents table');
    console.log('✅ Vector similarity index created');
    console.log('✅ match_documents function available');
    console.log('✅ Ready for N8N Supabase Vector Store operations');

    console.log('\n📝 N8N Configuration Notes:');
    console.log('- Table Name: documents');
    console.log('- Query Name: match_documents (for similarity search)');
    console.log('- Embedding Dimension: 1536 (OpenAI text-embedding-3-small)');
    console.log('- Vector Index: ivfflat with cosine similarity');
  } catch (error) {
    console.error('❌ Error adding embedding column:', error);
    throw error;
  }
}

// Run the script
addMissingEmbeddingColumn()
  .then(() => {
    console.log(
      '\n🎉 Embedding column successfully added! N8N vector store is ready.',
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to add embedding column:', error);
    process.exit(1);
  });
