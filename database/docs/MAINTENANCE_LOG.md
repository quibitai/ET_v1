# Database Maintenance Log

## 2025-06-27 - File Organization & Cleanup

### Actions Taken:
1. Created organized directory structure
2. Moved 40 files to appropriate locations
3. Cleaned up unused tables: account, session, conversation_entities, chat_file_references
4. Created comprehensive schema backup
5. Organized migration files

### Files Moved:
- 📁 add-google-workspace-mcp.sql → database/scripts/setup (Database setup and seeding scripts)
- 📁 add-google-workspace-mcp.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 analyze-unused-tables.js → database/scripts/debug (Testing and debugging scripts)
- 📁 check-foreign-key-relationship.js → database/scripts/debug (Testing and debugging scripts)
- 📁 cleanup-client-config.ts → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 clear-processed-files-table.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 complete-cascade-delete-fix.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 create-n8n-workflow-state-table.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 create-processed-google-drive-files-table.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 create-schema-backup.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 debug-n8n-workflow-issues.js → database/scripts/debug (Testing and debugging scripts)
- 📁 deploy-cascade-delete.ts → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-cascade-delete-relationships.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-document-metadata-schema-column.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-document-metadata-title-constraint.ts → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-processed-files-orphan-cleanup.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-schema-format-issue.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-schema-format-issue.ts → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 fix-title-constraint-direct.ts → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 manual-db-setup.sql → database/scripts/setup (Database setup and seeding scripts)
- 📁 migrate-specialists.ts → database/scripts/archived (Completed/archived scripts)
- 📁 phase1-setup.sh → database/scripts/archived (Completed/archived scripts)
- 📁 restore-original-schema-format.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 restore-schema-column-direct.js → database/scripts/maintenance (Database maintenance and repair scripts)
- 📁 seed-asana-mcp.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 setup-asana-env.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 setup-mcp-tables.ts → database/scripts/setup (Database setup and seeding scripts)
- 📁 test-cascade-delete.sql → database/scripts/debug (Testing and debugging scripts)
- 📁 test-conversation-summary.ts → database/scripts/debug (Testing and debugging scripts)
- 📁 test-final-verification.mjs → database/scripts/debug (Testing and debugging scripts)
- 📁 test-google-workspace-tools.ts → database/scripts/debug (Testing and debugging scripts)
- 📁 test-hooks-compliance.mjs → database/scripts/debug (Testing and debugging scripts)
- 📁 test-n8n-vector-store.ts → database/scripts/debug (Testing and debugging scripts)
- 📁 test-react-hooks-final.mjs → database/scripts/debug (Testing and debugging scripts)
- 📁 update-echo-tango-tools.sql → database/scripts/archived (Completed/archived scripts)
- 📁 update-echo-tango-with-google-workspace-tools.ts → database/scripts/archived (Completed/archived scripts)
- 📁 MULTI_TENANT_MIGRATION.md → database/migrations/deprecated (Deprecated migration files)
- 📁 drop_deprecated_tables.sql → database/migrations/deprecated (Deprecated migration files)
- 📁 SUPABASE_SCHEMA_BACKUP_2025-06-27T19-31-37-419Z.sql → database/backups (Database backups)
- 📁 SUPABASE_SCHEMA_BACKUP_LATEST.sql → database/backups (Database backups)

### Files Remaining in scripts/:
- add-echo-tango-specialist.ts (general utility)
- add-missing-client-id-columns.ts (general utility)
- add-missing-embedding-column.ts (general utility)
- add-nextauth-to-supabase.sql (general utility)
- create-match-documents-function.ts (general utility)
- testAllTools.ts (general utility)
- updateClientToolConfigs.ts (general utility)

### Next Steps:
- Monitor application for any issues
- Continue using organized structure for new scripts
- Regular backup schedule recommended
