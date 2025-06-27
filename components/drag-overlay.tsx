'use client';

import { cn } from '@/lib/utils';

interface DragOverlayProps {
  isVisible: boolean;
  className?: string;
}

export function DragOverlay({ isVisible, className }: DragOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-sm',
        'border-2 border-dashed border-primary/50',
        'transition-all duration-200 ease-in-out',
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-primary/10 p-6">
          <svg
            className="h-12 w-12 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Drop files to upload
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Release your files anywhere on this window to upload them to the
            chat
          </p>
          <div className="text-xs text-muted-foreground">
            Supported: PDF, DOC, TXT, MD, Images, and more
          </div>
        </div>
      </div>
    </div>
  );
}
