/**
 * Reviewer case-detail view (PRD §9.3, AC-42; ADR-004 §3/§6).
 *
 * Purely presentational: `src/app/reviewer/[caseId]/page.tsx` (server
 * component) calls `getCaseWithHistory(getDb(), caseId)` directly and
 * passes the full result here. Renders, in order: form data, the stored
 * image(s) via the protected `GET /api/images/[...path]` route, the raw
 * per-image analysis (including the `conclusive` flag — the analysis is
 * internal data never shown verbatim to the customer, PRD §11, but is part
 * of the audit record the reviewer needs, PRD AC-42), the full decision
 * history (oldest to newest, reusing `DecisionBlock` so it looks identical
 * to the chat screen), and the read-only transcript (`TranscriptView`).
 *
 * Entirely read-only (AC-42/TAC-004-04): the single back-to-list link is
 * the only interactive element in the whole view — no buttons, inputs, or
 * forms.
 */

import Link from "next/link";

import { DecisionBlock } from "@/components/chat/DecisionBlock";
import { Button } from "@/components/ui/button";
import { pl } from "@/lib/copy/pl";
import type { CaseDetail } from "@/lib/db/cases";
import { TranscriptView } from "./TranscriptView";

/** `purchaseDate` is a plain `YYYY-MM-DD` date string (no time/timezone). */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}.${month}.${year}`;
}

export function CaseDetailView({ caseDetail }: { caseDetail: CaseDetail }) {
  const descriptionLabel =
    caseDetail.requestType === "reklamacja"
      ? pl.form.fields.description.labelRequired
      : pl.form.fields.description.labelOptional;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <Button asChild className="self-start" variant="outline">
        <Link href="/reviewer">{pl.reviewer.backButton}</Link>
      </Button>

      <section>
        <h2 className="text-lg font-semibold">{pl.reviewer.detail.formDataHeading}</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{pl.form.fields.requestType.label}</dt>
            <dd className="text-sm font-medium">
              {pl.form.fields.requestType.options[caseDetail.requestType]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{pl.form.fields.category.label}</dt>
            <dd className="text-sm font-medium">{caseDetail.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{pl.form.fields.productName.label}</dt>
            <dd className="text-sm font-medium">{caseDetail.productName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{pl.form.fields.purchaseDate.label}</dt>
            <dd className="text-sm font-medium">{formatDate(caseDetail.purchaseDate)}</dd>
          </div>
          {caseDetail.description && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{descriptionLabel}</dt>
              <dd className="text-sm">{caseDetail.description}</dd>
            </div>
          )}
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{pl.reviewer.detail.imageHeading}</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {caseDetail.images.map((image) => (
            // Reviewer-only, server-rendered read view of a stored file behind
            // the protected image route; next/image adds no value here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={image.originalFilename}
              className="h-48 w-auto rounded-lg border object-cover"
              key={image.id}
              src={`/api/images/${image.filePath}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{pl.reviewer.detail.analysisHeading}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {caseDetail.analyses.map((analysis) => (
            <pre
              className="overflow-x-auto rounded-lg border bg-secondary p-3 text-xs"
              data-testid="image-analysis"
              key={analysis.id}
            >
              {JSON.stringify(
                { conclusive: analysis.conclusive, analysis: analysis.analysis },
                null,
                2,
              )}
            </pre>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{pl.reviewer.detail.decisionHistoryHeading}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {caseDetail.decisions.map((decision) => (
            <DecisionBlock
              key={decision.id}
              output={{
                status: decision.status,
                justification: decision.justification,
                nextSteps: decision.nextSteps,
                isRevision: decision.isRevision,
              }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{pl.reviewer.detail.transcriptHeading}</h2>
        <div className="mt-3">
          <TranscriptView messages={caseDetail.messages} />
        </div>
      </section>
    </div>
  );
}
