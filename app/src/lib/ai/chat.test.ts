import type {
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import type { ModelMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type DbHandle } from "@/lib/db/client";
import { completeAnalysis, createSession, getSessionWithHistory } from "@/lib/db/repositories";
import type { RequestFormInput } from "@/lib/validation";

import type { ChatSessionSummary } from "./prompts";
import type { ImageAnalysis } from "./types";
import {
  DEFAULT_CHAT_STEP_CAP,
  REVISE_DECISION_TOOL_NAME,
  reviseDecisionInputSchema,
  reviseDecisionOutputSchema,
  streamChatReply,
} from "./chat";

const USAGE: LanguageModelV4Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function toolCallStream(input: object, toolCallId = "call-1"): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    {
      type: "tool-call",
      toolCallId,
      toolName: REVISE_DECISION_TOOL_NAME,
      input: JSON.stringify(input),
    },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage: USAGE },
  ];
}

function textStream(text: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE },
  ];
}

function streamResult(parts: LanguageModelV4StreamPart[]): LanguageModelV4StreamResult {
  return { stream: convertArrayToReadableStream(parts) };
}

function analysisFixture(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    imageUsable: true,
    unusableReason: null,
    matchesDeclaredProduct: true,
    damageVisible: false,
    damageDescription: null,
    plausibleCauses: null,
    usageSigns: null,
    resellableAssessment: null,
    confidence: "high",
    ...overrides,
  };
}

function formFixture(overrides: Partial<RequestFormInput> = {}): RequestFormInput {
  return {
    requestType: "return",
    category: "smartphone",
    productName: "Samsung Galaxy S22",
    purchaseDate: "2026-07-10",
    image: { type: "image/jpeg", size: 12345 },
    ...overrides,
  } as RequestFormInput;
}

function createAnalyzedSession(
  handle: DbHandle,
  form: RequestFormInput,
  analysis: ImageAnalysis,
) {
  const session = createSession(
    handle.db,
    {
      requestType: form.requestType,
      category: form.category,
      productName: form.productName,
      purchaseDate: form.purchaseDate,
      reason: form.reason,
    },
    {
      imagePath: "data/uploads/test.jpg",
      imageOriginalName: "original.jpg",
      imageMediaType: form.image.type,
    },
    () => 1000,
  );

  completeAnalysis(
    handle.db,
    session.id,
    analysis,
    { decision: "APPROVE", justification: "Initial decision.", citedRuleIds: [] },
    { id: "msg-1", parts: [{ type: "text", text: "Initial answer." }] },
    () => 1001,
  );

  return session;
}

function sessionSummary(
  handle: DbHandle,
  form: RequestFormInput,
  analysis: ImageAnalysis,
): ChatSessionSummary {
  const session = createAnalyzedSession(handle, form, analysis);
  return {
    form,
    analysis,
    sessionId: session.id,
    policyProse: "Policy text for the current request.",
    decisionHistory: [
      {
        category: "APPROVE",
        justification: "Initial decision.",
        timestamp: "2026-07-16T10:00:00.000Z",
      },
    ],
  };
}

function historyFixture(): ModelMessage[] {
  return [{ role: "user", content: "Czy mogę zmienić zgłoszenie?" }];
}

describe("streamChatReply", () => {
  let handle: DbHandle;

  beforeEach(() => {
    handle = createDb({ filePath: ":memory:" });
  });

  afterEach(() => {
    handle.close();
  });

  it("streams a text-only chat reply and calls onFinish with the final text", async () => {
    const model = new MockLanguageModelV4({
      doStream: streamResult(textStream("Dzień dobry, sprawdzę zgłoszenie.")),
    });
    const onFinishEvents: Array<{ text: string }> = [];

    const result = streamChatReply(sessionSummary(handle, formFixture(), analysisFixture()), historyFixture(), {
      db: handle.db,
      model,
      today: "2026-07-16",
      onFinish: (event) => {
        onFinishEvents.push(event);
      },
    });

    await expect(result.text).resolves.toBe("Dzień dobry, sprawdzę zgłoszenie.");
    expect(onFinishEvents).toEqual([{ text: "Dzień dobry, sprawdzę zgłoszenie." }]);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0].prompt[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("Samsung Galaxy S22"),
    });
    expect(model.doStreamCalls[0].prompt[1]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "Czy mogę zmienić zgłoszenie?" }],
    });
    expect(model.doStreamCalls[0].tools?.map((item) => item.name)).toEqual([
      REVISE_DECISION_TOOL_NAME,
    ]);
    // No image bytes are ever attached to a chat call (text-only context).
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain('"type":"file"');
  });

  it("executes revise_decision, appends a decision row, and continues to the final text step", async () => {
    const form = formFixture({ purchaseDate: "2026-07-10" });
    const session = sessionSummary(handle, form, analysisFixture());
    const model = new MockLanguageModelV4({
      doStream: [
        streamResult(
          toolCallStream({
            newDecision: "REJECT",
            reason: "Widoczne ślady użytkowania.",
            citedRuleIds: ["R-4"],
          }),
        ),
        streamResult(textStream("Zmieniłem ocenę na odmowę z powodu śladów użytkowania.")),
      ],
    });

    const result = streamChatReply(session, historyFixture(), {
      db: handle.db,
      model,
      today: "2026-07-16",
    });

    await expect(result.text).resolves.toBe(
      "Zmieniłem ocenę na odmowę z powodu śladów użytkowania.",
    );

    const history = getSessionWithHistory(handle.db, session.sessionId);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(history?.decisions).toHaveLength(2);
    expect(history?.decisions[1].decision).toBe("REJECT");
    expect(history?.decisions[1].previousDecision).toBe("APPROVE");
    expect(history?.decisions[1].source).toBe("chat_revision");
    expect(history?.decisions[1].guardOverride).toBe(false);
    expect(history?.decisions[1].citedRuleIds).toBe(JSON.stringify(["R-4"]));
  });

  it("guards an out-of-window APPROVE revision to ESCALATE and persists the window rule", async () => {
    const form = formFixture({ purchaseDate: "2026-06-01" });
    const session = sessionSummary(handle, form, analysisFixture());
    const model = new MockLanguageModelV4({
      doStream: [
        streamResult(
          toolCallStream({
            newDecision: "APPROVE",
            reason: "Klient dosłał wyjaśnienie.",
            citedRuleIds: [],
          }),
        ),
        streamResult(textStream("Sprawa wymaga ręcznej weryfikacji.")),
      ],
    });

    const result = streamChatReply(session, historyFixture(), {
      db: handle.db,
      model,
      today: "2026-07-16",
    });

    const toolResults = await result.toolResults;
    expect(toolResults[0].output).toEqual({
      accepted: false,
      recordedDecision: "ESCALATE",
      previousDecision: "APPROVE",
      overrideReason: "out_of_window",
      citedRuleIds: ["R-1"],
    });

    const history = getSessionWithHistory(handle.db, session.sessionId);
    expect(history?.decisions[1].decision).toBe("ESCALATE");
    expect(history?.decisions[1].guardOverride).toBe(true);
    expect(history?.decisions[1].citedRuleIds).toBe(JSON.stringify(["R-1"]));
  });

  it("guards an unusable-image revision before the window reason", async () => {
    const form = formFixture({ purchaseDate: "2026-06-01" });
    const session = sessionSummary(
      handle,
      form,
      analysisFixture({ imageUsable: false, unusableReason: "Zdjęcie rozmazane." }),
    );
    const model = new MockLanguageModelV4({
      doStream: [
        streamResult(
          toolCallStream({
            newDecision: "APPROVE",
            reason: "Klient dosłał wyjaśnienie.",
            citedRuleIds: [],
          }),
        ),
        streamResult(textStream("Sprawa wymaga ręcznej weryfikacji zdjęcia.")),
      ],
    });

    const result = streamChatReply(session, historyFixture(), {
      db: handle.db,
      model,
      today: "2026-07-16",
    });

    const toolResults = await result.toolResults;
    expect(toolResults[0].output).toEqual({
      accepted: false,
      recordedDecision: "ESCALATE",
      previousDecision: "APPROVE",
      overrideReason: "image_unusable",
      citedRuleIds: ["R-1"],
    });
  });

  it("caps the multi-step tool loop at maxSteps when the model keeps calling the tool", async () => {
    const form = formFixture({ purchaseDate: "2026-07-10" });
    const session = sessionSummary(handle, form, analysisFixture());
    let n = 0;
    const model = new MockLanguageModelV4({
      // Always returns a tool call and never a final text step: without the
      // step cap this loop would never terminate.
      doStream: async () =>
        streamResult(
          toolCallStream(
            { newDecision: "APPROVE", reason: "Ponawiam prośbę.", citedRuleIds: [] },
            `call-${(n += 1)}`,
          ),
        ),
    });

    const result = streamChatReply(session, historyFixture(), {
      db: handle.db,
      model,
      today: "2026-07-16",
      maxSteps: 2,
    });

    await result.consumeStream();

    expect(model.doStreamCalls).toHaveLength(2);
    const history = getSessionWithHistory(handle.db, session.sessionId);
    // 1 initial decision (completeAnalysis) + exactly 2 capped chat revisions.
    expect(history?.decisions).toHaveLength(3);
    expect(
      history?.decisions.filter((decision) => decision.source === "chat_revision"),
    ).toHaveLength(2);
  });

  it("exports the revision schemas and default step cap for route integration", () => {
    expect(DEFAULT_CHAT_STEP_CAP).toBe(3);
    expect(reviseDecisionInputSchema.parse({
      newDecision: "MORE_INFO",
      reason: "Potrzebny numer seryjny.",
    })).toEqual({
      newDecision: "MORE_INFO",
      reason: "Potrzebny numer seryjny.",
      citedRuleIds: [],
    });
    expect(reviseDecisionOutputSchema.parse({
      accepted: true,
      recordedDecision: "MORE_INFO",
      previousDecision: null,
      overrideReason: null,
      citedRuleIds: [],
    })).toEqual({
      accepted: true,
      recordedDecision: "MORE_INFO",
      previousDecision: null,
      overrideReason: null,
      citedRuleIds: [],
    });
  });
});
