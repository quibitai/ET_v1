// Force Node.js runtime for this route to avoid Edge Runtime issues with auth
export const runtime = 'nodejs';

export { GET, POST } from '@/app/(auth)/auth';
