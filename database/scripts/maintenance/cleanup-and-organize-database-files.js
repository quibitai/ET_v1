const fs = require('node:fs');
const path = require('node:path');

async function cleanupAndOrganizeDatabaseFiles() {
  console.log('🧹 Database Files Cleanup & Organization\n');
  console.log('='.repeat(80));

  // Create organized directory structure
  const directories = {
    'database/migrations': 'Active migration files',
    'database/migrations/deprecated': 'Old/deprecated migration files',
    'database/scripts/maintenance': 'Database maintenance scripts',
    'database/scripts/setup': 'Initial setup and seeding scripts',
    'database/scripts/debug': 'Debugging and testing scripts',
    'database/scripts/archived': 'Completed/archived scripts',
    'database/backups': 'Schema and data backups',
    'database/docs': 'Database documentation',
  };

  // Create directories
  console.log('📁 Creating organized directory structure...');
  for (const [dir, description] of Object.entries(directories)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created: ${dir} (${description})`);
    }
  }

  // File categorization rules
  const fileCategories = {
    // Active migrations (keep in lib/db/migrations)
    activeMigrations: {
      pattern: /^00\d{2}_.*\.sql$/,
      destination: 'lib/db/migrations',
      description: 'Active Drizzle migrations',
    },

    // Deprecated migrations
    deprecatedMigrations: {
      files: ['drop_deprecated_tables.sql', 'MULTI_TENANT_MIGRATION.md'],
      destination: 'database/migrations/deprecated',
      description: 'Deprecated migration files',
    },

    // Setup scripts
    setupScripts: {
      patterns: [
        /setup.*\.(ts|js|sql)$/i,
        /seed.*\.(ts|js|sql)$/i,
        /manual.*\.(ts|js|sql)$/i,
        /add-.*-mcp\.(ts|js|sql)$/i,
        /create-.*-table\.(ts|js)$/i,
      ],
      destination: 'database/scripts/setup',
      description: 'Database setup and seeding scripts',
    },

    // Maintenance scripts (recent fixes)
    maintenanceScripts: {
      patterns: [
        /fix-.*\.(ts|js)$/i,
        /restore-.*\.(ts|js)$/i,
        /clear-.*\.(ts|js)$/i,
        /cleanup-.*\.(ts|js)$/i,
        /cascade-delete.*\.(ts|js)$/i,
        /schema.*backup.*\.(ts|js)$/i,
      ],
      destination: 'database/scripts/maintenance',
      description: 'Database maintenance and repair scripts',
    },

    // Debug/test scripts
    debugScripts: {
      patterns: [
        /test-.*\.(ts|js|mjs|sql)$/i,
        /debug-.*\.(ts|js)$/i,
        /check-.*\.(ts|js)$/i,
        /analyze-.*\.(ts|js)$/i,
      ],
      destination: 'database/scripts/debug',
      description: 'Testing and debugging scripts',
    },

    // Archived scripts (completed work)
    archivedScripts: {
      patterns: [
        /phase1.*\.(sh|ts|js)$/i,
        /migrate.*\.(ts|js)$/i,
        /deploy.*\.(ts|js)$/i,
        /update.*tools.*\.(ts|js|sql)$/i,
      ],
      destination: 'database/scripts/archived',
      description: 'Completed/archived scripts',
    },

    // Backups
    backups: {
      patterns: [/.*backup.*\.sql$/i, /SUPABASE_SCHEMA.*\.sql$/i],
      destination: 'database/backups',
      description: 'Database backups',
    },
  };

  // Move files from scripts directory
  console.log('\n📦 Organizing scripts directory files...');
  const scriptsDir = 'scripts';
  const scriptsFiles = fs
    .readdirSync(scriptsDir)
    .filter((f) => f !== 'cleanup-and-organize-database-files.js');

  const moveLog = [];
  const keepInScripts = [];

  for (const file of scriptsFiles) {
    const filePath = path.join(scriptsDir, file);
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) continue;

    let moved = false;

    // Check each category
    for (const [categoryName, category] of Object.entries(fileCategories)) {
      if (categoryName === 'activeMigrations') continue; // Skip for scripts dir

      let shouldMove = false;

      // Check patterns
      if (category.patterns) {
        shouldMove = category.patterns.some((pattern) => pattern.test(file));
      }

      // Check specific files
      if (category.files) {
        shouldMove = category.files.includes(file);
      }

      if (shouldMove) {
        const destPath = path.join(category.destination, file);
        fs.renameSync(filePath, destPath);
        moveLog.push(
          `📁 ${file} → ${category.destination} (${category.description})`,
        );
        moved = true;
        break;
      }
    }

    if (!moved) {
      keepInScripts.push(file);
    }
  }

  // Move files from lib/db/migrations
  console.log('\n📦 Organizing migrations directory files...');
  const migrationsDir = 'lib/db/migrations';
  const migrationFiles = fs.readdirSync(migrationsDir);

  for (const file of migrationFiles) {
    if (file === 'meta') continue; // Skip meta directory

    const filePath = path.join(migrationsDir, file);
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) continue;

    // Check if it's a deprecated migration
    const deprecated = fileCategories.deprecatedMigrations;
    if (deprecated.files && deprecated.files.includes(file)) {
      const destPath = path.join(deprecated.destination, file);
      fs.renameSync(filePath, destPath);
      moveLog.push(
        `📁 ${file} → ${deprecated.destination} (${deprecated.description})`,
      );
    }
  }

  // Move backup files from root
  console.log('\n📦 Moving backup files...');
  const rootFiles = fs.readdirSync('.');
  for (const file of rootFiles) {
    if (/SUPABASE_SCHEMA.*\.sql$/i.test(file)) {
      const destPath = path.join('database/backups', file);
      fs.renameSync(file, destPath);
      moveLog.push(`📁 ${file} → database/backups (Database backups)`);
    }
  }

  // Create documentation
  console.log('\n📝 Creating database documentation...');

  const readmeContent = `# Database Documentation

## Directory Structure

### \`migrations/\`
Active Drizzle migration files. These are automatically applied by the Drizzle migration system.

### \`migrations/deprecated/\`
Old or deprecated migration files that are no longer needed.

### \`scripts/setup/\`
Scripts for initial database setup, seeding data, and creating MCP integrations.

### \`scripts/maintenance/\`
Scripts for database maintenance, repairs, and schema fixes.

### \`scripts/debug/\`
Testing and debugging scripts for troubleshooting database issues.

### \`scripts/archived/\`
Completed scripts that are kept for reference but no longer actively used.

### \`backups/\`
Database schema and data backups.

## Best Practices

1. **Migrations**: Use Drizzle's migration system for schema changes
2. **Backups**: Regular backups are created automatically
3. **Scripts**: Organize scripts by purpose and archive when complete
4. **Testing**: Test all database changes in development first

## Current Schema

The current database schema includes:
- User management (User, Clients)
- Chat system (Chat, Message_v2, Vote_v2)
- Knowledge base (document_metadata, document_rows, documents)
- MCP integrations (mcp_servers, user_mcp_integrations)
- Analytics and monitoring (analytics_events, conversational_memory)
- N8N workflow state (n8n_workflow_state, processed_google_drive_files)

## Maintenance

- Schema backups are created before major changes
- Unused tables are periodically cleaned up
- Migration files are organized and deprecated ones archived
`;

  fs.writeFileSync('database/docs/README.md', readmeContent);
  console.log('✅ Created database documentation');

  // Create maintenance log
  const maintenanceLog = `# Database Maintenance Log

## ${new Date().toISOString().split('T')[0]} - File Organization & Cleanup

### Actions Taken:
1. Created organized directory structure
2. Moved ${moveLog.length} files to appropriate locations
3. Cleaned up unused tables: account, session, conversation_entities, chat_file_references
4. Created comprehensive schema backup
5. Organized migration files

### Files Moved:
${moveLog.map((entry) => `- ${entry}`).join('\n')}

### Files Remaining in scripts/:
${keepInScripts.map((file) => `- ${file} (general utility)`).join('\n')}

### Next Steps:
- Monitor application for any issues
- Continue using organized structure for new scripts
- Regular backup schedule recommended
`;

  fs.writeFileSync('database/docs/MAINTENANCE_LOG.md', maintenanceLog);
  console.log('✅ Created maintenance log');

  // Summary
  console.log('\n📋 ORGANIZATION SUMMARY\n');
  console.log('='.repeat(80));
  console.log(`✅ Moved ${moveLog.length} files to organized locations`);
  console.log(
    `✅ Kept ${keepInScripts.length} general utility files in scripts/`,
  );
  console.log('✅ Created documentation and maintenance logs');
  console.log('✅ Database cleanup completed');

  console.log('\n🎯 NEW STRUCTURE:');
  console.log('database/');
  console.log('├── migrations/           # Active Drizzle migrations');
  console.log('├── migrations/deprecated/ # Old migration files');
  console.log('├── scripts/setup/        # Setup and seeding scripts');
  console.log('├── scripts/maintenance/  # Maintenance and repair scripts');
  console.log('├── scripts/debug/        # Testing and debugging scripts');
  console.log('├── scripts/archived/     # Completed/archived scripts');
  console.log('├── backups/              # Schema and data backups');
  console.log('└── docs/                 # Database documentation');

  console.log('\n🚀 Database organization complete!');
}

if (require.main === module) {
  cleanupAndOrganizeDatabaseFiles().catch(console.error);
}
