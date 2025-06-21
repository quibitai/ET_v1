/**
 * Simple Response Node Prompt Template
 *
 * This prompt guides the generation of direct, concise responses for straightforward queries.
 * Used when the user needs a clear, focused answer without extensive analysis.
 */

import { dedent } from 'ts-dedent';
import type { GraphState } from '../state';
import { getToolMessages, getLastHumanMessage } from '../state';

export const SIMPLE_RESPONSE_PROMPT_TEMPLATE = dedent`
  You are an AI assistant. Your task is to provide a direct and concise response to the user's query based on the provided tool results.

  **CRITICAL INSTRUCTIONS:**
  1.  **DO NOT** under any circumstances generate an "Overview", "Summary", "Introduction", "Conclusion", or "Actionable Insights" section.
  2.  Your response **MUST** be a direct answer to the user's question, which is often a simple list of items.
  3.  Format the output as clean, readable markdown. For lists, use numbered or bulleted points.
  4.  Embed hyperlinks directly in the item names where applicable.
  5.  **DO NOT** add any conversational text, preamble, or explanation unless the user explicitly asked for it. Just provide the data.

  **User Query:**
  {query}

  **Tool Results:**
  {tool_results}
`;

export function formatSimpleResponsePrompt(state: GraphState): string {
  const toolMessages = getToolMessages(state);
  const query = getLastHumanMessage(state);

  const tool_results =
    toolMessages.length > 0
      ? toolMessages
          .map((msg) =>
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content, null, 2),
          )
          .join('\n\n---\n\n')
      : 'No tool results available.';

  return SIMPLE_RESPONSE_PROMPT_TEMPLATE.replace('{query}', query).replace(
    '{tool_results}',
    tool_results,
  );
}
