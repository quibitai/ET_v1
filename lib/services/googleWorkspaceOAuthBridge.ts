/**
 * Google Workspace OAuth Bridge Service
 *
 * This service bridges the gap between NextAuth OAuth tokens and Google Workspace MCP client authentication.
 * It extracts OAuth tokens from user sessions and creates authenticated MCP clients.
 */

import { GoogleWorkspaceMCPClient } from '@/lib/ai/mcp/GoogleWorkspaceMCPClient';
import { auth } from '@/app/(auth)/auth';

interface UserContext {
  id: string;
  email: string;
  name?: string;
}

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface AuthenticationStatus {
  isAuthenticated: boolean;
  userEmail?: string;
  hasValidTokens?: boolean;
  expiresAt?: number;
  scopes?: string[];
  error?: string;
}

export class GoogleWorkspaceOAuthBridge {
  private static instance: GoogleWorkspaceOAuthBridge | null = null;
  private clientCache = new Map<
    string,
    { client: GoogleWorkspaceMCPClient; expires: number }
  >();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    // Set up periodic cleanup
    setInterval(() => this.cleanupExpiredClients(), this.CACHE_DURATION);

    // Clear cache on startup to ensure fresh token sync during development
    this.clearCache();
  }

  static getInstance(): GoogleWorkspaceOAuthBridge {
    if (!GoogleWorkspaceOAuthBridge.instance) {
      GoogleWorkspaceOAuthBridge.instance = new GoogleWorkspaceOAuthBridge();
    }
    return GoogleWorkspaceOAuthBridge.instance;
  }

  /**
   * Extract OAuth tokens from NextAuth session
   */
  async extractTokensFromSession(): Promise<OAuthTokens | null> {
    try {
      const session = await auth();

      console.log('[GoogleWorkspaceOAuth] Session debug:', {
        hasSession: !!session,
        hasAccessToken: !!session?.accessToken,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        expires: session?.expires,
        sessionKeys: session ? Object.keys(session) : [],
        accessTokenLength: session?.accessToken
          ? session.accessToken.length
          : 0,
      });

      if (!session?.accessToken) {
        console.log('[GoogleWorkspaceOAuth] No access token in session');
        return null;
      }

      const tokens = {
        access_token: session.accessToken,
        refresh_token: undefined, // NextAuth doesn't expose refresh token in session
        expires_at: session.expires
          ? new Date(session.expires).getTime()
          : undefined,
      };

      console.log('[GoogleWorkspaceOAuth] Extracted tokens:', {
        hasAccessToken: !!tokens.access_token,
        accessTokenPrefix: `${tokens.access_token.substring(0, 20)}...`,
        expiresAt: tokens.expires_at,
        expiresIn: tokens.expires_at
          ? `${Math.round((tokens.expires_at - Date.now()) / 1000 / 60)} minutes`
          : 'unknown',
      });

      return tokens;
    } catch (error) {
      console.error(
        '[GoogleWorkspaceOAuth] Failed to extract tokens from session:',
        error,
      );
      return null;
    }
  }

  /**
   * Sync OAuth tokens from NextAuth session to MCP server credential files
   */
  async syncTokensToMCPServer(user: UserContext): Promise<boolean> {
    try {
      // Extract tokens from NextAuth session
      const tokens = await this.extractTokensFromSession();
      if (!tokens) {
        console.log(
          '[GoogleWorkspaceOAuth] No OAuth tokens available to sync for user:',
          user.email,
        );
        return false;
      }

      // Validate token expiration
      if (tokens.expires_at && tokens.expires_at < Date.now()) {
        console.log(
          '[GoogleWorkspaceOAuth] OAuth token expired, cannot sync for user:',
          user.email,
        );
        return false;
      }

      // Prepare credential data in the format expected by the MCP server
      const credentialData = {
        token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_uri: 'https://oauth2.googleapis.com/token',
        client_id: process.env.AUTH_GOOGLE_ID,
        client_secret: process.env.AUTH_GOOGLE_SECRET,
        scopes: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.labels',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/documents.readonly',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/presentations',
          'https://www.googleapis.com/auth/presentations.readonly',
          'https://www.googleapis.com/auth/forms.body',
          'https://www.googleapis.com/auth/forms.body.readonly',
          'https://www.googleapis.com/auth/forms.responses.readonly',
          'https://www.googleapis.com/auth/chat.spaces',
          'https://www.googleapis.com/auth/chat.messages',
          'https://www.googleapis.com/auth/chat.messages.readonly',
        ],
        expiry: tokens.expires_at
          ? new Date(tokens.expires_at)
              .toISOString()
              .replace('Z', '')
              .replace(/\.\d{3}$/, '')
          : null,
      };

      // Write credential file to MCP server
      const mcpCredentialPath = `/tmp/mcp-credentials-${user.email}.json`;
      const fs = await import('node:fs');
      await fs.promises.writeFile(
        mcpCredentialPath,
        JSON.stringify(credentialData, null, 2),
      );

      // Copy to MCP server's .credentials directory (new workspace-mcp location)
      const { execSync } = await import('node:child_process');
      const mcpCredentialsDir = './mcp-workspace/.credentials';
      const targetPath = `${mcpCredentialsDir}/${user.email}.json`;

      // Ensure credentials directory exists
      execSync(`mkdir -p "${mcpCredentialsDir}"`);
      execSync(`cp "${mcpCredentialPath}" "${targetPath}"`);
      execSync(`rm "${mcpCredentialPath}"`);

      console.log(
        '[GoogleWorkspaceOAuth] Successfully synced OAuth tokens to MCP server for user:',
        user.email,
      );
      return true;
    } catch (error) {
      console.error(
        '[GoogleWorkspaceOAuth] Failed to sync tokens to MCP server for user:',
        user.email,
        error,
      );
      return false;
    }
  }

  /**
   * Create authenticated Google Workspace MCP client for a user
   */
  async createAuthenticatedClient(
    userEmail: string,
  ): Promise<GoogleWorkspaceMCPClient> {
    console.log(
      `[GoogleWorkspaceOAuth] Creating new authenticated client for user: ${userEmail}`,
    );

    // Extract OAuth tokens from the session
    const tokens = await this.extractTokensFromSession();
    console.log(`[GoogleWorkspaceOAuth] Token validation check:`, {
      hasTokens: !!tokens,
      hasAccessToken: !!tokens?.access_token,
      tokenLength: tokens?.access_token?.length || 0,
    });

    if (!tokens || !tokens.access_token) {
      console.error(`[GoogleWorkspaceOAuth] Token validation failed:`, {
        tokens: !!tokens,
        accessToken: !!tokens?.access_token,
        tokenType: typeof tokens?.access_token,
      });
      throw new Error('No valid OAuth tokens found in session');
    }

    console.log(
      `[GoogleWorkspaceOAuth] Token validation passed, creating MCP client...`,
    );

    console.log(
      `[GoogleWorkspaceOAuth] Creating MCP client - server will handle OAuth flow internally`,
    );

    // Create client with OAuth tokens for injection
    console.log(`[GoogleWorkspaceOAuth] Creating MCP client with config:`, {
      serverUrl:
        process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL || 'http://127.0.0.1:8000',
      userEmail,
      hasOAuthTokens: true,
      tokenPrefix: `${tokens.access_token.substring(0, 20)}...`,
    });

    let client: GoogleWorkspaceMCPClient;
    try {
      // Create client with new official workspace-mcp server
      client = new GoogleWorkspaceMCPClient({
        serverUrl:
          process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL ||
          'http://127.0.0.1:8000',
        userEmail,
      });

      // Sync tokens to the MCP server's credential files
      await this.syncTokensToMCPServer({
        id: 'user-id', // This will be updated when we have user context
        email: userEmail,
      });

      console.log(`[GoogleWorkspaceOAuth] MCP client created successfully`);
    } catch (error) {
      console.error(
        `[GoogleWorkspaceOAuth] Failed to create MCP client:`,
        error,
      );
      throw new Error(
        `Google Workspace authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Cache the client
    this.clientCache.set(userEmail, {
      client,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes cache
    });

    // Clean up old clients
    this.cleanupExpiredClients();

    console.log(
      `[GoogleWorkspaceOAuth] Successfully created and cached authenticated client for user: ${userEmail}`,
    );
    return client;
  }

  /**
   * Check if user has valid Google Workspace authentication
   */
  async hasValidAuthentication(user: UserContext): Promise<boolean> {
    try {
      const tokens = await this.extractTokensFromSession();
      if (!tokens) {
        return false;
      }

      // Check token expiration
      if (tokens.expires_at && tokens.expires_at < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        '[GoogleWorkspaceOAuth] Error checking authentication for user:',
        user.email,
        error,
      );
      return false;
    }
  }

  /**
   * Get authentication status for a user
   */
  async getAuthenticationStatus(
    user: UserContext,
  ): Promise<AuthenticationStatus> {
    try {
      const tokens = await this.extractTokensFromSession();

      if (!tokens) {
        return {
          isAuthenticated: false,
          error: 'No OAuth tokens found. Please sign in with Google.',
        };
      }

      const isExpired = tokens.expires_at && tokens.expires_at < Date.now();
      if (isExpired) {
        return {
          isAuthenticated: false,
          userEmail: user.email,
          hasValidTokens: false,
          expiresAt: tokens.expires_at,
          error: 'OAuth token has expired. Please sign in again.',
        };
      }

      return {
        isAuthenticated: true,
        userEmail: user.email,
        hasValidTokens: true,
        expiresAt: tokens.expires_at,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/presentations',
          'https://www.googleapis.com/auth/forms',
          'https://www.googleapis.com/auth/chat.spaces',
        ],
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        userEmail: user.email,
        error: `Authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clean up expired clients from cache
   */
  private cleanupExpiredClients(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cached] of this.clientCache.entries()) {
      if (cached.expires <= now) {
        this.clientCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[GoogleWorkspaceOAuth] Cleaned up ${cleanedCount} expired clients from cache`,
      );
    }
  }

  /**
   * Clear all cached clients (for testing/debugging)
   */
  clearCache(): void {
    this.clientCache.clear();
    console.log('[GoogleWorkspaceOAuth] Cleared all cached clients');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalClients: this.clientCache.size,
      clients: Array.from(this.clientCache.entries()).map(([key, cached]) => ({
        userId: key,
        expiresIn: Math.max(0, cached.expires - Date.now()),
      })),
    };
  }
}

// Export singleton instance
export const googleWorkspaceOAuthBridge =
  GoogleWorkspaceOAuthBridge.getInstance();
