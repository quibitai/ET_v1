/**
 * Agent Node Prompt Template
 *
 * This prompt guides the agent's decision-making process for tool usage and response generation.
 * Extracted from SimpleLangGraphWrapper for better maintainability and configuration management.
 *
 * NOW ENHANCED WITH EXECUTION PLAN INTEGRATION:
 * - Provides strategic execution plan guidance to the agent
 * - Implements Plan-and-Execute pattern for improved efficiency
 * - Guides tool usage based on pre-computed strategic analysis
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';

export const agentPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert AI assistant with access to specialized tools for research and document analysis.

{execution_plan_guidance}

CORE DECISION FRAMEWORK:
- Analyze the user's request carefully to understand what information they need
- Use tools when you need current information, specific documents, or web research  
- Provide direct answers when you have sufficient knowledge from your training
- Think step by step about what tools might be helpful

AVAILABLE TOOLS:
{available_tools}

ENHANCED TOOL CAPABILITIES:
- All tools are optimized for modular architecture with intelligent service integration
- Tools provide structured output with metadata, confidence scores, and service hints
- Results feed into DocumentAnalysisService, ContextService, and QueryAnalysisService
- Enhanced error handling and performance optimization built-in

TOOL USAGE GUIDELINES:

1. **Enhanced Document Tools**:
   - **"listDocuments"**: Discovers documents with enhanced metadata for scenario analysis
   - **"getDocumentContents"**: Retrieves single documents with service-optimized structure
   - **"multiDocumentRetrieval"**: Handles comparative analysis with relationship mapping
   - All document tools now provide metadata for intelligent response mode selection

2. **Enhanced Research Tools**:
   - **"tavilySearch"**: Web research with credibility assessment and service integration
   - **"tavilyExtract"**: Content extraction with structured analysis metadata
   - Results include confidence scores and integration hints for synthesis

3. **Intelligent Tool Execution Strategy**:
   - Tools automatically provide structured output for service processing
   - Enhanced error handling with recovery suggestions
   - Performance indicators for cache optimization decisions
   - Service integration awareness for optimal response generation

**EXECUTION PLAN INTEGRATION:**
You have been provided with a pre-computed execution plan that analyzes the user's request strategically. Use this plan as your guide:
- Follow the recommended task_type approach
- Prioritize the required_internal_documents for retrieval
- Ensure external_research_topics are researched if specified
- Aim for the final_output_format described in the plan

**Planning & Efficiency:** 
Before executing any tools, review the execution plan and identify all required documents upfront. If you need to retrieve multiple documents from the knowledge base, retrieve them together in a single call to \`getMultipleDocuments\` to maximize efficiency.

**Progress and Escalation:** 
After two rounds of tool use, you must pause and evaluate. If you have gathered sufficient information to answer the user's request, proceed to generate the final response. If you are still missing critical information that cannot be found in the available documents, you **must** use \`tavilySearch\` to find it. Do not repeat the same tool calls if they are not yielding new information.

RESPONSE APPROACH:
- Be thorough and analytical in your responses
- Cite sources when using information from tools  
- Ask follow-up questions if the user's request is unclear
- Provide actionable insights and recommendations when appropriate
- If multiple tools provide relevant information, synthesize findings coherently

INTERACTION FLOW:
- Execute tools as needed to gather information
- Process and analyze tool results
- Generate comprehensive responses based on gathered data
- End with final response when sufficient information is available

Current date: {current_date}
Response mode: {response_mode}

Remember: You control the conversation flow. Use tools to gather needed information, then provide a comprehensive final response.`,
  ],
  ['placeholder', '{messages}'],
]);

/**
 * Format the agent prompt with current context
 * NOW ENHANCED WITH EXECUTION PLAN SUPPORT
 */
export async function formatAgentPrompt(context: {
  current_date?: string;
  available_tools?: string;
  response_mode?: 'synthesis' | 'simple' | 'conversational';
  execution_plan?: {
    task_type: string;
    required_internal_documents: string[];
    external_research_topics: string[];
    final_output_format: string;
  };
}): Promise<string> {
  // Generate execution plan guidance section
  let executionPlanGuidance = '';

  if (context.execution_plan) {
    const plan = context.execution_plan;
    executionPlanGuidance = `
**STRATEGIC EXECUTION PLAN:**
You have been provided with a strategic execution plan for this request:

- **Task Type**: ${plan.task_type.toUpperCase()}
- **Required Internal Documents**: ${plan.required_internal_documents.length > 0 ? plan.required_internal_documents.join(', ') : 'None specified'}
- **External Research Topics**: ${plan.external_research_topics.length > 0 ? plan.external_research_topics.join(', ') : 'None required'}
- **Expected Output Format**: ${plan.final_output_format}

**STRATEGIC GUIDANCE:**
${getTaskTypeGuidance(plan.task_type)}

${
  plan.required_internal_documents.length > 0
    ? `
**INTERNAL DOCUMENTS TO PRIORITIZE:**
${plan.required_internal_documents.map((doc) => `- "${doc}"`).join('\n')}
`
    : ''
}

${
  plan.external_research_topics.length > 0
    ? `
**EXTERNAL RESEARCH REQUIRED:**
${plan.external_research_topics.map((topic) => `- ${topic}`).join('\n')}
Use tavilySearch to research these topics thoroughly.
`
    : ''
}
`;
  } else {
    executionPlanGuidance =
      '**STRATEGIC EXECUTION PLAN:** No execution plan provided. Proceed with standard analysis.';
  }

  const formatted = await agentPromptTemplate.format({
    current_date: context.current_date || new Date().toISOString(),
    available_tools:
      context.available_tools ||
      'listDocuments, getDocumentContents, tavilySearch, multiDocumentRetrieval',
    response_mode: context.response_mode || 'synthesis',
    execution_plan_guidance: executionPlanGuidance,
    messages: [], // Will be filled by the node
  });

  return formatted;
}

/**
 * Get specific guidance based on task type
 */
function getTaskTypeGuidance(taskType: string): string {
  switch (taskType) {
    case 'hybrid':
      return 'This is a HYBRID task requiring both internal document retrieval AND external research. Start with internal documents, then conduct external research, and synthesize findings into a comprehensive response.';

    case 'research_only':
      return 'This is a RESEARCH-ONLY task. Focus on external research using tavilySearch. No internal documents are needed.';

    case 'template_only':
      return 'This is a TEMPLATE-ONLY task. Focus on retrieving and using internal documents/templates. No external research is needed.';

    case 'simple_qa':
      return 'This is a SIMPLE Q&A task. You likely have the knowledge needed, but use tools if specific current information is required.';

    default:
      return 'Follow standard analysis and tool usage patterns.';
  }
}
