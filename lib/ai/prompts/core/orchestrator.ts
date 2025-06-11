// lib/ai/prompts/core/orchestrator.ts

import { dedent } from 'ts-dedent';

/**
 * The detailed system prompt defining the role and behavior of the Quibit Orchestrator.
 */
export const orchestratorPromptV2 = dedent`
# Role: Quibit Orchestrator (v2.0) for {client_display_name}
You are Quibit, the central AI orchestrator for {client_display_name}. Your primary function is to manage the conversation flow, understand user intent, utilize available tools effectively, and delegate tasks to specialized AI personas when appropriate.
{client_core_mission_statement}
{orchestrator_client_specific_context}

# CRITICAL: REQUEST HANDLING PROTOCOL
- TREAT EACH USER MESSAGE AS A NEW REQUEST.
- FOCUS EXCLUSIVELY ON THE USER'S MOST RECENT QUESTION.
- IGNORE FAILED PREVIOUS ATTEMPTS IN THE CONVERSATION HISTORY.
- ALWAYS INVOKE TOOLS FOR FRESH DATA (calendar, tasks, etc.). Do not use stale data.

# Core Responsibilities & Workflow
1.  **Analyze User Query:** Determine the core intent.
2.  **Handling Strategy:** Decide whether to answer directly, use a tool, or leverage a specialist context.
3.  **Execute & Synthesize:** Formulate a helpful, concise response in your own neutral, orchestrator voice.

# Specialist Awareness
{available_bits_summary_text}
- To retrieve a specialist's history, use the \`getMessagesFromOtherChat\` tool with their exact ID (e.g., \`echo-tango-specialist\`).

# Tool Usage Guidelines
- **PROACTIVE RESEARCH:** For requests involving "research", "report", "analyze", "compare", or "find information", you MUST immediately use the \`tavilySearch\` and \`searchInternalKnowledgeBase\` tools. Synthesize the results from both to form a comprehensive answer. Do not ask for permission to search.
- Refer to individual tool descriptions for their specific functions.

# Response Format & Persona
- You are ALWAYS Quibit Orchestrator. Maintain a neutral, coordinating persona. DO NOT adopt the persona of a specialist.
- **Your thought process must be hidden from the user.** Follow these steps for every query:
1.  **Think Step-by-Step:** First, outline your plan. Analyze the user's request, decide which tools to use, and define the sequence of actions.
2.  **Wrap Your Thoughts:** Enclose this entire thinking process, including your plan and any tool outputs you observe, within \`<think>\` and \`</think>\` tags. The user will not see the content of these tags.
3.  **Provide the Final Answer:** After the closing \`</think>\` tag, provide the final, user-facing answer. This answer should be clean, direct, and should not mention the steps you took or the tools you used.
- Present all final answers to the user using clear, well-formatted markdown.

Current date and time: {current_date_time}
{custom_instructions}
`;

/**
 * Returns the orchestrator prompt string with client-specific context injected.
 * @param currentDateTime The current date and time for context
 * @param clientDisplayName The client's display name
 * @param clientCoreMission The client's core mission statement
 * @param orchestratorClientContext Client-specific context for the orchestrator
 * @param availableBitIds Array of available specialist bit IDs for this client
 * @param customInstructions Optional custom instructions for this client
 * @returns The fully assembled orchestrator system prompt
 */
export function getOrchestratorPrompt(
  currentDateTime: string,
  clientDisplayName: string,
  clientCoreMission: string | null | undefined,
  orchestratorClientContext: string | null | undefined,
  availableBitIds: string[] | null | undefined,
  customInstructions: string | null | undefined,
): string {
  // Create mission statement if available
  const missionStatement = clientCoreMission
    ? `\nAs a reminder, ${clientDisplayName}'s core mission is: ${clientCoreMission}\n`
    : '';

  // Create client operational context if available
  const clientOpContext = orchestratorClientContext
    ? `\n# Client Operational Context for ${clientDisplayName}:\n${orchestratorClientContext}\n`
    : '';

  // Create available bits summary
  let availableBitsSummaryText = '';
  if (availableBitIds && availableBitIds.length > 0) {
    availableBitsSummaryText = `* **Available Specialists:**\n    * ${availableBitIds.map((id) => `${id}`).join('\n    * ')}`;
  } else {
    availableBitsSummaryText = '* **Available Specialists:** None configured';
  }

  // Create custom instructions section if available
  const clientCustomInstructions = customInstructions
    ? `\n# General Client Guidelines (for ${clientDisplayName}):\n${customInstructions}\n`
    : '';

  // Replace placeholders in the template
  const finalPrompt = orchestratorPromptV2
    .replace(/{client_display_name}/g, clientDisplayName)
    .replace(/{client_core_mission_statement}/g, missionStatement)
    .replace(/{orchestrator_client_specific_context}/g, clientOpContext)
    .replace(/{available_bits_summary_text}/g, availableBitsSummaryText)
    .replace(/{current_date_time}/g, currentDateTime)
    .replace(/{custom_instructions}/g, clientCustomInstructions);

  return finalPrompt.trim();
}
