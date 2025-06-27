/**
 * Test Unified Tool Registry
 *
 * Simple test endpoint to demonstrate the new unified tool system.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initializeTools,
  getAvailableTools,
  findTools,
  getToolStats,
  executeTool,
} from '@/lib/ai/tools/registry';

export async function GET(request: NextRequest) {
  try {
    console.log('[TestUnifiedTools] Starting unified tool system test...');

    // Initialize the tool system
    console.log('[TestUnifiedTools] Initializing tools...');
    await initializeTools();

    // Get all available tools
    console.log('[TestUnifiedTools] Getting available tools...');
    const allTools = await getAvailableTools();

    // Get statistics
    const stats = getToolStats();

    // Test tool search
    const asanaTools = findTools('asana');
    const projectTools = findTools('project');

    // Test a simple tool execution (if available)
    let testExecution = null;
    const listProjectsTool = allTools.find(
      (tool) => tool.name === 'asana_list_projects',
    );
    if (listProjectsTool) {
      try {
        console.log('[TestUnifiedTools] Testing tool execution...');
        testExecution = await executeTool(
          'asana_list_projects',
          {},
          {
            userId: 'test-user',
            clientId: 'echo-tango',
          },
        );
      } catch (error: any) {
        testExecution = { error: error.message };
      }
    }

    const response = {
      success: true,
      message: 'Unified tool system test completed',
      results: {
        stats,
        toolCounts: {
          total: allTools.length,
          byCategory: allTools.reduce(
            (acc, tool) => {
              acc[tool.category] = (acc[tool.category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          bySource: allTools.reduce(
            (acc, tool) => {
              acc[tool.source] = (acc[tool.source] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        searchResults: {
          asanaTools: asanaTools.length,
          projectTools: projectTools.length,
        },
        sampleTools: allTools.slice(0, 5).map((tool) => ({
          name: tool.name,
          displayName: tool.displayName,
          category: tool.category,
          source: tool.source,
          description: tool.description,
          usage: tool.usage,
          examples: tool.examples.slice(0, 2),
        })),
        testExecution,
      },
    };

    console.log('[TestUnifiedTools] Test completed successfully');
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[TestUnifiedTools] Test failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
