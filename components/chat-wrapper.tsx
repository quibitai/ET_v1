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
    streamProtocol: 'data',

    onError: (error) => {
      console.error('🚨 [ChatWrapper useChat Error]', error);
    },
    experimental_prepareRequestBody: ({
      messages,
      requestData,
      requestBody,
    }) => {
      const body = {
        id: id,
        chatId: id,
        messages: messages,
        fileContext: fileContext, // This ensures the current fileContext is included
        artifactContext: null,
        collapsedArtifactsContext: null,
        activeBitContextId: activeBitContextId,
        ...requestBody, // Include any additional request body data
      };

      console.log('🔍 [DEBUG] experimental_prepareRequestBody called with:', {
        hasFileContext: !!fileContext,
        fileContextFilename: fileContext?.filename,
        messagesCount: messages.length,
        requestDataKeys: requestData ? Object.keys(requestData) : [],
        requestBodyKeys: requestBody ? Object.keys(requestBody) : [],
      });

      console.log('🔍 [DEBUG] Final body being returned:', {
        hasFileContext: !!body.fileContext,
        fileContextKeys: body.fileContext ? Object.keys(body.fileContext) : [],
        bodyKeys: Object.keys(body),
        fileContextPreview: body.fileContext
          ? {
              filename: body.fileContext.filename,
              contentType: body.fileContext.contentType,
              extractedTextLength: body.fileContext.extractedText?.length || 0,
            }
          : null,
      });

      return body;
    },
    onResponse: (response) => {
      console.log('📡 [ChatWrapper Response]', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        contentType: response.headers.get('content-type'),
      });
    },
    onFinish: (message) => {
      console.log('✅ [ChatWrapper Stream Finished]', {
        messageId: message.id,
        role: message.role,
        contentLength: message.content.length,
        status: 'completed',
        hadFileContextWhenFinished: !!fileContext,
      });
      // Clear file context after the request completes
      console.log('🔍 [DEBUG] Clearing fileContext after stream completion');
      clearFileContext();
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

  // Debug status changes specifically
  useEffect(() => {
    console.log('[ChatWrapper] Status changed:', {
      status,
      isLoading,
      timestamp: new Date().toISOString(),
    });
  }, [status, isLoading]);

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
      console.log('🔍 [DEBUG] Setting fileContext:', {
        filename: fileMeta.filename,
        contentType: fileMeta.contentType,
        url: fileMeta.url,
        hasExtractedText: !!fileMeta.extractedText,
        extractedTextLength: fileMeta.extractedText?.length || 0,
        extractedTextPreview:
          fileMeta.extractedText?.substring(0, 200) || 'No text',
      });
      setFileContext(fileMeta);
    },
    [],
  );

  const clearFileContext = useCallback(() => {
    setFileContext(null);
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('🔍 [DEBUG] Form submit with fileContext:', {
      hasFileContext: !!fileContext,
      fileContextFilename: fileContext?.filename,
      inputLength: input.length,
      inputPreview: input.substring(0, 100),
      fullFileContext: fileContext, // Log the complete object
    });

    // Also log what will be sent in the body
    console.log('🔍 [DEBUG] useChat body will contain:', {
      id: id,
      chatId: id,
      fileContext: fileContext,
      hasFileContextInBody: !!fileContext,
      activeBitContextId: activeBitContextId,
    });

    handleSubmit();
    // Don't clear file context immediately - let it be available for the request
    // clearFileContext();
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
      onFileProcessed={handleFileProcessed}
    />
  );
}
