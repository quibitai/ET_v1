import { dataAnalysisToolInstructions } from './data-analysis';
import { availableTools } from '../../tools';
// Enhanced tool instructions for modular architecture integration
import {
  enhancedToolInstructionMap,
  getEnhancedToolPromptInstructions,
} from './modular-architecture';
import {
  googleWorkspaceInstructions,
  masterGoogleWorkspaceInstructions,
} from './google-workspace';
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

  listDocuments: `KNOWLEDGE BASE DISCOVERY TOOL: Use this tool to discover what documents are available in the knowledge base. Always use this tool first when the user asks about available documents or needs to explore knowledge base contents. The results provide document IDs needed for getDocumentContents.`,

  getDocumentContents: `DOCUMENT RETRIEVAL TOOL: Use this tool to fetch the full content of a specific document using its ID (preferred) or title. Always try to use document IDs from listDocuments results first for exact matches. For title-based retrieval, use the most specific title terms possible.`,

  getMultipleDocuments: `SMART MULTI-DOCUMENT RETRIEVAL TOOL: Use this tool for comparative analysis, synthesis, or when multiple documents are referenced in a single query. This tool automatically:
  
  1. DETECTS multi-document needs (comparative analysis, "vs", "relationship", etc.)
  2. EXTRACTS all document references from the query automatically
  3. RETRIEVES multiple documents in parallel for efficiency
  4. PROVIDES relationship mapping for comparative analysis
  
  **WHEN TO USE**: 
  - "Compare [Document A] and [Document B]"
  - "How do [Document A] and [Document B] align?"
  - "What's the relationship between [Document A] and [Document B]?"
  - Any query mentioning multiple documents or requiring comparative analysis
  
  **ADVANTAGES over individual getDocumentContents calls**:
  - Parallel retrieval (faster)
  - Automatic document detection
  - Built-in relationship mapping
  - Better error handling for missing documents
  
  **USAGE**: Simply pass the user's query and the tool will handle document extraction and retrieval automatically.`,

  // Web Search Tools
  tavilySearch: `PROACTIVE RESEARCH TOOL: Use immediately for company information, current events, industry research, or any external information needed. Always search when users mention specific companies, organizations, or need current data. Synthesize results into comprehensive responses.`,

  // Data Analysis Tools
  queryDocumentRows: dataAnalysisToolInstructions,

  // Document Management Tools
  // createDocument and updateDocument removed as part of Echo Tango v1 simplification

  // Integration Tools - Google Calendar now handled by Google Workspace MCP tools

  // Content Processing Instructions
  createBudget: `Use this tool to structure and calculate detailed budgets for video production projects. Pass project scope from uploaded content, rate card information from knowledge base searches, and additional project details. Always use this for budget creation requests.`,

  // Google Workspace MCP Tools
  ...googleWorkspaceInstructions,

  // MCP Tools (Dynamic Discovery)
  // NOTE: MCP tools are discovered dynamically from connected servers
  // Tool-specific instructions are generated based on actual available tools
  // This eliminates hardcoded tool name mismatches

  // Other tools
  getMessagesFromOtherChat: `When retrieving messages from other chats, summarize the key points relevant to the user's current query. Note the source chat (e.g., "In the Echo Tango chat...").`,
  // Weather tool removed - focusing on core business tools
  requestSuggestions: `When suggestions are requested, confirm the request and mention that suggestions will appear in the document interface.`,

  // Add mappings for any other tools as needed
};

/**
 * Gathers unique instruction snippets for a given list of tool IDs.
 * This is used to provide context-relevant tool guidance within the main system prompt.
 * @param toolIds - Array of tool names available in the current context.
 * @param useEnhanced - Whether to use enhanced modular architecture instructions (default: true)
 * @returns A single string containing relevant, unique instructions, or an empty string if none apply.
 */
export function getToolPromptInstructions(
  // The toolIds parameter is now ignored to ensure we always use the single source of truth.
  toolIds: string[] = [],
  useEnhanced = true,
): string {
  // Use enhanced instructions for modular architecture by default
  if (useEnhanced) {
    const availableToolNames = availableTools.map((tool) => tool.name);
    console.log(
      '[ToolInstructions] Generating ENHANCED instructions for modular architecture.',
      { toolCount: availableTools.length, enhancedMode: true },
    );
    return getEnhancedToolPromptInstructions(availableToolNames);
  }

  // Legacy instruction generation (fallback)
  const relevantInstructions = new Set<string>();

  console.log(
    '[ToolInstructions] Generating LEGACY instructions from dynamically loaded tools.',
    { toolCount: availableTools.length, enhancedMode: false },
  );

  for (const tool of availableTools) {
    const instruction = toolInstructionMap[tool.name];
    if (instruction) {
      // Add the trimmed instruction to avoid extra whitespace issues
      relevantInstructions.add(instruction.trim());
    } else {
      // This is now an expected case for tools that don't need special instructions.
      // console.log(`[ToolInstructions] No specific instruction found for tool: ${tool.name}`);
    }
  }
  // Join the unique instructions with double newlines for better separation
  return Array.from(relevantInstructions).join('\n\n');
}

/**
 * Get enhanced tool instructions specifically for modular architecture
 * @param toolIds - Array of tool names to get instructions for
 * @returns Enhanced instructions optimized for service integration
 */
export function getEnhancedToolInstructions(toolIds: string[] = []): string {
  return getEnhancedToolPromptInstructions(toolIds);
}
