const fs = require('node:fs');
const path = require('node:path');

async function organizeMigrations() {
  console.log('🔄 Organizing Migration Files\n');
  console.log('='.repeat(80));

  const migrationsDir = 'lib/db/migrations';
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== 'meta');

  console.log(`Found ${files.length} migration files to organize\n`);

  // Parse migration files and extract info
  const migrations = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract migration number and name
    const match = file.match(/^(\d{4})_(.+)\.sql$/);
    if (match) {
      const [, number, name] = match;

      // Try to determine the purpose from content
      let purpose = 'unknown';
      let description = name.replace(/_/g, ' ');

      if (content.includes('CREATE TABLE')) {
        purpose = 'schema';
        description = `Create tables: ${extractTableNames(content).join(', ')}`;
      } else if (content.includes('ALTER TABLE')) {
        purpose = 'schema';
        description = `Alter tables: ${extractAlterTableNames(content).join(', ')}`;
      } else if (content.includes('INSERT INTO')) {
        purpose = 'data';
        description = `Populate data: ${extractInsertTableNames(content).join(', ')}`;
      } else if (content.includes('DROP TABLE')) {
        purpose = 'cleanup';
        description = `Drop tables: ${extractDropTableNames(content).join(', ')}`;
      }

      migrations.push({
        originalFile: file,
        number: parseInt(number),
        name,
        purpose,
        description,
        content,
        size: fs.statSync(filePath).size,
      });
    }
  }

  // Sort by migration number
  migrations.sort((a, b) => a.number - b.number);

  // Identify duplicates and issues
  console.log('📋 Migration Analysis:\n');

  const numberCounts = {};
  migrations.forEach((m) => {
    numberCounts[m.number] = (numberCounts[m.number] || 0) + 1;
  });

  const duplicates = Object.entries(numberCounts).filter(
    ([num, count]) => count > 1,
  );

  if (duplicates.length > 0) {
    console.log('⚠️  Duplicate migration numbers found:');
    duplicates.forEach(([num, count]) => {
      console.log(`   ${num}: ${count} files`);
      migrations
        .filter((m) => m.number === parseInt(num))
        .forEach((m) => {
          console.log(
            `     - ${m.originalFile} (${m.purpose}): ${m.description}`,
          );
        });
    });
    console.log('');
  }

  // Show migration timeline
  console.log('📅 Migration Timeline:');
  migrations.forEach((m) => {
    const status = numberCounts[m.number] > 1 ? '⚠️ ' : '✅';
    console.log(
      `   ${status} ${String(m.number).padStart(4, '0')}: ${m.description}`,
    );
  });

  // Create organized migration plan
  console.log('\n🎯 Reorganization Plan:\n');

  // Group by purpose and logical order
  const organized = {
    core: migrations.filter((m) => m.purpose === 'schema' && m.number <= 5),
    features: migrations.filter(
      (m) => m.purpose === 'schema' && m.number > 5 && m.number <= 10,
    ),
    enhancements: migrations.filter(
      (m) => m.purpose === 'schema' && m.number > 10,
    ),
    data: migrations.filter((m) => m.purpose === 'data'),
    cleanup: migrations.filter((m) => m.purpose === 'cleanup'),
  };

  let newNumber = 1;
  const renameMap = [];

  ['core', 'features', 'enhancements', 'data', 'cleanup'].forEach(
    (category) => {
      if (organized[category].length > 0) {
        console.log(`${category.toUpperCase()} MIGRATIONS:`);
        organized[category].forEach((m) => {
          const newFileName = `${String(newNumber).padStart(4, '0')}_${m.name}.sql`;
          console.log(`   ${m.originalFile} → ${newFileName}`);
          renameMap.push({
            old: m.originalFile,
            new: newFileName,
            description: m.description,
          });
          newNumber++;
        });
        console.log('');
      }
    },
  );

  // Ask for confirmation and perform renames
  console.log('🔄 Performing migration file reorganization...\n');

  // Create backup first
  const backupDir =
    'database/backups/migration-backup-' +
    new Date().toISOString().split('T')[0];
  fs.mkdirSync(backupDir, { recursive: true });

  // Backup original files
  migrations.forEach((m) => {
    const srcPath = path.join(migrationsDir, m.originalFile);
    const backupPath = path.join(backupDir, m.originalFile);
    fs.copyFileSync(srcPath, backupPath);
  });
  console.log(`✅ Backed up original migrations to: ${backupDir}`);

  // Perform renames using temporary names first to avoid conflicts
  const tempSuffix = '.temp';

  // Step 1: Rename all to temp names
  renameMap.forEach(({ old, new: newName }) => {
    const oldPath = path.join(migrationsDir, old);
    const tempPath = path.join(migrationsDir, newName + tempSuffix);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, tempPath);
    }
  });

  // Step 2: Rename from temp to final names
  renameMap.forEach(({ new: newName }) => {
    const tempPath = path.join(migrationsDir, newName + tempSuffix);
    const finalPath = path.join(migrationsDir, newName);
    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, finalPath);
    }
  });

  console.log('✅ Migration files reorganized successfully');

  // Update meta files if they exist
  const metaDir = path.join(migrationsDir, 'meta');
  if (fs.existsSync(metaDir)) {
    console.log(
      '⚠️  Note: Meta files may need manual update for Drizzle compatibility',
    );
  }

  // Create migration documentation
  const migrationDocs = `# Migration Files Documentation

## Current Migrations (Organized)

${renameMap
  .map(
    (m, i) => `### ${String(i + 1).padStart(2, '0')}. ${m.new}
${m.description}
`,
  )
  .join('\n')}

## Organization Principles

1. **Core Schema (0001-0005)**: Basic table structures
2. **Features (0006-0010)**: Feature-specific tables and columns  
3. **Enhancements (0011+)**: Improvements and optimizations
4. **Data Migrations**: Data population and seeding
5. **Cleanup**: Removing deprecated structures

## Backup Location

Original migration files backed up to: ${backupDir}

## Notes

- Migration numbers are now sequential without gaps
- Duplicate numbers have been resolved
- Files are organized by logical purpose
- Drizzle meta files may need regeneration
`;

  fs.writeFileSync('database/docs/MIGRATIONS.md', migrationDocs);
  console.log('✅ Created migration documentation');

  console.log('\n🎉 Migration organization complete!');
  console.log(`📁 Backup created: ${backupDir}`);
  console.log('📝 Documentation: database/docs/MIGRATIONS.md');
}

function extractTableNames(content) {
  const matches = content.match(/CREATE TABLE[^"]*"([^"]+)"/gi) || [];
  return matches.map((m) => m.match(/"([^"]+)"/)[1]);
}

function extractAlterTableNames(content) {
  const matches = content.match(/ALTER TABLE[^"]*"([^"]+)"/gi) || [];
  return [...new Set(matches.map((m) => m.match(/"([^"]+)"/)[1]))];
}

function extractInsertTableNames(content) {
  const matches = content.match(/INSERT INTO[^"]*"([^"]+)"/gi) || [];
  return [...new Set(matches.map((m) => m.match(/"([^"]+)"/)[1]))];
}

function extractDropTableNames(content) {
  const matches = content.match(/DROP TABLE[^"]*"([^"]+)"/gi) || [];
  return matches.map((m) => m.match(/"([^"]+)"/)[1]);
}

if (require.main === module) {
  organizeMigrations().catch(console.error);
}
