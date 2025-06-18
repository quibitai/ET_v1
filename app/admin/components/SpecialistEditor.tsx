'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import type { Specialist } from '@/lib/db/schema';
import { SpecialistForm } from './SpecialistForm';

interface SpecialistEditorProps {
  specialists: Specialist[];
}

/**
 * Specialist Editor Component
 *
 * Provides a table view of specialists with edit and create functionality.
 * Uses dialogs for inline editing without page navigation.
 */
export function SpecialistEditor({ specialists }: SpecialistEditorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Specialists</CardTitle>
          <CardDescription>
            Manage specialist personas and their configurations
          </CardDescription>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Specialist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>Create New Specialist</DialogTitle>
              <DialogDescription>
                Add a new specialist persona to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <SpecialistForm onSuccess={() => setIsCreateDialogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {specialists.map((specialist) => (
              <TableRow key={specialist.id}>
                <TableCell className="font-mono text-xs">
                  {specialist.id}
                </TableCell>
                <TableCell className="font-medium">{specialist.name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {specialist.description || (
                    <span className="text-muted-foreground">
                      No description
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {specialist.defaultTools &&
                  Array.isArray(specialist.defaultTools) &&
                  specialist.defaultTools.length > 0 ? (
                    <Badge variant="secondary">
                      {specialist.defaultTools.length} tools
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No tools</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {specialist.createdAt?.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 size-4" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                      <DialogHeader className="shrink-0">
                        <DialogTitle>
                          Edit Specialist: {specialist.name}
                        </DialogTitle>
                        <DialogDescription>
                          Update specialist persona and configuration.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto px-1">
                        <SpecialistForm
                          specialist={specialist}
                          onSuccess={() => {}}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {specialists.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No specialists configured. Click &quot;Add Specialist&quot; to
            create your first specialist.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
