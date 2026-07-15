/**
 * Chat / decision screen route (PRD §9.2; ADR-004 §3).
 *
 * A thin Server Component: it resolves the dynamic `caseId` (Next.js 16 route
 * `params` is a Promise) and hands off to the client `ChatShell`, which
 * hydrates from `GET /api/cases/[caseId]` and drives the streaming chat.
 */

import { ChatShell } from "@/components/chat/ChatShell";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ChatShell caseId={caseId} />;
}
