'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus } from 'lucide-react';
import type { Client } from '@/lib/db/schema';
import { ClientForm } from './ClientForm';

interface ClientEditorProps {
  clients: Client[];
}

/**
 * Client Editor Component
 *
 * Provides a table view of clients with edit and create functionality.
 * Uses dialogs for inline editing without page navigation.
 */
export function ClientEditor({ clients }: ClientEditorProps) {
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Manage client configurations and settings
          </CardDescription>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
              <DialogDescription>
                Add a new client configuration to the system.
              </DialogDescription>
            </DialogHeader>
            <ClientForm onSuccess={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Mission</TableHead>
              <TableHead>Instructions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-mono text-xs">{client.id}</TableCell>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.client_display_name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {client.client_core_mission || (
                    <span className="text-muted-foreground">No mission</span>
                  )}
                </TableCell>
                <TableCell>
                  {client.customInstructions ? (
                    <Badge variant="secondary">Has instructions</Badge>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 size-4" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Client: {client.name}</DialogTitle>
                        <DialogDescription>
                          Update client configuration and settings.
                        </DialogDescription>
                      </DialogHeader>
                      <ClientForm
                        client={client}
                        onSuccess={() => setEditingClient(null)}
                      />
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {clients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No clients configured. Click &quot;Add Client&quot; to create your
            first client.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
