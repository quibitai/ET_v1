-- Migration to drop deprecated tables
-- This migration removes the old Message and Vote tables that have been replaced by Message_v2 and Vote_v2

-- Drop deprecated tables if they exist
DO $$ 
BEGIN
    -- Drop the Vote table if it exists
    BEGIN
        DROP TABLE IF EXISTS "Vote";
        RAISE NOTICE 'Dropped Vote table';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop Vote table: %', SQLERRM;
    END;

    -- Drop the Message table if it exists
    BEGIN
        DROP TABLE IF EXISTS "Message";
        RAISE NOTICE 'Dropped Message table';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop Message table: %', SQLERRM;
    END;

    -- Drop the Suggestion table if it exists (Phase 1, Task 1.2)
    BEGIN
        DROP TABLE IF EXISTS "Suggestion";
        RAISE NOTICE 'Dropped Suggestion table';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop Suggestion table: %', SQLERRM;
    END;

    -- Drop the Document table if it exists (Phase 1, Task 1.2)
    -- First, drop any foreign key constraints that reference Document
    BEGIN
        -- Drop foreign key from chat_file_references that references Document
        ALTER TABLE "chat_file_references" DROP CONSTRAINT IF EXISTS "chat_file_references_artifactDocumentId_artifactDocumentCreatedAt_Document_id_createdAt_fk";
        RAISE NOTICE 'Dropped foreign key constraint to Document table';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Foreign key constraint to Document may not exist: %', SQLERRM;
    END;
    
    -- Now drop the Document table with CASCADE to drop all dependencies
    BEGIN
        DROP TABLE IF EXISTS "Document" CASCADE;
        RAISE NOTICE 'Dropped Document table with CASCADE';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop Document table: %', SQLERRM;
    END;
END
$$; 