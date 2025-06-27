# Migration Files Documentation

## Current Migrations (Organized)

### 01. 0001_keen_devos.sql
Create tables: Chat, User

### 02. 0002_sparkling_blue_marvel.sql
Create tables: Suggestion, Document

### 03. 0003_wandering_riptide.sql
Create tables: Message, Vote

### 04. 0004_cloudy_glorian.sql
Alter tables: Chat

### 05. 0005_odd_slayback.sql
Alter tables: Document

### 06. 0006_wooden_whistler.sql
Create tables: Message_v2, Vote_v2

### 07. 0007_open_venom.sql
Create tables: Clients

### 08. 0008_enforce_not_null.sql
Alter tables: User, Chat, Message_v2, Document, Suggestion, Vote_v2

### 09. 0009_make_client_id_required.sql
Alter tables: User, Chat, Message_v2, Document, Suggestion, Vote_v2

### 10. 0010_unusual_prodigy.sql
Alter tables: Clients

### 11. 0011_chunky_power_pack.sql
Alter tables: Clients

### 12. 0012_add_bit_context_id.sql
Alter tables: Chat

### 13. 0013_sweet_morgan_stark.sql
Alter tables: Chat, Clients

### 14. 0014_context_management_tables.sql
Create tables: conversation_entities, conversation_summaries, chat_file_references

### 15. 0015_cascade_delete_and_conversational_memory.sql
Create tables: conversational_memory

### 16. 0016_numerous_infant_terrible.sql
Create tables: specialists

### 17. 0017_many_storm.sql
Alter tables: User

### 18. 0018_rare_iron_monger.sql
Create tables: analytics_events

### 19. 0019_data_population.sql
Populate data: Clients

### 20. 0020_remove_legacy_artifact_tables.sql
Drop tables: Suggestion, Document


## Organization Principles

1. **Core Schema (0001-0005)**: Basic table structures
2. **Features (0006-0010)**: Feature-specific tables and columns  
3. **Enhancements (0011+)**: Improvements and optimizations
4. **Data Migrations**: Data population and seeding
5. **Cleanup**: Removing deprecated structures

## Backup Location

Original migration files backed up to: database/backups/migration-backup-2025-06-27

## Notes

- Migration numbers are now sequential without gaps
- Duplicate numbers have been resolved
- Files are organized by logical purpose
- Drizzle meta files may need regeneration
