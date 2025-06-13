'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import React from 'react';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SuggestedActions } from './suggested-actions';
import type { VisibilityType } from './visibility-selector';

// We no longer need FileContext here, it's handled in the wrapper
// We also simplify the props significantly

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

export function Chat({
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
}: ChatProps) {
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
}
