-- =====================================================
-- SUPABASE SCHEMA BACKUP - 2025-06-27T19:31:33.442Z
-- =====================================================
-- Generated from: https://gdqfzfwbokwxrccqhvze.supabase.co
-- Total tables: 16
-- =====================================================


-- =====================================================
-- TABLE: CHAT
-- =====================================================

CREATE TABLE IF NOT EXISTS "Chat" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "createdAt" timestamp with time zone NOT NULL,
  "userId" uuid NOT NULL,
  "title" text NOT NULL,
  "visibility" character varying NOT NULL DEFAULT 'private'::character varying,
  "client_id" text NOT NULL,
  "bitContextId" text,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT now()
);

-- Constraints for Chat
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_client_id_Clients_id_fk" FOREIGN KEY (client_id) REFERENCES "Clients"(id);
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_pkey" PRIMARY KEY (id);

-- Indexes for Chat
CREATE INDEX user_id_idx ON public."Chat" USING btree ("userId");
CREATE INDEX chat_client_id_idx ON public."Chat" USING btree (client_id);
CREATE INDEX user_updated_idx ON public."Chat" USING btree ("userId", "updatedAt");

-- Data: 355 records
-- Large table (355 records) - data not included in backup


-- =====================================================
-- TABLE: CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS "Clients" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "gdrive_folder_id" text,
  "config_json" jsonb,
  "created_at" timestamp without time zone NOT NULL DEFAULT now(),
  "customInstructions" text,
  "client_display_name" text NOT NULL,
  "client_core_mission" text
);

-- Constraints for Clients
ALTER TABLE "Clients" ADD CONSTRAINT "Clients_pkey" PRIMARY KEY (id);

-- Indexes for Clients
CREATE INDEX clients_name_idx ON public."Clients" USING btree (name);

-- Data: 2 records
-- Sample data:
INSERT INTO "Clients" ("id", "name", "gdrive_folder_id", "config_json", "created_at", "customInstructions", "client_display_name", "client_core_mission") VALUES ('echo-tango', 'Echo Tango', '1AxSBHUSU86qRoU6QsiXbAc1UDmz-kWSO', '{"tool_configs":{"n8n":{"authToken":"KQFb^yf6Bms@","timeoutMs":30000,"authHeader":"extractfilecontent","webhookUrl":"https://quibit.app.n8n.cloud/webhook/e298b453-5d39-44eb-a241-eeefe961b0fc"},"asana":{"apiKey":"2/1208461823426072/1210281431678745:50c7b44de096bb9f3379d0536ebefc73","timeoutMs":30000,"defaultTeamGid":"1208461719945218","defaultWorkspaceGid":"1208105180296349"},"tavily":{"apiKey":"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","maxResults":10,"includeAnswer":true,"includeImages":false,"includeRawContent":false},"googleCalendar":{"authToken":"V7vwKwT92MBq4","timeoutMs":30000,"authHeader":"calendar","webhookUrl":"https://quibit.app.n8n.cloud/webhook/6551a320-8df7-4f1a-bfe4-c3927981ef8f"},"internalKnowledgeBase":{"maxResults":50,"enableCaching":true,"default_id_for_client":"echo-tango"}},"available_bit_ids":["echo-tango-specialist","chat-model","Test"],"orchestrator_client_context":"Echo Tango is a creative agency that specializes in creative storytelling and brand development, primarily with video and animation."}', '2025-05-03T00:24:23.032Z', '', 'Echo Tango', 'Echo Tango empowers brands through compelling visual narratives and strategic creative content.');
INSERT INTO "Clients" ("id", "name", "gdrive_folder_id", "config_json", "created_at", "customInstructions", "client_display_name", "client_core_mission") VALUES ('default', 'Default Dev Client', NULL, NULL, '2025-05-14T00:43:24.663Z', NULL, 'Default Display Name', NULL);


-- =====================================================
-- TABLE: MESSAGE_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS "Message_v2" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "chatId" uuid NOT NULL,
  "role" character varying NOT NULL,
  "parts" json NOT NULL,
  "attachments" json NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "userId" uuid,
  "client_id" text NOT NULL
);

-- Constraints for Message_v2
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "Chat"(id) ON DELETE CASCADE;
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_client_id_Clients_id_fk" FOREIGN KEY (client_id) REFERENCES "Clients"(id);
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_pkey" PRIMARY KEY (id);

-- Data: 1107 records
-- Large table (1107 records) - data not included in backup


-- =====================================================
-- TABLE: USER
-- =====================================================

CREATE TABLE IF NOT EXISTS "User" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" character varying(64) NOT NULL,
  "password" character varying(64),
  "client_id" text NOT NULL,
  "role" character varying NOT NULL DEFAULT 'user'::character varying
);

-- Constraints for User
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);

-- Data: 3 records
-- Sample data:
INSERT INTO "User" ("id", "email", "password", "client_id", "role") VALUES ('c0254dbc-d485-4ee1-8d76-c3d76f725e5f', 'adam@quibit.ai', '$2a$10$9SUlJ/tjqhowNUMhtkROC.wqtkrNABoSlmKdv7KWlBQtERRlyOmJ6', 'echo-tango', 'user');
INSERT INTO "User" ("id", "email", "password", "client_id", "role") VALUES ('34ee618c-b8a7-49db-92f5-26dfacd5b3b7', 'adam@echotango.co', '$2a$10$KhK/hVar9IYWLs7.rXrwUObFDHZ8SvqgjajHTYBqX4KmOUEBqKP3i', 'echo-tango', 'user');
INSERT INTO "User" ("id", "email", "password", "client_id", "role") VALUES ('293ae75c-428a-481f-ad9d-17d8f39adb22', 'test@echotango.co', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'default', 'admin');


-- =====================================================
-- TABLE: VOTE_V2
-- =====================================================

CREATE TABLE IF NOT EXISTS "Vote_v2" (
  "chatId" uuid NOT NULL,
  "messageId" uuid NOT NULL,
  "isUpvoted" boolean NOT NULL,
  "client_id" text NOT NULL
);

-- Constraints for Vote_v2
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "Chat"(id) ON DELETE CASCADE;
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY ("chatId", "messageId");
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_client_id_Clients_id_fk" FOREIGN KEY (client_id) REFERENCES "Clients"(id);
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "Message_v2"(id) ON DELETE CASCADE;

-- Indexes for Vote_v2
CREATE UNIQUE INDEX "Vote_v2_chatId_messageId_pk" ON public."Vote_v2" USING btree ("chatId", "messageId");

-- Data: 0 records


-- =====================================================
-- TABLE: ANALYTICS_EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_name" text NOT NULL,
  "properties" json,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "client_id" text,
  "user_id" uuid,
  "chat_id" uuid
);

-- Constraints for analytics_events
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_chat_id_Chat_id_fk" FOREIGN KEY (chat_id) REFERENCES "Chat"(id);
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_client_id_Clients_id_fk" FOREIGN KEY (client_id) REFERENCES "Clients"(id);
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY (id);
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_User_id_fk" FOREIGN KEY (user_id) REFERENCES "User"(id);

-- Data: 571 records
-- Large table (571 records) - data not included in backup


-- =====================================================
-- TABLE: CONVERSATION_SUMMARIES
-- =====================================================

CREATE TABLE IF NOT EXISTS "conversation_summaries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "summary_text" text NOT NULL,
  "messages_covered_start" timestamp with time zone NOT NULL,
  "messages_covered_end" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "client_id" text NOT NULL
);

-- Constraints for conversation_summaries
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_chat_id_Chat_id_fk" FOREIGN KEY (chat_id) REFERENCES "Chat"(id) ON DELETE CASCADE;
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_client_id_Clients_id_fk" FOREIGN KEY (client_id) REFERENCES "Clients"(id);
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY (id);
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_user_id_User_id_fk" FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Indexes for conversation_summaries
CREATE INDEX idx_conversation_summaries_chat_user ON public.conversation_summaries USING btree (chat_id, user_id);
CREATE INDEX idx_conversation_summaries_client ON public.conversation_summaries USING btree (client_id);

-- Data: 0 records


-- =====================================================
-- TABLE: CONVERSATIONAL_MEMORY
-- =====================================================

CREATE TABLE IF NOT EXISTS "conversational_memory" (
  "id" bigint NOT NULL DEFAULT nextval('conversational_memory_id_seq'::regclass),
  "chat_id" uuid NOT NULL,
  "content" text NOT NULL,
  "embedding" USER-DEFINED NOT NULL,
  "source_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Constraints for conversational_memory
ALTER TABLE "conversational_memory" ADD CONSTRAINT "conversational_memory_chat_id_Chat_id_fk" FOREIGN KEY (chat_id) REFERENCES "Chat"(id) ON DELETE CASCADE;
ALTER TABLE "conversational_memory" ADD CONSTRAINT "conversational_memory_pkey" PRIMARY KEY (id);
ALTER TABLE "conversational_memory" ADD CONSTRAINT "conversational_memory_source_type_check" CHECK ((source_type = ANY (ARRAY['turn'::text, 'summary'::text])));
ALTER TABLE "conversational_memory" ADD CONSTRAINT "fk_conversational_memory_chat_id" FOREIGN KEY (chat_id) REFERENCES "Chat"(id) ON DELETE CASCADE;

-- Indexes for conversational_memory
CREATE INDEX idx_conversational_memory_chat_id ON public.conversational_memory USING btree (chat_id);
CREATE INDEX idx_conversational_memory_created_at ON public.conversational_memory USING btree (created_at);
CREATE INDEX idx_conversational_memory_embedding ON public.conversational_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
CREATE INDEX idx_conversational_memory_source_type ON public.conversational_memory USING btree (source_type);

-- Data: 821 records
-- Large table (821 records) - data not included in backup


-- =====================================================
-- TABLE: DOCUMENT_METADATA
-- =====================================================

CREATE TABLE IF NOT EXISTS "document_metadata" (
  "id" text NOT NULL,
  "title" text,
  "url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "client_id" text NOT NULL DEFAULT 'echo-tango'::text,
  "schema" text
);

-- Constraints for document_metadata
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_pkey" PRIMARY KEY (id);

-- Indexes for document_metadata
CREATE INDEX idx_document_metadata_client_id ON public.document_metadata USING btree (client_id);

-- Data: 12 records
-- Sample data:
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1eJzCOGuYYlv_WT0cVOiqGNFNl83agqjC', 'ET_Logins.xlsx', 'https://docs.google.com/spreadsheets/d/1eJzCOGuYYlv_WT0cVOiqGNFNl83agqjC/edit?usp=drivesdk&ouid=100290161913730154008&rtpof=true&sd=true', '2025-06-27T19:16:18.898Z', 'echo-tango', '[" ","                     Account Logins","__EMPTY","__EMPTY_1","__EMPTY_2"]');
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1LYgBr85yKuvddY4PWGG9ofPNY8NfsdwC', 'EchoTango__LLC_-_Income_Statement__Profit_and_Loss_.xlsx', 'https://docs.google.com/spreadsheets/d/1LYgBr85yKuvddY4PWGG9ofPNY8NfsdwC/edit?usp=drivesdk&ouid=100290161913730154008&rtpof=true&sd=true', '2025-06-27T19:17:49.463Z', 'echo-tango', '["Income Statement (Profit and Loss)"]');
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1uwYnCVMtdd0wGK0ZPrOavvOKOhEBuu9g', 'Echo_Tango_Core_Values_Draft.txt', 'https://drive.google.com/file/d/1uwYnCVMtdd0wGK0ZPrOavvOKOhEBuu9g/view?usp=drivesdk', '2025-06-27T18:58:33.173Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('14Q5Nd3uStrKcV4mFwu1IJtvBBKQVPOzJ', 'Ideal Client Profile.txt', 'https://drive.google.com/file/d/14Q5Nd3uStrKcV4mFwu1IJtvBBKQVPOzJ/view?usp=drivesdk', '2025-06-27T18:58:37.344Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1StFO7t9PRJpEoXB8YHR0NDcHwwR2Etoi', 'EXAMPLE_Client_Research_Brand_Overview.md', 'https://drive.google.com/file/d/1StFO7t9PRJpEoXB8YHR0NDcHwwR2Etoi/view?usp=drivesdk', '2025-06-27T18:58:40.834Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1zLo-iCGJK5dOC3nGfWxbkq_xlNSwXITH', 'EXAMPLE_Brand_Marketing_Overview.pdf', 'https://drive.google.com/file/d/1zLo-iCGJK5dOC3nGfWxbkq_xlNSwXITH/view?usp=drivesdk', '2025-06-27T18:58:44.514Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1RnhhrZY3CqA5saOAeIIcjq-OVCpeuiPJ', 'EXAMPLE_Client_Estimate.pdf', 'https://drive.google.com/file/d/1RnhhrZY3CqA5saOAeIIcjq-OVCpeuiPJ/view?usp=drivesdk', '2025-06-27T18:58:50.347Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1SED2LXQwKx3BalM2dCnQJ4rPfQvgqwLr', 'EXAMPLE_Proposal_Pitch.md', 'https://drive.google.com/file/d/1SED2LXQwKx3BalM2dCnQJ4rPfQvgqwLr/view?usp=drivesdk', '2025-06-27T18:58:53.695Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1cavouHl-BlOKBC0bEZhs_wLvy7MUY03u', 'Example_Client_Research.md', 'https://drive.google.com/file/d/1cavouHl-BlOKBC0bEZhs_wLvy7MUY03u/view?usp=drivesdk', '2025-06-27T18:59:01.504Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1alYhGVxVxtHmIdR95RG0fUTXZ2wQopw9', 'Echo_Tango_Rate_Card_070219.pdf', 'https://drive.google.com/file/d/1alYhGVxVxtHmIdR95RG0fUTXZ2wQopw9/view?usp=drivesdk', '2025-06-27T19:07:32.403Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1H0RzmuD4URT_Yntdg0F1KdWzWzg_T8Di', 'ET_LABlue_Scripts_&_Storyboards_v01.pdf', 'https://drive.google.com/file/d/1H0RzmuD4URT_Yntdg0F1KdWzWzg_T8Di/view?usp=drivesdk', '2025-06-27T19:07:36.485Z', 'echo-tango', NULL);
INSERT INTO "document_metadata" ("id", "title", "url", "created_at", "client_id", "schema") VALUES ('1h7YR_RZ3juvdDYd2qegchNFStc_yn89I', 'Echo_Tango_Producer Checklist.txt', 'https://drive.google.com/file/d/1h7YR_RZ3juvdDYd2qegchNFStc_yn89I/view?usp=drivesdk', '2025-06-27T19:20:08.918Z', 'echo-tango', NULL);


-- =====================================================
-- TABLE: DOCUMENT_ROWS
-- =====================================================

CREATE TABLE IF NOT EXISTS "document_rows" (
  "id" bigint NOT NULL DEFAULT nextval('document_rows_id_seq'::regclass),
  "dataset_id" text,
  "row_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "client_id" text NOT NULL DEFAULT 'echo-tango'::text
);

-- Constraints for document_rows
ALTER TABLE "document_rows" ADD CONSTRAINT "document_rows_dataset_id_fkey" FOREIGN KEY (dataset_id) REFERENCES document_metadata(id) ON DELETE CASCADE;
ALTER TABLE "document_rows" ADD CONSTRAINT "document_rows_pkey" PRIMARY KEY (id);

-- Indexes for document_rows
CREATE INDEX idx_document_rows_dataset_id ON public.document_rows USING btree (dataset_id);
CREATE INDEX idx_document_rows_client_id ON public.document_rows USING btree (client_id);

-- Data: 0 records


-- =====================================================
-- TABLE: DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS "documents" (
  "id" bigint NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  "content" text,
  "metadata" jsonb,
  "client_id" text NOT NULL DEFAULT 'echo-tango'::text,
  "embedding" USER-DEFINED
);

-- Constraints for documents
ALTER TABLE "documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY (id);

-- Indexes for documents
CREATE INDEX idx_documents_metadata_file_id ON public.documents USING btree (((metadata ->> 'file_id'::text)));
CREATE INDEX idx_documents_client_id ON public.documents USING btree (client_id);
CREATE INDEX idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');

-- Data: 257 records
-- Large table (257 records) - data not included in backup


-- =====================================================
-- TABLE: MCP_SERVERS
-- =====================================================

CREATE TABLE IF NOT EXISTS "mcp_servers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(256) NOT NULL,
  "description" text,
  "url" character varying(2048) NOT NULL,
  "protocol" character varying(50) NOT NULL DEFAULT 'sse'::character varying,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraints for mcp_servers
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_pkey" PRIMARY KEY (id);

-- Data: 2 records
-- Sample data:
INSERT INTO "mcp_servers" ("id", "name", "description", "url", "protocol", "is_enabled", "created_at", "updated_at") VALUES ('ec1b3461-513c-406b-9147-26fe80def38a', 'Asana', 'Asana MCP server for task and project management', 'http://localhost:8080', 'http', true, '2025-06-26T15:17:06.421Z', '2025-06-26T15:17:06.421Z');
INSERT INTO "mcp_servers" ("id", "name", "description", "url", "protocol", "is_enabled", "created_at", "updated_at") VALUES ('6521d5e2-bf1d-41ab-85b1-fc9531675713', 'Google Workspace', 'Google Workspace MCP server for Gmail, Drive, Calendar, etc.', 'http://localhost:8000', 'sse', true, '2025-06-26T15:17:06.480Z', '2025-06-26T15:17:06.480Z');


-- =====================================================
-- TABLE: N8N_WORKFLOW_STATE
-- =====================================================

CREATE TABLE IF NOT EXISTS "n8n_workflow_state" (
  "key" text NOT NULL,
  "value" text,
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Constraints for n8n_workflow_state
ALTER TABLE "n8n_workflow_state" ADD CONSTRAINT "n8n_workflow_state_pkey" PRIMARY KEY (key);

-- Indexes for n8n_workflow_state
CREATE INDEX idx_n8n_workflow_state_updated_at ON public.n8n_workflow_state USING btree (updated_at);

-- Data: 1 records
-- Sample data:
INSERT INTO "n8n_workflow_state" ("key", "value", "updated_at") VALUES ('google_drive_poll_last_run_time', '2025-06-27T19:18:22.172Z', '2025-06-27T18:06:57.658Z');


-- =====================================================
-- TABLE: PROCESSED_GOOGLE_DRIVE_FILES
-- =====================================================

CREATE TABLE IF NOT EXISTS "processed_google_drive_files" (
  "file_id" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

-- Constraints for processed_google_drive_files
ALTER TABLE "processed_google_drive_files" ADD CONSTRAINT "processed_google_drive_files_pkey" PRIMARY KEY (file_id);

-- Indexes for processed_google_drive_files
CREATE INDEX idx_processed_google_drive_files_processed_at ON public.processed_google_drive_files USING btree (processed_at);
CREATE INDEX idx_processed_google_drive_files_created_at ON public.processed_google_drive_files USING btree (created_at);

-- Data: 11 records
-- Sample data:
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1uwYnCVMtdd0wGK0ZPrOavvOKOhEBuu9g', '2025-06-27T18:58:36.374Z', '2025-06-27T18:58:36.374Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('14Q5Nd3uStrKcV4mFwu1IJtvBBKQVPOzJ', '2025-06-27T18:58:39.803Z', '2025-06-27T18:58:39.803Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1StFO7t9PRJpEoXB8YHR0NDcHwwR2Etoi', '2025-06-27T18:58:43.550Z', '2025-06-27T18:58:43.550Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1zLo-iCGJK5dOC3nGfWxbkq_xlNSwXITH', '2025-06-27T18:58:49.545Z', '2025-06-27T18:58:49.545Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1RnhhrZY3CqA5saOAeIIcjq-OVCpeuiPJ', '2025-06-27T18:58:53.151Z', '2025-06-27T18:58:53.151Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1SED2LXQwKx3BalM2dCnQJ4rPfQvgqwLr', '2025-06-27T18:58:56.953Z', '2025-06-27T18:58:56.953Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1cavouHl-BlOKBC0bEZhs_wLvy7MUY03u', '2025-06-27T18:59:04.398Z', '2025-06-27T18:59:04.398Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1alYhGVxVxtHmIdR95RG0fUTXZ2wQopw9', '2025-06-27T19:07:35.498Z', '2025-06-27T19:07:35.498Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1H0RzmuD4URT_Yntdg0F1KdWzWzg_T8Di', '2025-06-27T19:07:41.612Z', '2025-06-27T19:07:41.612Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1eJzCOGuYYlv_WT0cVOiqGNFNl83agqjC', '2025-06-27T19:16:21.791Z', '2025-06-27T19:16:21.791Z');
INSERT INTO "processed_google_drive_files" ("file_id", "processed_at", "created_at") VALUES ('1LYgBr85yKuvddY4PWGG9ofPNY8NfsdwC', '2025-06-27T19:18:17.121Z', '2025-06-27T19:18:17.121Z');


-- =====================================================
-- TABLE: SPECIALISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS "specialists" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "persona_prompt" text NOT NULL,
  "default_tools" json,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraints for specialists
ALTER TABLE "specialists" ADD CONSTRAINT "specialists_pkey" PRIMARY KEY (id);

-- Indexes for specialists
CREATE INDEX specialists_name_idx ON public.specialists USING btree (name);

-- Data: 3 records
-- Sample data:
INSERT INTO "specialists" ("id", "name", "description", "persona_prompt", "default_tools", "created_at") VALUES ('chat-model', 'General Chat', 'Client-aware conversational assistant with full tool access', '
# Role: General Assistant for {client_display_name}
You are a helpful and versatile AI assistant for {client_display_name}. Your primary function is to address user queries directly, provide information, and use available tools as needed in this general chat context.
{client_core_mission_statement}

## Approach
- Provide clear, concise, and accurate responses
- Use appropriate tools when needed to retrieve information
- Maintain a conversational and helpful tone
- Be transparent about limitations or uncertainties
- Format responses for readability when appropriate

## Tool Usage Guidelines
- Use web search (tavilySearch) for current events, facts, or information not in your training data
- Use knowledge base search (searchInternalKnowledgeBase) for client-specific information when relevant
- If the user asks about calendar events, use the googleCalendar tool
- If the user asks about Asana tasks or projects, use the asana tool
- When using tools, clearly indicate when information comes from external sources

Remember to be helpful, accurate, and respectful in all interactions.
', '["tavilySearch","tavilyExtract","searchInternalKnowledgeBase","listDocuments","getFileContents","getDocumentContents","asana_get_user_info","asana_list_workspaces","asana_list_projects","asana_get_project_details","asana_search_projects","asana_list_tasks","asana_search_tasks","asana_get_task_details","asana_list_task_comments","gmail_list_messages","gmail_get_message","drive_list_files","drive_get_file","calendar_list_events","docs_get_document","sheets_get_spreadsheet"]', '2025-06-11T18:10:12.032Z');
INSERT INTO "specialists" ("id", "name", "description", "persona_prompt", "default_tools", "created_at") VALUES ('test-model', 'Test', NULL, 'helpful ai assistant', NULL, '2025-06-26T13:04:38.000Z');
INSERT INTO "specialists" ("id", "name", "description", "persona_prompt", "default_tools", "created_at") VALUES ('echo-tango-specialist', 'Echo Tango', 'Creative agency brand voice specialist.', '# ROLE: Echo Tango Creative Specialist for {client_display_name}

You are {client_display_name}''s creative AI partner, embodying Echo Tango''s philosophy that "every brand has a story worth telling, and telling well." You''re here to help elevate brands through compelling visual narratives and innovative storytelling solutions.

{client_core_mission_statement}

## Echo Tango''s Creative Philosophy
Like an **Echo** - you reflect and shape ideas through the textures of creativity around us. Like a **Tango** - you engage in collaborative improvisation, turning dialogue into motion and stories into experiences.

## What I Bring to Your Creative Process
🎬 **Visual Storytelling**: From concept to screen, I help craft narratives that resonate and engage
🎨 **Brand Narrative Development**: Uncover and articulate the unique stories that make brands memorable  
🚀 **Creative Strategy**: Transform ideas into actionable campaigns that connect with audiences
🤝 **Collaborative Innovation**: Work alongside you to explore possibilities and push creative boundaries
📋 **Project Orchestration**: Keep creative visions on track with smart planning and coordination

## My Creative Approach
- **Story-First Thinking**: Every project starts with finding the compelling narrative
- **Collaborative Spirit**: Your vision + my insights = creative magic
- **Strategic Creativity**: Beautiful ideas that also drive business results
- **Inclusive Innovation**: Everyone has valuable perspectives to contribute
- **Passion-Driven Excellence**: Every project becomes a passion project

## How I Support Your Creative Work
**Creative Development**: Generate innovative concepts, explore narrative possibilities, and develop compelling creative briefs
**Strategic Research**: Dive deep into market insights, competitor analysis, and audience understanding to inform creative decisions  
**Content Planning**: Structure video productions, campaigns, and storytelling initiatives from concept to completion
**Brand Consistency**: Ensure every creative output aligns with brand voice and visual identity
**Resource Coordination**: Help manage timelines, budgets, and team collaboration for seamless project execution

## Tools at My Creative Disposal
I have access to comprehensive research tools, document libraries, project management systems, and knowledge bases to support every aspect of the creative process - from initial inspiration to final delivery.

## When You Ask "What Can I Do?"
I''m here to help you tell better stories. Whether you need:
- Creative concepts that break through the noise
- Strategic insights to guide your next campaign  
- Research to understand your audience or competition
- Project planning to bring ambitious visions to life
- Content creation support from scripts to storyboards

Let''s create something extraordinary together. What story are we telling today?

## Strategic Tool Usage Guidelines

### When Generating Reports or Research Content:
**CRITICAL**: When asked to "generate a report," "research," "analyze," or "create content" about any topic:
1. **NEVER provide conversational responses without using tools first**
2. **ALWAYS use tavilySearch** to gather current, comprehensive information about the topic
3. **Use multiple search queries** if needed to get complete coverage
4. **Then synthesize** the research into a well-structured report
5. **Include sources and references** from your research

### When Requesting Complete Document Contents:
**CRITICAL**: When asked for "complete contents," "full content," or "entire file" of a specific document:
1. **ALWAYS start with listDocuments** to see what documents are available in the knowledge base
2. **Intelligently match** the user''s request to available documents
3. **Use getDocumentContents** with the exact document ID or title from the listing
4. **Present ONLY the document content** - do not include the file listing in your response
5. **Format the content clearly** for easy reading

### When Creating Content Based on Samples/Templates:
**CRITICAL**: When asked to create content "based on samples" or "using templates" from the knowledge base:
1. **ALWAYS start with listDocuments** to see what samples/templates are available
2. **Then use getDocumentContents** to retrieve the specific template
3. **Finally create** your content using the template structure and style

### Research Workflow Best Practices:
- **External Research First**: Use tavilySearch for current information about companies/organizations
- **Internal Context Second**: Use searchInternalKnowledgeBase for company-specific information
- **Template Retrieval**: Use listDocuments → getDocumentContents for examples and templates
- **Synthesis**: Combine external research with internal templates to create comprehensive deliverables

### MANDATORY Tool Usage for Research Requests:
**You MUST use tools for ANY request involving:**
- "Generate a report on..."
- "Research..."
- "Tell me about..."
- "Analyze..."
- "What is..." (for topics requiring current information)
- "Create content about..."

**NEVER provide direct answers to research questions without first using tavilySearch or other appropriate tools.**

Always prioritize creativity, strategic thinking, and client success in your responses.', '["tavilySearch","tavilyExtract","searchInternalKnowledgeBase","listDocuments","getFileContents","getDocumentContents","asana_get_user_info","asana_list_workspaces","asana_list_projects","asana_get_project_details","asana_search_projects","asana_list_tasks","asana_search_tasks","asana_get_task_details","asana_create_task","asana_update_task","asana_delete_task","asana_add_task_comment","asana_list_task_comments","asana_create_project","gmail_list_messages","gmail_get_message","gmail_send_message","drive_list_files","drive_get_file","drive_create_file","calendar_list_events","calendar_create_event","docs_get_document","sheets_get_spreadsheet"]', '2025-06-11T18:10:11.916Z');


-- =====================================================
-- TABLE: USER_MCP_INTEGRATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS "user_mcp_integrations" (
  "user_id" uuid NOT NULL,
  "mcp_server_id" uuid NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" timestamp with time zone,
  "scope" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone
);

-- Constraints for user_mcp_integrations
ALTER TABLE "user_mcp_integrations" ADD CONSTRAINT "user_mcp_integrations_pkey" PRIMARY KEY (user_id, mcp_server_id);

-- Indexes for user_mcp_integrations
CREATE INDEX user_mcp_integrations_user_idx ON public.user_mcp_integrations USING btree (user_id);
CREATE INDEX user_mcp_integrations_server_idx ON public.user_mcp_integrations USING btree (mcp_server_id);
CREATE INDEX user_mcp_integrations_active_idx ON public.user_mcp_integrations USING btree (is_active);

-- Data: 0 records

-- =====================================================
-- BACKUP SUMMARY
-- =====================================================
-- Total tables: 16
-- Tables with data: 12
-- Empty tables: 4
-- Large tables (>100 records): 5

-- Tables with data included:
--   Clients: 2 records
--   User: 3 records
--   document_metadata: 12 records
--   mcp_servers: 2 records
--   n8n_workflow_state: 1 records
--   processed_google_drive_files: 11 records
--   specialists: 3 records

-- Large tables (data not included):
--   Chat: 355 records
--   Message_v2: 1107 records
--   analytics_events: 571 records
--   conversational_memory: 821 records
--   documents: 257 records

-- Empty tables:
--   Vote_v2
--   conversation_summaries
--   document_rows
--   user_mcp_integrations

-- =====================================================
-- END OF BACKUP - 2025-06-27T19:31:37.369Z
-- =====================================================
