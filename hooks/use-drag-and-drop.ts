import { useCallback, useEffect, useState, useRef } from 'react';

interface UseDragAndDropOptions {
  onFilesDropped?: (files: FileList) => void;
  acceptedTypes?: string[];
  disabled?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = [
  '.txt',
  '.md',
  '.json',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.js',
  '.ts',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.html',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
];

export function useDragAndDrop({
  onFilesDropped,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
}: UseDragAndDropOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const dragCounterRef = useRef(0);

  const isValidFile = useCallback(
    (file: File): boolean => {
      if (!acceptedTypes.length) return true;

      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      return acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          // Extension check
          return fileName.endsWith(type.toLowerCase());
        } else {
          // MIME type check
          return fileType.includes(type.toLowerCase());
        }
      });
    },
    [acceptedTypes],
  );

  const hasValidFiles = useCallback(
    (files: FileList): boolean => {
      return Array.from(files).some((file) => isValidFile(file));
    },
    [isValidFile],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      dragCounterRef.current++;
      setDragCounter(dragCounterRef.current);

      if (e.dataTransfer?.items) {
        const hasFiles = Array.from(e.dataTransfer.items).some(
          (item) => item.kind === 'file',
        );

        if (hasFiles) {
          setIsDragging(true);
          console.log('[useDragAndDrop] Drag enter detected with files');
        }
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Set the dropEffect to indicate this is a valid drop zone
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      dragCounterRef.current--;
      setDragCounter(dragCounterRef.current);

      if (dragCounterRef.current === 0) {
        setIsDragging(false);
        console.log('[useDragAndDrop] Drag leave - no longer dragging');
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Reset drag state
      dragCounterRef.current = 0;
      setDragCounter(0);
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        console.log('[useDragAndDrop] Drop event but no files found');
        return;
      }

      console.log('[useDragAndDrop] Files dropped:', {
        count: files.length,
        files: Array.from(files).map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      });

      // Filter for valid files
      const validFiles = Array.from(files).filter(isValidFile);

      if (validFiles.length === 0) {
        console.warn('[useDragAndDrop] No valid files in drop');
        return;
      }

      if (validFiles.length !== files.length) {
        console.warn('[useDragAndDrop] Some files were filtered out:', {
          total: files.length,
          valid: validFiles.length,
          filtered: files.length - validFiles.length,
        });
      }

      // Create a new FileList-like object with only valid files
      const validFileList = {
        ...validFiles,
        length: validFiles.length,
        item: (index: number) => validFiles[index] || null,
      } as FileList;

      onFilesDropped?.(validFileList);
    },
    [disabled, isValidFile, onFilesDropped],
  );

  // Set up global event listeners
  useEffect(() => {
    if (disabled) return;

    const handleWindowDragEnter = (e: DragEvent) => handleDragEnter(e);
    const handleWindowDragOver = (e: DragEvent) => handleDragOver(e);
    const handleWindowDragLeave = (e: DragEvent) => handleDragLeave(e);
    const handleWindowDrop = (e: DragEvent) => handleDrop(e);

    // Add event listeners to window to catch all drag events
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [disabled, handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  return {
    isDragging,
    dragCounter,
    isValidFile,
    hasValidFiles,
  };
}
