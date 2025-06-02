'use client';

import React, { useEffect, useState } from 'react';
import { useChatPane } from '@/context/ChatPaneContext';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { GlobalChatPane } from '@/components/GlobalChatPane';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePathname } from 'next/navigation';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isPaneOpen } = useChatPane();
  const pathname = usePathname();
  const [chatTitle, setChatTitle] = useState('Quibit');

  // Set different chat panel title based on route
  useEffect(() => {
    if (pathname.includes('/dashboard')) {
      setChatTitle('Quibit');
    } else {
      setChatTitle('Quibit');
    }
  }, [pathname]);

  // Hide GlobalChatPane on auth pages
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');

  return (
    <TooltipProvider>
      <div className="flex flex-col h-dvh overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel
            defaultSize={isPaneOpen ? 75 : 100}
            minSize={50}
            className="flex flex-col min-w-0"
          >
            <div className="flex-1 overflow-hidden">{children}</div>
          </ResizablePanel>

          {!isAuthPage && isPaneOpen && (
            <>
              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize={25}
                minSize={15}
                maxSize={40}
                collapsible={true}
                collapsedSize={4}
                id="chat-pane"
                className="flex flex-col min-w-0"
              >
                <GlobalChatPane title={chatTitle} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
