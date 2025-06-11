'use client';

import React from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { PlusIcon } from './icons';

interface AttachmentsButtonProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  status: 'error' | 'submitted' | 'streaming' | 'ready';
}

export function AttachmentsButton({
  fileInputRef,
  status,
}: AttachmentsButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="attachments-button"
          variant="ghost"
          size="icon"
          type="button"
          className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary transition-colors"
          aria-label="Attach files"
          disabled={status !== 'ready'}
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          <PlusIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Attach files</TooltipContent>
    </Tooltip>
  );
}
