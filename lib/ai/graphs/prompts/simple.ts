/**
 * Simplified Prompt System
 * 
 * Following Development Roadmap v6.0.0 - "Radical Simplification"
 * Replaces complex multi-layer prompt system with simple, direct approach
 * Follows LangGraph best practices for clean, maintainable prompts
 */

/**
 * Create a simple, effective agent prompt
 * This follows LangGraph best practices - simple and direct
 */
export function createAgentPrompt(options: {
  tools: string[];
  currentDate: string;
  responseMode?: 'synthesis' | 'simple' | 'conversational';
  specialistPersona?: string;
}): string {
  const { tools, currentDate, responseMode = 'synthesis', specialistPersona } = options;

  // If we have a specialist persona, use it as the base
  if (specialistPersona) {
    return `${specialistPersona}

Available tools: ${tools.join(', ')}
Current date: ${currentDate}

CORE INSTRUCTIONS:
- Use tools when you need specific information, documents, or research
- Always provide a final response after using tools - never end with just tool calls
- Think step by step about what information you need
- Be helpful, accurate, and follow your specialist expertise

TOOL USAGE:
- Call tools when you need current information or specific documents
- Process tool results and synthesize them into clear responses
- If multiple tools provide relevant information, combine findings coherently

RESPONSE APPROACH:
${getResponseGuidance(responseMode)}

Remember: Use tools to gather information, then always provide a comprehensive final answer.`;
  }

  // Default general chat prompt
  return `You are a helpful AI assistant with access to specialized tools.

Available tools: ${tools.join(', ')}
Current date: ${currentDate}

CORE INSTRUCTIONS:
- Use tools when you need specific information, documents, or research
- Always provide a final response after using tools - never end with just tool calls
- Think step by step about what information you need
- Be helpful, accurate, and concise

TOOL USAGE:
- Call tools when you need current information or specific documents
- Process tool results and synthesize them into clear responses
- If multiple tools provide relevant information, combine findings coherently

RESPONSE APPROACH:
${getResponseGuidance(responseMode)}

Remember: Use tools to gather information, then always provide a comprehensive final answer.`;
}

/**
 * Get response guidance based on mode
 */
function getResponseGuidance(mode: string): string {
  switch (mode) {
    case 'synthesis':
      return '- Provide thorough, analytical responses with proper citations\n- Structure information clearly with headings and bullet points\n- Include actionable insights and recommendations';
    
    case 'simple':
      return '- Give direct, concise answers\n- Focus on the most important information\n- Use clear, simple language';
    
    case 'conversational':
      return '- Respond in a natural, engaging tone\n- Ask follow-up questions when helpful\n- Make technical information accessible';
    
    default:
      return '- Provide clear, helpful responses\n- Structure information logically\n- Be comprehensive but concise';
  }
}

/**
 * Create a specialist-aware system message for the graph
 * This loads specialist persona from database using SpecialistRepository directly
 * Note: This only works on server-side where database access is available
 */
export async function createSystemMessage(
  tools: string[], 
  currentDate: string,
  specialistId?: string
): Promise<string> {
  let specialistPersona: string | undefined;

  // Load specialist persona from database if specified (server-side only)
  if (specialistId && specialistId !== 'chat-model') {
    try {
      // Direct import since this only runs server-side
      const { SpecialistRepository } = await import('@/lib/db/repositories/specialistRepository');
      const specialistRepo = new SpecialistRepository();
      const specialist = await specialistRepo.getSpecialistById(specialistId);
      
      if (specialist) {
        specialistPersona = specialist.personaPrompt;
        console.log(`[SimplePrompts] Loaded specialist persona for: ${specialist.name}`);
      } else {
        console.warn(`[SimplePrompts] Specialist not found: ${specialistId}, using general chat`);
      }
    } catch (error) {
      console.error(`[SimplePrompts] Error loading specialist ${specialistId}:`, error);
    }
  }

  return createAgentPrompt({
    tools,
    currentDate,
    responseMode: 'synthesis',
    specialistPersona
  });
}

/**
 * Legacy function for backward compatibility
 * Use createSystemMessage instead
 */
export function createSystemMessageSync(tools: string[], currentDate: string): string {
  return createAgentPrompt({
    tools,
    currentDate,
    responseMode: 'synthesis'
  });
} 