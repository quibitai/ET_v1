import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Document functionality has been removed in Phase 1, Task 1.2
  return new NextResponse(
    'Document retrieval functionality has been deprecated',
    {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    },
  );
}

export async function DELETE(request: NextRequest) {
  // Document functionality has been removed in Phase 1, Task 1.2
  return new NextResponse(
    'Document deletion functionality has been deprecated',
    {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    },
  );
}
