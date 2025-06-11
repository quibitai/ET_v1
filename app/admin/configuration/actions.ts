'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { clients, specialists } from '../../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Server Actions for Configuration Management
 *
 * Provides CRUD operations for clients and specialists with validation
 * and automatic cache revalidation.
 *
 * Note: Database imports verified and working correctly.
 */

// Validation schemas
const clientSchema = z.object({
  id: z.string().min(1, 'Client ID is required'),
  name: z.string().min(1, 'Name is required'),
  client_display_name: z.string().min(1, 'Display name is required'),
  client_core_mission: z.string().optional(),
  customInstructions: z.string().optional(),
  config_json: z.string().optional(),
});

const specialistSchema = z.object({
  id: z.string().min(1, 'Specialist ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  personaPrompt: z.string().min(1, 'Persona prompt is required'),
  defaultTools: z.string().optional(),
});

// Client Actions
export async function createClient(formData: FormData) {
  try {
    const rawData = {
      id: formData.get('id') as string,
      name: formData.get('name') as string,
      client_display_name: formData.get('client_display_name') as string,
      client_core_mission:
        (formData.get('client_core_mission') as string) || null,
      customInstructions:
        (formData.get('customInstructions') as string) || null,
      config_json: formData.get('config_json') as string,
    };

    const validatedData = clientSchema.parse(rawData);

    // Parse and validate JSON config
    let parsedConfig = null;
    if (validatedData.config_json?.trim()) {
      try {
        parsedConfig = JSON.parse(validatedData.config_json);
      } catch (error) {
        throw new Error('Invalid JSON in configuration field');
      }
    }

    await db.insert(clients).values({
      id: validatedData.id,
      name: validatedData.name,
      client_display_name: validatedData.client_display_name,
      client_core_mission: validatedData.client_core_mission,
      customInstructions: validatedData.customInstructions,
      config_json: parsedConfig,
    });

    revalidatePath('/admin/configuration');
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      );
    }
    throw error;
  }
}

export async function updateClient(clientId: string, formData: FormData) {
  try {
    const rawData = {
      id: clientId, // Use existing ID
      name: formData.get('name') as string,
      client_display_name: formData.get('client_display_name') as string,
      client_core_mission:
        (formData.get('client_core_mission') as string) || null,
      customInstructions:
        (formData.get('customInstructions') as string) || null,
      config_json: formData.get('config_json') as string,
    };

    const validatedData = clientSchema.parse(rawData);

    // Parse and validate JSON config
    let parsedConfig = null;
    if (validatedData.config_json?.trim()) {
      try {
        parsedConfig = JSON.parse(validatedData.config_json);
      } catch (error) {
        throw new Error('Invalid JSON in configuration field');
      }
    }

    await db
      .update(clients)
      .set({
        name: validatedData.name,
        client_display_name: validatedData.client_display_name,
        client_core_mission: validatedData.client_core_mission,
        customInstructions: validatedData.customInstructions,
        config_json: parsedConfig,
      })
      .where(eq(clients.id, clientId));

    revalidatePath('/admin/configuration');
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      );
    }
    throw error;
  }
}

export async function deleteClient(clientId: string) {
  try {
    await db.delete(clients).where(eq(clients.id, clientId));
    revalidatePath('/admin/configuration');
  } catch (error) {
    throw new Error(
      `Failed to delete client: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Specialist Actions
export async function createSpecialist(formData: FormData) {
  try {
    const rawData = {
      id: formData.get('id') as string,
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      personaPrompt: formData.get('personaPrompt') as string,
      defaultTools: formData.get('defaultTools') as string,
    };

    const validatedData = specialistSchema.parse(rawData);

    // Parse and validate tools JSON
    let parsedTools = [];
    if (validatedData.defaultTools?.trim()) {
      try {
        parsedTools = JSON.parse(validatedData.defaultTools);
        if (!Array.isArray(parsedTools)) {
          throw new Error('Default tools must be an array');
        }
      } catch (error) {
        throw new Error('Invalid JSON in default tools field');
      }
    }

    await db.insert(specialists).values({
      id: validatedData.id,
      name: validatedData.name,
      description: validatedData.description,
      personaPrompt: validatedData.personaPrompt,
      defaultTools: parsedTools,
    });

    revalidatePath('/admin/configuration');
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      );
    }
    throw error;
  }
}

export async function updateSpecialist(
  specialistId: string,
  formData: FormData,
) {
  try {
    const rawData = {
      id: specialistId, // Use existing ID
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      personaPrompt: formData.get('personaPrompt') as string,
      defaultTools: formData.get('defaultTools') as string,
    };

    const validatedData = specialistSchema.parse(rawData);

    // Parse and validate tools JSON
    let parsedTools = [];
    if (validatedData.defaultTools?.trim()) {
      try {
        parsedTools = JSON.parse(validatedData.defaultTools);
        if (!Array.isArray(parsedTools)) {
          throw new Error('Default tools must be an array');
        }
      } catch (error) {
        throw new Error('Invalid JSON in default tools field');
      }
    }

    await db
      .update(specialists)
      .set({
        name: validatedData.name,
        description: validatedData.description,
        personaPrompt: validatedData.personaPrompt,
        defaultTools: parsedTools,
      })
      .where(eq(specialists.id, specialistId));

    revalidatePath('/admin/configuration');
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      );
    }
    throw error;
  }
}

export async function deleteSpecialist(specialistId: string) {
  try {
    await db.delete(specialists).where(eq(specialists.id, specialistId));
    revalidatePath('/admin/configuration');
  } catch (error) {
    throw new Error(
      `Failed to delete specialist: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
