"use client";

/**
 * Chat controller for the decision screen (ADR-004 §3 "Chat page").
 *
 * ## Why a hand-rolled controller instead of `@ai-sdk/react`'s `useChat`
 * ADR-004 specifies `useChat` from `@ai-sdk/react`, but that package is NOT a
 * dependency of this project (only `ai@7` is installed) and P3.2 forbids
 * adding new dependencies. This hook reproduces the slice of `useChat` this
 * screen needs — an initial-message seed, a streamed assistant turn, a
 * `status` state machine, and an error+retry path — on top of the primitives
 * `ai@7` DOES export: `DefaultChatTransport` (POSTs `{ messages }` to the
 * route and returns a `UIMessageChunk` stream) and `readUIMessageStream`
 * (folds that chunk stream into progressive `UIMessage` snapshots). The wire
 * contract is identical to what `useChat` would send, so the committed chat
 * route (P2.3) is consumed unchanged.
 *
 * The transport is injectable via `createRunner` so unit tests drive the turn
 * with a fake async generator — no real network, no SSE parsing (TAC test
 * strategy: mock the transport).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type FileUIPart,
  type UIMessage,
} from "ai";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/**
 * Runs a single chat turn: given the full outgoing message list, yields
 * progressive snapshots of the assistant response message. Throws if the
 * stream fails (the hook maps that to `status: "error"`).
 */
export interface ChatStreamRunner {
  run(
    messages: UIMessage[],
    options: { abortSignal: AbortSignal },
  ): AsyncIterable<UIMessage>;
}

export type CreateRunner = (caseId: string) => ChatStreamRunner;

/** Production runner: real `DefaultChatTransport` + `readUIMessageStream`. */
export function createDefaultRunner(caseId: string): ChatStreamRunner {
  const transport = new DefaultChatTransport<UIMessage>({
    api: `/api/cases/${caseId}/chat`,
  });

  return {
    async *run(messages, { abortSignal }) {
      const stream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: caseId,
        messageId: undefined,
        messages,
        abortSignal,
      });

      let streamError: unknown;
      for await (const snapshot of readUIMessageStream<UIMessage>({
        stream,
        onError: (error) => {
          streamError = error;
        },
      })) {
        yield snapshot;
      }

      if (streamError) {
        throw streamError instanceof Error ? streamError : new Error(String(streamError));
      }
    },
  };
}

export interface SendMessageArgs {
  text: string;
  files: FileUIPart[];
}

export interface UseCaseChatArgs {
  caseId: string;
  initialMessages: UIMessage[];
  createRunner?: CreateRunner;
}

export interface UseCaseChatResult {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  sendMessage: (args: SendMessageArgs) => void;
  retry: () => void;
}

export function useCaseChat({
  caseId,
  initialMessages,
  createRunner = createDefaultRunner,
}: UseCaseChatArgs): UseCaseChatResult {
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>(undefined);

  // One runner per mounted chat (kept stable across renders).
  const runnerRef = useRef<ChatStreamRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createRunner(caseId);
  }

  // Latest messages, readable synchronously inside `sendMessage`.
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // The exact outgoing array of the last turn, so a retry re-sends it verbatim
  // (AC-25: retry re-sends the last user message, no re-entry).
  const lastSentRef = useRef<UIMessage[]>(initialMessages);

  const runTurn = useCallback(async (outgoing: UIMessage[]) => {
    lastSentRef.current = outgoing;
    setMessages(outgoing);
    setStatus("submitted");
    setError(undefined);

    const controller = new AbortController();
    try {
      for await (const assistant of runnerRef.current!.run(outgoing, {
        abortSignal: controller.signal,
      })) {
        setStatus("streaming");
        setMessages([...outgoing, assistant]);
      }
      setStatus("ready");
    } catch (caught) {
      // Drop any partial assistant snapshot; keep the user message so retry
      // re-sends it unchanged.
      setMessages(outgoing);
      setError(caught instanceof Error ? caught : new Error(String(caught)));
      setStatus("error");
    }
  }, []);

  const sendMessage = useCallback(
    ({ text, files }: SendMessageArgs) => {
      const parts: UIMessage["parts"] = [];
      for (const file of files) {
        parts.push({
          type: "file",
          mediaType: file.mediaType,
          filename: file.filename,
          url: file.url,
        });
      }
      if (text) {
        parts.push({ type: "text", text });
      }
      if (parts.length === 0) {
        return;
      }

      const userMessage: UIMessage = { id: nanoid(), role: "user", parts };
      void runTurn([...messagesRef.current, userMessage]);
    },
    [runTurn],
  );

  const retry = useCallback(() => {
    void runTurn(lastSentRef.current);
  }, [runTurn]);

  return { messages, status, error, sendMessage, retry };
}
