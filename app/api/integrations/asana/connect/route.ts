import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@/app/(auth)/auth';

/**
 * Asana OAuth Connection Initiation
 *
 * Redirects users to Asana for OAuth authorization using configured endpoints
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session for OAuth flow
    const session = await auth();
    if (!session?.user?.id) {
      console.error(
        '[AsanaOAuth] No authenticated user session for OAuth initiation',
      );
      return NextResponse.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(request.url)}`,
          request.url,
        ),
      );
    }

    // Validate environment variables using actual config names
    const clientId = process.env.ASANA_OAUTH_CLIENT_ID;
    const authUrl = process.env.ASANA_OAUTH_AUTHORIZATION_URL;
    const redirectUri = process.env.ASANA_OAUTH_REDIRECT_URI;

    if (!clientId || !authUrl || !redirectUri) {
      console.error('[AsanaOAuth] Missing required Asana OAuth configuration', {
        hasClientId: !!clientId,
        hasAuthUrl: !!authUrl,
        hasRedirectUri: !!redirectUri,
      });
      return NextResponse.json(
        { error: 'Asana integration not configured' },
        { status: 500 },
      );
    }

    // Generate secure state parameter with user ID
    const stateData = {
      userId: session.user.id,
      nonce: randomBytes(16).toString('base64url'),
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Build Asana OAuth URL using configured endpoints
    const asanaAuthUrl = new URL(authUrl);
    asanaAuthUrl.searchParams.set('client_id', clientId);
    asanaAuthUrl.searchParams.set('response_type', 'code');
    asanaAuthUrl.searchParams.set('redirect_uri', redirectUri);
    asanaAuthUrl.searchParams.set('state', state);

    console.log('[AsanaOAuth] Redirecting to Asana authorization', {
      authUrl: authUrl,
      redirectUri: redirectUri,
      state: `${state.substring(0, 8)}...`,
    });

    return NextResponse.redirect(asanaAuthUrl.toString());
  } catch (error) {
    console.error('[AsanaOAuth] Error initiating OAuth flow:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Asana connection' },
      { status: 500 },
    );
  }
}
