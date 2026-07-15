/**
 * `AiProviderError` (ADR-002 §5) — the typed error wrapping any failure from
 * an OpenRouter/AI SDK model call (`analyzeImage`, `decideInitial`). Callers
 * (route handlers, P2.1) catch this specific type and turn it into the
 * `502 { retryable: true }` response — timeouts and explicit 4xx/5xx from
 * OpenRouter are both treated as retryable from the customer's perspective.
 */

export class AiProviderError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "AiProviderError";
  }
}
