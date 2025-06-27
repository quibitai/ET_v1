/**
 * Specialists Registry - Client Safe
 * 
 * This module provides functions to access specialist configurations.
 * Uses API calls for client-side access only. Server-side code should use
 * SpecialistRepository directly.
 */

// Fallback specialists when API is unavailable  
const FALLBACK_SPECIALISTS = [
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

/**
 * Retrieves a list of available specialists using API endpoint.
 * This function is client-safe and should be used by frontend components.
 * @returns Promise resolving to an array of specialist info objects.
 */
export async function getAvailableSpecialists(): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
  }>
> {
    try {
    const response = await fetch('/api/specialists');
    const data = await response.json();

    if (data.success && data.specialists) {
      console.log('[SpecialistRegistry] Loaded specialists from API:', data.specialists.length);
      return data.specialists;
    } else {
      console.warn('[SpecialistRegistry] API returned error, using fallbacks:', data.error);
      return FALLBACK_SPECIALISTS;
      }
    } catch (error) {
    console.error('[SpecialistRegistry] API error, using fallbacks:', error);
  return FALLBACK_SPECIALISTS;
  }
}
