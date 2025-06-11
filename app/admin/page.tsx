import { redirect } from 'next/navigation';

/**
 * Admin Root Page
 *
 * Redirects to the admin dashboard as the default admin landing page.
 */
export default function AdminRootPage() {
  redirect('/admin/dashboard');
}
