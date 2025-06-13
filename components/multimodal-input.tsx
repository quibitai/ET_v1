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
} from 'react';
import { SendButton, StopButton } from './chat-buttons';
import { AttachmentsButton } from './attachments-button';
import { PreviewAttachment } from './preview-attachment';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

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
}

function PureMultimodalInput({
  input,
  setInput,
  status,
  stop,
  className,
  onSubmit,
  onFileProcessed,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (!files || files.length === 0) return;

      setIsUploading(true);
      const newAttachments: Array<Attachment> = [];

      try {
        for (const file of Array.from(files)) {
          console.log('[MultimodalInput] Processing file:', {
            name: file.name,
            type: file.type,
            size: file.size,
          });

          // First upload to blob storage
          const formData = new FormData();
          formData.append('file', file);

          const uploadResponse = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Upload failed');
          }

          const uploadResult = await uploadResponse.json();
          console.log('[MultimodalInput] File uploaded:', uploadResult);

          // Then extract content via n8n
          const extractResponse = await fetch('/api/files/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileUrl: uploadResult.url,
              filename: file.name,
              contentType: file.type,
            }),
          });

          if (!extractResponse.ok) {
            const errorData = await extractResponse.json();
            console.warn(
              '[MultimodalInput] Extraction failed, using basic metadata:',
              errorData,
            );

            // Fallback: use basic file metadata
            const attachment: Attachment = {
              name: file.name,
              url: uploadResult.url,
              contentType: file.type,
            };
            newAttachments.push(attachment);

            // Notify parent with basic metadata
            if (onFileProcessed) {
              onFileProcessed({
                filename: file.name,
                contentType: file.type,
                url: uploadResult.url,
                extractedText: `File uploaded: ${file.name} (${file.type})`,
              });
            }
          } else {
            const extractResult = await extractResponse.json();
            console.log('[MultimodalInput] File extracted:', extractResult);

            const attachment: Attachment = {
              name: file.name,
              url: uploadResult.url,
              contentType: file.type,
            };
            newAttachments.push(attachment);

            // Notify parent with extracted content
            if (onFileProcessed) {
              onFileProcessed({
                filename: file.name,
                contentType: file.type,
                url: uploadResult.url,
                extractedText:
                  extractResult.extractedContent ||
                  extractResult.extractedText ||
                  '',
              });
            }
          }
        }

        setAttachments((prev) => [...prev, ...newAttachments]);
        toast.success(`${files.length} file(s) uploaded successfully`);
      } catch (error) {
        console.error('[MultimodalInput] File upload error:', error);
        toast.error(
          error instanceof Error ? error.message : 'File upload failed',
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onFileProcessed],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFileUpload(files);
      }
      // Reset the input so the same file can be selected again
      e.target.value = '';
    },
    [handleFileUpload],
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
      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="flex w-full flex-wrap gap-2 p-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${attachment.url}`}
              className="relative group"
            >
              <PreviewAttachment
                attachment={attachment}
                isUploading={isUploading && index === attachments.length - 1}
              />
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex w-full items-end gap-2">
        <div className="flex-1 relative">
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
                handleSubmit();
              }
            }}
            disabled={!isReady}
          />

          <div className="absolute bottom-0 right-0 p-2">
            {status === 'submitted' || status === 'streaming' ? (
              <StopButton stop={stop} />
            ) : (
              <SendButton
                isReady={
                  isReady && (input.trim().length > 0 || attachments.length > 0)
                }
              />
            )}
          </div>
        </div>

        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
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
}

export const MultimodalInput = memo(PureMultimodalInput);
