import { composeSpecialistPrompt } from './core/base';
import { getOrchestratorPrompt } from './core/orchestrator';
import { getToolPromptInstructions } from './tools';
import {
  CHAT_BIT_CONTEXT_ID,
  GLOBAL_ORCHESTRATOR_CONTEXT_ID,
} from '@/lib/constants';
import type { ClientConfig } from '@/lib/db/queries';
import { CONDENSED_ECHO_TANGO_PROMPT } from './specialists/condensed';

// Fallback specialist prompts when database is not available
const FALLBACK_SPECIALIST_PROMPTS = {
  'echo-tango-specialist': CONDENSED_ECHO_TANGO_PROMPT,
  'chat-model': `# Role: General Assistant for {client_display_name}

You are {client_display_name}'s AI assistant, providing helpful, accurate, and engaging responses.

{client_core_mission_statement}

## Core Capabilities
- Answer questions across diverse topics
- Help with analysis, writing, and problem-solving
- Provide research and information synthesis
- Support creative and strategic thinking

## Tool Usage
When asked for research, reports, or current information:
1. **Use tavilySearch** for current data
2. **Use searchInternalKnowledgeBase** for company-specific info
3. **Use listDocuments/getDocumentContents** for templates

Always use tools for research requests - never provide direct answers without current data.`,
};

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
    console.warn(
      'Database imports failed in loader.ts, using fallback prompts',
      error,
    );
  }
}

interface LoadPromptParams {
  modelId: string; // e.g., 'global-orchestrator', 'gpt-4.1-mini'
  contextId: string | null; // Represents activeBitContextId or activeBitPersona
  clientConfig?: ClientConfig | null; // Client-specific overrides
  currentDateTime?: string; // Current date/time for context
}

/**
 * Loads the appropriate system prompt based on the provided context.
 * @param params - Object containing modelId, contextId, and clientConfig.
 * @returns Promise resolving to the system prompt string.
 */
export async function loadPrompt({
  modelId,
  contextId,
  clientConfig,
  currentDateTime = new Date().toISOString(),
}: LoadPromptParams): Promise<string> {
  console.log(
    `[PromptLoader] Attempting to load prompt with modelId: '${modelId}', contextId: '${contextId}'`,
  );

  // 1. PRIORITIZE Specialist context based on contextId
  if (contextId) {
    console.log(
      `[PromptLoader] Looking up specialist contextId '${contextId}' in database.`,
    );

    // Check if we're on server-side and have database access
    if (db && specialists && eq) {
      try {
        // Query database for specialist configuration
        const specialistResult = await db
          .select()
          .from(specialists)
          .where(eq(specialists.id, contextId))
          .limit(1);

        if (specialistResult.length > 0) {
          console.log(
            `[PromptLoader] Valid specialist contextId '${contextId}' found. Loading specialist prompt.`,
          );

          const specialistConfig = specialistResult[0];
          // Use the specialist persona from the database (no client overrides for individual specialists anymore)
          const specialistBasePersona = specialistConfig.personaPrompt;

          if (!specialistBasePersona || specialistBasePersona.trim() === '') {
            console.warn(
              `[PromptLoader] Specialist persona for '${contextId}' is empty or not found (checked default and client config). Falling back to default assistant prompt.`,
            );
            return composeSpecialistPrompt(
              `# Role: General Assistant
You are a helpful general assistant within the Quibit system. Address user queries directly or use available tools as needed.`,
              `Standard tools for search and document interaction may be available.`,
              currentDateTime,
            );
          }

          // Inject client-specific context into the specialist persona
          let personaWithClientContext = specialistBasePersona;

          // Inject client_display_name
          if (clientConfig?.client_display_name) {
            personaWithClientContext = personaWithClientContext.replace(
              /{client_display_name}/g,
              clientConfig.client_display_name,
            );
          }

          // Create and inject client_core_mission_statement
          const missionStatement =
            clientConfig?.client_core_mission &&
            clientConfig.client_display_name
              ? `\nAs a specialist for ${clientConfig.client_display_name}, be guided by their core mission: ${clientConfig.client_core_mission}\n`
              : '';
          personaWithClientContext = personaWithClientContext.replace(
            /{client_core_mission_statement}/g,
            missionStatement,
          );

          let finalPersonaContent = personaWithClientContext;

          // Append general client-specific instructions if they exist
          const generalClientInstructions =
            clientConfig?.customInstructions?.trim();
          if (generalClientInstructions) {
            // Create header that includes client name if available
            const customInstructionsHeader = clientConfig?.client_display_name
              ? `\n\n# Client-Specific Guidelines for ${clientConfig.client_display_name} (General)\n`
              : `\n\n# Client-Specific Guidelines (General)\n`;

            // Check if the general instructions are already in the specialist prompt to avoid duplication
            if (!finalPersonaContent.includes(generalClientInstructions)) {
              finalPersonaContent += `${customInstructionsHeader}${generalClientInstructions}`;
            }
          }

          const toolInstructions = getToolPromptInstructions();

          console.log(
            `[PromptLoader] Successfully composed prompt for specialist: ${contextId}`,
          );
          return composeSpecialistPrompt(
            finalPersonaContent,
            toolInstructions,
            currentDateTime,
          );
        }
      } catch (error) {
        console.error(
          `[PromptLoader] Database error for contextId '${contextId}':`,
          error,
        );
        console.log(
          `[PromptLoader] Will attempt to use fallback prompt for '${contextId}'`,
        );
      }
    } else {
      console.warn(
        `[PromptLoader] Database not available (client-side or import failed). Checking fallback prompts for '${contextId}'.`,
      );
    }

    // Check fallback prompts if database failed or specialist not found
    if (
      FALLBACK_SPECIALIST_PROMPTS[
        contextId as keyof typeof FALLBACK_SPECIALIST_PROMPTS
      ]
    ) {
      console.log(
        `[PromptLoader] Database lookup failed, using fallback prompt for specialist: ${contextId}`,
      );

      let fallbackPersona =
        FALLBACK_SPECIALIST_PROMPTS[
          contextId as keyof typeof FALLBACK_SPECIALIST_PROMPTS
        ];

      // Inject client-specific context into the fallback persona
      if (clientConfig?.client_display_name) {
        fallbackPersona = fallbackPersona.replace(
          /{client_display_name}/g,
          clientConfig.client_display_name,
        );
      }

      // Create and inject client_core_mission_statement
      const missionStatement =
        clientConfig?.client_core_mission && clientConfig.client_display_name
          ? `\nAs a specialist for ${clientConfig.client_display_name}, be guided by their core mission: ${clientConfig.client_core_mission}\n`
          : '';
      fallbackPersona = fallbackPersona.replace(
        /{client_core_mission_statement}/g,
        missionStatement,
      );

      const toolInstructions = getToolPromptInstructions();

      return composeSpecialistPrompt(
        fallbackPersona,
        toolInstructions,
        currentDateTime,
      );
    }
  }

  // 2. Check if this is the global orchestrator context
  if (
    contextId === GLOBAL_ORCHESTRATOR_CONTEXT_ID ||
    modelId === 'global-orchestrator'
  ) {
    console.log(
      `[PromptLoader] Loading Orchestrator prompt for global context or modelId.`,
    );
    // Call the updated orchestrator function with client-specific context
    return getOrchestratorPrompt(
      currentDateTime,
      clientConfig?.client_display_name || 'Quibit',
      clientConfig?.client_core_mission || null,
      clientConfig?.configJson?.orchestrator_client_context || null,
      clientConfig?.configJson?.available_bit_ids || null,
      clientConfig?.customInstructions || null,
    );
  }

  // 3. Check if this is the chat model context (general chat)
  if (contextId === CHAT_BIT_CONTEXT_ID) {
    console.log(
      `[PromptLoader] Loading Chat Model specialist prompt for general chat context.`,
    );

    // Check if we're on server-side and have database access
    if (db && specialists && eq) {
      try {
        // Query database for chat model specialist
        const chatModelResult = await db
          .select()
          .from(specialists)
          .where(eq(specialists.id, CHAT_BIT_CONTEXT_ID))
          .limit(1);

        const chatModelPrompt =
          chatModelResult.length > 0 ? chatModelResult[0].personaPrompt : null;

        if (!chatModelPrompt || chatModelPrompt.trim() === '') {
          console.warn(
            `[PromptLoader] Chat Model specialist prompt not found. Falling back to default assistant prompt.`,
          );
          return composeSpecialistPrompt(
            `# Role: General Assistant
You are a helpful general assistant within the Quibit system. Address user queries directly or use available tools as needed.`,
            `Standard tools for search and document interaction may be available.`,
            currentDateTime,
          );
        }

        // Inject client-specific context into the chat model persona
        let personaWithClientContext = chatModelPrompt;

        // Inject client_display_name
        if (clientConfig?.client_display_name) {
          personaWithClientContext = personaWithClientContext.replace(
            /{client_display_name}/g,
            clientConfig.client_display_name,
          );
        }

        // Create and inject client_core_mission_statement
        const missionStatement =
          clientConfig?.client_core_mission && clientConfig.client_display_name
            ? `\nAs a specialist for ${clientConfig.client_display_name}, be guided by their core mission: ${clientConfig.client_core_mission}\n`
            : '';
        personaWithClientContext = personaWithClientContext.replace(
          /{client_core_mission_statement}/g,
          missionStatement,
        );

        let finalPersonaContent = personaWithClientContext;

        // Append general client-specific instructions if they exist
        const generalClientInstructions =
          clientConfig?.customInstructions?.trim();
        if (generalClientInstructions) {
          // Create header that includes client name if available
          const customInstructionsHeader = clientConfig?.client_display_name
            ? `\n\n# Client-Specific Guidelines for ${clientConfig.client_display_name} (General)\n`
            : `\n\n# Client-Specific Guidelines (General)\n`;

          // Check if the general instructions are already in the specialist prompt to avoid duplication
          if (!finalPersonaContent.includes(generalClientInstructions)) {
            finalPersonaContent += `${customInstructionsHeader}${generalClientInstructions}`;
          }
        }

        // Get tool instructions for the chat model specialist
        const toolInstructions = getToolPromptInstructions();

        console.log(
          `[PromptLoader] Successfully composed prompt for Chat Model specialist`,
        );
        return composeSpecialistPrompt(
          finalPersonaContent,
          toolInstructions,
          currentDateTime,
        );
      } catch (error) {
        console.error('[PromptLoader] Database error for chat model:', error);
      }
    } else {
      console.warn(
        `[PromptLoader] Database not available (client-side or import failed). Cannot load chat model specialist.`,
      );
    }
  }

  // 4. Fallback if not a known specialist and not the orchestrator modelId

  console.log(
    `[PromptLoader] No specific specialist context and modelId ('${modelId}') is not orchestrator. Loading default assistant prompt.`,
  );
  return composeSpecialistPrompt(
    `# Role: General Assistant
You are a helpful general assistant within the Quibit system. Address user queries directly or use available tools as needed.`,
    `Standard tools for search and document interaction may be available.`,
    currentDateTime,
  );
}
