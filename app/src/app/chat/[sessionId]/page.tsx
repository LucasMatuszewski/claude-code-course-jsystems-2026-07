import { ChatView } from "@/components/chat/ChatView";
import { getDb } from "@/lib/db/client";
import { getSessionWithHistory } from "@/lib/db/repositories";
import { notFound } from "next/navigation";

import { buildChatMessages } from "./restore";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const history = getSessionWithHistory(getDb(), sessionId);

  if (history === null) {
    notFound();
    return null;
  }

  const messages = buildChatMessages(history);
  return <ChatView sessionId={sessionId} messages={messages} />;
}
