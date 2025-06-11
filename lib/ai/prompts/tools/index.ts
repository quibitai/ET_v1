
import { dataAnalysisToolInstructions } from './data-analysis';
// Document tool instructions removed as part of Echo Tango v1 simplification
// Import instructions for other tools as they are created

/**
 * Maps tool names (or categories) to their specific instruction snippets.
 * Ensure tool names here match the names used in SpecialistConfig.defaultTools
 * and the actual tool definitions in lib/ai/tools/index.ts
 */
const toolInstructionMap: Record<string, string> = {
  // Knowledge Base Tools
  searchAndRetrieveKnowledgeBase: `PROACTIVE RESEARCH TOOL: Use this to find and retrieve the FULL content of internal documents, case studies, and examples. When a user asks for "the contents of a file" or to "find a document," use this tool immediately.

BUDGET CREATION WORKFLOW: When users ask to create budgets or estimates:
1. First check uploaded content for project details, scope, and requirements
2. Use this tool to search the knowledge base for "rate card", "pricing", "budget", and similar terms to get rate information.
3. Use found rate information to calculate costs based on uploaded project scope
4. Create detailed budget breakdowns with line items and totals
5. Do NOT ask users to upload rate cards if they exist in knowledge base`,

  // Web Search Tools
  tavilySearch: `PROACTIVE RESEARCH TOOL: Use immediately for company information, current events, industry research, or any external information needed. Always search when users mention specific companies, organizations, or need current data. Synthesize results into comprehensive responses.`,

  // Data Analysis Tools
  queryDocumentRows: dataAnalysisToolInstructions,

  // Document Management Tools
  // createDocument and updateDocument removed as part of Echo Tango v1 simplification

  // Integration Tools
  googleCalendar: `Use this tool ONLY for Google Calendar related tasks and operations. This tool is now dedicated to calendar management. For any calendar-related requests, provide a clear natural language description of what you need.`,

  // Content Processing Instructions
  createBudget: `Use this tool to structure and calculate detailed budgets for video production projects. Pass project scope from uploaded content, rate card information from knowledge base searches, and additional project details. Always use this for budget creation requests.`,

  // Asana Function Calling Tools
  asana_get_project_details: `Use this tool to get detailed information about a specific Asana project including description, status, milestones, and tasks. Use when users ask for project details, project overview, or project information. Provide the project name or GID as project_id.`,
  asana_list_projects: `Use this tool to list and discover projects in the Asana workspace. Use when users want to see available projects or find a project by name. Can filter by team or include archived projects.`,
  asana_create_task: `Use this tool to create new tasks in Asana. Provide task name, optional description, project, assignee, and due date. The tool handles semantic resolution of project and user names.`,
  asana_list_tasks: `Use this tool to list tasks from Asana with optional filtering by project, assignee, or completion status. Use when users want to see their tasks or tasks in a specific project.`,
  asana_update_task: `Use this tool to update an existing task in Asana. Provide the task GID or name and the fields to update (e.g., description, assignee, due date, completion status).`,
  asana_create_comment: `Use this tool to add comments to Asana tasks or projects. Provide the GID of the task/project and the comment text.`,
  asana_search_tasks: `Use this tool to perform a semantic search for tasks across all projects in Asana. Use when you need to find tasks related to a specific topic, keyword, or user.`,

  // Other tools
  getMessagesFromOtherChat: `When retrieving messages from other chats, summarize the key points relevant to the user's current query. Note the source chat (e.g., "In the Echo Tango chat...").`,
  getWeather: `When providing weather information, state the location and key conditions (temperature, precipitation).`,
  requestSuggestions: `When suggestions are requested, confirm the request and mention that suggestions will appear in the document interface.`,

  // Add mappings for any other tools as needed
};

/**
 * Gathers unique instruction snippets for a given list of tool IDs.
 * This is used to provide context-relevant tool guidance within the main system prompt.
 * @param toolIds - Array of tool names available in the current context.
 * @returns A single string containing relevant, unique instructions, or an empty string if none apply.
 */
export function getToolPromptInstructions(toolIds: string[] = []): string {
  const relevantInstructions = new Set<string>();
  for (const toolId of toolIds) {
    const instruction = toolInstructionMap[toolId];
    if (instruction) {
      // Add the trimmed instruction to avoid extra whitespace issues
      relevantInstructions.add(instruction.trim());
    } else {
      console.warn(
        `[ToolInstructions] No specific instruction found for tool: ${toolId}`,
      );
    }
  }
  // Join the unique instructions with double newlines for better separation
  return Array.from(relevantInstructions).join('\n\n');
}
