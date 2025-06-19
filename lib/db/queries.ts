import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
  isNull,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  message,
  type DBMessage,
  vote,
  type Chat,
  clients,
} from './schema';
// ArtifactKind removed as part of Echo Tango v1 simplification
import type { ChatSummary } from '@/lib/types';
import {
  GLOBAL_ORCHESTRATOR_CONTEXT_ID,
  CHAT_BIT_CONTEXT_ID,
} from '@/lib/constants';

// Import conversational memory utilities - using dynamic import to avoid Edge Runtime issues
// import { storeConversationalMemory } from '@/lib/conversationalMemory';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Client configuration type returned by getClientConfig
 */
export type ClientConfig = {
  id: string;
  name: string;
  client_display_name: string; // User-facing client name
  client_core_mission?: string | null; // Short client business description
  customInstructions?: string | null;
  configJson?: {
    orchestrator_client_context?: string | null;
    available_bit_ids?: string[] | null;
    tool_configs?: Record<string, any> | null;
  } | null;
};

/**
 * Fetch client configuration based on client ID
 * @param clientId The client ID to fetch configuration for
 * @returns ClientConfig object or null if not found
 */
export async function getClientConfig(
  clientId: string,
): Promise<ClientConfig | null> {
  try {
    console.log(
      `[DB:getClientConfig] Fetching config for clientId: ${clientId}`,
    );
    const result = await db
      .select({
        id: clients.id,
        name: clients.name,
        client_display_name: clients.client_display_name,
        client_core_mission: clients.client_core_mission,
        customInstructions: clients.customInstructions,
        configJsonRaw: clients.config_json, // Fetch the JSONB column
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (result.length === 0) {
      console.warn(
        `[DB:getClientConfig] No configuration found for clientId: ${clientId}`,
      );
      return null;
    }

    const dbClient = result[0];
    let parsedConfigJson: ClientConfig['configJson'] = null;

    if (dbClient.configJsonRaw) {
      // Drizzle might already parse JSONB, but if it's a string, explicitly parse.
      if (typeof dbClient.configJsonRaw === 'string') {
        try {
          parsedConfigJson = JSON.parse(dbClient.configJsonRaw);
        } catch (e) {
          console.error(
            `[DB:getClientConfig] Failed to parse config_json string for client ${clientId}:`,
            e,
          );
          // Set to null or an empty object depending on desired error handling
          parsedConfigJson = null;
        }
      } else {
        // If Drizzle already parsed it (common for JSONB)
        parsedConfigJson = dbClient.configJsonRaw as ClientConfig['configJson'];
      }
    }

    console.log(
      `[DB:getClientConfig] Raw customInstructions:`,
      dbClient.customInstructions,
    );
    console.log(`[DB:getClientConfig] Parsed configJson:`, parsedConfigJson);

    const clientConfigData: ClientConfig = {
      id: dbClient.id,
      name: dbClient.name,
      client_display_name: dbClient.client_display_name,
      client_core_mission: dbClient.client_core_mission,
      customInstructions: dbClient.customInstructions,
      configJson: parsedConfigJson,
    };

    console.log(
      `[DB:getClientConfig] Found config for ${clientId}:`,
      clientConfigData,
    );

    return clientConfigData;
  } catch (error) {
    console.error(
      `[DB:getClientConfig] Error fetching config for clientId ${clientId}:`,
      error,
    );
    return null; // Return null on error
  }
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(
  email: string,
  password: string,
  clientId: string,
) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({
      email,
      password: hash,
      clientId,
    });
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  bitContextId,
  clientId = 'default',
}: {
  id: string;
  userId: string;
  title: string;
  bitContextId?: string | null;
  clientId?: string;
}) {
  try {
    console.log('[DB] Attempting to save chat:', {
      id,
      userId,
      title,
      bitContextId,
      clientId,
    });
    const result = await db
      .insert(chat)
      .values({
        id,
        createdAt: new Date(),
        userId,
        title,
        clientId,
        bitContextId,
      })
      .onConflictDoNothing();
    console.log('[DB] Successfully saved chat (or already exists):', {
      id,
      result,
    });
    return result;
  } catch (error) {
    console.error('[DB] Failed to save chat in database:', error);
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select({
          id: chat.id,
          title: chat.title,
          updatedAt: chat.updatedAt,
          createdAt: chat.createdAt,
          visibility: chat.visibility,
          bitContextId: chat.bitContextId,
          userId: chat.userId,
          clientId: chat.clientId,
        })
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.updatedAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    console.log(`[DB:getChatById] Fetching chat with ID: ${id}`);
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    console.log(
      `[DB:getChatById] Result for ${id}: ${selectedChat ? 'Found' : 'Not found'}`,
    );
    if (selectedChat) {
      console.log(
        `[DB:getChatById] Chat details: title=${selectedChat.title}, userId=${selectedChat.userId}, createdAt=${selectedChat.createdAt}, updatedAt=${selectedChat.updatedAt || 'N/A'}`,
      );
    }
    return selectedChat;
  } catch (error) {
    console.error(
      `[DB:getChatById] Failed to get chat with ID ${id} from database:`,
      error,
    );
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  console.log(
    '[saveMessages] Function called. Number of messages received:',
    Array.isArray(messages) ? messages.length : 'Not an array!',
  );
  if (Array.isArray(messages) && messages.length > 0) {
    // Log structure of the first message to check format
    console.log(
      '[saveMessages] Structure of first message:',
      JSON.stringify(messages[0], null, 2),
    );
  } else if (!Array.isArray(messages)) {
    console.error('[saveMessages] Input is not an array:', messages);
  }

  try {
    console.log('[saveMessages] Received messages type:', typeof messages);
    console.log('[saveMessages] Is Array:', Array.isArray(messages));
    try {
      console.log(
        '[saveMessages] Received messages value:',
        JSON.stringify(messages, null, 2),
      );
    } catch (e) {
      console.error('[saveMessages] Could not stringify received messages:', e);
      console.log('[saveMessages] Raw received messages value:', messages);
    }

    // Guard clause to ensure messages is an array
    if (!Array.isArray(messages)) {
      console.error(
        '[saveMessages] FATAL: Input "messages" is not an array. Aborting save operation. Received:',
        messages,
      );
      throw new Error(
        'Invalid input to saveMessages: The "messages" parameter must be an array.',
      );
    }

    console.log('[DB] Attempting to save messages, count:', messages.length);
    console.log('[DB] Message sample:', JSON.stringify(messages[0], null, 2));

    // Validate message format and ensure proper date objects
    for (const msg of messages) {
      // Validate required fields
      if (!msg.id || !msg.chatId || !msg.role) {
        console.error('[DB] Missing required fields:', msg);
        throw new Error('Invalid message format: missing required fields');
      }

      // Validate parts array
      if (!msg.parts || !Array.isArray(msg.parts) || msg.parts.length === 0) {
        console.error('[DB] Invalid message parts:', msg);
        throw new Error('Invalid message format: parts array is required');
      }

      // Validate attachments array
      if (!msg.attachments || !Array.isArray(msg.attachments)) {
        console.error('[DB] Invalid message attachments:', msg);
        throw new Error(
          'Invalid message format: attachments array is required',
        );
      }

      // Ensure createdAt is a valid Date object
      if (msg.createdAt && !(msg.createdAt instanceof Date)) {
        console.log('[DB] Converting createdAt to Date object');
        msg.createdAt = new Date(msg.createdAt);
      }

      // If no createdAt is provided, it will use the database default (NOW())
      if (!msg.createdAt) {
        console.log('[DB] No createdAt provided, will use database default');
      }

      // Ensure clientId is provided
      if (!msg.clientId) {
        console.log('[DB] No clientId provided, using default');
        msg.clientId = 'default';
      }
    }

    console.log('[saveMessages] Preparing to execute db.insert(message)...');
    const result = await db.insert(message).values(messages);
    console.log('[saveMessages] db.insert(message) executed successfully.');

    return result;
  } catch (error: any) {
    console.error('[saveMessages] Error during db.insert(message):', error);
    // Log specific DB error details if available
    if (error.code) {
      console.error(`[saveMessages] DB Error Code: ${error.code}`);
    }
    if (error.message) {
      console.error(`[saveMessages] DB Error Message: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Enhanced version of saveMessages that includes conversational memory storage
 * This function maintains all existing behavior while adding memory capabilities
 */
export async function saveMessagesWithMemory({
  messages,
  enableMemoryStorage = true,
}: {
  messages: Array<DBMessage>;
  enableMemoryStorage?: boolean;
}) {
  try {
    // First, save messages using the existing function
    const result = await saveMessages({ messages });

    // If memory storage is enabled, process conversation turns
    if (enableMemoryStorage && messages.length > 0) {
      await processConversationalMemory(messages);
    }

    return result;
  } catch (error) {
    console.error('[saveMessagesWithMemory] Error in enhanced save:', error);
    throw error;
  }
}

/**
 * Process messages for conversational memory storage
 * Extracts user-assistant conversation turns and stores them with embeddings
 */
async function processConversationalMemory(messages: Array<DBMessage>) {
  try {
    // Process each unique chatId
    const chatIds = [...new Set(messages.map((msg) => msg.chatId))];

    for (const chatId of chatIds) {
      // Get recent messages from this chat to find conversation pairs
      const recentMessages = await db
        .select()
        .from(message)
        .where(eq(message.chatId, chatId))
        .orderBy(desc(message.createdAt))
        .limit(10); // Get last 10 messages to find pairs

      // Reverse to get chronological order
      const chronologicalMessages = recentMessages.reverse();

      // Look for user-assistant conversation pairs
      let userMessage: any = null;
      let storedCount = 0;

      for (const msg of chronologicalMessages) {
        if (msg.role === 'user') {
          userMessage = msg;
        } else if (msg.role === 'assistant' && userMessage) {
          // We have a complete conversation turn
          const userText = extractTextFromMessage(userMessage);
          const assistantText = extractTextFromMessage(msg);

          if (userText && assistantText) {
            // Store the conversation turn with embeddings - using dynamic import to avoid Edge Runtime issues
            try {
              const { storeConversationalMemory } = await import(
                '@/lib/conversationalMemory'
              );
              const stored = await storeConversationalMemory(
                chatId,
                userText,
                assistantText,
                'turn',
              );

              if (stored) {
                storedCount++;
              }
            } catch (error) {
              console.warn(
                '[DB] Failed to store conversational memory:',
                error,
              );
            }
          }

          // Reset for next potential turn
          userMessage = null;
        }
      }

      if (storedCount > 0) {
        console.log(
          `[ConversationalMemory] Stored ${storedCount} conversation turns for chat ${chatId.substring(0, 8)}`,
        );
      }
    }
  } catch (error) {
    console.error(
      '[ConversationalMemory] Error processing conversational memory:',
      error,
    );
    // Don't throw here - memory storage failure shouldn't break message saving
  }
}

/**
 * Extract text content from a message's parts array
 */
function extractTextFromMessage(message: DBMessage): string | null {
  try {
    if (!message.parts || !Array.isArray(message.parts)) {
      return null;
    }

    // Find the first text part
    const textPart = message.parts.find((part) => part.type === 'text');
    return textPart?.text || null;
  } catch (error) {
    console.error(
      '[ConversationalMemory] Error extracting text from message:',
      error,
    );
    return null;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));

    return messages;
  } catch (error) {
    console.error(
      `[DB:getMessagesByChatId] Failed to get messages for chat ID ${id} from database:`,
      error,
    );
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
      clientId: 'default',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    const result = await db
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));

    // Note: Cache invalidation is now handled client-side when the UI updates
    // Server-side cache invalidation has been removed as it was incorrectly
    // attempting to call client-side functions from the server

    return result;
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function ensureChatExists({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    // First try to find the chat
    const existingChat = await db
      .select({
        id: chat.id,
        userId: chat.userId,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    if (existingChat.length === 0) {
      try {
        await db.insert(chat).values({
          id: chatId,
          createdAt: new Date(),
          userId: userId,
          title: 'New Chat', // Default title, can be updated later
          clientId: 'default',
        });
        return true;
      } catch (insertError: any) {
        // Handle potential race condition where chat was created by another request
        if (insertError.code === '23505') {
          // Unique constraint violation - chat exists from concurrent request
          return true;
        }
        throw insertError;
      }
    } else {
      return true;
    }
  } catch (error) {
    console.error('Error during chat existence check:', error);
    throw error;
  }
}

interface GetChatSummariesParams {
  userId: string;
  clientId: string;
  historyType: 'sidebar' | 'global' | null;
  bitContextId?: string | null;
  page: number;
  limit: number;
}

/**
 * Fetch chat summaries for display in the UI, with support for pagination and filtering
 * by history type (sidebar or global) and bitContextId.
 */
export async function getChatSummaries({
  userId,
  clientId,
  historyType,
  bitContextId: queryBitContextId,
  page,
  limit,
}: GetChatSummariesParams): Promise<ChatSummary[]> {
  // Reduced DB query logging
  const offset = (page - 1) * limit;

  try {
    // Define base conditions
    const conditions = [eq(chat.userId, userId), eq(chat.clientId, clientId)];

    // Define specific filters based on historyType
    if (historyType === 'global') {
      if (GLOBAL_ORCHESTRATOR_CONTEXT_ID === null) {
        conditions.push(isNull(chat.bitContextId));
      } else {
        conditions.push(eq(chat.bitContextId, GLOBAL_ORCHESTRATOR_CONTEXT_ID));
      }
    } else if (historyType === 'sidebar' && queryBitContextId) {
      conditions.push(eq(chat.bitContextId, queryBitContextId));
    } else if (historyType === 'sidebar' && !queryBitContextId) {
      // Default for sidebar if no specific contextId given - use CHAT_BIT_CONTEXT_ID
      conditions.push(eq(chat.bitContextId, CHAT_BIT_CONTEXT_ID));
    }

    // Optimized query - use updatedAt for sorting instead of expensive subqueries
    const groupedAndFilteredChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        bitContextId: chat.bitContextId,
        visibility: chat.visibility,
      })
      .from(chat)
      .where(and(...conditions))
      .orderBy(desc(chat.updatedAt))
      .limit(limit)
      .offset(offset);

    // Only log if no chats found (potential issue)
    if (groupedAndFilteredChats.length === 0) {
      console.log(
        `[DB getChatSummaries] No chats found with the current filters.`,
      );
    }

    // Transform database results to ChatSummary objects
    const chatSummaries: ChatSummary[] = groupedAndFilteredChats.map(
      (chat) => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        userId: userId, // Add required userId
        clientId: clientId, // Add required clientId
        lastMessageTimestamp: chat.updatedAt, // Use updatedAt as the last activity timestamp
        lastMessageSnippet: undefined, // We'll implement this in a separate step if needed
        bitContextId: chat.bitContextId,
        // Derive isGlobal based on bitContextId using the constant
        isGlobal:
          chat.bitContextId === GLOBAL_ORCHESTRATOR_CONTEXT_ID ||
          (chat.bitContextId === null &&
            GLOBAL_ORCHESTRATOR_CONTEXT_ID === null),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt || chat.createdAt, // Fallback to createdAt if updatedAt isn't available
        visibility: chat.visibility,
        pinnedStatus: false, // Default to false until we implement pinning
      }),
    );

    // Reduced summary processing logs

    return chatSummaries;
  } catch (error) {
    console.error(
      '[DB getChatSummaries] Error fetching chat summaries:',
      error,
    );
    throw new Error(
      `Failed to fetch chat summaries: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Fetch chat summaries from all specialists at once
 * This allows displaying chats from different specialists in separate sections
 */
export async function getAllSpecialistChatSummaries({
  userId,
  clientId,
  specialistIds,
  page,
  limit,
}: {
  userId: string;
  clientId: string;
  specialistIds: string[];
  page: number;
  limit: number;
}): Promise<Record<string, ChatSummary[]>> {
  console.log(
    `[DB getAllSpecialistChatSummaries] Params: userId=${userId}, clientId=${clientId}, specialists=${specialistIds.join(',')}, page=${page}, limit=${limit}`,
  );

  try {
    // Create a map to store results by specialist ID
    const resultsBySpecialist: Record<string, ChatSummary[]> = {};

    // Define base conditions common to all queries
    const baseConditions = [
      eq(chat.userId, userId),
      eq(chat.clientId, clientId),
    ];

    // Loop through each specialist ID and fetch its chats
    for (const specialistId of specialistIds) {
      console.log(
        `[DB getAllSpecialistChatSummaries] Fetching chats for specialist: ${specialistId}`,
      );

      // Create conditions specific to this specialist
      const conditions = [
        ...baseConditions,
        eq(chat.bitContextId, specialistId),
      ];

      // Optimized query for specialist chats - use updatedAt instead of expensive subqueries
      const specialistChats = await db
        .select({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          bitContextId: chat.bitContextId,
          visibility: chat.visibility,
        })
        .from(chat)
        .where(and(...conditions))
        .orderBy(desc(chat.updatedAt))
        .limit(limit)
        .offset((page - 1) * limit);

      // Transform database results to ChatSummary objects
      const chatSummaries: ChatSummary[] = specialistChats.map((chat) => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        userId: userId, // Add required userId
        clientId: clientId, // Add required clientId
        lastMessageTimestamp: chat.updatedAt, // Use updatedAt as the last activity timestamp
        lastMessageSnippet: undefined,
        bitContextId: chat.bitContextId,
        isGlobal: false, // These are specialist chats, not global
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt || chat.createdAt,
        visibility: chat.visibility,
        pinnedStatus: false,
      }));

      // Store in the results map
      resultsBySpecialist[specialistId] = chatSummaries;
      console.log(
        `[DB getAllSpecialistChatSummaries] Found ${chatSummaries.length} chats for specialist ${specialistId}`,
      );
    }

    return resultsBySpecialist;
  } catch (error) {
    console.error(
      '[DB getAllSpecialistChatSummaries] Error fetching specialist chat summaries:',
      error,
    );
    throw new Error(
      `Failed to fetch specialist chat summaries: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
