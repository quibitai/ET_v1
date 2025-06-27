/**
 * Test Google Workspace Tools API
 *
 * This endpoint tests the Google Workspace tool adapter and OAuth bridge
 * to verify they work correctly with the current user session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('[TestGoogleTools] Starting Google Workspace tools test...');

    // Get current session
    const session = await auth();
    console.log('[TestGoogleTools] Session:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      hasAccessToken: !!session?.accessToken,
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'No authenticated session found. Please sign in.',
        },
        { status: 401 },
      );
    }

    // Test OAuth Bridge
    console.log('[TestGoogleTools] Testing OAuth bridge...');
    const { googleWorkspaceOAuthBridge } = await import(
      '@/lib/services/googleWorkspaceOAuthBridge'
    );

    const userContextForOAuth = {
      id: session.user.id || 'unknown',
      email: session.user.email || 'unknown',
      name: session.user.name || undefined,
    };

    const toolContext = {
      user: {
        id: session.user.id || 'unknown',
        email: session.user.email || 'unknown',
        name: session.user.name || undefined,
      },
    };

    // Check authentication status
    const authStatus =
      await googleWorkspaceOAuthBridge.getAuthenticationStatus(
        userContextForOAuth,
      );
    console.log('[TestGoogleTools] Auth status:', authStatus);

    // Test creating authenticated client
    let clientTest = null;
    try {
      const client =
        await googleWorkspaceOAuthBridge.createAuthenticatedClient(
          userContextForOAuth,
        );
      clientTest = {
        success: !!client,
        clientCreated: !!client,
      };
      console.log('[TestGoogleTools] Client creation test:', clientTest);
    } catch (error) {
      clientTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.log('[TestGoogleTools] Client creation failed:', clientTest);
    }

    // Test Google Workspace Tool Adapter
    console.log('[TestGoogleTools] Testing Google Workspace tool adapter...');
    let adapterTest = null;
    try {
      const { GoogleWorkspaceToolAdapter } = await import(
        '@/lib/ai/tools/adapters/GoogleWorkspaceToolAdapter'
      );
      const adapter = new GoogleWorkspaceToolAdapter();
      await adapter.initialize();
      const tools = adapter.getTools();

      adapterTest = {
        success: true,
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
        toolCategories: [...new Set(tools.map((t) => t.category))],
      };
      console.log('[TestGoogleTools] Adapter test:', adapterTest);
    } catch (error) {
      adapterTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.log('[TestGoogleTools] Adapter test failed:', adapterTest);
    }

    // Test tool execution (if we have a working client)
    let executionTest = null;
    if (clientTest?.success && adapterTest?.success) {
      console.log('[TestGoogleTools] Testing tool execution...');
      try {
        const { GoogleWorkspaceToolAdapter } = await import(
          '@/lib/ai/tools/adapters/GoogleWorkspaceToolAdapter'
        );
        const adapter = new GoogleWorkspaceToolAdapter();
        await adapter.initialize();
        const tools = adapter.getTools();

        // Try to execute a simple Gmail list tool
        const gmailListTool = tools.find(
          (t) => t.name === 'list_gmail_messages',
        );
        if (gmailListTool) {
          const result = await gmailListTool.execute(
            { max_results: 5 },
            toolContext,
          );
          executionTest = {
            success: result.success,
            toolName: 'list_gmail_messages',
            hasData: !!result.data,
            error: result.error,
          };
        } else {
          executionTest = {
            success: false,
            error: 'Gmail list tool not found',
          };
        }
        console.log('[TestGoogleTools] Execution test:', executionTest);
      } catch (error) {
        executionTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        console.log('[TestGoogleTools] Execution test failed:', executionTest);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        hasSession: !!session,
        userEmail: session.user.email,
        hasAccessToken: !!session.accessToken,
      },
      authStatus,
      clientTest,
      adapterTest,
      executionTest,
    });
  } catch (error) {
    console.error('[TestGoogleTools] Test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
