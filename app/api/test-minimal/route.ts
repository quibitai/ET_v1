import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('[TEST API] Minimal test handler invoked');
  
  try {
    const body = await req.json();
    console.log('[TEST API] Body received:', body);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test API working',
      received: body 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[TEST API] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: 'Test API healthy' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}