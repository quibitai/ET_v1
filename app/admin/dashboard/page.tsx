import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Users, Database } from 'lucide-react';
import Link from 'next/link';

/**
 * Admin Dashboard Page
 *
 * Provides an overview and quick access to admin functions.
 */
export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage system configuration and monitor application health.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Configuration</span>
            </CardTitle>
            <CardDescription>
              Manage clients and specialists configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/configuration">
                <Settings className="mr-2 h-4 w-4" />
                Open Configuration
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>System Status</span>
            </CardTitle>
            <CardDescription>
              Monitor system health and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Coming soon...</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Tools</span>
            </CardTitle>
            <CardDescription>
              Administrative tools and utilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Coming soon...</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
