import { compare } from 'bcrypt-ts';
import NextAuth, { type User, type Session } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { createUser, getUser } from '@/lib/db/queries';
import { logger } from '@/lib/logger';

import { authConfig } from './auth.config';

// Force Node.js runtime for auth to avoid Edge Runtime issues
export const runtime = 'nodejs';

// Add top-level log to check if this file is being loaded
logger.debug('Auth', 'auth.ts file is being loaded');
logger.debug('Auth', 'Checking for auth secrets');

// Check for authentication secrets - NextAuth v5 prefers AUTH_ prefix
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (authSecret) {
  logger.debug('Auth', 'Found authentication secret');
} else {
  logger.error(
    'Auth',
    'No authentication secret found in environment variables. This will cause auth to fail.',
  );
}

const providers: Provider[] = [
  Credentials({
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const users = await getUser(credentials.email as string);
      if (users.length === 0) return null;

      const user = users[0];
      // biome-ignore lint/style/noNonNullAssertion: password will be present for credential users
      const passwordsMatch = await compare(
        credentials.password as string,
        user.password ?? '',
      );
      if (!passwordsMatch) return null;

      return user as any;
    },
  }),
];

const googleClientId =
  process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope:
            'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/chat.messages.readonly https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.memberships.readonly https://www.googleapis.com/auth/chat.messages https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/presentations.readonly https://www.googleapis.com/auth/presentations',
        },
      },
    }),
  );
  logger.debug('Auth', 'Google OAuth provider configured.');
} else {
  logger.warn(
    'Auth',
    'Missing Google OAuth credentials. Google provider will be disabled.',
  );
}

// Inspect authConfig for debugging
logger.debug(
  'Auth',
  'Inspecting authConfig before passing to NextAuth',
  // We stringify selectively to avoid logging sensitive provider details or complex functions
  {
    pages: authConfig.pages,
    // Check if providers array exists in the imported config
    hasProvidersDefinedInAuthConfig: Array.isArray(authConfig.providers),
    // Check if callbacks object exists
    hasCallbacks:
      typeof authConfig.callbacks === 'object' && authConfig.callbacks !== null,
    // Check if the specific authorized callback function exists
    hasAuthorizedCallback:
      typeof authConfig.callbacks?.authorized === 'function',
  },
);

// Extended User interface to include clientId
interface ExtendedUser extends User {
  clientId?: string;
}

// Extended Session interface to include clientId in the user object
interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    name?: string | null;
    clientId?: string;
  };
}

// Log about callback merging
logger.debug(
  'Auth',
  'About to merge callbacks - will preserve authorized callback from authConfig',
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        if (!user.email) return false; // Must have an email

        // Check if user already exists
        const existingUsers = await getUser(user.email);

        if (existingUsers.length === 0) {
          // This is a new user, create them in your database
          logger.debug(
            'Auth:signIn',
            `New Google user: ${user.email}. Creating database entry.`,
          );
          try {
            // Assuming the clientId can be derived or is static for this context.
            // You might need to adjust where 'echo-tango' comes from.
            await createUser(user.email, '', 'echo-tango');
            logger.debug(
              'Auth:signIn',
              `Successfully created user: ${user.email}`,
            );
          } catch (error) {
            logger.error(
              'Auth:signIn',
              `Failed to create user: ${user.email}`,
              error,
            );
            return false; // Prevent sign-in if user creation fails
          }
        } else {
          logger.debug(
            'Auth:signIn',
            `Existing Google user signed in: ${user.email}`,
          );
        }
      }
      return true; // Allow sign-in
    },
    async jwt({ token, user, account }) {
      // Initial sign-in: Save tokens and basic user info.
      if (account && user) {
        logger.debug(
          'Auth:JWT',
          `Initial sign-in for ${user.email} with ${account.provider}.`,
        );
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;

        // Fetch user from DB to get our internal ID and clientId
        const dbUsers = await getUser(user.email as string);
        if (dbUsers.length > 0) {
          const dbUser = dbUsers[0];
          token.id = dbUser.id;
          token.clientId = dbUser.clientId;
          logger.debug(
            'Auth:JWT',
            `Enriched token with DB data. User ID: ${dbUser.id}, Client ID: ${dbUser.clientId}`,
          );
        } else {
          logger.error(
            'Auth:JWT',
            `User ${user.email} not found in DB during initial sign-in.`,
          );
        }
        return token;
      }

      // Return previous token if the access token has not expired yet
      if (
        token.accessTokenExpires &&
        Date.now() < (token.accessTokenExpires as number)
      ) {
        logger.debug('Auth:JWT', 'Access token is still valid.');
        return token;
      }

      // Access token has expired, try to refresh it
      // This is a simplified refresh flow. A robust implementation would use the refresh_token
      // to get a new access_token from the provider.
      logger.warn(
        'Auth:JWT',
        'Access token has expired. A full refresh token flow is not implemented. The user may need to sign in again.',
      );
      // For now, we nullify the expired token to force re-authentication.
      token.accessToken = null;

      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string;
        // Add clientId to the session.user object if available in token
        if (token.clientId) {
          logger.debug('Auth', `Adding clientId to session: ${token.clientId}`);
          session.user.clientId = token.clientId as string;
        }
      }

      // Add access token to session for Google Workspace integration
      if (token.accessToken) {
        logger.debug(
          'Auth',
          `Adding access token to session: ${!!token.accessToken}`,
        );
        session.accessToken = token.accessToken as string;
      } else {
        logger.warn('Auth', 'No access token found in JWT token');
      }

      return session;
    },
  },
});

// Export the handlers for use in the route file
export const { GET, POST } = handlers;
