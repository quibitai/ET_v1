'use client';

import { useChat, type UseChatHelpers, type Message } from 'ai/react';
import { generateUUID } from '@/lib/utils';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Chat, type ChatRef } from '@/components/chat';
import type { VisibilityType } from './visibility-selector';
import { useChatCacheInvalidation } from '@/lib/utils/chatCacheInvalidation';
import { useChatHistory } from '@/hooks/use-chat-history';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { UIMessage } from '@/lib/types';
import { useDragAndDrop } from '@/hooks/use-drag-and-drop';
import { useFileUpload } from '@/hooks/use-file-upload';
import { DragOverlay } from '@/components/drag-overlay';

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

  // File context state
  const [fileContext, setFileContext] = useState<FileContext | null>(null);

  // Ref to access Chat component methods
  const chatRef = useRef<ChatRef>(null);

  // Global drag and drop for file uploads
  const { handleFileUpload: uploadFiles } = useFileUpload({
    onFileProcessed: (fileMeta) => {
      console.log(
        '[ChatWrapper] Global drag and drop file processed:',
        fileMeta,
      );
      setFileContext(fileMeta);
    },
  });

  const { isDragging } = useDragAndDrop({
    onFilesDropped: async (files) => {
      console.log('[ChatWrapper] Files dropped globally:', files);
      const attachments = await uploadFiles(files);

      // Add attachments to MultimodalInput to show pills
      if (attachments.length > 0 && chatRef.current) {
        console.log(
          '[ChatWrapper] Adding attachments to MultimodalInput:',
          attachments,
        );
        chatRef.current.addAttachments(attachments);
      }
    },
    disabled: isReadonly, // Disable drag and drop in readonly mode
  });

  // Store the first user message for title generation (using ref for immediate access)
  const firstUserMessageRef = useRef<string | null>(null);

  // FIXED: Add flag to prevent multiple onFinish callbacks
  const onFinishProcessedRef = useRef<Set<string>>(new Set());

  // Get cache invalidation functions
  const { addChatOptimistically } = useChatCacheInvalidation();

  // Get hook-specific mutate function for real-time sidebar updates
  const { mutateChatHistory } = useChatHistory();

  // Specialist state management (moved from ChatPaneContext)
  const [currentActiveSpecialistId, setCurrentActiveSpecialistId] =
    useState<string>(activeBitContextId || 'echo-tango-specialist');

  // Sync the current specialist ID with the active bit context for API calls
  const effectiveActiveBitContextId =
    currentActiveSpecialistId || activeBitContextId || 'echo-tango-specialist';

  // Update localStorage and cookie when specialist changes (for persistence across page loads)
  useEffect(() => {
    if (typeof window !== 'undefined' && currentActiveSpecialistId) {
      localStorage.setItem(
        'current-active-specialist',
        currentActiveSpecialistId,
      );

      // Also set cookie for server-side access
      document.cookie = `current-active-specialist=${currentActiveSpecialistId}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days

      console.log(
        '[ChatWrapper] Updated localStorage and cookie specialist:',
        currentActiveSpecialistId,
      );
    }
  }, [currentActiveSpecialistId]);

  const {
    messages,
    setMessages,
    input,
    setInput,
    append,
    reload,
    stop,
    isLoading,
    status,
    error,
    data,
    handleSubmit: originalHandleSubmit,
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
        fileContext: fileContext,
        artifactContext: null,
        collapsedArtifactsContext: null,
        activeBitContextId: effectiveActiveBitContextId,
        ...requestBody,
      };

      console.log('🔍 [DEBUG] experimental_prepareRequestBody called with:', {
        hasFileContext: !!fileContext,
        fileContextFilename: fileContext?.filename,
        messagesCount: messages.length,
        activeBitContextId: effectiveActiveBitContextId,
        currentActiveSpecialistId: currentActiveSpecialistId,
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
    onFinish: async (message) => {
      const messageKey = `${message.id}-${message.role}`;
      if (onFinishProcessedRef.current.has(messageKey)) {
        console.log(
          '[ChatWrapper] onFinish already processed for message:',
          messageKey,
        );
        return;
      }
      onFinishProcessedRef.current.add(messageKey);

      console.log('🎯 [ChatWrapper] onFinish callback triggered!', {
        chatId: id,
        messageRole: message.role,
      });

      const isNewChat =
        message.role === 'assistant' && initialMessages.length === 0;

      if (isNewChat) {
        setTimeout(async () => {
          try {
            console.log('[ChatWrapper] Starting async cache refresh...');
            await new Promise((resolve) => setTimeout(resolve, 100));
            await mutateChatHistory();
            console.log('[ChatWrapper] Cache refresh completed');
          } catch (error) {
            console.error(
              '[ChatWrapper] Failed to refresh chat history:',
              error,
            );
          }
        }, 0);
      }

      clearFileContext();

      setTimeout(() => {
        onFinishProcessedRef.current.delete(messageKey);
      }, 5000);
    },
  });

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

  // Sync initial messages when they change - FIXED: Use ref to prevent infinite loops
  const initialMessagesRef = useRef<Message[]>([]);
  const hasSetInitialMessages = useRef(false);

  useEffect(() => {
    // Only run if initial messages actually changed
    const messagesChanged = !initialMessages.every(
      (msg, index) => initialMessagesRef.current[index]?.id === msg.id,
    );

    if (messagesChanged) {
      initialMessagesRef.current = [...initialMessages];
      hasSetInitialMessages.current = false;
    }

    console.log('[ChatWrapper] useEffect triggered:', {
      initialMessagesLength: initialMessages.length,
      currentMessagesLength: messages.length,
      shouldSetMessages:
        initialMessages.length > 0 &&
        messages.length === 0 &&
        !hasSetInitialMessages.current,
      hasSetInitialMessages: hasSetInitialMessages.current,
    });

    if (
      initialMessages &&
      initialMessages.length > 0 &&
      messages.length === 0 &&
      !hasSetInitialMessages.current
    ) {
      console.log('[ChatWrapper] Setting initial messages:', initialMessages);
      setMessages(initialMessages);
      hasSetInitialMessages.current = true;
    }
  }, [initialMessages, messages.length, setMessages]);

  const handleFileProcessed = useCallback(
    (fileMeta: {
      filename: string;
      contentType: string;
      url: string;
      extractedText: string;
    }) => {
      console.log(
        '[ChatWrapper] File processed from MultimodalInput:',
        fileMeta,
      );
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

  // Wrapper function to capture user input before submission
  const handleSubmitWrapper = useCallback(
    (event?: { preventDefault?: () => void }, chatRequestOptions?: any) => {
      console.log('🚨 [WRAPPER] handleSubmit wrapper function called!', {
        timestamp: new Date().toISOString(),
        inputValue: input,
        messagesLength: messages.length,
      });

      // Debug: Check conditions before capture
      console.log('🔍 [DEBUG] Capture conditions check:', {
        messagesLength: messages.length,
        hasInput: !!input.trim(),
        inputValue: input,
        alreadyHasFirstMessage: !!firstUserMessageRef.current,
        refCurrentValue: firstUserMessageRef.current,
        shouldCapture:
          messages.length === 0 && input.trim() && !firstUserMessageRef.current,
      });

      // Capture the user input for title generation (only for new chats)
      if (messages.length === 0 && input.trim()) {
        console.log(
          '✅ [ChatWrapper] Captured user input for title generation:',
          input.trim(),
        );

        // Generate optimistic title from user input
        const words = input.trim().split(' ');
        let chatTitle = words.slice(0, 5).join(' ');
        if (chatTitle.length > 50) chatTitle = `${chatTitle.slice(0, 47)}...`;

        console.log('✅ [ChatWrapper] Creating optimistic chat:', {
          chatTitle,
          chatId: id,
        });

        // Add chat optimistically to sidebar
        addChatOptimistically({
          id,
          title: chatTitle,
          visibility: selectedVisibilityType,
          bitContextId: effectiveActiveBitContextId,
        }).catch((e) =>
          console.error('❌ [ChatWrapper] optimistic add failed:', e),
        );
      } else {
        console.log('❌ [ChatWrapper] NOT capturing user input because:', {
          messagesLength: messages.length,
          hasInput: !!input.trim(),
        });
      }

      console.log('🔍 [DEBUG] handleSubmit wrapper called with:', {
        messagesLength: messages.length,
        inputValue: input,
        inputTrimmed: input.trim(),
        hasInput: !!input.trim(),
        currentFirstUserMessage: firstUserMessageRef.current,
        shouldStoreMessage:
          messages.length === 0 && input.trim() && !firstUserMessageRef.current,
      });

      // If we have file context, add it as an attachment to the user message
      if (fileContext && input.trim()) {
        console.log('🔍 [DEBUG] Adding file attachment to user message:', {
          filename: fileContext.filename,
          contentType: fileContext.contentType,
          url: fileContext.url,
        });

        const userMessage = {
          role: 'user' as const,
          content: input,
          experimental_attachments: [
            {
              name: fileContext.filename,
              url: fileContext.url,
              contentType: fileContext.contentType,
            },
          ],
        };

        // Use append to add the message with attachments
        append(userMessage);
        setInput(''); // Clear the input manually since we're using append
        return;
      }

      // Call the original handleSubmit for regular messages
      return originalHandleSubmit(event, chatRequestOptions);
    },
    // FIXED: Stabilize dependencies to prevent infinite re-renders
    [
      messages.length,
      input,
      originalHandleSubmit,
      id,
      selectedVisibilityType,
      effectiveActiveBitContextId,
      addChatOptimistically,
    ],
  );

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
    <>
      <Chat
        ref={chatRef}
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
        handleSubmit={handleSubmitWrapper}
        append={append}
        onFileProcessed={handleFileProcessed}
      />

      {/* Global drag and drop overlay */}
      <DragOverlay isVisible={isDragging && !isReadonly} />
    </>
  );
}
