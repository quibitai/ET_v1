'use client';

import { useChat, type Message } from '@ai-sdk/react';
import { generateUUID } from '@/lib/utils';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Chat } from './chat';
import type { VisibilityType } from './visibility-selector';

// Define FileContext here since it's not in lib/types
type FileContext = {
  filename: string;
  contentType: string;
  url: string;
  extractedText: string;
};

interface ChatWrapperProps {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  activeBitContextId?: string;
}

export function ChatWrapper({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
  activeBitContextId,
}: ChatWrapperProps) {
  // Debug logging for initialization (reduced to prevent spam)
  const logKeyRef = useRef(`${id}-${initialMessages.length}`);
  const currentLogKey = `${id}-${initialMessages.length}`;

  if (logKeyRef.current !== currentLogKey) {
    console.log('[ChatWrapper] Initializing with:', {
      id,
      initialMessagesCount: initialMessages.length,
      selectedChatModel,
      selectedVisibilityType,
      isReadonly,
    });
    logKeyRef.current = currentLogKey;
  }

  const [fileContext, setFileContext] = useState<FileContext | null>(null);

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
    status,
    handleSubmit,
  } = useChat({
    id,
    api: '/api/brain',
    initialMessages,
    generateId: generateUUID,
    sendExtraMessageFields: true,
    body: {
      id: id,
      chatId: id,
      fileContext: fileContext,
      artifactContext: null,
      collapsedArtifactsContext: null,
      activeBitContextId: activeBitContextId,
    },
  });

  // Specialist state management (moved from ChatPaneContext)
  const [currentActiveSpecialistId, setCurrentActiveSpecialistId] =
    useState<string>(activeBitContextId || 'echo-tango-specialist');

  // Check if current chat is committed (has messages)
  const isCurrentChatCommitted = messages.length > 0;

  // Reduced logging to prevent infinite spam
  const stateLogRef = useRef('');
  const currentStateLog = `${messages.length}-${status}-${isLoading}`;

  if (stateLogRef.current !== currentStateLog) {
    console.log('[ChatWrapper] useChat hook state:', {
      messagesCount: messages.length,
      status,
      isLoading,
      inputLength: input.length,
      error: error ? error.message : null,
    });
    stateLogRef.current = currentStateLog;
  }

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error('[ChatWrapper] useChat error:', error);
    }
  }, [error]);

  // Debug messages changes (only log count to avoid infinite loops)
  useEffect(() => {
    console.log('[ChatWrapper] Messages count changed:', messages.length);
  }, [messages.length]);

  // Sync initial messages when they change
  useEffect(() => {
    console.log('[ChatWrapper] useEffect triggered:', {
      initialMessagesLength: initialMessages.length,
      currentMessagesLength: messages.length,
      shouldSetMessages: initialMessages.length > 0 && messages.length === 0,
    });

    if (
      initialMessages &&
      initialMessages.length > 0 &&
      messages.length === 0
    ) {
      console.log('[ChatWrapper] Setting initial messages:', initialMessages);
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  const handleFileProcessed = useCallback(
    (fileMeta: {
      filename: string;
      contentType: string;
      url: string;
      extractedText: string;
    }) => {
      console.log('[ChatWrapper] File processed:', fileMeta);
      setFileContext(fileMeta);
    },
    [],
  );

  const clearFileContext = useCallback(() => {
    setFileContext(null);
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit();
    clearFileContext();
  };

  // Reduced render logging to prevent spam
  const renderLogRef = useRef('');
  const currentRenderLog = `${messages.length}-${status}-${isLoading}-${!!fileContext}`;

  if (renderLogRef.current !== currentRenderLog) {
    console.log('[ChatWrapper] Rendering Chat component with:', {
      messagesCount: messages.length,
      status,
      isLoading,
      hasFileContext: !!fileContext,
    });
    renderLogRef.current = currentRenderLog;
  }

  // Pass all state and handlers as props to the Chat component
  return (
    <Chat
      id={id}
      selectedChatModel={selectedChatModel}
      selectedVisibilityType={selectedVisibilityType}
      isReadonly={isReadonly}
      currentActiveSpecialistId={currentActiveSpecialistId}
      setCurrentActiveSpecialistId={setCurrentActiveSpecialistId}
      isCurrentChatCommitted={isCurrentChatCommitted}
      messages={messages}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      error={error}
      data={data}
      setMessages={setMessages}
      stop={stop}
      reload={reload}
      status={status}
      handleSubmit={handleSubmit}
      append={append}
    />
  );
}
