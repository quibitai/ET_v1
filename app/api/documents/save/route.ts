import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Document functionality has been removed in Phase 1, Task 1.2
  return new NextResponse('Document save functionality has been deprecated', {
    status: 410,
    headers: { 'Content-Type': 'text/plain' },
  });
}
