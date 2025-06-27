import { type NextRequest, NextResponse } from 'next/server';

/**
 * Google Chat Webhook Handler
 *
 * This endpoint receives events from Google Chat when users interact with the Chat app.
 * It handles direct messages, space additions, and other Chat events.
 */

interface ChatEvent {
  type: 'MESSAGE' | 'ADDED_TO_SPACE' | 'REMOVED_FROM_SPACE';
  eventTime: string;
  message?: {
    name: string;
    sender: {
      name: string;
      displayName: string;
      email: string;
    };
    text: string;
    space: {
      name: string;
      type: 'ROOM' | 'DM';
    };
  };
  space?: {
    name: string;
    type: 'ROOM' | 'DM';
  };
  user?: {
    name: string;
    displayName: string;
    email: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatEvent = await request.json();

    console.log(
      '[Chat Webhook] Received event:',
      JSON.stringify(body, null, 2),
    );

    // Handle different event types
    switch (body.type) {
      case 'MESSAGE':
        return handleMessage(body);

      case 'ADDED_TO_SPACE':
        return handleAddedToSpace(body);

      case 'REMOVED_FROM_SPACE':
        return handleRemovedFromSpace(body);

      default:
        console.log('[Chat Webhook] Unknown event type:', body.type);
        return NextResponse.json({ text: 'Event received' });
    }
  } catch (error) {
    console.error('[Chat Webhook] Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 },
    );
  }
}

/**
 * Handle incoming chat messages
 */
async function handleMessage(event: ChatEvent) {
  const { message } = event;

  if (!message) {
    return NextResponse.json({ text: 'No message found' });
  }

  console.log(
    `[Chat Webhook] Message from ${message.sender.displayName}: ${message.text}`,
  );

  // Simple echo response for now
  const response = {
    text: `Hello ${message.sender.displayName}! I received your message: "${message.text}"\n\nI'm the ET Quibit assistant. How can I help you today?`,
  };

  return NextResponse.json(response);
}

/**
 * Handle being added to a space
 */
async function handleAddedToSpace(event: ChatEvent) {
  const { space, user } = event;

  console.log(
    `[Chat Webhook] Added to space: ${space?.name} by ${user?.displayName}`,
  );

  const response = {
    text: `👋 Hello! I'm the ET Quibit assistant. I'm here to help with productivity tasks, email management, calendar scheduling, and more!\n\nTry asking me things like:\n• "Show me my recent emails"\n• "What's on my calendar today?"\n• "Create a document"\n• "Search my Drive files"`,
  };

  return NextResponse.json(response);
}

/**
 * Handle being removed from a space
 */
async function handleRemovedFromSpace(event: ChatEvent) {
  console.log('[Chat Webhook] Removed from space:', event.space?.name);

  // No response needed for removal events
  return NextResponse.json({});
}

/**
 * Handle GET requests (for verification)
 */
export async function GET() {
  return NextResponse.json({
    status: 'Chat webhook is running',
    timestamp: new Date().toISOString(),
  });
}
