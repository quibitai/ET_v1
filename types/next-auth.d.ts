import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Extend the built-in session types
   */
  interface Session {
    user: {
      /** Default fields from NextAuth */
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** Custom fields */
      clientId?: string;
    } & DefaultSession['user'];
    /** Google OAuth access token for Workspace integration */
    accessToken?: string;
  }

  /**
   * Extend the built-in user types
   */
  interface User {
    /** Default fields from NextAuth */
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    /** Custom fields */
    clientId?: string;
  }
}
