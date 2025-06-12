import { relations } from 'drizzle-orm';
import {
  user,
  chat,
  message,
  vote,
  clients,
  conversationEntities,
  conversationSummaries,
  chatFileReferences,
  conversationalMemory,
  specialists,
  analyticsEvents,
} from './schema';

// Client Relationships
export const clientRelations = relations(clients, ({ many }) => ({
  users: many(user),
  chats: many(chat),
  messages: many(message),
  votes: many(vote),
  conversationEntities: many(conversationEntities),
  conversationSummaries: many(conversationSummaries),
  chatFileReferences: many(chatFileReferences),
  conversationalMemory: many(conversationalMemory),
  specialists: many(specialists),
  analyticsEvents: many(analyticsEvents),
}));

// User Relationships
export const userRelations = relations(user, ({ one, many }) => ({
  client: one(clients, {
    fields: [user.clientId],
    references: [clients.id],
  }),
  chats: many(chat),
  conversationEntities: many(conversationEntities),
  conversationSummaries: many(conversationSummaries),
  chatFileReferences: many(chatFileReferences),
  conversationalMemory: many(conversationalMemory),
}));

// Chat Relationships
export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
  client: one(clients, {
    fields: [chat.clientId],
    references: [clients.id],
  }),
  messages: many(message),
  votes: many(vote),
  conversationEntities: many(conversationEntities),
  conversationSummaries: many(conversationSummaries),
  chatFileReferences: many(chatFileReferences),
  conversationalMemory: many(conversationalMemory),
}));

// Message Relationships
export const messageRelations = relations(message, ({ one, many }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
  client: one(clients, {
    fields: [message.clientId],
    references: [clients.id],
  }),
  votes: many(vote),
  conversationEntities: many(conversationEntities),
}));

// Vote Relationships
export const voteRelations = relations(vote, ({ one }) => ({
  chat: one(chat, {
    fields: [vote.chatId],
    references: [chat.id],
  }),
  message: one(message, {
    fields: [vote.messageId],
    references: [message.id],
  }),
  client: one(clients, {
    fields: [vote.clientId],
    references: [clients.id],
  }),
}));

// ConversationEntity Relationships
export const conversationEntityRelations = relations(
  conversationEntities,
  ({ one }) => ({
    chat: one(chat, {
      fields: [conversationEntities.chatId],
      references: [chat.id],
    }),
    user: one(user, {
      fields: [conversationEntities.userId],
      references: [user.id],
    }),
    message: one(message, {
      fields: [conversationEntities.messageId],
      references: [message.id],
    }),
    client: one(clients, {
      fields: [conversationEntities.clientId],
      references: [clients.id],
    }),
  }),
);

// ConversationSummary Relationships
export const conversationSummaryRelations = relations(
  conversationSummaries,
  ({ one }) => ({
    chat: one(chat, {
      fields: [conversationSummaries.chatId],
      references: [chat.id],
    }),
    user: one(user, {
      fields: [conversationSummaries.userId],
      references: [user.id],
    }),
    client: one(clients, {
      fields: [conversationSummaries.clientId],
      references: [clients.id],
    }),
  }),
);

// ChatFileReference Relationships
export const chatFileReferenceRelations = relations(
  chatFileReferences,
  ({ one }) => ({
    chat: one(chat, {
      fields: [chatFileReferences.chatId],
      references: [chat.id],
    }),
    user: one(user, {
      fields: [chatFileReferences.userId],
      references: [user.id],
    }),
    client: one(clients, {
      fields: [chatFileReferences.clientId],
      references: [clients.id],
    }),
  }),
);

// ConversationalMemory Relationships
export const conversationalMemoryRelations = relations(
  conversationalMemory,
  ({ one }) => ({
    chat: one(chat, {
      fields: [conversationalMemory.chatId],
      references: [chat.id],
    }),
  }),
);

// Specialist Relationships - This table is global, no client relationship
export const specialistRelations = relations(specialists, () => ({
  // No client relation defined in schema
}));

// AnalyticsEvent Relationships
export const analyticsEventRelations = relations(
  analyticsEvents,
  ({ one }) => ({
    client: one(clients, {
      fields: [analyticsEvents.clientId],
      references: [clients.id],
    }),
    user: one(user, {
      fields: [analyticsEvents.userId],
      references: [user.id],
    }),
    chat: one(chat, {
      fields: [analyticsEvents.chatId],
      references: [chat.id],
    }),
  }),
);
