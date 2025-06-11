import { db } from '@/lib/db';
import { clients, specialists } from '@/lib/db/schema';
import { ClientEditor } from './components/ClientEditor';
import { SpecialistEditor } from './components/SpecialistEditor';

/**
 * Configuration Management Page
 *
 * Server component that fetches clients and specialists data and provides
 * administrative interface for managing system configuration.
 */
export default async function ConfigurationPage() {
  // Fetch all clients and specialists data
  const [clientsData, specialistsData] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    db.select().from(specialists).orderBy(specialists.name),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">System Configuration</h1>
        <p className="text-muted-foreground">
          Manage clients and specialists configuration for the application.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Client Management</h2>
          <ClientEditor clients={clientsData} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Specialist Management</h2>
          <SpecialistEditor specialists={specialistsData} />
        </section>
      </div>
    </div>
  );
}
