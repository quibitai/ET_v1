'use client';

import type { Attachment, UIMessage } from 'ai';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatHeader } from '@/components/chat-header';

import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';

import { useChatPane } from '@/context/ChatPaneContext';
import React from 'react';

// Define the ChatRequestOptions interface based on the actual structure
interface ChatRequestOptions {
  headers?: Record<string, string> | Headers;
  body?: object;
  data?: any;
  experimental_attachments?: FileList | Array<Attachment>;
  allowEmptySubmit?: boolean;
}

// Extend UIMessage with an optional __saved property
interface EnhancedUIMessage extends Omit<UIMessage, 'createdAt'> {
  __saved?: boolean;
  attachments?: Array<Attachment>;
  createdAt?: string | number | Date;
}

// --- File Context State (Hybrid Approach) ---
interface FileContext {
  filename: string;
  contentType: string;
  url: string;
  extractedText: string;
}

// Inline SVG for clear (X) icon
const XCircleIcon = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className || ''}
    height="1em"
    width="1em"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export function Chat({
  id,
  initialMessages: initialMessagesFromProps,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  // Access the ChatPaneContext to use the shared chat state and centralized artifact state
  const {
    setMainUiChatId,
    chatState,
    currentActiveSpecialistId,
    globalPaneChatId,
    submitMessage,
  } = useChatPane();

  // --- NO MORE LOCAL useArtifact() HOOK ---

  const {
    messages,
    input,
    isLoading,
    error,
    append,
    data,
    setInput,
    setMessages,
    stop,
    reload,
  } = chatState;

  useEffect(() => {
    if (id) setMainUiChatId(id);
  }, [id, setMainUiChatId]);

  useEffect(() => {
    if (
      initialMessagesFromProps &&
      initialMessagesFromProps.length > 0 &&
      messages.length === 0
    ) {
      setMessages(initialMessagesFromProps);
    }
  }, [initialMessagesFromProps, messages.length, setMessages]);

  // --- REMOVE the local useEffect that processes `data` for artifacts ---
  // This is now handled globally in ChatPaneContext.

  // Add state for attachments for MultimodalInput
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Add state for file context to pass to AI
  const [fileContext, setFileContext] = useState<FileContext | null>(null);

  // Add file processed callback
  const handleFileProcessed = useCallback(
    (fileMeta: {
      filename: string;
      contentType: string;
      url: string;
      extractedText: string;
    }) => {
      console.log('[Chat] File processed:', fileMeta);
      setFileContext({
        filename: fileMeta.filename,
        contentType: fileMeta.contentType,
        url: fileMeta.url,
        extractedText: fileMeta.extractedText,
      });
    },
    [],
  );

  // Clear file context when starting a new message (after successful submit)
  const clearFileContext = useCallback(() => {
    setFileContext(null);
  }, []);

  const handleSubmitFromUi = useCallback(async () => {
    if (!input.trim()) return;

    const currentInputVal = input.trim();
    const currentFileContext = fileContext;
    setInput('');

    // No artifact context needed anymore

    try {
      await submitMessage({
        message: currentInputVal,
        data: {
          fileContext: currentFileContext,
          artifactContext: null,
          collapsedArtifactsContext: null,
          id: id,
          chatId: id,
        },
      });

      // Clear file context after successful submission
      clearFileContext();
    } catch (err) {
      console.error('[Chat] Error in handleSubmitFromUi:', err);
      setInput(currentInputVal);
      // Don't clear file context on error so user can retry
    }
  }, [input, setInput, submitMessage, id, fileContext, clearFileContext]);

  // JSX rendering part
  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <div className="flex-1 min-h-0">
          <Messages
            chatId={id}
            status={isLoading ? 'streaming' : error ? 'error' : 'ready'}
            messages={messages}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isArtifactVisible={false}
            votes={undefined}
          />
        </div>
        <form
          className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitFromUi();
          }}
        >
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmitFromUi}
              status={isLoading ? 'streaming' : error ? 'error' : 'ready'}
              stop={stop}
              messages={messages}
              setMessages={setMessages}
              append={append}
              attachments={attachments}
              setAttachments={setAttachments}
              onFileProcessed={handleFileProcessed}
            />
          )}
        </form>
      </div>
    </>
  );
}
