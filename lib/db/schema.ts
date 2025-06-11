import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  boolean,
  bigint,
  index,
} from 'drizzle-orm/pg-core';

// New Clients table
export const clients = pgTable('Clients', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  gdrive_folder_id: text('gdrive_folder_id'), // Google Drive folder ID for this client
  client_display_name: text('client_display_name').notNull(), // User-facing client name
  client_core_mission: text('client_core_mission'), // Short client business description (nullable)
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  customInstructions: text('customInstructions'),
  config_json: json('config_json'), // Structured configuration for orchestrator context, available bit IDs, and tool configs
});

export type Client = InferSelectModel<typeof clients>;

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  role: varchar('role', { enum: ['user', 'admin'] })
    .notNull()
    .default('user'),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable(
  'Chat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    title: text('title').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    visibility: varchar('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('private'),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
    bitContextId: text('bitContextId'), // Add bitContextId field (nullable)
  },
  (table) => ({
    // Index for efficient user-based chat queries
    userIdx: index('user_id_idx').on(table.userId),
    // Index for efficient client-based queries
    clientIdx: index('chat_client_id_idx').on(table.clientId),
    // Composite index for user + updatedAt for pagination
    userUpdatedIdx: index('user_updated_idx').on(table.userId, table.updatedAt),
  }),
);

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    isUpvoted: boolean('isUpvoted').notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

// Context Management Tables

export const conversationEntities = pgTable(
  'conversation_entities',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type').notNull(),
    entityValue: text('entity_value').notNull(),
    messageId: uuid('message_id').references(() => message.id, {
      onDelete: 'cascade',
    }),
    extractedAt: timestamp('extracted_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
  },
  (table) => ({
    chatUserIdx: index('idx_conversation_entities_chat_user').on(
      table.chatId,
      table.userId,
    ),
    typeIdx: index('idx_conversation_entities_type').on(table.entityType),
    clientIdx: index('idx_conversation_entities_client').on(table.clientId),
  }),
);

export type ConversationEntity = InferSelectModel<typeof conversationEntities>;

export const conversationSummaries = pgTable(
  'conversation_summaries',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    summaryText: text('summary_text').notNull(),
    messagesCoveredStart: timestamp('messages_covered_start', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    messagesCoveredEnd: timestamp('messages_covered_end', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
  },
  (table) => ({
    chatUserIdx: index('idx_conversation_summaries_chat_user').on(
      table.chatId,
      table.userId,
    ),
    clientIdx: index('idx_conversation_summaries_client').on(table.clientId),
  }),
);

export type ConversationSummary = InferSelectModel<
  typeof conversationSummaries
>;

export const chatFileReferences = pgTable(
  'chat_file_references',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => message.id, {
      onDelete: 'cascade',
    }),
    fileType: varchar('file_type').notNull(),
    fileMetadata: json('file_metadata'),
    // For knowledge base files (document_metadata uses text id)
    documentMetadataId: text('document_metadata_id'),
    // For document chunks (documents table uses bigint id)
    documentChunkId: bigint('document_chunk_id', { mode: 'number' }),
    // For artifacts (Document table uses uuid + timestamp composite key)
    artifactDocumentId: uuid('artifact_document_id'),
    artifactDocumentCreatedAt: timestamp('artifact_document_created_at'),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    chatUserIdx: index('idx_chat_file_references_chat_user').on(
      table.chatId,
      table.userId,
    ),
    typeIdx: index('idx_chat_file_references_type').on(table.fileType),
    clientIdx: index('idx_chat_file_references_client').on(table.clientId),
    // Foreign key for artifact references removed - document table no longer exists
  }),
);

export type ChatFileReference = InferSelectModel<typeof chatFileReferences>;

// Conversational Memory Table for RAG-based context retention
export const conversationalMemory = pgTable(
  'conversational_memory',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: text('embedding').notNull(), // Vector embedding - handled as text in Drizzle, vector in DB
    sourceType: varchar('source_type', { enum: ['turn', 'summary'] }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    chatIdx: index('idx_conversational_memory_chat_id').on(table.chatId),
    createdAtIdx: index('idx_conversational_memory_created_at').on(
      table.createdAt,
    ),
    sourceTypeIdx: index('idx_conversational_memory_source_type').on(
      table.sourceType,
    ),
  }),
);

export type ConversationalMemory = InferSelectModel<
  typeof conversationalMemory
>;

// Specialists Configuration Table
export const specialists = pgTable('specialists', {
  id: text('id').primaryKey().notNull(), // e.g., 'chat-model', 'echo-tango-specialist'
  name: text('name').notNull(),
  description: text('description'),
  personaPrompt: text('persona_prompt').notNull(),
  defaultTools: json('default_tools'), // Stores an array of tool names, e.g., ["tavilySearch"]
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Specialist = InferSelectModel<typeof specialists>;

// Analytics Events Table for Observability Dashboard
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  eventName: text('event_name').notNull(), // e.g., 'QUERY_CLASSIFICATION', 'TOOL_USED', 'EXECUTION_PATH'
  properties: json('properties'), // e.g., { "path": "LangGraph", "tool": "tavilySearch", "confidence": 0.9 }
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  clientId: text('client_id').references(() => clients.id),
  userId: uuid('user_id').references(() => user.id),
  chatId: uuid('chat_id').references(() => chat.id),
});

export type AnalyticsEvent = InferSelectModel<typeof analyticsEvents>;
