/**
 * Simple Response Node Prompt Template
 *
 * This prompt guides the generation of direct, concise responses for straightforward queries.
 * Used when the user needs a clear, focused answer without extensive analysis.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

export const simpleResponsePromptTemplate = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a helpful AI assistant providing clear, direct responses to user queries.

RESPONSE GUIDELINES:
- Provide concise, accurate answers based on the available information
- Use clear, accessible language appropriate for the query complexity
- Include relevant details without overwhelming the user
- Cite sources when referencing specific documents or web content
- Maintain a professional but friendly tone

FORMATTING:
- Use simple markdown formatting for readability
- Organize information with bullet points or numbered lists when helpful
- Use **bold** sparingly for key points
- Keep responses focused and to-the-point

CITATION APPROACH:
- Reference sources naturally within the response
- Include document titles or web URLs when relevant
- Avoid overly academic citation styles unless specifically requested

Current date: {current_date}`,
  ],
  [
    'human',
    `User Request: "{user_query}"

Available Information:
{tool_results}

{references_context}

Provide a clear, direct response to the user's question based on the available information.`,
  ],
]);

/**
 * Format the simple response prompt with context
 */
export async function formatSimpleResponsePrompt(context: {
  user_query: string;
  tool_results: string;
  references_context?: string;
  current_date?: string;
}): Promise<string> {
  const formatted = await simpleResponsePromptTemplate.format({
    user_query: context.user_query,
    tool_results: context.tool_results,
    references_context: context.references_context || '',
    current_date: context.current_date || new Date().toISOString(),
  });

  return formatted;
}
