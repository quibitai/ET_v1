/**
 * SWR-Native Chat Cache Invalidation System
 *
 * This module provides robust cache invalidation for chat history using SWR's
 * native patterns. It replaces the custom event system with direct SWR integration
 * for better reliability and performance.
 */

import { mutate } from 'swr';
import type { ChatHistory, ChatSummary } from '@/lib/types';

/**
 * Configuration options for cache invalidation
 */
interface CacheInvalidationOptions {
  /** Whether to revalidate immediately after invalidation */
  revalidate?: boolean;
  /** Whether to show optimistic updates */
  optimistic?: boolean;
  /** Custom logger function */
  logger?: (message: string, data?: any) => void;
  /** Whether to retry on failure */
  retry?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
}

/**
 * Default configuration for cache invalidation
 */
const DEFAULT_OPTIONS: Required<CacheInvalidationOptions> = {
  revalidate: true,
  optimistic: true,
  logger: console.log,
  retry: true,
  maxRetries: 3,
};

// FIXED: Add debouncing to prevent infinite loops during streaming
const pendingOptimisticUpdates = new Set<string>();
const OPTIMISTIC_UPDATE_DEBOUNCE_MS = 1000;

/**
 * Generates cache keys for chat history pagination
 */
function getChatHistoryCacheKeys(): string[] {
  const keys: string[] = [];

  // Generate keys for typical pagination pages (0-9)
  for (let i = 0; i < 10; i++) {
    keys.push(`/api/history?page=${i}&limit=20`);
  }

  return keys;
}

/**
 * Checks if a key is a chat history cache key
 */
function isChatHistoryKey(key: any): boolean {
  if (typeof key !== 'string') return false;
  return key.includes('/api/history') && key.includes('page=');
}

/**
 * Invalidates all chat history cache entries using SWR's global mutate
 */
export async function invalidateChatHistoryCache(
  options: CacheInvalidationOptions = {},
): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.log('[ChatCacheInvalidation] Skipping on server side');
    return;
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const { logger, retry, maxRetries } = config;

  const executeInvalidation = async (attempt = 1): Promise<void> => {
    try {
      logger('[ChatCacheInvalidation] Starting cache invalidation', {
        attempt,
        timestamp: new Date().toISOString(),
      });

      // Use SWR's global mutate with a filter function to target all chat history keys
      await mutate((key) => isChatHistoryKey(key), undefined, {
        revalidate: config.revalidate,
        populateCache: false,
        optimisticData: undefined,
        rollbackOnError: true,
      });

      logger('[ChatCacheInvalidation] Cache invalidation successful', {
        attempt,
        revalidated: config.revalidate,
      });
    } catch (error) {
      logger('[ChatCacheInvalidation] Cache invalidation failed', {
        attempt,
        error: error instanceof Error ? error.message : String(error),
        willRetry: retry && attempt < maxRetries,
      });

      if (retry && attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return executeInvalidation(attempt + 1);
      }

      // Don't throw - cache invalidation failure shouldn't break the main flow
      console.warn(
        '[ChatCacheInvalidation] All retry attempts failed, continuing...',
      );
    }
  };

  await executeInvalidation();
}

/**
 * Optimistically adds a new chat to the cache while invalidating
 */
export async function addChatOptimistically(
  newChat: Partial<ChatSummary>,
  options: CacheInvalidationOptions = {},
): Promise<void> {
  if (typeof window === 'undefined') return;

  // FIXED: Prevent multiple optimistic updates during streaming
  const chatKey = `optimistic-${newChat.id}`;
  if (pendingOptimisticUpdates.has(chatKey)) {
    console.log(
      '[ChatCacheInvalidation] Skipping duplicate optimistic update',
      {
        chatId: newChat.id,
      },
    );
    return;
  }

  pendingOptimisticUpdates.add(chatKey);
  setTimeout(() => {
    pendingOptimisticUpdates.delete(chatKey);
  }, OPTIMISTIC_UPDATE_DEBOUNCE_MS);

  const config = { ...DEFAULT_OPTIONS, ...options };
  const { logger, optimistic } = config;

  try {
    logger('[ChatCacheInvalidation] Adding chat optimistically', {
      chatId: newChat.id,
      title: newChat.title,
    });

    if (optimistic) {
      // Get the specific key that the sidebar is using
      const activeContextId =
        localStorage.getItem('current-active-specialist') ||
        'echo-tango-specialist';
      const sidebarKey = `/api/history?type=sidebar&contextId=${activeContextId}&limit=20`;

      logger('[ChatCacheInvalidation] Targeting specific SWR key:', sidebarKey);

      // Use a broader approach to update all matching keys
      // This ensures we catch all SWR infinite hooks that might be using this data
      await mutate(
        (key) => {
          if (
            typeof key === 'string' &&
            key.includes('/api/history') &&
            key.includes('type=sidebar')
          ) {
            logger(
              '[ChatCacheInvalidation] Found matching key for update:',
              key,
            );
            return true;
          }
          return false;
        },
        async (currentData: any) => {
          logger('[ChatCacheInvalidation] Current cache data structure:', {
            isArray: Array.isArray(currentData),
            length: currentData?.length,
            type: typeof currentData,
            keys: currentData ? Object.keys(currentData) : 'no data',
            firstKey: currentData ? Object.keys(currentData)[0] : 'no keys',
            firstValue:
              currentData && Object.keys(currentData)[0]
                ? currentData[Object.keys(currentData)[0]]
                : 'no first value',
          });

          // Log the actual structure in detail
          if (currentData) {
            logger('[ChatCacheInvalidation] Detailed cache structure:');
            Object.keys(currentData).forEach((key, index) => {
              logger(
                `[ChatCacheInvalidation] Key ${index}: "${key}", Type: ${typeof currentData[key]}, IsArray: ${Array.isArray(currentData[key])}`,
              );
              if (
                Array.isArray(currentData[key]) &&
                currentData[key].length > 0
              ) {
                logger(
                  `[ChatCacheInvalidation] First item in ${key}:`,
                  currentData[key][0],
                );
              }
            });
          }

          if (!currentData) {
            logger(
              '[ChatCacheInvalidation] No cache data available, skipping optimistic update',
            );
            return currentData;
          }

          // Handle different possible data structures
          let pages: ChatHistory[];

          if (Array.isArray(currentData)) {
            // Standard SWR infinite array format
            pages = currentData;
          } else if (currentData.pages && Array.isArray(currentData.pages)) {
            // SWR infinite with wrapper object
            pages = currentData.pages;
          } else if (currentData.chats && Array.isArray(currentData.chats)) {
            // Single page format
            pages = [currentData];
          } else {
            logger(
              '[ChatCacheInvalidation] Unknown cache data structure, skipping optimistic update',
            );
            return currentData;
          }

          if (pages.length === 0) {
            logger(
              '[ChatCacheInvalidation] No pages available, skipping optimistic update',
            );
            return currentData;
          }

          // Check if first page exists and has the expected structure
          const firstPage = pages[0];
          if (
            !firstPage ||
            !firstPage.chats ||
            !Array.isArray(firstPage.chats)
          ) {
            logger(
              '[ChatCacheInvalidation] First page missing or invalid structure:',
              {
                hasFirstPage: !!firstPage,
                hasChats: firstPage ? 'chats' in firstPage : false,
                chatsIsArray: firstPage?.chats
                  ? Array.isArray(firstPage.chats)
                  : false,
              },
            );
            return currentData;
          }

          logger(
            '[ChatCacheInvalidation] Updating first page with optimistic chat',
          );

          // Create the optimistic chat with all required fields
          const optimisticChat: ChatSummary = {
            id: newChat.id || `temp-${Date.now()}`,
            title: newChat.title || 'New Chat',
            createdAt: newChat.createdAt || new Date(),
            updatedAt: newChat.updatedAt || new Date(),
            visibility: newChat.visibility || 'private',
            userId: newChat.userId || '',
            clientId: newChat.clientId || 'default',
            bitContextId: newChat.bitContextId || 'echo-tango-specialist',
            ...newChat,
          };

          logger('[ChatCacheInvalidation] Optimistic chat object created', {
            chatId: optimisticChat.id,
            title: optimisticChat.title,
            bitContextId: optimisticChat.bitContextId,
          });

          // Create updated first page with new chat at the beginning
          const updatedFirstPage: ChatHistory = {
            ...firstPage,
            chats: [optimisticChat, ...firstPage.chats],
          };

          // Update the pages array
          const updatedPages = [updatedFirstPage, ...pages.slice(1)];

          // Return in the same format as received
          let result: any;
          if (Array.isArray(currentData)) {
            result = updatedPages;
            logger(
              '[ChatCacheInvalidation] Returning updated pages array format',
            );
          } else if (currentData.pages) {
            result = { ...currentData, pages: updatedPages };
            logger(
              '[ChatCacheInvalidation] Returning wrapper object with pages',
            );
          } else {
            result = updatedFirstPage;
            logger('[ChatCacheInvalidation] Returning single page format');
          }

          logger('[ChatCacheInvalidation] Final result structure:', {
            isArray: Array.isArray(result),
            hasChats: result && 'chats' in result,
            chatsCount: result?.chats?.length || 0,
            firstChatId: result?.chats?.[0]?.id?.substring(0, 8) || 'none',
            firstChatTitle: result?.chats?.[0]?.title || 'none',
          });

          return result;
        },
        {
          revalidate: false, // Don't revalidate immediately to see optimistic update
          populateCache: true,
          rollbackOnError: true,
        },
      );

      logger(
        '[ChatCacheInvalidation] Optimistic update completed for all matching keys',
      );
    }

    // Skip cache invalidation for optimistic updates to prevent overwriting
    // The optimistic update should be visible until the next natural revalidation
    logger(
      '[ChatCacheInvalidation] Skipping cache invalidation to preserve optimistic update',
    );
  } catch (error) {
    logger('[ChatCacheInvalidation] Optimistic update failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to regular invalidation
    await invalidateChatHistoryCache(options);
  }
}

/**
 * Removes a chat from the cache optimistically
 */
export async function removeChatOptimistically(
  chatId: string,
  options: CacheInvalidationOptions = {},
): Promise<void> {
  if (typeof window === 'undefined') return;

  const config = { ...DEFAULT_OPTIONS, ...options };
  const { logger, optimistic } = config;

  try {
    logger('[ChatCacheInvalidation] Removing chat optimistically', { chatId });

    if (optimistic) {
      // Optimistically remove the chat from all pages
      await mutate(
        (key) => isChatHistoryKey(key),
        async (currentData: ChatHistory | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            chats: currentData.chats.filter((chat) => chat.id !== chatId),
          };
        },
        {
          revalidate: config.revalidate,
          populateCache: true,
          rollbackOnError: true,
        },
      );
    }

    // Also do a full invalidation to ensure consistency
    await invalidateChatHistoryCache({
      ...options,
      optimistic: false,
    });
  } catch (error) {
    logger('[ChatCacheInvalidation] Optimistic removal failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to regular invalidation
    await invalidateChatHistoryCache(options);
  }
}

/**
 * Updates a chat in the cache optimistically
 */
export async function updateChatOptimistically(
  chatId: string,
  updates: Partial<ChatSummary>,
  options: CacheInvalidationOptions = {},
): Promise<void> {
  if (typeof window === 'undefined') return;

  const config = { ...DEFAULT_OPTIONS, ...options };
  const { logger, optimistic } = config;

  try {
    logger('[ChatCacheInvalidation] Updating chat optimistically', {
      chatId,
      updates: Object.keys(updates),
    });

    if (optimistic) {
      // Optimistically update the chat in all pages
      await mutate(
        (key) => isChatHistoryKey(key),
        async (currentData: ChatHistory | undefined) => {
          if (!currentData) return currentData;

          return {
            ...currentData,
            chats: currentData.chats.map((chat) =>
              chat.id === chatId ? { ...chat, ...updates } : chat,
            ),
          };
        },
        {
          revalidate: config.revalidate,
          populateCache: true,
          rollbackOnError: true,
        },
      );
    }

    // Also do a targeted invalidation
    await invalidateChatHistoryCache({
      ...options,
      optimistic: false,
    });
  } catch (error) {
    logger('[ChatCacheInvalidation] Optimistic update failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to regular invalidation
    await invalidateChatHistoryCache(options);
  }
}

/**
 * Server-safe wrapper that only runs on client side
 */
export function invalidateChatHistoryCacheServerSafe(
  options: CacheInvalidationOptions = {},
): void {
  if (typeof window === 'undefined') {
    console.log('[ChatCacheInvalidation] Skipping server-side invalidation');
    return;
  }

  // Run asynchronously to avoid blocking
  invalidateChatHistoryCache(options).catch((error) => {
    console.warn('[ChatCacheInvalidation] Async invalidation failed:', error);
  });
}

/**
 * Hook for components that need to invalidate chat history cache
 */
export function useChatCacheInvalidation() {
  return {
    invalidateCache: invalidateChatHistoryCache,
    addChatOptimistically,
    removeChatOptimistically,
    updateChatOptimistically,
  };
}
