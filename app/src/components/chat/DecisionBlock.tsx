import { MessageResponse } from "@/components/ai-elements/message";
import { DISCLAIMER_PL } from "@/lib/ai/prompts";
import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import type { DecisionCategory } from "@/lib/db/schema";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";

/**
 * First/decision message (PRD §9.2 "First message"; AC-17; ADR-002 §3 +
 * D2-03; design-guidelines §2 badge color mapping + §6 promo-tag spec).
 *
 * Content split: `category` (the structured decision) drives the badge;
 * `messageMarkdown` is the AI-generated body verbatim (greeting,
 * justification, numbered next steps, and the mandatory disclaimer appended
 * as trailing text by the guard — `lib/ai/guard.ts` `ensureDisclaimer`).
 * `lib/i18n/pl.ts` deliberately does NOT contain this prose (see its module
 * doc) — only the badge label is static UI chrome.
 *
 * The disclaimer is rendered as its own small-print element by splitting the
 * known trailing `DISCLAIMER_PL` constant off the body text, rather than
 * asking the backend for a separate field (none exists in `DecisionResult` —
 * `messageMarkdown` is "stored verbatim", ADR-001 §4).
 */

export type { DecisionCategory };

export interface DecisionData {
  category: DecisionCategory;
  messageMarkdown: string;
}

/**
 * The restore page (T4.5) synthesizes this custom data part (AI SDK v5
 * `DataUIPart<DATA_TYPES>` convention: `type: "data-${name}"`, `data: ...`)
 * for the session's first assistant message so the generic part-rendering
 * pipeline in `MessageRow` can route it to `DecisionBlock` (ADR-002 §4: "the
 * first message's decision metadata is included in the restore payload and
 * rendered from the persisted Decision record").
 */
export interface DecisionDataPart {
  type: "data-decision";
  id?: string;
  data: DecisionData;
}

/**
 * Type guard used by `MessageRow` to route a generic UI-message part to
 * `DecisionBlock`. A type predicate is a trusted assertion (not derived from
 * control-flow narrowing), so this is the single safe place a loose part is
 * treated as `DecisionDataPart` — callers must not skip this check.
 */
export function isDecisionDataPart(
  part: UIMessagePart<UIDataTypes, UITools> | { type: string },
): part is DecisionDataPart {
  return part.type === "data-decision";
}

const BADGE_COLOR_CLASS: Record<DecisionCategory, string> = {
  APPROVE: "bg-badge-approve",
  REJECT: "bg-badge-reject",
  MORE_INFO: "bg-badge-more-info",
  ESCALATE: "bg-badge-escalate",
};

/**
 * Category badge — Play promo-tag pattern (design-guidelines §6): radius
 * 3px, weight 700, 9px, white text, colored background per category
 * (design-guidelines §2 mapping; tokens defined in `globals.css` as
 * `--badge-approve/reject/more-info/escalate`). Shared with `RevisionMarker`.
 */
export function CategoryBadge({ category }: { category: DecisionCategory }) {
  return (
    <span
      data-testid="decision-badge"
      className={cn(
        "w-fit rounded-[var(--radius-play-sm)] px-[3px] py-[1px] text-[9px] font-bold text-white",
        BADGE_COLOR_CLASS[category],
      )}
    >
      {pl.chat.decisionBadge[category]}
    </span>
  );
}

/**
 * Splits the mandatory trailing disclaimer (appended by `ensureDisclaimer`,
 * `lib/ai/guard.ts`) off the AI-generated body text so it can be rendered as
 * its own small-print element (AC-17 "disclaimer in smaller text", PRD
 * §9.2). Falls back to rendering the whole text as the body — with no
 * disclaimer element — when the trailing text does not match (defensive:
 * must never crash or hide content on a shape mismatch).
 */
function splitDisclaimer(messageMarkdown: string): {
  body: string;
  disclaimer: string | null;
} {
  const trimmed = messageMarkdown.trimEnd();
  if (!trimmed.endsWith(DISCLAIMER_PL)) {
    return { body: messageMarkdown, disclaimer: null };
  }
  const body = trimmed.slice(0, trimmed.length - DISCLAIMER_PL.length).trimEnd();
  return { body, disclaimer: DISCLAIMER_PL };
}

export interface DecisionBlockProps {
  category: DecisionCategory;
  messageMarkdown: string;
}

export function DecisionBlock({ category, messageMarkdown }: DecisionBlockProps) {
  const { body, disclaimer } = splitDisclaimer(messageMarkdown);
  return (
    <div
      data-testid="decision-block"
      className="border-border-strong/40 bg-background-subtle flex flex-col gap-2 rounded-[var(--radius-play-md)] border p-md"
    >
      <CategoryBadge category={category} />
      <MessageResponse>{body}</MessageResponse>
      {disclaimer !== null ? (
        <p data-testid="decision-disclaimer" className="text-text-secondary text-xs">
          {disclaimer}
        </p>
      ) : null}
    </div>
  );
}
