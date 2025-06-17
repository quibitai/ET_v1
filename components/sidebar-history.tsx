'use client';
import { useParams, useRouter, usePathname } from 'next/navigation';
import type { User } from 'next-auth';
import { useCallback, useEffect, memo, useState } from 'react';
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
import { ChevronDown, ChevronRight, Loader, Trash } from 'lucide-react';
import { useChatHistory } from '@/hooks/use-chat-history';
import type { GroupedChats, ChatSummary, ExpandedSections } from '@/lib/types';

const MAX_CHATS_PER_DAY = 5;

// Helper function to convert ChatSummary to Chat for ChatItem compatibility
const convertChatSummaryToChat = (chatSummary: ChatSummary): Chat => {
  return {
    id: chatSummary.id,
    title: chatSummary.title || 'Untitled Chat', // Handle null titles
    userId: chatSummary.userId,
    clientId: chatSummary.clientId,
    createdAt: new Date(chatSummary.createdAt),
    updatedAt: new Date(chatSummary.updatedAt),
    visibility: chatSummary.visibility,
    bitContextId: (chatSummary.bitContextId ?? null) as string | null, // Explicit type assertion
  };
};

const DaySection = memo(function DaySection({
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
  chats: ChatSummary[];
  isExpanded: boolean;
  isCountExpanded: boolean;
  onToggleExpansion: (day: keyof GroupedChats) => void;
  onToggleCountExpansion: (day: keyof GroupedChats) => void;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  currentChatId?: string;
}) {
  if (chats.length === 0) return null;

  const visibleChats = isCountExpanded
    ? chats
    : chats.slice(0, MAX_CHATS_PER_DAY);
  const hasMoreChats = chats.length > MAX_CHATS_PER_DAY;

  return (
    <div className="mb-1">
      <div
        className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={() => onToggleExpansion(day)}
      >
        <span className="flex items-center gap-1">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {title} ({chats.length})
        </span>
      </div>

      {isExpanded && (
        <div className="ml-2">
          {visibleChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={convertChatSummaryToChat(chat)}
              isActive={chat.id === currentChatId}
              onDelete={onDelete}
              setOpenMobile={setOpenMobile}
            />
          ))}

          {hasMoreChats && !isCountExpanded && (
            <div
              className="px-2 py-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => onToggleCountExpansion(day)}
            >
              Show {chats.length - MAX_CHATS_PER_DAY} more...
            </div>
          )}

          {hasMoreChats && isCountExpanded && (
            <div
              className="px-2 py-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => onToggleCountExpansion(day)}
            >
              Show less
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// New component for specialist sections
const SpecialistSection = memo(function SpecialistSection({
  specialistId,
  specialistChats,
  expandedDays,
  expandedChatCounts,
  onToggleExpansion,
  onToggleCountExpansion,
  onDelete,
  setOpenMobile,
  currentChatId,
}: {
  specialistId: string;
  specialistChats: GroupedChats;
  expandedDays: any;
  expandedChatCounts: any;
  onToggleExpansion: (day: keyof GroupedChats) => void;
  onToggleCountExpansion: (day: keyof GroupedChats) => void;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  currentChatId?: string;
}) {
  // Get specialist name (we'll improve this with proper mapping)
  const getSpecialistName = (id: string) => {
    switch (id) {
      case 'echo-tango-specialist':
        return 'Echo Tango';
      case 'chat-model':
        return 'General Chat';
      default:
        return id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const specialistName = getSpecialistName(specialistId);

  // Calculate total chats for this specialist
  const totalChats =
    specialistChats.today.length +
    specialistChats.yesterday.length +
    specialistChats.lastWeek.length +
    specialistChats.lastMonth.length +
    specialistChats.older.length;

  if (totalChats === 0) return null;

  return (
    <div className="mb-3">
      <div className="px-2 py-2 text-sm font-semibold text-foreground border-b border-border/50">
        {specialistName} ({totalChats})
      </div>

      <div className="ml-1 mt-1">
        <DaySection
          day="today"
          title="Today"
          chats={specialistChats.today}
          isExpanded={expandedDays.today}
          isCountExpanded={expandedChatCounts.today}
          onToggleExpansion={onToggleExpansion}
          onToggleCountExpansion={onToggleCountExpansion}
          onDelete={onDelete}
          setOpenMobile={setOpenMobile}
          currentChatId={currentChatId}
        />
        <DaySection
          day="yesterday"
          title="Yesterday"
          chats={specialistChats.yesterday}
          isExpanded={expandedDays.yesterday}
          isCountExpanded={expandedChatCounts.yesterday}
          onToggleExpansion={onToggleExpansion}
          onToggleCountExpansion={onToggleCountExpansion}
          onDelete={onDelete}
          setOpenMobile={setOpenMobile}
          currentChatId={currentChatId}
        />
        <DaySection
          day="lastWeek"
          title="Last 7 Days"
          chats={specialistChats.lastWeek}
          isExpanded={expandedDays.lastWeek}
          isCountExpanded={expandedChatCounts.lastWeek}
          onToggleExpansion={onToggleExpansion}
          onToggleCountExpansion={onToggleCountExpansion}
          onDelete={onDelete}
          setOpenMobile={setOpenMobile}
          currentChatId={currentChatId}
        />
        <DaySection
          day="lastMonth"
          title="Last 30 Days"
          chats={specialistChats.lastMonth}
          isExpanded={expandedDays.lastMonth}
          isCountExpanded={expandedChatCounts.lastMonth}
          onToggleExpansion={onToggleExpansion}
          onToggleCountExpansion={onToggleCountExpansion}
          onDelete={onDelete}
          setOpenMobile={setOpenMobile}
          currentChatId={currentChatId}
        />
        <DaySection
          day="older"
          title="Older"
          chats={specialistChats.older}
          isExpanded={expandedDays.older}
          isCountExpanded={expandedChatCounts.older}
          onToggleExpansion={onToggleExpansion}
          onToggleCountExpansion={onToggleCountExpansion}
          onDelete={onDelete}
          setOpenMobile={setOpenMobile}
          currentChatId={currentChatId}
        />
      </div>
    </div>
  );
});

const PAGE_SIZE = 20;

export const SidebarHistory = memo(function SidebarHistory({
  user,
}: {
  user: User | undefined;
}) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const chatId = typeof id === 'string' ? id : undefined;
  const router = useRouter();
  const pathname = usePathname();

  // Use the refactored useChatHistory hook instead of context
  const {
    groupedChats: chatGroups,
    groupedSpecialistChats,
    hasEmptyChatHistory,
    isLoadingChatHistory,
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

  // Add specialist-specific expansion states
  const [specialistExpandedDays, setSpecialistExpandedDays] = useState<
    Record<string, ExpandedSections>
  >({});
  const [specialistExpandedCounts, setSpecialistExpandedCounts] = useState<
    Record<string, ExpandedSections>
  >({});

  // Initialize expansion states for each specialist
  useEffect(() => {
    if (groupedSpecialistChats) {
      const specialists = Object.keys(groupedSpecialistChats);

      setSpecialistExpandedDays((prev) => {
        const newState = { ...prev };
        specialists.forEach((specialistId) => {
          if (!newState[specialistId]) {
            newState[specialistId] = {
              today: true,
              yesterday: false,
              lastWeek: false,
              lastMonth: false,
              older: false,
            };
          }
        });
        return newState;
      });

      setSpecialistExpandedCounts((prev) => {
        const newState = { ...prev };
        specialists.forEach((specialistId) => {
          if (!newState[specialistId]) {
            newState[specialistId] = {
              today: false,
              yesterday: false,
              lastWeek: false,
              lastMonth: false,
              older: false,
            };
          }
        });
        return newState;
      });
    }
  }, [groupedSpecialistChats]);

  // Specialist-specific toggle functions
  const toggleSpecialistDayExpansion = useCallback(
    (specialistId: string, day: keyof GroupedChats) => {
      setSpecialistExpandedDays((prev) => ({
        ...prev,
        [specialistId]: {
          ...prev[specialistId],
          [day]: !prev[specialistId]?.[day],
        },
      }));
    },
    [],
  );

  const toggleSpecialistCountExpansion = useCallback(
    (specialistId: string, day: keyof GroupedChats) => {
      setSpecialistExpandedCounts((prev) => ({
        ...prev,
        [specialistId]: {
          ...prev[specialistId],
          [day]: !prev[specialistId]?.[day],
        },
      }));
    },
    [],
  );

  // Handle loading state
  if (isLoadingChatHistory) {
    return (
      <div className="p-8 text-center">
        <Loader className="h-4 w-4 animate-spin mx-auto" />
      </div>
    );
  }

  // Handle case where there are no chats
  if (hasEmptyChatHistory || (!chatGroups && !groupedSpecialistChats)) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No chat history
      </div>
    );
  }

  // Determine which view to show
  const showSpecialistView =
    groupedSpecialistChats && Object.keys(groupedSpecialistChats).length > 0;

  // Order specialists: Echo Tango first, then General Chat, then others
  const getOrderedSpecialists = () => {
    if (!groupedSpecialistChats) return [];

    const specialists = Object.entries(groupedSpecialistChats);
    const ordered: Array<[string, GroupedChats]> = [];

    // First: Echo Tango
    const echoTango = specialists.find(
      ([id]) => id === 'echo-tango-specialist',
    );
    if (echoTango) ordered.push(echoTango);

    // Second: General Chat
    const generalChat = specialists.find(([id]) => id === 'chat-model');
    if (generalChat) ordered.push(generalChat);

    // Third: All others
    specialists.forEach(([id, chats]) => {
      if (id !== 'echo-tango-specialist' && id !== 'chat-model') {
        ordered.push([id, chats]);
      }
    });

    return ordered;
  };

  return (
    <>
      <SidebarMenu>
        <div className="px-1 my-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1 px-2">
            Recent Chats
          </div>

          {showSpecialistView ? (
            // New specialist-grouped view with proper ordering
            getOrderedSpecialists().map(([specialistId, specialistChats]) => (
              <SpecialistSection
                key={specialistId}
                specialistId={specialistId}
                specialistChats={specialistChats}
                expandedDays={
                  specialistExpandedDays[specialistId] || {
                    today: true,
                    yesterday: false,
                    lastWeek: false,
                    lastMonth: false,
                    older: false,
                  }
                }
                expandedChatCounts={
                  specialistExpandedCounts[specialistId] || {
                    today: false,
                    yesterday: false,
                    lastWeek: false,
                    lastMonth: false,
                    older: false,
                  }
                }
                onToggleExpansion={(day) =>
                  toggleSpecialistDayExpansion(specialistId, day)
                }
                onToggleCountExpansion={(day) =>
                  toggleSpecialistCountExpansion(specialistId, day)
                }
                onDelete={initDeleteChat}
                setOpenMobile={setOpenMobile}
                currentChatId={chatId}
              />
            ))
          ) : (
            // Fallback to original grouped view
            <>
              <DaySection
                day="today"
                title="Today"
                chats={chatGroups?.today || []}
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
                chats={chatGroups?.yesterday || []}
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
                chats={chatGroups?.lastWeek || []}
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
                chats={chatGroups?.lastMonth || []}
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
                chats={chatGroups?.older || []}
                isExpanded={expandedDays.older}
                isCountExpanded={expandedChatCounts.older}
                onToggleExpansion={toggleDayExpansion}
                onToggleCountExpansion={toggleChatCountExpansion}
                onDelete={initDeleteChat}
                setOpenMobile={setOpenMobile}
                currentChatId={chatId}
              />
            </>
          )}
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
