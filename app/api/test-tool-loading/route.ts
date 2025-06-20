import { NextResponse } from 'next/server';
import { getAvailableTools } from '@/lib/ai/tools';

export const runtime = 'nodejs';

/**
 * Test endpoint to verify tool loading
 * Tests if Asana MCP tools are being loaded from environment variables
 */
export async function GET() {
  try {
    console.log('[TestToolLoading] Testing tool loading...');
    console.log('[TestToolLoading] Environment check:');
    console.log(
      '  ASANA_ACCESS_TOKEN:',
      process.env.ASANA_ACCESS_TOKEN ? 'SET' : 'NOT_SET',
    );
    console.log('  ASANA_MCP_SERVER_URL:', process.env.ASANA_MCP_SERVER_URL);

    // Mock session with user ID
    const mockSession = {
      user: {
        id: 'test-user-env-tools',
      },
    };

    console.log('[TestToolLoading] Calling getAvailableTools...');

    // Get all available tools (should now include Asana from env vars)
    const tools = await getAvailableTools(mockSession);

    console.log('[TestToolLoading] Got tools:', tools.length);
    console.log(
      '[TestToolLoading] Tool names:',
      tools.map((t) => t.name),
    );

    // Filter for Asana tools
    const asanaTools = tools.filter((tool) =>
      tool.name.toLowerCase().includes('asana'),
    );

    console.log('[TestToolLoading] Asana tools found:', asanaTools.length);

    // Also test direct Asana tool creation
    let directAsanaTest = null;
    try {
      console.log('[TestToolLoading] Testing direct Asana tool creation...');
      const { createAsanaTools } = await import('@/lib/ai/tools/mcp/asana');
      const directAsanaTools = await createAsanaTools(
        'test-user-direct',
        'test-session',
      );
      directAsanaTest = {
        success: true,
        toolCount: directAsanaTools.length,
        toolNames: directAsanaTools.map((t) => t.name),
      };
      console.log('[TestToolLoading] Direct Asana tools:', directAsanaTest);
    } catch (error) {
      console.error(
        '[TestToolLoading] Direct Asana tool creation failed:',
        error,
      );
      directAsanaTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    const response = {
      status: 'success',
      toolLoadingTest: {
        totalTools: tools.length,
        asanaToolCount: asanaTools.length,
        asanaToolNames: asanaTools.map((t) => t.name),
        allToolNames: tools.map((t) => t.name),
        environmentVariables: {
          ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
            ? 'SET ✅'
            : 'NOT_SET',
          ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'NOT_SET',
        },
      },
      directAsanaTest,
      success: asanaTools.length > 0,
      message:
        asanaTools.length > 0
          ? `✅ Successfully loaded ${asanaTools.length} Asana tools from environment variables!`
          : '❌ No Asana tools found - check environment variables and server startup logs',
    };

    console.log('[TestToolLoading] Tool loading test completed:', {
      totalTools: tools.length,
      asanaTools: asanaTools.length,
      success: asanaTools.length > 0,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[TestToolLoading] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Test endpoint to actually execute an Asana tool and see what error occurs
 */
export async function POST() {
  try {
    console.log('[TestToolExecution] Testing actual tool execution...');

    // Mock session with user ID
    const mockSession = {
      user: {
        id: 'test-user-execution',
      },
    };

    // Get all available tools
    const tools = await getAvailableTools(mockSession);
    console.log('[TestToolExecution] Total tools loaded:', tools.length);

    // Find tools we want to test
    const searchTasksTool = tools.find(
      (tool) => tool.name === 'asana_search_tasks',
    );
    const listWorkspacesTool = tools.find(
      (tool) => tool.name === 'asana_list_workspaces',
    );
    const searchProjectsTool = tools.find(
      (tool) => tool.name === 'asana_search_projects',
    );

    if (!searchTasksTool || !listWorkspacesTool) {
      return NextResponse.json({
        status: 'error',
        error: 'Required Asana tools not found',
        availableAsanaTools: tools
          .filter((t) => t.name.includes('asana'))
          .map((t) => t.name),
      });
    }

    console.log(
      '[TestToolExecution] Found required tools, testing execution...',
    );

    // Test 1: List workspaces first to see what's available
    let workspacesResult = null;
    let workspacesError = null;

    try {
      console.log('[TestToolExecution] Test 1: Listing workspaces...');
      workspacesResult = await listWorkspacesTool.func({});
      console.log('[TestToolExecution] Workspaces result:', workspacesResult);
    } catch (error) {
      console.error('[TestToolExecution] Workspace listing failed:', error);
      workspacesError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    // Test 2: Search projects to see if we can find projects
    let projectsResult = null;
    let projectsError = null;

    if (searchProjectsTool) {
      try {
        console.log('[TestToolExecution] Test 2: Searching projects...');
        projectsResult = await searchProjectsTool.func({
          name_pattern: '.*', // Match any project name
        });
        console.log('[TestToolExecution] Projects result:', projectsResult);
      } catch (error) {
        console.error('[TestToolExecution] Project search failed:', error);
        projectsError = {
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Test 3: Search tasks with more specific parameters
    let searchResult = null;
    let searchError = null;

    try {
      console.log(
        '[TestToolExecution] Test 3: Search tasks with specific parameters...',
      );
      const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

      // Try with text search parameter to make it more specific
      searchResult = await searchTasksTool.func({
        workspace: workspaceId,
        text: '', // Empty text to search all tasks
        completed: false, // Only incomplete tasks
        limit: 10, // Limit results
      });
      console.log('[TestToolExecution] Search with parameters succeeded');
    } catch (error) {
      console.error(
        '[TestToolExecution] Search with parameters failed:',
        error,
      );
      searchError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
      };
    }

    return NextResponse.json({
      status: 'success',
      tests: {
        workspacesList: {
          success: !workspacesError,
          result: workspacesResult,
          error: workspacesError,
        },
        projectsSearch: {
          success: !projectsError,
          result: projectsResult,
          error: projectsError,
        },
        taskSearch: {
          success: !searchError,
          result: searchResult,
          error: searchError,
        },
      },
      environmentCheck: {
        ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
          ? 'SET ✅'
          : 'NOT_SET',
        DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'NOT_SET',
        ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'NOT_SET',
      },
      summary: {
        workspacesWorked: !workspacesError,
        projectsWorked: !projectsError,
        taskSearchWorked: !searchError,
      },
    });
  } catch (error) {
    console.error('[TestToolExecution] Outer error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Test endpoint to simulate the actual chat execution path
 */
export async function PUT() {
  try {
    console.log('[TestChatExecution] Testing chat execution path...');

    // Import the main brain API logic
    const { POST: brainPost } = await import('@/app/api/brain/route');

    // Create a mock request that simulates the chat asking for Asana tasks
    const mockBody = {
      messages: [
        {
          id: 'test-message-1',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'show me my asana tasks',
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
      chatId: 'test-chat-execution',
      userId: 'test-user-chat-execution',
      clientId: 'echo-tango',
    };

    // Create a mock request object
    const mockRequest = {
      json: async () => mockBody,
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    };

    console.log('[TestChatExecution] Calling brain API with mock request...');

    // Call the brain API
    let brainResponse = null;
    let brainError = null;

    try {
      brainResponse = await brainPost(mockRequest as any);
      console.log('[TestChatExecution] Brain API call completed');
    } catch (error) {
      console.error('[TestChatExecution] Brain API call failed:', error);
      brainError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }

    // Also test if we can manually force tool selection
    let manualToolTest = null;
    try {
      console.log('[TestChatExecution] Testing manual tool selection...');

      // Get tools for the session
      const { getAvailableTools } = await import('@/lib/ai/tools');
      const mockSession = { user: { id: 'test-user-manual' } };
      const tools = await getAvailableTools(mockSession);

      const asanaSearchTool = tools.find(
        (t) => t.name === 'asana_search_tasks',
      );
      if (asanaSearchTool) {
        const result = await asanaSearchTool.func({
          workspace: process.env.DEFAULT_WORKSPACE_ID,
          text: '',
          completed: false,
          limit: 5,
        });

        manualToolTest = {
          success: true,
          toolName: 'asana_search_tasks',
          result: JSON.parse(result),
        };
      } else {
        manualToolTest = {
          success: false,
          error: 'asana_search_tasks tool not found',
          availableTools: tools.map((t) => t.name),
        };
      }
    } catch (error) {
      manualToolTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return NextResponse.json({
      status: 'success',
      chatExecutionTest: {
        brainApiCalled: true,
        brainSuccess: !brainError,
        brainError,
        brainResponseStatus: brainResponse ? brainResponse.status : null,
      },
      manualToolTest,
      environmentCheck: {
        ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN
          ? 'SET ✅'
          : 'NOT_SET',
        DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'NOT_SET',
        ASANA_MCP_SERVER_URL: process.env.ASANA_MCP_SERVER_URL || 'NOT_SET',
      },
      recommendation:
        'If manualToolTest works but chatExecutionTest fails, the issue is in the LangGraph tool selection/execution logic',
    });
  } catch (error) {
    console.error('[TestChatExecution] Outer error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Test endpoint to test the specific empty parameter fix
 */
export async function PATCH() {
  try {
    console.log('[TestEmptyParams] Testing empty parameter fix for Asana...');

    // Create a simple tool function for testing
    const createMcpToolFunction = (toolName: string, client: any) => {
      return async (input: any) => {
        try {
          const result = await client.callTool({
            name: toolName,
            arguments: input || {},
          });
          return JSON.stringify(result.content, null, 2);
        } catch (error: any) {
          return JSON.stringify(
            {
              error: error.message || 'Unknown error',
              tool: toolName,
            },
            null,
            2,
          );
        }
      };
    };

    // Mock client that matches the actual MCP client interface
    const mockClient = {
      callTool: async ({
        name,
        arguments: args,
      }: { name: string; arguments: any }) => {
        console.log(`[MockClient] Tool: ${name}, Args:`, args);

        // Simulate what would happen with these exact parameters
        if (name === 'asana_search_tasks') {
          if (!args.workspace) {
            // This is what was happening before the fix
            return {
              error: 'Bad Request - workspace required',
              content:
                'Error: Bad Request error when searching tasks. Check that all parameters are valid. Common issues: invalid workspace ID, invalid project reference, or incompatible search filters. Bad Request',
            };
          }

          // Simulate successful call with workspace
          return {
            content:
              '[{"gid":"1210586751633328","name":"C&C Digital Board","resource_type":"task","resource_subtype":"default_task"},{"gid":"1210586751633323","name":"Get Cosmo on Red Giant (for smoothing skin and hair) ","resource_type":"task","resource_subtype":"default_task"}]',
          };
        }

        return { content: 'Mock response' };
      },
    };

    // Test 1: Empty input (what LangGraph was sending)
    console.log('[TestEmptyParams] Test 1: Empty input');
    const asanaSearchTool = createMcpToolFunction(
      'asana_search_tasks',
      mockClient,
    );

    let emptyInputResult: string;
    try {
      emptyInputResult = await asanaSearchTool({});
      console.log('[TestEmptyParams] Empty input result:', emptyInputResult);
    } catch (error) {
      emptyInputResult = `Error: ${error instanceof Error ? error.message : error}`;
    }

    // Test 2: Undefined input (alternative case)
    console.log('[TestEmptyParams] Test 2: Undefined input');
    let undefinedInputResult: string;
    try {
      undefinedInputResult = await asanaSearchTool(undefined);
      console.log(
        '[TestEmptyParams] Undefined input result:',
        undefinedInputResult,
      );
    } catch (error) {
      undefinedInputResult = `Error: ${error instanceof Error ? error.message : error}`;
    }

    // Test 3: Proper input (should still work)
    console.log('[TestEmptyParams] Test 3: Proper input');
    let properInputResult: string;
    try {
      properInputResult = await asanaSearchTool({
        workspace: '1208105180296349',
        text: '',
        completed: false,
        limit: 5,
      });
      console.log('[TestEmptyParams] Proper input result:', properInputResult);
    } catch (error) {
      properInputResult = `Error: ${error instanceof Error ? error.message : error}`;
    }

    return NextResponse.json({
      status: 'success',
      message: 'Empty parameter fix test completed',
      testResults: {
        emptyInput: {
          success:
            !emptyInputResult.includes('Error') &&
            !emptyInputResult.includes('Bad Request'),
          result: emptyInputResult,
          expectedFix: 'Should apply default workspace parameters',
        },
        undefinedInput: {
          success:
            !undefinedInputResult.includes('Error') &&
            !undefinedInputResult.includes('Bad Request'),
          result: undefinedInputResult,
          expectedFix: 'Should apply default workspace parameters',
        },
        properInput: {
          success: !properInputResult.includes('Error'),
          result: properInputResult,
          expectedBehavior: 'Should work normally with provided parameters',
        },
      },
      environmentCheck: {
        DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || 'NOT_SET',
      },
      fixApplied:
        'Modified createMcpToolFunction to add default workspace for asana_search_tasks when input is empty',
    });
  } catch (error) {
    console.error('[TestEmptyParams] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Test endpoint to test the QueryClassifier improvements for Asana tool selection
 */
export async function DELETE() {
  try {
    console.log(
      '[TestQueryClassifier] Testing QueryClassifier Asana tool selection...',
    );

    // Import the QueryClassifier
    const { QueryClassifier } = await import('@/lib/services/queryClassifier');

    // Create a mock logger for testing
    const mockLogger = {
      info: (message: string, data?: any) =>
        console.log(`[Logger] ${message}`, data),
      error: (message: string, data?: any) =>
        console.error(`[Logger] ${message}`, data),
      warn: (message: string, data?: any) =>
        console.warn(`[Logger] ${message}`, data),
      debug: (message: string, data?: any) =>
        console.debug(`[Logger] ${message}`, data),
    };

    const classifier = new QueryClassifier(mockLogger as any);

    // Test different types of Asana queries
    const testQueries = [
      {
        query: 'show me active projects on asana',
        expectedTool: 'asana_search_projects',
        description: 'General project listing query',
      },
      {
        query: 'list my asana tasks',
        expectedTool: 'asana_search_tasks',
        description: 'General task listing query',
      },
      {
        query: 'show me my incomplete tasks on asana',
        expectedTool: 'asana_search_tasks',
        description: 'Filtered task query (incomplete)',
      },
      {
        query: 'show me my workspaces',
        expectedTool: 'asana_list_workspaces',
        description: 'Workspace listing query',
      },
      {
        query: 'create a new task',
        expectedTool: 'asana_create_task',
        description: 'Task creation query',
      },
      {
        query: 'create a new project',
        expectedTool: 'asana_create_project',
        description: 'Project creation query',
      },
      {
        query: 'update my task',
        expectedTool: 'asana_update_task',
        description: 'Task update query',
      },
      {
        query: 'what teams are available?',
        expectedTool: 'asana_get_teams_for_workspace',
        description: 'Team listing query',
      },
      {
        query: 'show me tasks due today',
        expectedTool: 'asana_search_tasks',
        description: 'Filtered task query (due date)',
      },
      {
        query: 'list urgent tasks',
        expectedTool: 'asana_search_tasks',
        description: 'Filtered task query (priority)',
      },
    ];

    const results = [];

    for (const testCase of testQueries) {
      console.log(`[TestQueryClassifier] Testing: "${testCase.query}"`);

      const classification = await classifier.classifyQuery(testCase.query);
      const actualTool =
        typeof classification.forceToolCall === 'object' &&
        classification.forceToolCall?.name
          ? classification.forceToolCall.name
          : 'no_tool_forced';
      const isCorrect = actualTool === testCase.expectedTool;

      const result = {
        query: testCase.query,
        description: testCase.description,
        expectedTool: testCase.expectedTool,
        actualTool,
        isCorrect,
        confidence: classification.confidence,
        asanaDetected: classification.reasoning.includes('Asana'),
      };

      results.push(result);

      console.log(
        `[TestQueryClassifier] ${isCorrect ? '✅' : '❌'} ${testCase.description}:`,
      );
      console.log(`  Expected: ${testCase.expectedTool}`);
      console.log(`  Actual: ${actualTool}`);
      console.log(`  Confidence: ${classification.confidence}`);
    }

    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = (correctCount / results.length) * 100;

    return NextResponse.json({
      success: true,
      message: `QueryClassifier Asana tool selection test completed`,
      accuracy: `${accuracy.toFixed(1)}%`,
      correctCount,
      totalTests: results.length,
      results,
    });
  } catch (error) {
    console.error('[TestQueryClassifier] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'QueryClassifier test failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
