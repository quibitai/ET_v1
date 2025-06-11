

export async function GET(request: Request) {
  // Suggestion functionality has been removed in Phase 1, Task 1.2
  return new Response('Suggestion functionality has been deprecated', {
    status: 410,
    headers: { 'Content-Type': 'text/plain' },
  });
}
