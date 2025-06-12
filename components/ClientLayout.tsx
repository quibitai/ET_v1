'use client';

import React from 'react';
import { ResizablePanelGroup, ResizablePanel } from '@/components/ui/resizable';

import { TooltipProvider } from '@/components/ui/tooltip';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex flex-col h-dvh overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel
            defaultSize={100}
            minSize={50}
            className="flex flex-col min-w-0"
          >
            <div className="flex-1 overflow-hidden">{children}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
