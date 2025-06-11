'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Settings, Users, Home, BarChart3 } from 'lucide-react';

/**
 * Admin Navigation Component
 *
 * Provides navigation for admin sections with active state indicators.
 */
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    // Force navigation even if we're already on the same path
    if (pathname === href) {
      router.refresh();
    } else {
      router.push(href);
    }
  };

  const navItems = [
    {
      href: '/',
      label: 'Back to App',
      icon: Home,
    },
    {
      href: '/admin',
      label: 'Dashboard',
      icon: Settings,
    },
    {
      href: '/admin/configuration',
      label: 'Configuration',
      icon: Users,
    },
    {
      href: '/admin/observability',
      label: 'Observability',
      icon: BarChart3,
    },
  ];

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <span className="font-semibold">Admin Panel</span>
      </div>

      <nav className="flex items-center space-x-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Button
              key={item.href}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleNavigation(item.href)}
              className="flex items-center space-x-2"
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
