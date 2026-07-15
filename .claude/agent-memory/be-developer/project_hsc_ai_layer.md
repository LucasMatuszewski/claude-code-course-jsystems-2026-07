---
name: project-hsc-ai-layer
description: Hardware Service Decision Copilot PoC — AI layer (P1.5) design, exported signatures, and confirmed AI SDK v7.0.28 API shapes (ADR-002 drift) for later tasks (P2.1 case creation route, P2.3 chat route) that consume lib/ai/**.
metadata:
  type: project
---

`app/src/lib/ai/**` implements ADR-002. Committed as `0ab3d97` on branch `moja-praca`. See [[project_zod_v4_error_api]] for the Zod error-message convention reused in `schemas.ts`.

**Exported signatures (P2.1/P2.3 integrate against these):**
- `schemas.ts`: `ImageAnalysisSchema`, `ImageAnalysis`, `DecisionSchema`, `Decision` (zod schemas + inferred types).
- `errors.ts`: `class AiProviderError extends Error` — built via `super(message, { cause })`, not a custom `cause` field.
- `providers.ts`: `createModels(env = process.env): { visionModel: LanguageModelV4; textModel: LanguageModelV4 }` — throws via `loadConfig`'s existing messages (no duplicated validation).
- `image-analysis.ts`: `analyzeImage(requestType, formData: CaseFormValues, compressedImageBuffer: Buffer, model = createModels().visionModel): Promise<ImageAnalysis>`.
- `decision-agent.ts`: `decideInitial(requestType, formData, imageAnalysis, policyMarkdown, model = createModels().textModel): Promise<Decision>`. Only `decideInitial` is implemented — `streamChatTurn` (ADR-002 §5, ongoing chat + `submitDecision` tool) is deliberately NOT built yet (P2.3 scope), per the "don't gold-plate" instruction in the P1.5 task brief.
- `prompts/index.ts` re-exports `imageAnalysisComplaintPrompt(formData)`, `imageAnalysisReturnPrompt(formData)`, `decisionSystemPrompt(requestType, formData, imageAnalysis, policyMarkdown)` from `prompts/image-analysis.ts` and `prompts/decision.ts`.
- All AI-layer functions take an **optional trailing/injected model param** defaulting to `createModels().visionModel`/`.textModel` — this is how tests avoid real network calls (inject `MockLanguageModelV4`), and how routes call with zero extra config.

**AI SDK v7.0.28 API drift vs ADR-002 assumptions (potential ADR-002 amendment):**
- ADR-002 says test with `MockLanguageModelV2`. The actually-installed `ai@7.0.28` only exports `MockLanguageModelV3`/`MockLanguageModelV4` from `ai/test` (no V2 mock). `@openrouter/ai-sdk-provider@^3.0.0`'s `createOpenRouter(...).chat(modelId)` returns a model that `implements LanguageModelV4` directly (confirmed via `node_modules/@openrouter/ai-sdk-provider/dist/index.d.ts`) — so `LanguageModelV4` (from `@ai-sdk/provider`) is the correct type/mock version project-wide, not V2.
- `MockLanguageModelV4` constructor: `doGenerate: async () => ({ content: [{type:'text', text: jsonString}], finishReason: {unified:'stop', raw: undefined}, usage: {inputTokens:{total,noCache,cacheRead,cacheWrite}, outputTokens:{total,text,reasoning}}, warnings: [] })`. Note the nested `finishReason.unified`/`.raw` and structured `usage.inputTokens`/`.outputTokens` — flat `{promptTokens, completionTokens}` (older AI SDK shape memorized from training data) does NOT match this version.
- `generateText({ model, output: Output.object({schema}), messages/system/prompt })` confirmed exact per ADR-002. **`result.output` is a plain value, NOT a Promise** for `generateText` (only `streamText`'s `.output` is a `PromiseLike`) — do not `await result.output` for `generateText`, only for `streamText`.
- The mock's `doGenerateCalls[0].prompt` is the standardized `LanguageModelV4Prompt`: an array of `{role, content}` messages; for `role: 'user'` content is `Array<{type:'text', text} | {type:'file', mediaType, data}>` — this is what a test should assert on to verify "one text part + one file part with mediaType image/jpeg" (TAC-002 test scenario), not the AI-SDK-level `messages` input shape passed to `generateText` (those get converted internally).

**Own-comment gotcha:** a static grep-based test forbidding `generateObject` usage (TAC-002-01) will also match the string inside your own doc comments explaining *why* you don't use it — phrase such comments without the literal substring `generateObject` (e.g. "the deprecated object-generation helper") or the self-check false-positives.
