'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import { type ChangeEvent, useRef, useEffect, memo } from 'react';
import { SendButton, StopButton } from './chat-buttons';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface MultimodalInputProps
  extends Pick<UseChatHelpers, 'input' | 'setInput' | 'status' | 'stop'> {
  className?: string;
  onSubmit?: () => void;
}

function PureMultimodalInput({
  input,
  setInput,
  status,
  stop,
  className,
  onSubmit,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const isReady = status === 'ready';

  return (
    <div className="relative flex w-full flex-col items-center justify-center gap-y-2 rounded-2xl border bg-background p-2 transition-all">
      <Textarea
        ref={textareaRef}
        rows={1}
        name="message"
        value={input}
        placeholder="Ask a question..."
        className="min-h-[60px] w-full resize-none border-0 bg-background px-4 py-2 pr-16 text-base focus-visible:ring-0"
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setInput(e.target.value)
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!isReady) {
              toast.error('Please wait for the previous request to complete.');
            } else if (input.trim() && onSubmit) {
              onSubmit();
            }
          }
        }}
        disabled={!isReady}
      />

      <div className="absolute bottom-0 right-0 p-2">
        {status === 'submitted' || status === 'streaming' ? (
          <StopButton stop={stop} />
        ) : (
          <SendButton isReady={isReady && input.trim().length > 0} />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(PureMultimodalInput);
