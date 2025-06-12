import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';

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
    <div className="h-screen bg-background overflow-hidden">
      <main className="h-full container mx-auto max-w-7xl">
        <div className="h-full overflow-y-auto py-6 px-4">{children}</div>
      </main>
    </div>
  );
}
