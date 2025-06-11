'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { Specialist } from '@/lib/db/schema';
import { updateSpecialist, createSpecialist } from '../actions';

interface SpecialistFormProps {
  specialist?: Specialist;
  onSuccess?: () => void;
}

/**
 * Specialist Form Component
 *
 * Form for creating and editing specialist configurations.
 * Uses server actions for data persistence.
 */
export function SpecialistForm({ specialist, onSuccess }: SpecialistFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(specialist);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && specialist) {
        await updateSpecialist(specialist.id, formData);
      } else {
        await createSpecialist(formData);
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
          <Label htmlFor="id">Specialist ID</Label>
          <Input
            id="id"
            name="id"
            defaultValue={specialist?.id}
            disabled={isEditing}
            placeholder="echo-tango-specialist"
            required
          />
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              ID cannot be changed after creation
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={specialist?.name}
            placeholder="Echo Tango Specialist"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={specialist?.description || ''}
          placeholder="Brief description of the specialist's role and capabilities"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personaPrompt">Persona Prompt</Label>
        <Textarea
          id="personaPrompt"
          name="personaPrompt"
          defaultValue={specialist?.personaPrompt || ''}
          placeholder="Detailed prompt defining the specialist's personality, expertise, and behavior"
          rows={12}
          className="font-mono text-sm"
          required
        />
        <p className="text-xs text-muted-foreground">
          This is the core prompt that defines how this specialist behaves and
          responds
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultTools">Default Tools</Label>
        <Textarea
          id="defaultTools"
          name="defaultTools"
          defaultValue={
            specialist?.defaultTools && Array.isArray(specialist.defaultTools)
              ? JSON.stringify(specialist.defaultTools, null, 2)
              : '[]'
          }
          placeholder='["tavily_search", "file_search", "document_editor"]'
          rows={6}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          JSON array of tool names that this specialist has access to by default
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Update Specialist' : 'Create Specialist'}
        </Button>
      </div>
    </form>
  );
}
