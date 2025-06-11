'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ArrowUpIcon, StopIcon } from './icons';

function PureStopButton({
  stop,
}: {
  stop: () => void;
}) {
  return (
    <Button
      data-testid="stop-button"
      variant="outline"
      className="rounded-full p-1.5 h-fit border-white dark:border-black bg-white dark:bg-black text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-black hover:text-black dark:hover:text-white"
      onClick={(event) => {
        event.preventDefault();
        stop();
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

export const StopButton = memo(PureStopButton);

function PureSendButton({
  isReady,
}: {
  isReady: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="send-button"
          variant="outline"
          type="submit"
          className={cn(
            'rounded-full p-1.5 h-fit border-white dark:border-black bg-white dark:bg-black text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-black hover:text-black dark:hover:text-white transition-all duration-200',
            !isReady && 'opacity-50 cursor-not-allowed',
          )}
          disabled={!isReady}
        >
          <ArrowUpIcon size={14} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isReady ? 'Send message' : 'Please wait...'}
      </TooltipContent>
    </Tooltip>
  );
}

export const SendButton = memo(PureSendButton);
