'use client';
import { ChevronUp, Settings } from 'lucide-react';
import Image from 'next/image';
import type { User } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function SidebarUserNav({ user }: { user: User }) {
  const { setTheme, theme } = useTheme();
  const { state } = useSidebar();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Handle hydration mismatch by only using sidebar state after mount
  useEffect(() => {
    setIsMounted(true);
    setIsExpanded(state === 'expanded');
  }, [state]);

  // Check if user is admin
  const userEmail = user?.email;
  const isAdmin =
    userEmail?.includes('admin') ||
    userEmail?.includes('hayden') ||
    userEmail === 'adam@quibit.ai';

  // During SSR and initial hydration, render the collapsed state to prevent mismatch
  if (!isMounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex justify-center w-full py-2">
                <Image
                  src={`https://avatar.vercel.sh/${user?.email || 'placeholder'}`}
                  alt={user?.email ?? 'user'}
                  width={30}
                  height={30}
                  className="rounded-full cursor-pointer"
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="w-[--radix-popper-anchor-width]"
            >
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/admin"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="w-full cursor-pointer"
                  onClick={() => {
                    signOut({
                      redirectTo: '/',
                    });
                  }}
                >
                  Sign out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isExpanded ? (
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10">
                <Image
                  src={`https://avatar.vercel.sh/${user?.email || 'placeholder'}`}
                  alt={user?.email ?? 'user'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span className="truncate">{user?.email}</span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            ) : (
              <div className="flex justify-center w-full py-2">
                <Image
                  src={`https://avatar.vercel.sh/${user?.email || 'placeholder'}`}
                  alt={user?.email ?? 'user'}
                  width={30}
                  height={30}
                  className="rounded-full cursor-pointer"
                />
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            {isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    href="/admin"
                    className="cursor-pointer flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                type="button"
                className="w-full cursor-pointer"
                onClick={() => {
                  signOut({
                    redirectTo: '/',
                  });
                }}
              >
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
