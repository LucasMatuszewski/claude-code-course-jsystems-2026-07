---
name: project-hsc-chat-route
description: Hardware Service Decision Copilot PoC — streaming chat route (P2.3) + AI SDK v7.0.28 streaming/tool API shapes, for P3.2 chat page (renders the submitDecision tool part) and any future streaming work.
metadata:
  type: project
---

`POST /api/cases/[caseId]/chat` implemented in P2.3, committed `7cf9104` on branch `moja-praca`. Route: `app/src/app/api/cases/[caseId]/chat/route.ts` (thin: parse params+body, delegate); streaming logic: `app/src/lib/ai/stream-chat.ts` (`streamChatTurn(deps, caseId, messages)`). See [[project_hsc_api_routes]], [[project_hsc_ai_layer]].

**Contract as implemented (P3.2 consumes these):**
- Request body: `{ messages: UIMessage[] }` (AI SDK `useChat` transport). DI seam `createChatPostHandler(deps)`, `deps = { db, models: Models, uploadsBaseDir?, policiesDir? }`. `context.params` is a Promise (Next 16).
- **EXACT submitDecision tool part type = `tool-submitDecision`** (AI SDK pattern `` `tool-${toolName}` ``). After execution its state is `output-available` with `.input` (model args) and `.output`. **P3.2 must render the decision block from `.output`** (`{ status, justification, nextSteps, isRevision }`) — NOT `.input`: `output.isRevision` is DB-computed and `output.status` reflects the AC-14 escalation override, whereas `.input` is the raw (possibly wrong) model proposal.
- Re-upload file parts are encoded as a UIMessage `file` part `{ type:'file', mediaType, filename?, url }` where `url` is a **data URL** (`data:image/...;base64,...`) produced by useChat file attachments. Route decodes the data URL → compress → `writeCaseImage(source:'chat_reupload')` → re-run `analyzeImage` BEFORE streaming. The PERSISTED user message rewrites that file part's `url` to `/api/images/<relativePath>` (served path) so the DB stays small and chat/reviewer views render via the image route.
- 404 unknown case → `{ error: pl.errors.caseNotFound }`. Provider failure (pre-stream re-analysis or mid-stream) → a streamed error part carrying `pl.chat.streamError.message` (via `onError`), never a thrown 500.
- Persistence (AC-33): user message + full assistant `responseMessage.parts` written as `chat_messages` in the stream's `onFinish`, wrapped in try/catch (AC-35 — a failed insert must not break the already-streamed turn).

**AI SDK v7.0.28 streaming API drift (verified in node_modules, differs from training data):**
- Use STANDALONE helpers: `const stream = toUIMessageStream({ stream: result.stream, originalMessages, onError, onFinish }); return createUIMessageStreamResponse({ stream });`. `result.toUIMessageStreamResponse()` still exists but is **deprecated** (app/AGENTS.md says heed deprecations). `onFinish` is a deprecated alias of `onEnd` — both take the same callback; used `onFinish` to match the task contract wording.
- `onFinish`/`onEnd` callback arg: `{ messages: UIMessage[], responseMessage: UIMessage, isContinuation, isAborted, finishReason? }`. Persist `responseMessage.parts` for the assistant turn (do NOT re-persist the whole `messages` array — that would duplicate history).
- Stop condition helper is **`isStepCount(n)`** (typed in `.d.ts`; `stepCountIs` also exists at runtime but is not the typed name). Used `stopWhen: isStepCount(1)` so exactly ONE decision row is written per `submitDecision` call (no multi-step tool loop).
- `convertToModelMessages(messages)` returns a **Promise** — must `await` it. Strip/replace `file` parts with a text note before converting (the text model doesn't need the already-analyzed image bytes).
- Tool = `tool({ description, inputSchema: DecisionSchema, execute })`. `execute` inserts exactly one decision via `insertDecision` (DB derives `isRevision`); AC-14 escalation forces `needs_human_review` by passing a `forcedStatus` into the tool factory PLUS `toolChoice: "required"` on `streamText` (forces the real model to call the tool; the mock just emits it).
- Mock streaming model for tests: `new MockLanguageModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([...]) }) })` from `ai/test`. Stream parts (`LanguageModelV4StreamPart`): `{type:'stream-start',warnings:[]}`, `{type:'text-start',id}`, `{type:'text-delta',id,delta}`, `{type:'text-end',id}`, `{type:'tool-call',toolCallId,toolName,input:<JSON string>}`, `{type:'finish',finishReason:{unified,raw},usage}` (usage shape same nested structure as doGenerate — see [[project_hsc_ai_layer]]). Assert rebuilt context on `text.doStreamCalls[0].prompt` (find the `role:'system'` message; its `content` is a string).

**Build gotchas (only surface in `npm run build`'s TS pass, not vitest/dev):**
- Regex dotAll `s` flag needs es2018 target → use `[\s\S]` instead of `.` with `/s`.
- `new AiProviderError(msg)` fails type-check — ctor needs 2 args `(message, cause)`; use a plain `Error` if there's no cause.
