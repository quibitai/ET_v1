'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { Attachment } from 'ai';
import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput, type MultimodalInputRef } from './multimodal-input';
import { SuggestedActions } from './suggested-actions';
import type { VisibilityType } from './visibility-selector';

// We no longer need FileContext here, it's handled in the wrapper
// We also simplify the props significantly

export interface ChatRef {
  addAttachments: (attachments: Attachment[]) => void;
}

interface ChatProps
  extends Pick<
    UseChatHelpers,
    | 'messages'
    | 'input'
    | 'setInput'
    | 'isLoading'
    | 'error'
    | 'data'
    | 'setMessages'
    | 'stop'
    | 'reload'
    | 'status'
    | 'handleSubmit'
    | 'append'
  > {
  id: string;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  currentActiveSpecialistId?: string;
  setCurrentActiveSpecialistId: (id: string) => void;
  isCurrentChatCommitted: boolean;
  onFileProcessed?: (fileMeta: {
    filename: string;
    contentType: string;
    url: string;
    extractedText: string;
  }) => void;
}

export const Chat = forwardRef<ChatRef, ChatProps>(
  (
    {
      id,
      selectedChatModel,
      selectedVisibilityType,
      isReadonly,
      currentActiveSpecialistId,
      setCurrentActiveSpecialistId,
      isCurrentChatCommitted,
      messages,
      input,
      setInput,
      isLoading,
      error,
      data,
      setMessages,
      stop,
      reload,
      status,
      handleSubmit,
      append,
      onFileProcessed,
    },
    ref,
  ) => {
    const multimodalInputRef = useRef<MultimodalInputRef>(null);

    // Expose addAttachments function via ref
    useImperativeHandle(
      ref,
      () => ({
        addAttachments: (attachments: Attachment[]) => {
          multimodalInputRef.current?.addAttachments(attachments);
        },
      }),
      [],
    );
    return (
      <>
        <div className="flex flex-col min-w-0 h-dvh bg-background">
          <ChatHeader
            chatId={id}
            selectedModelId={selectedChatModel}
            selectedVisibilityType={selectedVisibilityType}
            isReadonly={isReadonly}
            currentActiveSpecialistId={currentActiveSpecialistId}
            setCurrentActiveSpecialistId={setCurrentActiveSpecialistId}
            isCurrentChatCommitted={isCurrentChatCommitted}
          />

          <div className="flex-1 min-h-0">
            <Messages
              chatId={id}
              status={status}
              messages={messages}
              streamData={data}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              isArtifactVisible={false}
              votes={undefined}
            />
          </div>
          <form
            className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col w-full gap-4">
              {!isReadonly && messages.length === 0 && (
                <SuggestedActions chatId={id} append={append} />
              )}
              {!isReadonly && (
                <MultimodalInput
                  ref={multimodalInputRef}
                  input={input}
                  setInput={setInput}
                  status={status}
                  stop={stop}
                  onSubmit={() => {
                    if (input.trim()) {
                      handleSubmit();
                    }
                  }}
                  onFileProcessed={onFileProcessed}
                />
              )}
            </div>
          </form>
        </div>
      </>
    );
  },
);

Chat.displayName = 'Chat';
