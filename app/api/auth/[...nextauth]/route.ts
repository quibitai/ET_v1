import { handlers } from '@/app/(auth)/auth';

// Force Node.js runtime for this route to avoid Edge Runtime issues with auth
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
