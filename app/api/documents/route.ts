import { type NextRequest, NextResponse } from 'next/server';

// POST handler to create a new document
export async function POST(request: NextRequest) {
  // Document functionality has been removed in Phase 1, Task 1.2
  return new NextResponse(
    'Document creation functionality has been deprecated',
    {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    },
  );
}
