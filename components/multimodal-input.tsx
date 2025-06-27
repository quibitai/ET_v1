'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { Attachment } from 'ai';
import {
  type ChangeEvent,
  useRef,
  useEffect,
  memo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { SendButton, StopButton } from './chat-buttons';
import { AttachmentsButton } from './attachments-button';
import { FilePill } from './file-pill';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/use-file-upload';

interface MultimodalInputProps
  extends Pick<UseChatHelpers, 'input' | 'setInput' | 'status' | 'stop'> {
  className?: string;
  onSubmit?: () => void;
  onFileProcessed?: (fileMeta: {
    filename: string;
    contentType: string;
    url: string;
    extractedText: string;
  }) => void;
  onAddAttachments?: (attachments: Attachment[]) => void;
}

export interface MultimodalInputRef {
  addAttachments: (attachments: Attachment[]) => void;
}

const PureMultimodalInput = forwardRef<
  MultimodalInputRef,
  MultimodalInputProps
>(
  (
    {
      input,
      setInput,
      status,
      stop,
      className,
      onSubmit,
      onFileProcessed,
      onAddAttachments,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<Array<Attachment>>([]);

    // Use shared file upload hook
    const { handleFileUpload, isUploading } = useFileUpload({
      onFileProcessed,
    });

    // Expose addAttachments function via ref
    useImperativeHandle(
      ref,
      () => ({
        addAttachments: (newAttachments: Attachment[]) => {
          setAttachments((prev) => [...prev, ...newAttachments]);
          if (onAddAttachments) {
            onAddAttachments(newAttachments);
          }
        },
      }),
      [onAddAttachments],
    );

    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

    const isReady = status === 'ready';

    // Debug logging for status changes
    useEffect(() => {
      console.log('[MultimodalInput] Status changed:', {
        status,
        isReady,
        timestamp: new Date().toISOString(),
      });
    }, [status, isReady]);

    // Handle file upload and attachment management
    const handleFileUploadWithAttachments = useCallback(
      async (files: FileList) => {
        const newAttachments = await handleFileUpload(files);
        setAttachments((prev) => [...prev, ...newAttachments]);
      },
      [handleFileUpload],
    );

    const handleFileInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
          handleFileUploadWithAttachments(files);
        }
        // Reset the input so the same file can be selected again
        e.target.value = '';
      },
      [handleFileUploadWithAttachments],
    );

    const removeAttachment = useCallback((index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSubmit = useCallback(() => {
      if (!isReady) {
        toast.error('Please wait for the previous request to complete.');
        return;
      }

      if (input.trim() || attachments.length > 0) {
        onSubmit?.();
        // Clear attachments after submit
        setAttachments([]);
      }
    }, [isReady, input, attachments.length, onSubmit]);

    return (
      <div className="relative flex w-full flex-col items-center justify-center gap-y-2 rounded-2xl border bg-background p-2 transition-all">
        {/* File attachments preview - compact pills */}
        {attachments.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 px-3 py-2">
            {attachments.map((attachment, index) => (
              <FilePill
                key={`${attachment.name}-${attachment.url}`}
                filename={attachment.name || 'Unknown file'}
                contentType={
                  attachment.contentType || 'application/octet-stream'
                }
                url={attachment.url}
                size="sm"
                showRemove={true}
                onRemove={() => removeAttachment(index)}
                className={
                  isUploading && index === attachments.length - 1
                    ? 'opacity-60'
                    : ''
                }
              />
            ))}
          </div>
        )}

        <div className="flex w-full items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              rows={1}
              name="message"
              value={input}
              placeholder="Ask a question..."
              className="min-h-[60px] w-full resize-none border-0 bg-background px-12 py-2 text-base focus-visible:ring-0"
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
                  handleSubmit();
                }
              }}
              disabled={!isReady}
            />

            {/* Plus sign (AttachmentsButton) in bottom left */}
            <div className="absolute bottom-1 left-1 p-1">
              <AttachmentsButton fileInputRef={fileInputRef} status={status} />
            </div>

            {/* Arrow (SendButton) in bottom right */}
            <div className="absolute bottom-1 right-1 p-1">
              {status === 'submitted' || status === 'streaming' ? (
                <StopButton stop={stop} />
              ) : (
                <SendButton
                  isReady={
                    isReady &&
                    (input.trim().length > 0 || attachments.length > 0)
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.pdf,.doc,.docx,.xls,.xlsx,.csv,.js,.ts,.py,.java,.c,.cpp,.html,.css,.png,.jpg,.jpeg,.gif,.webp"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    );
  },
);

PureMultimodalInput.displayName = 'PureMultimodalInput';

export const MultimodalInput = memo(PureMultimodalInput);
