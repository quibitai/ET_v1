import { db } from '@/lib/db';
import { specialists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface SpecialistData {
  id: string;
  name: string;
  description: string | null;
  personaPrompt: string;
  defaultTools: string[] | null;
  createdAt: Date;
}

export class SpecialistRepository {
  /**
   * Get all available specialists for frontend dropdown
   */
  async getAvailableSpecialists(): Promise<Array<{
    id: string;
    name: string;
    description: string;
  }>> {
    try {
      const result = await db
        .select({
          id: specialists.id,
          name: specialists.name,
          description: specialists.description,
        })
        .from(specialists);

      return result.map(config => ({
        id: config.id,
        name: config.name,
        description: config.description || '',
      }));
    } catch (error) {
      console.error('[SpecialistRepository] Error fetching specialists:', error);
      return this.getFallbackSpecialists();
    }
  }

  /**
   * Get a specific specialist by ID including full persona prompt
   */
  async getSpecialistById(id: string): Promise<SpecialistData | null> {
    try {
      const result = await db
        .select()
        .from(specialists)
        .where(eq(specialists.id, id))
        .limit(1);

      if (result.length === 0) {
        console.warn(`[SpecialistRepository] Specialist not found: ${id}`);
        return null;
      }

      const specialist = result[0];
      return {
        id: specialist.id,
        name: specialist.name,
        description: specialist.description,
        personaPrompt: specialist.personaPrompt,
        defaultTools: specialist.defaultTools as string[] | null,
        createdAt: specialist.createdAt,
      };
    } catch (error) {
      console.error(`[SpecialistRepository] Error fetching specialist ${id}:`, error);
      return null;
    }
  }

  /**
   * Fallback specialists when database is unavailable
   */
  private getFallbackSpecialists(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return [
      {
        id: 'chat-model',
        name: 'General Chat',
        description: 'General conversational assistant',
      },
      {
        id: 'echo-tango-specialist',
        name: 'Echo Tango',
        description: 'Specialist for Echo Tango client',
      },
    ];
  }
} 