import { useCallback, useState } from 'react';
import type { Attachment } from 'ai';
import { toast } from 'sonner';

export interface FileUploadResult {
  filename: string;
  contentType: string;
  url: string;
  extractedText: string;
}

interface UseFileUploadOptions {
  onFileProcessed?: (fileMeta: FileUploadResult) => void;
}

export function useFileUpload({ onFileProcessed }: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback(
    async (files: FileList | File[]): Promise<Attachment[]> => {
      const fileArray = Array.from(files);
      if (!fileArray || fileArray.length === 0) return [];

      setIsUploading(true);
      const newAttachments: Array<Attachment> = [];

      try {
        for (const file of fileArray) {
          console.log('[useFileUpload] Processing file:', {
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
          console.log('[useFileUpload] File uploaded:', uploadResult);

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
              '[useFileUpload] Extraction failed, using basic metadata:',
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
              const fallbackData = {
                filename: file.name,
                contentType: file.type,
                url: uploadResult.url,
                extractedText: `File uploaded: ${file.name} (${file.type})`,
              };

              console.log(
                '🔍 [DEBUG] useFileUpload calling onFileProcessed (FALLBACK) with:',
                {
                  filename: fallbackData.filename,
                  contentType: fallbackData.contentType,
                  url: fallbackData.url,
                  extractedText: fallbackData.extractedText,
                  reason: 'Extraction failed, using basic metadata',
                },
              );

              onFileProcessed(fallbackData);
            }
          } else {
            const extractResult = await extractResponse.json();
            console.log('[useFileUpload] File extracted:', extractResult);

            const attachment: Attachment = {
              name: file.name,
              url: uploadResult.url,
              contentType: file.type,
            };
            newAttachments.push(attachment);

            // Notify parent with extracted content
            if (onFileProcessed) {
              const fileData = {
                filename: file.name,
                contentType: file.type,
                url: uploadResult.url,
                extractedText:
                  extractResult.extractedContent ||
                  extractResult.extractedText ||
                  '',
              };

              console.log(
                '🔍 [DEBUG] useFileUpload calling onFileProcessed with:',
                {
                  filename: fileData.filename,
                  contentType: fileData.contentType,
                  url: fileData.url,
                  hasExtractedText: !!fileData.extractedText,
                  extractedTextLength: fileData.extractedText?.length || 0,
                  extractedTextPreview:
                    fileData.extractedText?.substring(0, 200) || 'No text',
                },
              );

              onFileProcessed(fileData);
            }
          }
        }

        if (newAttachments.length > 0) {
          toast.success(
            `${newAttachments.length} file(s) uploaded successfully`,
          );
        } else {
          toast.warning('Files were processed but no attachments were created');
        }

        return newAttachments;
      } catch (error) {
        console.error('[useFileUpload] File upload error:', error);
        toast.error(
          error instanceof Error ? error.message : 'File upload failed',
        );
        return [];
      } finally {
        setIsUploading(false);
      }
    },
    [onFileProcessed],
  );

  return {
    handleFileUpload,
    isUploading,
  };
}
