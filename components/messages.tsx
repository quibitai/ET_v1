import type { Message, UseChatHelpers } from '@ai-sdk/react';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Greeting } from './greeting';
import { memo, useEffect, useCallback, useRef } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';

interface MessagesProps {
  chatId: string;
  status: 'error' | 'submitted' | 'streaming' | 'ready';
  votes: Array<Vote> | undefined;
  messages: Array<Message>;
  streamData?: any[];
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages(props: MessagesProps) {
  const {
    chatId,
    status,
    votes,
    messages,
    streamData,
    setMessages,
    reload,
    isReadonly,
    isArtifactVisible,
  } = props;

  // Debug logging for status (only when status changes)
  const prevStatusRef = useRef(status);
  if (prevStatusRef.current !== status) {
    console.log(
      `[Messages] Status changed: ${prevStatusRef.current} → ${status}, Messages count: ${messages.length}`,
    );
    if (messages.length > 0) {
      console.log(
        `[Messages] Last message role: ${messages[messages.length - 1].role}`,
      );
    }
    prevStatusRef.current = status;
  }

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  // Simple event handling that doesn't interfere with scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      // Just set tabindex for keyboard accessibility
      container.setAttribute('tabindex', '-1');
    }
  }, [messagesContainerRef]);

  const handleArtifactExpand = useCallback(async (artifactId: string) => {
    console.log(
      '[Messages] handleArtifactExpand called with ID (no-op):',
      artifactId,
    );
    // Artifact functionality removed
  }, []);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 h-full overflow-y-auto overflow-x-hidden pt-4 focus:outline-none"
      tabIndex={-1}
    >
      {messages.length === 0 && <Greeting />}

      {messages.map((message, index) => {
        const isLastMessage = messages.length - 1 === index;
        const isLoading = status === 'streaming' && isLastMessage;

        return (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message}
            isLoading={isLoading}
            streamData={isLoading ? streamData : undefined}
            vote={
              votes
                ? votes.find((vote) => vote.messageId === message.id)
                : undefined
            }
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            onArtifactExpand={handleArtifactExpand}
          />
        );
      })}

      {status === 'submitted' && <ThinkingMessage />}

      <div ref={messagesEndRef} className="shrink-0 min-h-[24px]" />
    </div>
  );
}

// Re-enable memoization for Messages with deep comparison
export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (!equal(prevProps.streamData, nextProps.streamData)) return false;

  return true;
});
