import { db } from '@/lib/db';
import { clients, specialists } from '@/lib/db/schema';
import { AdminDashboard } from './components/AdminDashboard';

/**
 * Consolidated Admin Dashboard
 *
 * Modern admin interface that consolidates configuration management,
 * observability, and system monitoring into a single, intuitive dashboard.
 */
export default async function AdminPage() {
  // Fetch all data for the dashboard
  const [clientsData, specialistsData] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    db.select().from(specialists).orderBy(specialists.name),
  ]);

  return <AdminDashboard clients={clientsData} specialists={specialistsData} />;
}
