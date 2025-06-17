import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import useSWRInfinite from 'swr/infinite';
import { useSession } from 'next-auth/react';
import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { toast } from 'sonner';
import { deleteChat } from '@/app/(chat)/actions';
import type { Chat } from '@/lib/db/schema';
import type {
  ChatHistory,
  DocumentHistory,
  GroupedChats,
  ExpandedSections,
  ChatSummary,
  GroupedSpecialistHistory,
  SpecialistWithChats,
} from '@/lib/types';
import { useChatCacheInvalidation } from '@/lib/utils/chatCacheInvalidation';

import { fetcher } from '@/lib/utils';

const PAGE_SIZE = 20;

// Helper functions for chat history (not tied to component state)
export const groupChatsByDate = (
  chats: Chat[] | ChatSummary[],
): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt || new Date());

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

// Update the separateChatsByType function to work with grouped specialist data
export const separateChatsBySpecialist = (
  specialistHistory: GroupedSpecialistHistory,
): Record<string, GroupedChats> => {
  console.log('[useChatHistory] Processing grouped specialist history');

  const result: Record<string, GroupedChats> = {};

  specialistHistory.specialists.forEach((specialist) => {
    console.log(
      `[useChatHistory] Processing ${specialist.chats.length} chats for specialist: ${specialist.name}`,
    );

    // Group this specialist's chats by date
    result[specialist.id] = groupChatsByDate(specialist.chats);
  });

  console.log(
    `[useChatHistory] Processed chats for ${Object.keys(result).length} specialists`,
  );

  return result;
};

// Keep the original function for backward compatibility
export const separateChatsByType = (
  chats: Chat[] | ChatSummary[],
): GroupedChats => {
  // Include ALL chats in the sidebar now, regardless of bitContextId
  console.log('[useChatHistory] Total chats to filter:', chats.length);

  // Log a sample of the incoming chats
  if (chats.length > 0) {
    console.log('[useChatHistory] Sample of incoming chats (first 3):');
    chats.slice(0, 3).forEach((chat, idx) => {
      console.log(`[useChatHistory] Chat ${idx + 1}:`, {
        id: `${chat.id.substring(0, 8)}...`,
        title: chat.title,
        bitContextId: chat.bitContextId,
        createdAt: chat.createdAt,
      });
    });
  } else {
    console.log('[useChatHistory] No chats received from backend');
  }

  // MODIFIED APPROACH: Include all chats, except global orchestrator
  const chatBitChats = chats.filter((chat) => {
    // Only exclude global orchestrator chats
    if (chat.bitContextId === 'global-orchestrator') {
      console.log(
        `[useChatHistory] Excluding global orchestrator chat "${chat.title}"`,
      );
      return false;
    }

    // Include all other chats, even if bitContextId is null or empty
    console.log(
      `[useChatHistory] Including chat "${chat.title}" with bitContextId: ${chat.bitContextId || 'NULL/EMPTY'}`,
    );
    return true;
  });

  console.log(
    '[useChatHistory] Filtered chat count (for sidebar):',
    chatBitChats.length,
  );

  // Log summary of included/excluded chats
  console.log(`[useChatHistory] Filtering summary:
    - Total chats: ${chats.length}
    - Included in sidebar: ${chatBitChats.length}
    - Excluded from sidebar: ${chats.length - chatBitChats.length}
  `);

  // Now group by date
  return groupChatsByDate(chatBitChats);
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  // CRITICAL: Check where this function is being called from
  const caller = new Error().stack?.split('\n')[2] || 'unknown';
  console.log(`[SWR Key Gen] CALLER >>> ${caller.trim()}`);

  console.log(
    `[getChatHistoryPaginationKey] Function called with pageIndex=${pageIndex}, previousPageData=`,
    previousPageData
      ? {
          hasMore: previousPageData.hasMore,
          chatCount: previousPageData.chats?.length || 0,
          firstChatId:
            previousPageData.chats?.[0]?.id?.substring(0, 8) || 'none',
        }
      : 'null/undefined',
  );

  if (previousPageData && previousPageData.hasMore === false) {
    console.log(
      '[getChatHistoryPaginationKey] Returning null (end of pagination reached)',
    );
    return null;
  }

  // Use all-specialists endpoint to get chats grouped by specialist
  try {
    const type = 'all-specialists';

    console.log(
      `[SWR Key Gen] >> Using type=${type} for specialist-grouped sidebar`,
    );

    // Create the URL with correct parameters
    let url = '';

    if (pageIndex === 0) {
      // Create a very clear, unmissable log about the key being generated
      url = `/api/history?type=${type}&limit=${PAGE_SIZE}`;
      console.log(
        `[SWR Key Gen] ALL-SPECIALISTS ATTEMPT >> Type: ${type}, Page: ${
          pageIndex + 1
        }, Limit: ${PAGE_SIZE} || FINAL KEY: ${url}`,
      );
      return url;
    }

    // For simplicity, we'll only load the first page for now
    // Pagination across all specialists is complex and can be added later if needed
    console.log(
      '[getChatHistoryPaginationKey] Returning null for pagination beyond first page',
    );
    return null;
  } catch (error) {
    console.error('[getChatHistoryPaginationKey] Error generating key:', error);
    // In case of error, return a sane default that will at least load some data
    const url = `/api/history?type=sidebar&contextId=echo-tango-specialist&limit=${PAGE_SIZE}`;
    console.error(
      `[SWR Key Gen] ERROR FALLBACK >> FINAL KEY: ${url}, Error: ${error}`,
    );
    return url;
  }
}

export function getDocumentHistoryPaginationKey(
  pageIndex: number,
  previousPageData: DocumentHistory,
) {
  console.log(
    `[getDocumentHistoryPaginationKey] Function called with pageIndex=${pageIndex}, previousPageData=`,
    previousPageData
      ? {
          hasMore: previousPageData.hasMore,
          documentCount: previousPageData.documents?.length || 0,
          firstDocId:
            previousPageData.documents?.[0]?.id?.substring(0, 8) || 'none',
        }
      : 'null/undefined',
  );

  if (previousPageData && previousPageData.hasMore === false) {
    console.log(
      '[getDocumentHistoryPaginationKey] Returning null (end of pagination reached)',
    );
    return null;
  }

  let url = '';

  if (pageIndex === 0) {
    url = `/api/documents-history?limit=${PAGE_SIZE}`;
    console.log(`[getDocumentHistoryPaginationKey] Initial URL: ${url}`);
    return url;
  }

  const lastDocumentFromPage = previousPageData.documents.at(-1);

  if (!lastDocumentFromPage) {
    console.log(
      '[getDocumentHistoryPaginationKey] No documents in previous page, returning null',
    );
    return null;
  }

  url = `/api/documents-history?limit=${PAGE_SIZE}&cursor=${lastDocumentFromPage.id}`;
  console.log(`[getDocumentHistoryPaginationKey] Pagination URL: ${url}`);
  return url;
}

// The main hook for chat history management
export function useChatHistory(currentChatId?: string) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine if the session is ready for fetching
  const isSessionReady = status !== 'loading' && session?.user?.id;

  // State for expanded day sections and number of chats to show per day
  const [expandedDays, setExpandedDays] = useState<ExpandedSections>({
    today: true,
    yesterday: false,
    lastWeek: false,
    lastMonth: false,
    older: false,
  });

  const [expandedChatCounts, setExpandedChatCounts] =
    useState<ExpandedSections>({
      today: false,
      yesterday: false,
      lastWeek: false,
      lastMonth: false,
      older: false,
    });

  // Add a state for document sections
  const [expandedDocumentDays, setExpandedDocumentDays] =
    useState<ExpandedSections>({
      today: true,
      yesterday: false,
      lastWeek: false,
      lastMonth: false,
      older: false,
    });

  // Add a state for document chat counts
  const [expandedDocumentCounts, setExpandedDocumentCounts] =
    useState<ExpandedSections>({
      today: false,
      yesterday: false,
      lastWeek: false,
      lastMonth: false,
      older: false,
    });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Log when SWR is about to make API calls
  console.log('[useChatHistory] Setting up SWR infinite hook for chat history');

  // Helper function for robust error handling
  const handleSWRError = useCallback((error: any, context: string) => {
    // Create a comprehensive error log
    const errorDetails = {
      message: error?.message || 'Unknown error',
      status: error?.status || error?.code || 'No status',
      name: error?.name || 'Unknown error type',
      stack: error?.stack || 'No stack trace',
      fullError: error,
      timestamp: new Date().toISOString(),
      context,
    };

    console.error(`[useChatHistory] SWR Error in ${context}:`, errorDetails);

    // Provide user-friendly error messages based on error type
    if (error?.status === 401 || error?.status === 403) {
      toast.error('Authentication required. Please log in again.');
    } else if (error?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (
      error?.name === 'TypeError' &&
      error?.message?.includes('fetch')
    ) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error(
        `Could not load ${context.toLowerCase()}. Please try again later.`,
      );
    }
  }, []);

  // Chat History fetching with SWR - Updated to handle grouped specialist data
  const {
    data: chatHistory,
    error: chatHistoryError,
    isLoading: isLoadingChatHistory,
    isValidating: isValidatingChatHistory,
    mutate: mutateChatHistory,
    size: chatHistoryPageSize,
    setSize: setChatHistoryPageSize,
  } = useSWRInfinite<GroupedSpecialistHistory>(
    // Only fetch if session is ready
    isSessionReady ? getChatHistoryPaginationKey : () => null,
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false, // Turned off for event-based invalidation
      revalidateIfStale: false, // Turned off for event-based invalidation
      refreshInterval: 0, // Turned off in favor of event-based invalidation
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 5000, // Keep a reasonable deduping interval
      onError: (error) => handleSWRError(error, 'Chat History'),
      onSuccess: (data) => {
        console.log('[useChatHistory] SWR fetch successful:', {
          pages: data?.length || 0,
          timestamp: new Date().toISOString(),
        });
      },
    },
  );

  // Document History fetching with SWR - DISABLED (deprecated in Phase 1, Task 1.2)
  const {
    data: paginatedDocumentHistories,
    setSize: setDocSize,
    isValidating: isDocValidating,
    isLoading: isDocLoading,
    mutate: mutateDocumentHistory,
  } = useSWRInfinite<DocumentHistory>(
    // Disable document history fetching since it's been deprecated
    () => null,
    fetcher,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnMount: false,
      dedupingInterval: 60000,
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateIfStale: false,
      loadingTimeout: 3000,
      onSuccess: (data) => {
        console.log('[useChatHistory] SWR onSuccess for document history:', {
          pages: data.length,
          totalItems: data.reduce(
            (acc, page) => acc + (page.documents?.length || 0),
            0,
          ),
        });
      },
      onError: (error) => handleSWRError(error, 'Document History'),
    },
  );

  // Flag to prevent multiple initializations
  const initializedRef = useRef(false);

  // Memoize grouped chats by specialist to prevent excessive recalculation
  const groupedSpecialistChats = useMemo(() => {
    if (!chatHistory || chatHistory.length === 0) {
      return {};
    }

    // The first page contains all the grouped specialist data
    const specialistHistory = chatHistory[0];

    console.log('[useChatHistory] Processing specialist history:', {
      specialistCount: specialistHistory.specialists.length,
      specialists: specialistHistory.specialists.map((s) => ({
        id: s.id,
        name: s.name,
        chatCount: s.chats.length,
      })),
    });

    // Process the grouped specialist data
    const result = separateChatsBySpecialist(specialistHistory);

    return result;
  }, [chatHistory]);

  // For backward compatibility, create a flattened view of all chats
  const groupedChats = useMemo(() => {
    if (
      !groupedSpecialistChats ||
      Object.keys(groupedSpecialistChats).length === 0
    ) {
      return null;
    }

    // Flatten all specialist chats into a single grouped structure
    const allChats: ChatSummary[] = [];
    Object.values(groupedSpecialistChats).forEach((specialistGroups) => {
      allChats.push(
        ...specialistGroups.today,
        ...specialistGroups.yesterday,
        ...specialistGroups.lastWeek,
        ...specialistGroups.lastMonth,
        ...specialistGroups.older,
      );
    });

    return groupChatsByDate(allChats);
  }, [groupedSpecialistChats]);

  // Check if chat history is empty
  const hasEmptyChatHistory = useMemo(() => {
    if (
      !groupedSpecialistChats ||
      Object.keys(groupedSpecialistChats).length === 0
    )
      return true;

    // Check if any specialist has chats
    return !Object.values(groupedSpecialistChats).some(
      (specialistGroups) =>
        specialistGroups.today.length > 0 ||
        specialistGroups.yesterday.length > 0 ||
        specialistGroups.lastWeek.length > 0 ||
        specialistGroups.lastMonth.length > 0 ||
        specialistGroups.older.length > 0,
    );
  }, [groupedSpecialistChats]);

  // Check if we've reached the end of pagination
  const hasReachedChatEnd = useMemo(() => {
    if (!chatHistory || chatHistory.length === 0) return false;
    const lastPage = chatHistory[chatHistory.length - 1];
    return lastPage && lastPage.hasMore === false;
  }, [chatHistory]);

  // Memoize grouped documents
  const groupedDocuments = useMemo(() => {
    if (!paginatedDocumentHistories) return null;

    const docsFromHistory = paginatedDocumentHistories.flatMap(
      (paginatedDocHistory) => paginatedDocHistory.documents,
    );

    // Convert Document type to match Chat type for grouping
    const formattedDocs = docsFromHistory.map((doc) => ({
      ...doc,
      title: doc.title || 'Untitled Document',
    }));

    return groupChatsByDate(formattedDocs as unknown as Chat[]);
  }, [paginatedDocumentHistories]);

  // Check if document history is empty
  const hasEmptyDocHistory = useMemo(() => {
    if (!paginatedDocumentHistories) return true;
    return paginatedDocumentHistories.every(
      (page) => page.documents.length === 0,
    );
  }, [paginatedDocumentHistories]);

  // Check if we've reached the end of document pagination
  const hasReachedDocEnd = useMemo(() => {
    if (!paginatedDocumentHistories || paginatedDocumentHistories.length === 0)
      return false;
    const lastPage =
      paginatedDocumentHistories[paginatedDocumentHistories.length - 1];
    return lastPage && lastPage.hasMore === false;
  }, [paginatedDocumentHistories]);

  // Callbacks for toggling day expansions with proper memoization
  const toggleDayExpansion = useCallback((day: keyof GroupedChats) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  }, []);

  const toggleDocumentDayExpansion = useCallback((day: keyof GroupedChats) => {
    setExpandedDocumentDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  }, []);

  const toggleChatCountExpansion = useCallback((day: keyof GroupedChats) => {
    setExpandedChatCounts((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  }, []);

  const toggleDocumentCountExpansion = useCallback(
    (day: keyof GroupedChats) => {
      setExpandedDocumentCounts((prev) => ({
        ...prev,
        [day]: !prev[day],
      }));
    },
    [],
  );

  // Initiate chat deletion
  const initDeleteChat = useCallback((id: string) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  }, []);

  // Cancel chat deletion
  const cancelDeleteChat = useCallback(() => {
    setDeleteId(null);
    setShowDeleteDialog(false);
  }, []);

  // Confirm and execute chat deletion
  const confirmDeleteChat = useCallback(async () => {
    if (!deleteId) {
      setShowDeleteDialog(false);
      return;
    }

    startTransition(async () => {
      try {
        await deleteChat(deleteId);
        toast.success('Chat deleted');

        // If we're viewing the deleted chat, redirect
        if (deleteId === currentChatId) {
          router.push('/');
        }

        // Refresh chat history data
        mutateChatHistory();
      } catch (error) {
        console.error('Error deleting chat:', error);
        toast.error('Failed to delete chat');
      } finally {
        setDeleteId(null);
        setShowDeleteDialog(false);
      }
    });
  }, [deleteId, currentChatId, router, mutateChatHistory]);

  // Load more chats
  const loadMoreChats = useCallback(() => {
    setChatHistoryPageSize((size) => size + 1);
  }, [setChatHistoryPageSize]);

  // Load more documents
  const loadMoreDocuments = useCallback(() => {
    setDocSize((size) => size + 1);
  }, [setDocSize]);

  return {
    // Chat data
    groupedChats,
    groupedSpecialistChats,
    hasEmptyChatHistory,
    hasReachedChatEnd,
    isLoadingChatHistory,
    isValidatingChatHistory,

    // Document data
    groupedDocuments,
    hasEmptyDocHistory,
    hasReachedDocEnd,
    isDocLoading,
    isDocValidating,

    // Chat expansion states
    expandedDays,
    expandedChatCounts,
    toggleDayExpansion,
    toggleChatCountExpansion,

    // Document expansion states
    expandedDocumentDays,
    expandedDocumentCounts,
    toggleDocumentDayExpansion,
    toggleDocumentCountExpansion,

    // Chat deletion
    deleteId,
    showDeleteDialog,
    isPending,
    initDeleteChat,
    cancelDeleteChat,
    confirmDeleteChat,

    // Pagination
    loadMoreChats,
    loadMoreDocuments,

    // Utilities
    mutateChatHistory,
    mutateDocumentHistory,
  };
}
