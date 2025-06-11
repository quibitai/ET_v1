import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getAllSpecialistChatSummaries } from '@/lib/db/queries';
import { getAvailableSpecialists } from '@/lib/ai/prompts/specialists';
import { CHAT_BIT_CONTEXT_ID } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Basic auth check
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Not authenticated',
          sessionExists: !!session,
          userExists: !!session?.user,
          userId: session?.user?.id || null,
        },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const clientId = (session.user as any).clientId || 'default';

    // Get specialists
    const specialists = await getAvailableSpecialists();
    const specialistIds = specialists.map((s) => s.id);
    specialistIds.push(CHAT_BIT_CONTEXT_ID);

    console.log('[DEBUG-HISTORY] Session info:', {
      userId,
      clientId,
      specialistIds,
      sessionEmail: session.user.email,
    });

    // Fetch specialist chats
    const specialistChats = await getAllSpecialistChatSummaries({
      userId,
      clientId,
      specialistIds,
      page: 1,
      limit: 20,
    });

    // Count total chats
    const totalChats = Object.values(specialistChats).reduce(
      (acc, chats) => acc + chats.length,
      0,
    );

    return NextResponse.json({
      success: true,
      userId,
      clientId,
      specialistCount: specialists.length,
      specialistIds,
      totalChats,
      chatsBySpecialist: Object.keys(specialistChats).map((id) => ({
        specialistId: id,
        chatCount: specialistChats[id].length,
        firstChatTitle: specialistChats[id][0]?.title || null,
      })),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        hasDatabase: !!process.env.POSTGRES_URL,
      },
    });
  } catch (error) {
    console.error('[DEBUG-HISTORY] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
