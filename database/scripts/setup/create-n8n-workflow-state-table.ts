import { sql } from '../lib/db/client';

/**
 * Create the n8n_workflow_state table
 * This table stores key-value pairs for N8N workflow state management,
 * particularly for tracking the last run time of the Google Drive polling workflow.
 */
async function createN8nWorkflowStateTable() {
  console.log('🔧 Creating n8n_workflow_state table...');

  try {
    // Create the table for storing workflow state
    await sql`
      CREATE TABLE IF NOT EXISTS n8n_workflow_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('✅ Table created successfully');

    // Add index for performance
    console.log('🔧 Creating indexes...');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_n8n_workflow_state_updated_at 
      ON n8n_workflow_state(updated_at);
    `;

    console.log('✅ Indexes created successfully');

    // Insert the initial state for Google Drive polling if it doesn't exist
    console.log('🔧 Setting up initial state...');

    await sql`
      INSERT INTO n8n_workflow_state (key, value, updated_at)
      VALUES ('google_drive_poll_last_run_time', '1970-01-01T00:00:00.000Z', NOW())
      ON CONFLICT (key) DO NOTHING;
    `;

    console.log('✅ Initial state configured');

    // Verify table structure
    console.log('🔍 Verifying table structure...');

    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'n8n_workflow_state'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Table structure:');
    console.table(tableInfo);

    // Show current state
    const currentState = await sql`
      SELECT * FROM n8n_workflow_state;
    `;

    console.log('📊 Current state:');
    console.table(currentState);

    console.log('\n📝 Table Usage:');
    console.log(
      "- N8N workflow reads: SELECT value FROM n8n_workflow_state WHERE key = 'google_drive_poll_last_run_time'",
    );
    console.log(
      '- N8N workflow updates: UPDATE n8n_workflow_state SET value = $1 WHERE key = $2',
    );
    console.log(
      '- Purpose: Track last run time to determine which files have been updated since last poll',
    );
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

// Run the script
createN8nWorkflowStateTable()
  .then(() => {
    console.log('\n🎉 n8n_workflow_state table setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });
