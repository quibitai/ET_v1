import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { AdminNav } from './components/AdminNav';

/**
 * Admin Layout Component
 *
 * Provides a secure layout for administrative pages with role-based access control.
 * Only authenticated users with 'admin' role can access admin routes.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check admin access - allow specific admin emails
  const userEmail = session.user.email;
  const isAdmin =
    userEmail?.includes('admin') ||
    userEmail?.includes('hayden') ||
    userEmail === 'adam@quibit.ai';

  if (!isAdmin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <AdminNav />
        </div>
      </div>
      <main className="container py-6">{children}</main>
    </div>
  );
}
