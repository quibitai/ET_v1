import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { logger } from '@/lib/logger';

/**
 * API endpoint to refresh Google OAuth token
 * This helps users who are already signed in but don't have access tokens captured
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // For now, we'll redirect them to re-authenticate with Google
    // This is the simplest way to capture fresh tokens
    const googleAuthUrl = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(
      request.headers.get('referer') || '/test-google',
    )}`;

    return NextResponse.json({
      success: false,
      message:
        'Please sign out and sign back in with Google to capture access tokens',
      redirectUrl: googleAuthUrl,
      instructions: [
        '1. Sign out of your current session',
        '2. Sign back in with Google',
        '3. Grant all requested permissions',
        '4. Return to the test page',
      ],
    });
  } catch (error) {
    logger.error('Auth', 'Token refresh failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
