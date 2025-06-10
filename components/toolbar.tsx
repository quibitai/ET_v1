'use client';

import type { UseChatHelpers } from '@ai-sdk/react';

// Simplified toolbar without artifact functionality
export function Toolbar({
  isLoading,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  input,
  setInput,
}: {
  isLoading: boolean;
  stop: () => void;
  attachments: File[];
  setAttachments: (attachments: File[]) => void;
  append: UseChatHelpers['append'];
  messages: any[];
  setMessages: UseChatHelpers['setMessages'];
  input: string;
  setInput: (input: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border-t">
      <div className="text-sm text-muted-foreground">
        Toolbar simplified - artifact creation disabled
      </div>
    </div>
  );
}
