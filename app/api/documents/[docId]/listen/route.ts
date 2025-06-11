import { type NextRequest, NextResponse } from 'next/server';

/**
 * SSE endpoint for document updates
 * Returns a stream of server-sent events for document updates.
 * This allows real-time notifications when a document is being updated
 * by the AI or other sources.
 */
export async function GET(request: NextRequest) {
  // Document functionality has been removed in Phase 1, Task 1.2
  return new NextResponse('Document listen functionality has been deprecated', {
    status: 410,
    headers: { 'Content-Type': 'text/plain' },
  });
}
