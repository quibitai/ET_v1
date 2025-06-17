## **Final Development Plan: LLM-Powered Planning & Agent Enhancement**
*Implementing Plan-and-Execute Pattern for Strategic Intelligence*

### **Strategic Context**
The LangSmith trace analysis revealed that the agent made poor **strategic decisions** (what to research, tool sequencing) while executing **tactical operations** (individual tool calls) effectively. This indicates the problem is at the planning level, making Plan-and-Execute the optimal pattern.

---

## **Task 1: Implement LLM-Powered PlannerService** 
*Priority: High - Addresses Root Cause*

### **1.1 Create PlannerService.ts**
```typescript
// lib/ai/graphs/services/PlannerService.ts
import { z } from 'zod';
import type { RequestLogger } from '../../../services/observabilityService';

export const ExecutionPlanSchema = z.object({
  task_type: z.enum(['simple_qa', 'research_only', 'template_only', 'hybrid'])
    .describe('The primary type of task identified.'),
  required_internal_documents: z.array(z.string())
    .describe('Specific internal document names the agent should retrieve.'),
  external_research_topics: z.array(z.string())
    .describe('Topics or entities requiring external web research.'),
  final_output_format: z.string()
    .describe('Expected final output format, e.g., "research report", "simple answer".')
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export class PlannerService {
  constructor(
    private logger: RequestLogger,
    private llm: any // Fast model like GPT-4o-mini
  ) {}

  async createPlan(userQuery: string): Promise<ExecutionPlan> {
    const startTime = performance.now();
    
    try {
      const planningPrompt = await this.buildPlanningPrompt(userQuery);
      const response = await this.llm.invoke([
        { role: 'system', content: planningPrompt }
      ]);
      
      const plan = ExecutionPlanSchema.parse(JSON.parse(response.content));
      
      this.logger.info('Execution plan created', {
        taskType: plan.task_type,
        internalDocs: plan.required_internal_documents.length,
        externalTopics: plan.external_research_topics.length,
        duration: performance.now() - startTime
      });
      
      return plan;
    } catch (error) {
      this.logger.error('Planning failed, using fallback', { error: error.message });
      return this.createFallbackPlan(userQuery);
    }
  }

  private async buildPlanningPrompt(userQuery: string): Promise<string> {
    const prompt = await import('../prompts/planner.prompt').then(m => m.plannerPromptTemplate);
    return prompt.format({
      user_query: userQuery,
      current_date: new Date().toISOString(),
      schema: JSON.stringify(ExecutionPlanSchema.shape, null, 2)
    });
  }

  private createFallbackPlan(userQuery: string): ExecutionPlan {
    // Simple fallback logic for when LLM planning fails
    return {
      task_type: 'simple_qa',
      required_internal_documents: [],
      external_research_topics: [],
      final_output_format: 'direct answer'
    };
  }
}
```

### **1.2 Create Planner Prompt**
```typescript
// lib/ai/graphs/prompts/planner.prompt.ts
import { ChatPromptTemplate } from '@langchain/core/prompts';

export const plannerPromptTemplate = ChatPromptTemplate.fromMessages([
  ['system', `You are an intelligent task planner for a RAG system. Analyze the user's query and create a structured execution plan.

TASK CLASSIFICATION GUIDELINES:
- **simple_qa**: Direct questions answerable from training data
- **research_only**: Requires current information from web search
- **template_only**: Creating content using existing internal templates/examples
- **hybrid**: Combines template usage with external research (e.g., "research report using templates")

HYBRID TASK INDICATORS:
- "create [content type] using [template/example]"
- "research [entity] for collaboration using [internal docs]"
- "analyze [external entity] based on [internal template]"

DOCUMENT IDENTIFICATION:
- Look for specific document references in the query
- Common templates: "ideal client profile", "client research example", "proposal template"
- Be specific with document names when mentioned

EXTERNAL RESEARCH DETECTION:
- Company names, organizations, people not in internal knowledge base
- Current events, recent news, market information
- Competitive analysis, industry research

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON matching the schema
- Be specific and actionable in your recommendations
- If uncertain, lean toward 'hybrid' for complex content creation tasks

Schema: {schema}

Current date: {current_date}`],
  ['human', `Analyze this query and create an execution plan:

"{user_query}"

Return the plan as JSON:`]
]);
```

### **1.3 Integrate into BrainOrchestrator**
```typescript
// lib/services/brainOrchestrator.ts - Enhance stream() method

async stream(userInput: string, config: StreamConfig): Promise<ReadableStream> {
  // ... existing classification logic

  // NEW: Create execution plan
  const plannerService = new PlannerService(this.logger, this.getLowLatencyLLM());
  const executionPlan = await plannerService.createPlan(userInput);

  // ... existing graph setup

  // Inject plan into initial graph state
  const initialGraphState = {
    messages: [new HumanMessage(userInput)],
    executionPlan: executionPlan, // ← Strategic context for agent
    needsSynthesis: this.determineIfSynthesisNeeded(userInput),
    // ... other initial state
  };

  // Stream with enhanced context
  const stream = agent.langGraphWrapper.stream(initialGraphState, runnableConfig);
  return this.processStream(stream, config);
}

private getLowLatencyLLM() {
  // Return fast model for planning (GPT-4o-mini)
  return new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 500
  });
}
```

---

## **Task 2: Enhanced Agent Prompt with Plan Integration**
*Priority: High - Immediate Impact*

### **2.1 Update Agent Prompt**
```typescript
// lib/ai/graphs/prompts/agent.prompt.ts - Add these sections

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
```

### **2.2 Enhance Agent Node to Use Plan**
```typescript
// lib/ai/graphs/nodes/agent.ts - Use execution plan

export async function agentNode(state: GraphState, dependencies: GraphDependencies) {
  const { executionPlan } = state;
  
  // Log plan-guided decision making
  if (executionPlan && state.iterationCount === 1) {
    logger.info('Agent guided by execution plan', {
      taskType: executionPlan.task_type,
      requiredDocs: executionPlan.required_internal_documents,
      externalResearch: executionPlan.external_research_topics
    });
  }

  // Enhanced system prompt includes plan context
  const systemPrompt = await promptService.loadPrompt({
    modelId: 'agent',
    contextId: null,
    promptType: 'graph',
    graphNodeType: 'agent',
    executionPlan: executionPlan // ← Pass plan to prompt formatting
  });

  // ... rest of agent logic
}
```

---

## **Task 3: Production Hardening & Validation**
*Priority: Medium - Quality Assurance*

### **3.1 Enhanced State Management**
```typescript
// lib/ai/graphs/state.ts - Add execution plan to state

const GraphStateAnnotation = Annotation.Root({
  // ... existing fields
  executionPlan: Annotation<ExecutionPlan | undefined>({
    reducer: (x?: ExecutionPlan, y?: ExecutionPlan) => y ?? x,
    default: () => undefined,
  }),
  planningMetrics: Annotation<{
    planCreatedAt: number;
    planDuration: number;
    planAccuracy?: number;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({ planCreatedAt: 0, planDuration: 0 }),
  }),
});
```

### **3.2 Integration Tests**
```typescript
// tests/reasoning/hybrid-reasoning.test.ts

describe('Plan-and-Execute Intelligence', () => {
  let plannerService: PlannerService;
  let brainOrchestrator: BrainOrchestrator;

  beforeEach(() => {
    plannerService = new PlannerService(mockLogger, mockLLM);
    brainOrchestrator = new BrainOrchestrator(mockConfig);
  });

  test('should create hybrid plan for Audubon query', async () => {
    const query = "Use ideal client profile and client research example to create a research report on Audubon Nature Institute";
    
    const plan = await plannerService.createPlan(query);
    
    expect(plan.task_type).toBe('hybrid');
    expect(plan.external_research_topics).toContain('Audubon Nature Institute');
    expect(plan.required_internal_documents).toContain('ideal client profile');
    expect(plan.required_internal_documents).toContain('client research example');
  });

  test('should execute hybrid plan with both internal and external tools', async () => {
    const query = "Research Tesla using our client analysis template";
    
    const result = await brainOrchestrator.invoke(query);
    
    // Verify both internal and external tools were used
    const toolsUsed = extractToolsFromResult(result);
    expect(toolsUsed).toContain('getMultipleDocuments'); // Internal
    expect(toolsUsed).toContain('tavilySearch'); // External
  });

  test('should prevent agent looping with progress escalation', async () => {
    const ambiguousQuery = "Tell me about that thing we discussed";
    
    const result = await brainOrchestrator.invoke(ambiguousQuery);
    
    expect(result.iterationCount).toBeLessThan(5);
    expect(result.messages).not.toContain('circuit breaker');
  });
});
```

---

## **Implementation Benefits**

### **Strategic Advantages:**
1. **🎯 Root Cause Solution**: Addresses strategic decision-making, not just symptoms
2. **🧠 Semantic Understanding**: LLM planning vs regex pattern matching
3. **📈 Scalability**: Handles novel query types without code changes
4. **🔄 Plan-and-Execute**: Proven pattern for complex AI tasks

### **Architectural Integrity:**
1. **✅ Modular Design**: PlannerService is focused, single-responsibility
2. **✅ Service Injection**: Plan injected into graph state like other dependencies
3. **✅ 200 LOC Principle**: Each service remains focused and manageable
4. **✅ ReAct Preservation**: Agent still reasons dynamically with strategic context

### **Performance Improvements:**
1. **⚡ Reduced Tool Calls**: Strategic planning prevents redundant operations
2. **🎯 Targeted Research**: Explicit external research identification
3. **🚫 Loop Prevention**: Clear progress tracking and escalation rules
4. **📊 Better Observability**: Plan accuracy tracking and metrics

---

## **Conclusion**

This plan implements a **Plan-and-Execute** pattern that provides strategic intelligence while preserving tactical flexibility. The LLM-powered planner addresses the root cause identified in the trace analysis: poor strategic decision-making that led to inefficient tool usage and missing external research.

**Implementation Priority:**
1. **Task 1** - PlannerService (Strategic foundation)
2. **Task 2** - Enhanced prompts (Tactical improvements)  
3. **Task 3** - Testing & validation (Quality assurance)

This approach transforms the agent from a reactive tool-caller into an intelligent executor of strategic plans. 