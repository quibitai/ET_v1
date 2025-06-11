import type { SpecialistConfig } from './template';

// Server-only imports with runtime protection
let db: any = null;
let specialists: any = null;
let eq: any = null;

// Only import database dependencies on server-side
if (typeof window === 'undefined') {
  try {
    const { db: dbInstance } = require('@/lib/db');
    const { specialists: specialistsSchema } = require('@/lib/db/schema');
    const { eq: eqOperator } = require('drizzle-orm');
    db = dbInstance;
    specialists = specialistsSchema;
    eq = eqOperator;
  } catch (error) {
    console.warn('Database imports failed in specialists/index.ts', error);
  }
}

/**
 * @deprecated This file is deprecated. Specialist configurations are now stored in the database.
 * Use the database-backed functions below for backward compatibility, but consider migrating
 * to direct database queries where possible.
 */

/**
 * @deprecated Registry is now stored in the database. Use getAvailableSpecialists() instead.
 */
export const specialistRegistry: Record<string, SpecialistConfig> = {};

/**
 * Retrieves the persona prompt string for a given specialist ID from the database.
 * @deprecated This function is deprecated. Use the database directly via loadPrompt() instead.
 * @param specialistId - The unique ID of the specialist.
 * @returns Promise resolving to the specialist's persona prompt string or an empty string.
 */
export async function getSpecialistPromptById(
  specialistId: string,
): Promise<string> {
  console.warn(
    `[SpecialistRegistry] getSpecialistPromptById is deprecated. Use loadPrompt() instead.`,
  );

  // Check if we're on server-side and have database access
  if (!db || !specialists || !eq) {
    console.warn(
      `[SpecialistRegistry] Database not available (client-side or import failed). Cannot load specialist '${specialistId}'.`,
    );
    return '';
  }

  try {
    const result = await db
      .select()
      .from(specialists)
      .where(eq(specialists.id, specialistId))
      .limit(1);

    if (result.length === 0) {
      console.warn(
        `[SpecialistRegistry] Prompt not found for specialistId: ${specialistId}`,
      );
      return '';
    }

    return result[0].personaPrompt;
  } catch (error) {
    console.error(
      `[SpecialistRegistry] Database error for specialistId: ${specialistId}`,
      error,
    );
    return '';
  }
}

/**
 * Retrieves a list of available specialists from the database.
 * @returns Promise resolving to an array of specialist info objects.
 */
export async function getAvailableSpecialists(): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
  }>
> {
  // Check if we're on server-side and have database access
  if (!db || !specialists) {
    console.warn(
      '[SpecialistRegistry] Database not available (client-side or import failed). Cannot retrieve specialists.',
    );
    return [];
  }

  try {
    const result = await db
      .select({
        id: specialists.id,
        name: specialists.name,
        description: specialists.description,
      })
      .from(specialists);

    return result.map((config: any) => ({
      id: config.id,
      name: config.name,
      description: config.description || '',
    }));
  } catch (error) {
    console.error(
      '[SpecialistRegistry] Database error retrieving specialists',
      error,
    );
    return [];
  }
}
