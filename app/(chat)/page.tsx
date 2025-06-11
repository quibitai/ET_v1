import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth';
import { ChatWrapper } from '@/components/chat-wrapper';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { ECHO_TANGO_SPECIALIST_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const id = generateUUID();
  const cookieStore = cookies();
  const session = await auth();

  const modelIdFromCookie = (await cookieStore).get('chat-model');
  const contextId =
    (await cookieStore).get('current-active-specialist')?.value ||
    ECHO_TANGO_SPECIALIST_ID;

  // Chat will be created automatically when the first message is sent via the brain orchestrator
  // This ensures proper title generation from the actual user message

  return (
    <ChatWrapper
      key={id}
      id={id}
      initialMessages={[]}
      selectedChatModel={modelIdFromCookie?.value || DEFAULT_CHAT_MODEL}
      selectedVisibilityType="private"
      isReadonly={false}
      activeBitContextId={contextId}
    />
  );
}
