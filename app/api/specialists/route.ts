import { NextResponse } from 'next/server';

/**
 * GET /api/specialists
 * 
 * Returns available specialists for the frontend dropdown.
 * Simplified implementation without database dependencies.
 */
export async function GET() {
  try {
    // Return hardcoded specialists to avoid database initialization issues
    const specialists = [
      {
        id: 'chat-model',
        name: 'General Chat',
        description: 'General conversational assistant',
      },
      {
        id: 'echo-tango-specialist',
        name: 'Echo Tango',
        description: 'Specialist for Echo Tango client',
      },
    ];
    
    return NextResponse.json({ 
      specialists,
      success: true 
    });
  } catch (error) {
    console.error('[SpecialistsAPI] Error:', error);
    
    return NextResponse.json({ 
      specialists: [],
      success: false,
      error: 'Failed to fetch specialists'
    }, { status: 500 });
  }
} 