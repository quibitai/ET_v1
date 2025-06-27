import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { GoogleWorkspaceMCPClient } from '@/lib/ai/mcp/GoogleWorkspaceMCPClient';

/**
 * Send a message via Google Chat
 * POST /api/chat/send-message
 */

interface SendChatMessageRequest {
  recipientEmail?: string;
  message: string;
  spaceId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const body: SendChatMessageRequest = await request.json();
    const { recipientEmail, message, spaceId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    console.log(
      `[Chat Send Message] User: ${session.user.email}, Message: "${message}"`,
    );

    const mcpClient = new GoogleWorkspaceMCPClient();

    // If spaceId is provided, send directly to that space
    if (spaceId) {
      console.log(`[Chat Send Message] Sending to space: ${spaceId}`);

      const result = await mcpClient.executeChatTool('send_message', {
        user_google_email: session.user.email,
        space_id: spaceId,
        message_text: message,
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Message sent successfully',
          details: result.result,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to send message: ${result.error}`,
          },
          { status: 500 },
        );
      }
    }

    // If recipientEmail is provided, try to find or create a DM space
    if (recipientEmail) {
      console.log(
        `[Chat Send Message] Finding DM space with: ${recipientEmail}`,
      );

      // First, list spaces to find existing DM
      const spacesResult = await mcpClient.executeChatTool('list_spaces', {
        user_google_email: session.user.email,
        page_size: 100,
        space_type: 'dm',
      });

      if (!spacesResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to access Google Chat: ${spacesResult.error}`,
            authRequired: spacesResult.error?.includes(
              'Authentication required',
            ),
          },
          { status: 500 },
        );
      }

      // For now, return instructions on how to send messages
      // TODO: Implement DM space creation/finding logic
      return NextResponse.json({
        success: false,
        message: `Direct messaging to ${recipientEmail} requires finding or creating a DM space.`,
        recommendation: `For now, please:
1. Open Google Chat
2. Start a conversation with ${recipientEmail}
3. Get the space ID from the URL
4. Use that space ID in your request`,
        spacesFound: spacesResult.result,
      });
    }

    // No spaceId or recipientEmail provided
    return NextResponse.json(
      {
        success: false,
        error: 'Either spaceId or recipientEmail must be provided',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Chat Send Message] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
