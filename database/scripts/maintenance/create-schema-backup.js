require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

async function createFullSchemaBackup() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  console.log('🔄 Creating comprehensive Supabase schema backup...');

  // Get all tables
  const tablesResult = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  let backup = `-- =====================================================
-- SUPABASE SCHEMA BACKUP - ${new Date().toISOString()}
-- =====================================================
-- Generated from: ${process.env.NEXT_PUBLIC_SUPABASE_URL}
-- Total tables: ${tablesResult.rows.length}
-- =====================================================

`;

  // Track important tables for summary
  const importantTables = [];
  const emptyTables = [];
  const largeTables = [];

  for (const table of tablesResult.rows) {
    const tableName = table.table_name;
    console.log(`📋 Backing up table: ${tableName}`);

    backup += `\n-- =====================================================\n`;
    backup += `-- TABLE: ${tableName.toUpperCase()}\n`;
    backup += `-- =====================================================\n\n`;

    // Get table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      ORDER BY ordinal_position;
    `);

    // Generate CREATE TABLE statement
    backup += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    const columns = structureResult.rows.map((col) => {
      let colDef = `  "${col.column_name}" ${col.data_type}`;
      if (col.character_maximum_length) {
        colDef += `(${col.character_maximum_length})`;
      }
      if (col.is_nullable === 'NO') {
        colDef += ' NOT NULL';
      }
      if (col.column_default) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      return colDef;
    });
    backup += columns.join(',\n') + '\n);\n\n';

    // Get constraints
    const constraintsResult = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = '${tableName}';
    `);

    if (constraintsResult.rows.length > 0) {
      backup += `-- Constraints for ${tableName}\n`;
      constraintsResult.rows.forEach((constraint) => {
        backup += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraint.conname}" ${constraint.definition};\n`;
      });
      backup += '\n';
    }

    // Get indexes
    const indexesResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = '${tableName}' 
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_pkey';
    `);

    if (indexesResult.rows.length > 0) {
      backup += `-- Indexes for ${tableName}\n`;
      indexesResult.rows.forEach((index) => {
        backup += `${index.indexdef};\n`;
      });
      backup += '\n';
    }

    // Get row count and sample data
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM "${tableName}"`,
    );
    const rowCount = parseInt(countResult.rows[0].count);

    backup += `-- Data: ${rowCount} records\n`;

    // Categorize tables
    if (rowCount === 0) {
      emptyTables.push(tableName);
    } else if (rowCount > 100) {
      largeTables.push({ name: tableName, count: rowCount });
    } else {
      importantTables.push({ name: tableName, count: rowCount });
    }

    if (rowCount > 0 && rowCount <= 100) {
      // Include actual data for small tables
      try {
        const dataResult = await client.query(
          `SELECT * FROM "${tableName}" LIMIT 100`,
        );
        if (dataResult.rows.length > 0) {
          backup += `-- Sample data:\n`;
          const columns = Object.keys(dataResult.rows[0]);
          dataResult.rows.forEach((row, i) => {
            const values = columns.map((col) => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string')
                return `'${val.replace(/'/g, "''")}'`;
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'object')
                return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            });
            backup += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
          });
        }
      } catch (error) {
        backup += `-- Error retrieving data: ${error.message}\n`;
      }
    } else if (rowCount > 0) {
      backup += `-- Large table (${rowCount} records) - data not included in backup\n`;
    }

    backup += '\n';
  }

  // Add summary
  backup += `-- =====================================================\n`;
  backup += `-- BACKUP SUMMARY\n`;
  backup += `-- =====================================================\n`;
  backup += `-- Total tables: ${tablesResult.rows.length}\n`;
  backup += `-- Tables with data: ${importantTables.length + largeTables.length}\n`;
  backup += `-- Empty tables: ${emptyTables.length}\n`;
  backup += `-- Large tables (>100 records): ${largeTables.length}\n\n`;

  if (importantTables.length > 0) {
    backup += `-- Tables with data included:\n`;
    importantTables.forEach((t) => {
      backup += `--   ${t.name}: ${t.count} records\n`;
    });
    backup += '\n';
  }

  if (largeTables.length > 0) {
    backup += `-- Large tables (data not included):\n`;
    largeTables.forEach((t) => {
      backup += `--   ${t.name}: ${t.count} records\n`;
    });
    backup += '\n';
  }

  if (emptyTables.length > 0) {
    backup += `-- Empty tables:\n`;
    emptyTables.forEach((t) => {
      backup += `--   ${t}\n`;
    });
    backup += '\n';
  }

  // Add footer
  backup += `-- =====================================================\n`;
  backup += `-- END OF BACKUP - ${new Date().toISOString()}\n`;
  backup += `-- =====================================================\n`;

  await client.end();
  return {
    backup,
    summary: {
      total: tablesResult.rows.length,
      withData: importantTables.length + largeTables.length,
      empty: emptyTables.length,
    },
  };
}

async function main() {
  try {
    console.log('🚀 Creating Supabase Schema Backup\n');

    const { backup, summary } = await createFullSchemaBackup();

    // Save backup file
    const backupFileName = `SUPABASE_SCHEMA_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    fs.writeFileSync(backupFileName, backup);

    console.log(`✅ Schema backup saved to: ${backupFileName}`);
    console.log(
      `📊 Summary: ${summary.total} tables, ${summary.withData} with data, ${summary.empty} empty`,
    );

    // Also create a latest backup
    fs.writeFileSync('SUPABASE_SCHEMA_BACKUP_LATEST.sql', backup);
    console.log('✅ Latest backup saved to: SUPABASE_SCHEMA_BACKUP_LATEST.sql');
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

if (require.main === module) {
  main();
}
