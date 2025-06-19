import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import type { ChatSummary } from '@/lib/types';
import {
  getChatSummaries,
  getAllSpecialistChatSummaries,
} from '@/lib/db/queries';
import type { Session } from 'next-auth';
import {
  GLOBAL_ORCHESTRATOR_CONTEXT_ID,
  CHAT_BIT_CONTEXT_ID,
} from '@/lib/constants';
import { getAvailableSpecialists } from '@/lib/ai/prompts/specialists';

// Force Node.js runtime for this route to avoid Edge Runtime issues with auth
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[API History] Request received');

  try {
    const session = (await auth()) as Session;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const clientId = (session.user as any).clientId || 'default';

    const searchParams = request.nextUrl.searchParams;
    const historyType = searchParams.get('type') as
      | 'sidebar'
      | 'global'
      | 'all-specialists'
      | null;
    const bitContextId = searchParams.get('contextId');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

    console.log('[API History] Request parameters:', {
      historyType,
      bitContextId,
      page,
      limit,
      userId: `${userId.substring(0, 8)}...`,
      clientId,
    });

    // Special handling for 'all-specialists' type
    if (historyType === 'all-specialists') {
      console.log('[API History] Fetching chats for ALL specialists');

      // Get all available specialists
      const specialists = await getAvailableSpecialists();
      const specialistIds = specialists.map((s) => s.id);

      // Add CHAT_BIT_CONTEXT_ID to include general chats
      specialistIds.push(CHAT_BIT_CONTEXT_ID);

      console.log(
        `[API History] Fetching chats for specialists: ${specialistIds.join(', ')}`,
      );

      // Fetch chats for all specialists
      const specialistChats = await getAllSpecialistChatSummaries({
        userId,
        clientId,
        specialistIds,
        page,
        limit,
      });

      console.log(
        `[API History] Returning chats for ${Object.keys(specialistChats).length} specialists`,
      );

      // Return the grouped result
      return NextResponse.json({
        specialists: Object.keys(specialistChats).map((id) => {
          // Find the specialist name from the list
          const specialistInfo =
            id === CHAT_BIT_CONTEXT_ID
              ? {
                  id,
                  name: 'General Chat',
                  description: 'Regular chat without a specialist',
                }
              : specialists.find((s) => s.id === id) || {
                  id,
                  name: id,
                  description: '',
                };

          return {
            ...specialistInfo,
            chats: specialistChats[id] || [],
          };
        }),
        hasMore: false, // For now, we don't support pagination in the grouped view
      });
    }

    // Apply default context ID values based on historyType if none provided
    let resolvedContextId = bitContextId;
    if (!bitContextId) {
      if (historyType === 'global') {
        resolvedContextId = GLOBAL_ORCHESTRATOR_CONTEXT_ID;
      } else if (historyType === 'sidebar') {
        resolvedContextId = CHAT_BIT_CONTEXT_ID;
      }
    }

    // Reduced verbose parameter logging

    const chatSummaries: ChatSummary[] = await getChatSummaries({
      userId,
      clientId,
      historyType,
      bitContextId: resolvedContextId,
      page,
      limit,
    });

    const hasMore = chatSummaries.length === limit;

    console.log('[API History] Query results:', {
      resolvedContextId,
      chatCount: chatSummaries.length,
      hasMore,
      chatIds: chatSummaries.map((chat) => `${chat.id.substring(0, 8)}...`),
      chatTitles: chatSummaries.map((chat) => chat.title),
    });

    return NextResponse.json(
      {
        chats: chatSummaries,
        hasMore,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[API History] Error fetching chat history:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch chat history', details: errorMessage },
      { status: 500 },
    );
  }
}
