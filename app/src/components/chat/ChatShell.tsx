"use client";

/**
 * Chat / decision screen (PRD §9.2; ADR-004 §3 + §7 sequence; AC-20..25,
 * AC-30, AC-51).
 *
 * On mount it hydrates from `GET /api/cases/[caseId]` (the first assistant
 * message already exists after case creation), then hands the conversation to
 * `useCaseChat` (streamed turns → `POST /api/cases/[caseId]/chat`). An unknown
 * case renders the not-found error state.
 *
 * ## How `requiresBetterPhoto` is derived (AC-22, TAC-004-02)
 * The re-upload affordance is shown IFF the conversation is in the
 * "awaiting a better photo" state, derived — never stored as a mutable flag
 * that could desync:
 *   1. The initial signal comes from the immutable hydration snapshot: the
 *      case is awaiting a photo when its LATEST image analysis is inconclusive
 *      AND no decision row exists yet. This is the one state that has no
 *      decision to read (the first "please upload a better photo" message is
 *      persisted as plain text, not a `submitDecision` tool part), so the GET
 *      response's `analyses` + `decisions` are the only signal available.
 *   2. It turns OFF as soon as ANY `submitDecision` decision is issued in the
 *      live message stream — a re-upload always ends in a decision (a
 *      conclusive re-analysis produces one; a second inconclusive one forces
 *      the AC-14 `needs_human_review` escalation), so a `tool-submitDecision`
 *      output part appearing in `messages` conclusively ends the re-upload
 *      window.
 * Both inputs are pure: (1) is a constant computed from the hydration payload,
 * (2) is recomputed from `messages` on every render. No `useState` toggle.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isToolUIPart, type UIMessage } from "ai";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pl } from "@/lib/copy/pl";
import type { RequestType } from "@/lib/validation/case-form.schema";
import { ChatMessageView, toUIMessages } from "./MessageParts";
import { ReuploadPromptInput } from "./ReuploadPromptInput";
import { createDefaultRunner, useCaseChat, type CreateRunner } from "./useCaseChat";

/** The `GET /api/cases/[caseId]` response shape this screen consumes. */
interface CaseHydration {
  id: string;
  caseNumber: string;
  requestType: RequestType;
  category: string;
  productName: string;
  analyses: { conclusive: boolean }[];
  decisions: unknown[];
  messages: { id: string; role: "user" | "assistant"; parts: unknown[] }[];
}

export interface ChatShellProps {
  caseId: string;
  /** Injectable transport factory for tests; defaults to the real transport. */
  createRunner?: CreateRunner;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; data: CaseHydration };

function CenterState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-secondary p-6 text-center">
      {children}
    </div>
  );
}

export function ChatShell({ caseId, createRunner }: ChatShellProps) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/cases/${caseId}`);
        if (!response.ok) {
          if (!cancelled) setState({ phase: "error" });
          return;
        }
        const data = (await response.json()) as CaseHydration;
        if (!cancelled) setState({ phase: "ready", data });
      } catch {
        if (!cancelled) setState({ phase: "error" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (state.phase === "loading") {
    return (
      <CenterState>
        <Spinner className="size-8" />
      </CenterState>
    );
  }

  if (state.phase === "error") {
    return (
      <CenterState>
        <p>{pl.errors.caseNotFound}</p>
      </CenterState>
    );
  }

  return <ChatView caseId={caseId} createRunner={createRunner} hydration={state.data} />;
}

/** True once a `submitDecision` decision has been issued anywhere in the chat. */
function decisionIssuedInMessages(messages: UIMessage[]): boolean {
  return messages.some((message) =>
    message.parts.some(
      (part) =>
        isToolUIPart(part) &&
        part.type === "tool-submitDecision" &&
        part.state === "output-available",
    ),
  );
}

function ChatView({
  caseId,
  hydration,
  createRunner,
}: {
  caseId: string;
  hydration: CaseHydration;
  createRunner?: CreateRunner;
}) {
  const router = useRouter();

  const initialMessages = useMemo(() => toUIMessages(hydration.messages), [hydration.messages]);
  const { messages, status, sendMessage, retry } = useCaseChat({
    caseId,
    initialMessages,
    createRunner: createRunner ?? createDefaultRunner,
  });

  // (1) Immutable hydration signal — see file header for the full rationale.
  const initialAwaitingPhoto = useMemo(() => {
    const latest = hydration.analyses.at(-1);
    return Boolean(latest && !latest.conclusive && hydration.decisions.length === 0);
  }, [hydration.analyses, hydration.decisions]);

  // (2) Recomputed from live messages every render.
  const requiresBetterPhoto = initialAwaitingPhoto && !decisionIssuedInMessages(messages);

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const assistantResponding =
    lastMessage?.role === "assistant" && messageHasVisibleContent(lastMessage);
  const showTyping = busy && !assistantResponding;

  function handleNewCase() {
    if (window.confirm(pl.chat.newCase.confirmMessage)) {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-0.5 text-sm">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">{pl.chat.caseSummary.caseNumberLabel}:</dt>
              <dd className="font-medium">{hydration.caseNumber}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">{pl.chat.caseSummary.requestTypeLabel}:</dt>
              <dd className="font-medium">
                {pl.form.fields.requestType.options[hydration.requestType]}
              </dd>
            </div>
            <div className="flex min-w-0 gap-1">
              <dt className="text-muted-foreground">{pl.chat.caseSummary.productNameLabel}:</dt>
              <dd className="truncate font-medium">{hydration.productName}</dd>
            </div>
          </dl>
          <Button className="shrink-0" onClick={handleNewCase} size="sm" type="button" variant="outline">
            {pl.chat.newCase.buttonLabel}
          </Button>
        </div>
      </header>

      <Conversation className="mx-auto w-full max-w-2xl flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <ChatMessageView key={message.id} message={message} />
          ))}

          {showTyping && (
            <Message from="assistant">
              <MessageContent>
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Spinner className="size-4" />
                  {pl.chat.typingIndicator}
                </p>
              </MessageContent>
            </Message>
          )}

          {status === "error" && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{pl.chat.streamError.message}</p>
                  <Button onClick={retry} size="sm" type="button" variant="outline">
                    {pl.chat.streamError.retryButton}
                  </Button>
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-2xl">
        <ReuploadPromptInput
          busy={busy}
          onSend={sendMessage}
          showAttachment={requiresBetterPhoto}
          status={status}
        />
      </div>
    </div>
  );
}

function messageHasVisibleContent(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return part.text.trim().length > 0;
    }
    if (part.type === "file") {
      return true;
    }
    return isToolUIPart(part) && part.state === "output-available";
  });
}

