'use client';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import React, { useEffect, useState, useMemo, memo } from 'react';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon, ChevronDown, CheckIcon } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvailableSpecialists } from '@/lib/ai/prompts/specialists';
import {
  CHAT_BIT_GENERAL_CONTEXT_ID,
  ECHO_TANGO_SPECIALIST_ID,
} from '@/lib/constants';
import { useChatCacheInvalidation } from '@/lib/utils/chatCacheInvalidation';

// Default option for general chat
const GENERAL_CHAT_OPTION = {
  id: CHAT_BIT_GENERAL_CONTEXT_ID,
  name: 'General Chat',
  description: 'General conversational assistant',
};

// Echo Tango specialist option
const ECHO_TANGO_OPTION = {
  id: ECHO_TANGO_SPECIALIST_ID,
  name: 'Echo Tango',
  description: 'Specialist for Echo Tango client',
};

// Memoize the SpecialistSelector component to prevent unnecessary re-renders
const SpecialistSelector = memo(
  ({
    currentActiveSpecialistId,
    setCurrentActiveSpecialistId,
    availableSpecialists,
    isCurrentChatCommitted,
  }: {
    currentActiveSpecialistId: string;
    setCurrentActiveSpecialistId: (id: string) => void;
    availableSpecialists: Array<{
      id: string;
      name: string;
      description: string;
    }>;
    isCurrentChatCommitted: boolean;
  }) => {
    // Debug log for dropdown state
    console.log('[SpecialistSelector] Render:', {
      currentActiveSpecialistId,
      isCurrentChatCommitted,
    });
    const handleSelection = (newSpecialistId: string) => {
      if (!isCurrentChatCommitted) {
        setCurrentActiveSpecialistId(newSpecialistId);
      }
    };
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isCurrentChatCommitted}>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 gap-1 ${isCurrentChatCommitted ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {availableSpecialists.find(
              (s) => s.id === currentActiveSpecialistId,
            )?.name || 'General Chat'}
            {!isCurrentChatCommitted && <ChevronDown className="size-3" />}
          </Button>
        </DropdownMenuTrigger>
        {!isCurrentChatCommitted && (
          <DropdownMenuContent align="start" className="w-[200px]">
            {availableSpecialists.map((specialist) => (
              <DropdownMenuItem
                key={specialist.id}
                onClick={() => handleSelection(specialist.id)}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span>{specialist.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {specialist.description}
                  </span>
                </div>
                {currentActiveSpecialistId === specialist.id && (
                  <CheckIcon className="size-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  },
);
SpecialistSelector.displayName = 'SpecialistSelector';

// Memoize the mobile selector component
const MobileSpecialistSelector = memo(
  ({
    currentActiveSpecialistId,
    setCurrentActiveSpecialistId,
    availableSpecialists,
    isCurrentChatCommitted,
  }: {
    currentActiveSpecialistId: string;
    setCurrentActiveSpecialistId: (id: string) => void;
    availableSpecialists: Array<{
      id: string;
      name: string;
      description: string;
    }>;
    isCurrentChatCommitted: boolean;
  }) => {
    // Debug log for mobile dropdown state
    console.log('[MobileSpecialistSelector] Render:', {
      currentActiveSpecialistId,
      isCurrentChatCommitted,
    });
    const handleSelection = (newSpecialistId: string) => {
      if (!isCurrentChatCommitted) {
        setCurrentActiveSpecialistId(newSpecialistId);
      }
    };
    return (
      <div className="flex md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isCurrentChatCommitted}>
            <Button
              variant="outline"
              className={`justify-between items-center w-full text-left ${isCurrentChatCommitted ? 'opacity-80 cursor-not-allowed' : ''}`}
              size="sm"
            >
              <span className="truncate">
                {availableSpecialists.find(
                  (s) => s.id === currentActiveSpecialistId,
                )?.name || 'General Chat'}
              </span>
              {!isCurrentChatCommitted && (
                <ChevronDown className="size-4 opacity-50" />
              )}
            </Button>
          </DropdownMenuTrigger>
          {!isCurrentChatCommitted && (
            <DropdownMenuContent
              align="end"
              className="w-[200px] max-h-[400px] overflow-y-auto"
            >
              {availableSpecialists.map((specialist) => (
                <DropdownMenuItem
                  key={specialist.id}
                  onClick={() => handleSelection(specialist.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span>{specialist.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {specialist.description}
                    </span>
                  </div>
                  {currentActiveSpecialistId === specialist.id && (
                    <CheckIcon className="size-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
    );
  },
);
MobileSpecialistSelector.displayName = 'MobileSpecialistSelector';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  currentActiveSpecialistId,
  setCurrentActiveSpecialistId,
  isCurrentChatCommitted,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  currentActiveSpecialistId?: string;
  setCurrentActiveSpecialistId: (id: string) => void;
  isCurrentChatCommitted: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();

  // Use state to store specialists
  const [specialists, setSpecialists] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
    }>
  >([]);

  // Memoize the available specialists from the registry
  const availableSpecialists = useMemo(() => {
    return specialists;
  }, [specialists]);

  // Coerce currentActiveSpecialistId to string for selector props
  const safeCurrentActiveSpecialistId =
    currentActiveSpecialistId || CHAT_BIT_GENERAL_CONTEXT_ID;

  // Debug log for header state
  console.log('[PureChatHeader] Render:', {
    currentActiveSpecialistId,
    isCurrentChatCommitted,
  });

  // Fetch specialists only once on component mount
  useEffect(() => {
    const loadSpecialists = async () => {
      try {
        // Get specialists from the registry (now has robust fallback built-in)
        const registeredSpecialists = await getAvailableSpecialists();
        console.log('[ChatHeader] Loaded specialists:', registeredSpecialists);
        setSpecialists(registeredSpecialists);
      } catch (error) {
        console.error('[ChatHeader] Error loading specialists:', error);
        // Final fallback if everything fails
        const emergencyFallback = [
          {
            id: 'echo-tango-specialist',
            name: 'Echo Tango',
            description: 'Creative agency brand voice specialist',
          },
          {
            id: 'chat-model',
            name: 'General Chat',
            description: 'General conversational assistant',
          },
        ];
        setSpecialists(emergencyFallback);
        console.warn('[ChatHeader] Using emergency fallback specialists');
      }
    };

    loadSpecialists();
  }, []);

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="md:px-2 px-2 md:h-fit"
            onClick={() => {
              // When creating a new chat, keep the current specialist selection
              // Don't force Echo Tango - let users choose their preferred specialist

              // Navigate to new chat - the cache will be invalidated when the first message is sent
              router.push('/');
              router.refresh();
            }}
          >
            <PlusIcon />
            <span className="md:sr-only">New Chat</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>New Chat</TooltipContent>
      </Tooltip>

      {/* Mobile specialist selector */}
      <MobileSpecialistSelector
        currentActiveSpecialistId={safeCurrentActiveSpecialistId}
        setCurrentActiveSpecialistId={setCurrentActiveSpecialistId}
        availableSpecialists={availableSpecialists}
        isCurrentChatCommitted={isCurrentChatCommitted}
      />

      {/* Desktop specialist selector */}
      {!isReadonly && selectedModelId === 'chat-model' && (
        <SpecialistSelector
          currentActiveSpecialistId={safeCurrentActiveSpecialistId}
          setCurrentActiveSpecialistId={setCurrentActiveSpecialistId}
          availableSpecialists={availableSpecialists}
          isCurrentChatCommitted={isCurrentChatCommitted}
        />
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-3"
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.currentActiveSpecialistId ===
      nextProps.currentActiveSpecialistId &&
    prevProps.isCurrentChatCommitted === nextProps.isCurrentChatCommitted
  );
});
