import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
// Document functionality removed - this endpoint is deprecated

// Force Node.js runtime for this route to avoid Edge Runtime issues with auth
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[Documents History API] Starting request handling');
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    console.log(
      '[Documents History API] Error: Both starting_after and ending_before provided',
    );
    return Response.json(
      'Only one of starting_after or ending_before can be provided!',
      { status: 400 },
    );
  }

  console.log('[Documents History API] Fetching auth session...');
  const session = await auth();
  console.log('[Documents History API] Session received:', session);
  console.log(
    '[Documents History API] User ID from session:',
    session?.user?.id,
  );

  if (!session?.user?.id) {
    console.log('[Documents History API] Unauthorized: No user ID in session');
    return Response.json('Unauthorized!', { status: 401 });
  }

  try {
    console.log(
      '[Documents History API] Fetching documents for user ID:',
      session.user.id,
    );
    // Document functionality has been removed in Phase 1, Task 1.2
    return Response.json(
      {
        message: 'Document history functionality has been deprecated',
        documents: [],
        hasMore: false,
      },
      { status: 410 },
    );
  } catch (error) {
    console.error('[Documents History API] Error fetching documents:', error);
    return Response.json('Failed to fetch documents!', { status: 500 });
  }
}
