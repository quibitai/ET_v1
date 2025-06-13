'use client';
import { useParams, useRouter, usePathname } from 'next/navigation';
import type { User } from 'next-auth';
import { useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SidebarMenu, useSidebar } from '@/components/ui/sidebar';
import type { Chat } from '@/lib/db/schema';
import { ChatItem } from './sidebar-history-item';
import {
  ChevronDown,
  ChevronRight,
  Loader,
  Trash,
  RotateCw,
} from 'lucide-react';
import { useChatHistory } from '@/hooks/use-chat-history';
import type { GroupedChats, ChatSummary } from '@/lib/types';

const PAGE_SIZE = 20;

// Memoize the DaySection component to prevent unnecessary re-renders
const DaySection = memo(
  ({
    day,
    title,
    chats,
    isExpanded,
    isCountExpanded,
    onToggleExpansion,
    onToggleCountExpansion,
    onDelete,
    setOpenMobile,
    currentChatId,
  }: {
    day: keyof GroupedChats;
    title: string;
    chats: Chat[] | ChatSummary[];
    isExpanded: boolean;
    isCountExpanded: boolean;
    onToggleExpansion: (day: keyof GroupedChats) => void;
    onToggleCountExpansion: (day: keyof GroupedChats) => void;
    onDelete: (chatId: string) => void;
    setOpenMobile: (open: boolean) => void;
    currentChatId: string | undefined;
  }) => {
    const handleToggle = useCallback(() => {
      onToggleExpansion(day);
    }, [day, onToggleExpansion]);

    const handleToggleCount = useCallback(() => {
      onToggleCountExpansion(day);
    }, [day, onToggleCountExpansion]);

    // Skip rendering if there are no chats for this day
    if (chats.length === 0) return null;

    const MAX_INITIAL_CHATS = 5;
    const visibleChats = isCountExpanded
      ? chats
      : chats.slice(0, MAX_INITIAL_CHATS);
    const hasMoreChats = chats.length > MAX_INITIAL_CHATS;

    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          {title} ({chats.length})
        </button>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 ml-2">
              {visibleChats.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat as any}
                  onDelete={onDelete}
                  setOpenMobile={setOpenMobile}
                  isActive={currentChatId === chat.id}
                />
              ))}
              {hasMoreChats && !isCountExpanded && (
                <button
                  type="button"
                  onClick={handleToggleCount}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 w-full text-left"
                >
                  Show {chats.length - MAX_INITIAL_CHATS} more...
                </button>
              )}
              {hasMoreChats && isCountExpanded && (
                <button
                  type="button"
                  onClick={handleToggleCount}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 w-full text-left"
                >
                  Show less
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  },
);
DaySection.displayName = 'DaySection';

export const SidebarHistory = memo(function SidebarHistory({
  user,
}: {
  user: User | undefined;
}) {
  console.log('[SidebarHistory] Component rendering');

  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const chatId = typeof id === 'string' ? id : undefined;
  const router = useRouter();
  const pathname = usePathname();

  // Use the refactored useChatHistory hook instead of context
  const {
    groupedChats: chatGroups,
    hasEmptyChatHistory,
    isChatLoading,
    expandedDays,
    expandedChatCounts,
    toggleDayExpansion,
    toggleChatCountExpansion,
    deleteId,
    showDeleteDialog,
    isPending,
    initDeleteChat,
    cancelDeleteChat,
    confirmDeleteChat,
    mutateChatHistory,
  } = useChatHistory(chatId);

  // Log fetched sidebar chats information
  useEffect(() => {
    console.log('[SidebarHistory] Current sidebar state:', {
      hasChats: !hasEmptyChatHistory,
      isLoading: isChatLoading,
      chatGroups: chatGroups
        ? {
            today: chatGroups.today?.length || 0,
            yesterday: chatGroups.yesterday?.length || 0,
            lastWeek: chatGroups.lastWeek?.length || 0,
            lastMonth: chatGroups.lastMonth?.length || 0,
            older: chatGroups.older?.length || 0,
          }
        : null,
    });
  }, [hasEmptyChatHistory, isChatLoading, chatGroups]);

  // Handle loading state
  if (isChatLoading) {
    return (
      <div className="p-8 text-center">
        <RotateCw className="h-4 w-4 animate-spin mx-auto" />
      </div>
    );
  }

  // Handle case where there are no chats
  if (hasEmptyChatHistory || !chatGroups) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No chat history
      </div>
    );
  }

  return (
    <>
      <SidebarMenu>
        <div className="px-1 my-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1 px-2">
            Recent Chats
            <button
              type="button"
              onClick={() => mutateChatHistory()}
              className="p-1 hover:bg-muted rounded-sm"
              title="Refresh chat history"
            >
              <RotateCw
                className={`h-3 w-3 ${isChatLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
          <DaySection
            day="today"
            title="Today"
            chats={chatGroups.today}
            isExpanded={expandedDays.today}
            isCountExpanded={expandedChatCounts.today}
            onToggleExpansion={toggleDayExpansion}
            onToggleCountExpansion={toggleChatCountExpansion}
            onDelete={initDeleteChat}
            setOpenMobile={setOpenMobile}
            currentChatId={chatId}
          />
          <DaySection
            day="yesterday"
            title="Yesterday"
            chats={chatGroups.yesterday}
            isExpanded={expandedDays.yesterday}
            isCountExpanded={expandedChatCounts.yesterday}
            onToggleExpansion={toggleDayExpansion}
            onToggleCountExpansion={toggleChatCountExpansion}
            onDelete={initDeleteChat}
            setOpenMobile={setOpenMobile}
            currentChatId={chatId}
          />
          <DaySection
            day="lastWeek"
            title="Last 7 Days"
            chats={chatGroups.lastWeek}
            isExpanded={expandedDays.lastWeek}
            isCountExpanded={expandedChatCounts.lastWeek}
            onToggleExpansion={toggleDayExpansion}
            onToggleCountExpansion={toggleChatCountExpansion}
            onDelete={initDeleteChat}
            setOpenMobile={setOpenMobile}
            currentChatId={chatId}
          />
          <DaySection
            day="lastMonth"
            title="Last 30 Days"
            chats={chatGroups.lastMonth}
            isExpanded={expandedDays.lastMonth}
            isCountExpanded={expandedChatCounts.lastMonth}
            onToggleExpansion={toggleDayExpansion}
            onToggleCountExpansion={toggleChatCountExpansion}
            onDelete={initDeleteChat}
            setOpenMobile={setOpenMobile}
            currentChatId={chatId}
          />
          <DaySection
            day="older"
            title="Older"
            chats={chatGroups.older}
            isExpanded={expandedDays.older}
            isCountExpanded={expandedChatCounts.older}
            onToggleExpansion={toggleDayExpansion}
            onToggleCountExpansion={toggleChatCountExpansion}
            onDelete={initDeleteChat}
            setOpenMobile={setOpenMobile}
            currentChatId={chatId}
          />
        </div>
      </SidebarMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={cancelDeleteChat}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              chat and remove all messages from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteChat}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteChat}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
