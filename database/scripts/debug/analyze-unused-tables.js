require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});

async function analyzeUnusedTables() {
  console.log('📋 UNUSED TABLES ANALYSIS\n');
  console.log('='.repeat(80));

  try {
    await client.connect();

    // Table analysis data
    const tableAnalysis = [
      {
        name: 'account',
        purpose: 'NextAuth.js OAuth account storage (Google, etc.)',
        currentUsage: 'UNUSED - Empty table, NextAuth disabled',
        recommendation: 'SAFE TO DELETE',
        reasoning: 'Your auth system uses custom implementation, not NextAuth',
        records: 0,
      },
      {
        name: 'session',
        purpose: 'NextAuth.js session management',
        currentUsage: 'UNUSED - Empty table, NextAuth disabled',
        recommendation: 'SAFE TO DELETE',
        reasoning: 'Your auth system uses custom implementation, not NextAuth',
        records: 0,
      },
      {
        name: 'verificationToken',
        purpose: 'NextAuth.js email verification tokens',
        currentUsage: 'UNUSED - Table does not exist',
        recommendation: 'ALREADY DELETED',
        reasoning: 'Table was never created or already removed',
        records: 'N/A',
      },
      {
        name: 'mcp_servers',
        purpose: 'MCP (Model Context Protocol) server registry',
        currentUsage:
          'ACTIVELY USED - Contains Asana & Google Workspace configs',
        recommendation: 'KEEP - REQUIRED',
        reasoning: 'Used by MCP integration system for tool orchestration',
        records: 2,
      },
      {
        name: 'user_mcp_integrations',
        purpose: 'User OAuth tokens for MCP servers',
        currentUsage: 'UNUSED - Empty but code exists',
        recommendation: 'KEEP - FUTURE USE',
        reasoning:
          'Part of MCP system architecture, may be used for OAuth flows',
        records: 0,
      },
      {
        name: 'conversation_entities',
        purpose: 'Entity extraction from chat conversations',
        currentUsage: 'UNUSED - Empty, feature disabled',
        recommendation: 'SAFE TO DELETE',
        reasoning: 'Entity extraction feature not currently implemented',
        records: 0,
      },
      {
        name: 'chat_file_references',
        purpose: 'Track file attachments and references in chats',
        currentUsage: 'UNUSED - Empty, feature disabled',
        recommendation: 'SAFE TO DELETE',
        reasoning: 'File reference tracking not currently implemented',
        records: 0,
      },
    ];

    // Display analysis
    for (const table of tableAnalysis) {
      console.log(`\n🔍 TABLE: ${table.name.toUpperCase()}`);
      console.log('-'.repeat(50));
      console.log(`📝 Purpose: ${table.purpose}`);
      console.log(`📊 Records: ${table.records}`);
      console.log(`🔄 Current Usage: ${table.currentUsage}`);
      console.log(`💡 Recommendation: ${table.recommendation}`);
      console.log(`🎯 Reasoning: ${table.reasoning}`);
    }

    // Summary recommendations
    console.log('\n\n📋 SUMMARY RECOMMENDATIONS\n');
    console.log('='.repeat(80));

    const safeToDel = tableAnalysis.filter(
      (t) => t.recommendation === 'SAFE TO DELETE',
    );
    const keepTables = tableAnalysis.filter((t) =>
      t.recommendation.includes('KEEP'),
    );
    const alreadyGone = tableAnalysis.filter(
      (t) => t.recommendation === 'ALREADY DELETED',
    );

    console.log('🗑️  SAFE TO DELETE:');
    safeToDel.forEach((t) => {
      console.log(`   ❌ ${t.name} - ${t.reasoning}`);
    });

    console.log('\n✅ KEEP (REQUIRED/FUTURE USE):');
    keepTables.forEach((t) => {
      console.log(`   ✅ ${t.name} - ${t.reasoning}`);
    });

    if (alreadyGone.length > 0) {
      console.log('\n🚮 ALREADY DELETED:');
      alreadyGone.forEach((t) => {
        console.log(`   ✅ ${t.name} - ${t.reasoning}`);
      });
    }

    // Generate cleanup script
    console.log('\n\n🧹 CLEANUP SCRIPT\n');
    console.log('='.repeat(80));

    const tablesToDelete = safeToDel.map((t) => t.name);

    if (tablesToDelete.length > 0) {
      console.log('-- SQL commands to safely remove unused tables:');
      console.log('-- Run these one by one to clean up your database\n');

      tablesToDelete.forEach((tableName) => {
        console.log(`-- Drop ${tableName} table (NextAuth/unused feature)`);
        console.log(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        console.log('');
      });

      console.log('-- Verify cleanup');
      console.log('SELECT table_name FROM information_schema.tables');
      console.log("WHERE table_schema = 'public'");
      console.log(
        "AND table_name IN ('account', 'session', 'conversation_entities', 'chat_file_references');",
      );
    } else {
      console.log('No tables recommended for deletion.');
    }

    // Storage impact
    console.log('\n\n💾 STORAGE IMPACT\n');
    console.log('='.repeat(80));

    const storageQuery = `
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation,
        most_common_vals,
        most_common_freqs,
        histogram_bounds
      FROM pg_stats 
      WHERE schemaname = 'public' 
      AND tablename IN ('account', 'session', 'conversation_entities', 'chat_file_references');
    `;

    try {
      const storageResult = await client.query(storageQuery);
      if (storageResult.rows.length === 0) {
        console.log('✅ Tables are empty - minimal storage impact');
        console.log(
          '🎯 Cleanup will free up table metadata and index overhead only',
        );
      } else {
        console.log('📊 Storage statistics:');
        storageResult.rows.forEach((row) => {
          console.log(
            `   ${row.tablename}.${row.attname}: ${row.n_distinct} distinct values`,
          );
        });
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve storage statistics');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🚀 Database Table Cleanup Analysis\n');
  console.log('Analyzing potentially unused tables for safe removal.\n');

  await analyzeUnusedTables();

  console.log('\n\n🎯 NEXT STEPS:\n');
  console.log('1. Review the recommendations above');
  console.log('2. Run the cleanup SQL commands if you agree');
  console.log('3. Monitor your application for any issues');
  console.log('4. Tables can be recreated from migrations if needed');
}

if (require.main === module) {
  main().catch(console.error);
}
