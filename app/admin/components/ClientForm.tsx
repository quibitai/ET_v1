'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { Client } from '@/lib/db/schema';
import { updateClient, createClient } from '../actions';

interface ClientFormProps {
  client?: Client;
  onSuccess?: () => void;
}

/**
 * Client Form Component
 *
 * Form for creating and editing client configurations.
 * Uses server actions for data persistence.
 */
export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(client);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && client) {
        await updateClient(client.id, formData);
      } else {
        await createClient(formData);
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="id">Client ID</Label>
          <Input
            id="id"
            name="id"
            defaultValue={client?.id}
            disabled={isEditing}
            placeholder="echo-tango"
            required
          />
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              ID cannot be changed after creation
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Internal Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={client?.name}
            placeholder="Echo Tango Internal"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_display_name">Display Name</Label>
        <Input
          id="client_display_name"
          name="client_display_name"
          defaultValue={client?.client_display_name}
          placeholder="Echo Tango Creative Agency"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_core_mission">Core Mission</Label>
        <Textarea
          id="client_core_mission"
          name="client_core_mission"
          defaultValue={client?.client_core_mission || ''}
          placeholder="Brief description of the client's core business mission"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customInstructions">Custom Instructions</Label>
        <Textarea
          id="customInstructions"
          name="customInstructions"
          defaultValue={client?.customInstructions || ''}
          placeholder="General client-specific instructions for AI interactions"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="config_json">Configuration JSON</Label>
        <Textarea
          id="config_json"
          name="config_json"
          defaultValue={
            client?.config_json
              ? JSON.stringify(client.config_json, null, 2)
              : '{\n  "available_bit_ids": [],\n  "tool_configs": {},\n  "orchestrator_client_context": ""\n}'
          }
          placeholder="JSON configuration for tools, available bits, etc."
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Valid JSON object with tool configurations and available bit IDs
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isEditing ? 'Update Client' : 'Create Client'}
        </Button>
      </div>
    </form>
  );
}
