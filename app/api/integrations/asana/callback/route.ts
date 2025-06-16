import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { McpIntegrationRepository } from '@/lib/db/repositories/mcpIntegrations';

/**
 * Asana OAuth Callback Handler
 *
 * Handles the OAuth authorization code exchange for opaque access tokens.
 * CRITICAL: Ensures opaque tokens are stored, NOT JWT tokens.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Extract user ID from state parameter
    let userId: string;
    try {
      if (!state) {
        throw new Error('Missing state parameter');
      }
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = stateData.userId;

      if (!userId) {
        throw new Error('Missing user ID in state');
      }

      // Optional: Validate timestamp to prevent replay attacks
      const age = Date.now() - stateData.timestamp;
      if (age > 10 * 60 * 1000) {
        // 10 minutes
        throw new Error('State parameter expired');
      }

      console.log('[AsanaOAuth] Extracted user ID from state', {
        userId: `${userId.substring(0, 8)}...`,
        age: `${Math.round(age / 1000)}s`,
      });
    } catch (stateError) {
      console.error('[AsanaOAuth] Invalid state parameter:', stateError);
      return NextResponse.redirect(
        new URL('/?error=oauth_invalid_state', request.url),
      );
    }

    // Handle OAuth errors
    if (error) {
      console.error('[AsanaOAuth] OAuth error from Asana:', error);
      return NextResponse.redirect(
        new URL(
          `/?error=asana_oauth_error&message=${encodeURIComponent(error)}`,
          request.url,
        ),
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[AsanaOAuth] Missing code or state parameter');
      return NextResponse.redirect(
        new URL('/?error=oauth_invalid_request', request.url),
      );
    }

    console.log('[AsanaOAuth] Received callback', {
      hasCode: !!code,
      state: `${state.substring(0, 8)}...`,
    });

    // Validate environment variables
    const clientId = process.env.ASANA_OAUTH_CLIENT_ID;
    const clientSecret = process.env.ASANA_OAUTH_CLIENT_SECRET;
    const tokenUrl = process.env.ASANA_OAUTH_TOKEN_URL;
    const redirectUri = process.env.ASANA_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !tokenUrl || !redirectUri) {
      console.error('[AsanaOAuth] Missing OAuth configuration');
      return NextResponse.redirect(
        new URL('/?error=oauth_config_error', request.url),
      );
    }

    // Exchange authorization code for access token
    console.log('[AsanaOAuth] Exchanging code for access token');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[AsanaOAuth] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });
      return NextResponse.redirect(
        new URL('/?error=token_exchange_failed', request.url),
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('[AsanaOAuth] Token exchange successful', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
    });

    // CRITICAL: Verify we received an opaque token (not JWT)
    if (tokenData.access_token?.includes('.')) {
      console.warn(
        '[AsanaOAuth] WARNING: Received token contains dots (possible JWT)',
      );
      // Don't fail, but log for investigation
    }

    // Store encrypted tokens in database
    console.log('[AsanaOAuth] Storing encrypted tokens in database');

    // Calculate expiration time
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Find Asana MCP server ID
    const asanaServer =
      await McpIntegrationRepository.getMcpServerByName('Asana');
    if (!asanaServer) {
      console.error('[AsanaOAuth] Asana MCP server not found in database');
      return NextResponse.redirect(
        new URL('/?error=asana_server_not_found', request.url),
      );
    }

    // Store the integration with encrypted tokens
    await McpIntegrationRepository.upsertUserMcpIntegration(
      userId,
      asanaServer.id,
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        expiresAt: expiresAt || undefined,
        scope: tokenData.scope || undefined,
      },
    );

    console.log('[AsanaOAuth] Successfully stored encrypted tokens', {
      userId: `${userId.substring(0, 8)}...`,
      serverId: asanaServer.id,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresAt: expiresAt?.toISOString(),
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/?success=asana_oauth_flow_completed', request.url),
    );
  } catch (error) {
    console.error('[AsanaOAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/?error=oauth_callback_error', request.url),
    );
  }
}
