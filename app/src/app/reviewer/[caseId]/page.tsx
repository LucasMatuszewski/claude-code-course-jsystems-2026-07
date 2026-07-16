/**
 * Reviewer case-detail view (PRD §9.3, AC-42; ADR-004 §3/§6).
 *
 * Server component: calls `getCaseWithHistory(getDb(), caseId)` directly
 * (no HTTP round trip — ADR-004 §6). An unknown case id mirrors how
 * `ChatShell`'s own not-found state is worded (`pl.errors.caseNotFound`)
 * rather than a generic 404 page, since this is the same "unknown id"
 * situation AC-42 implies for the reviewer side.
 */

import { CaseDetailView } from "@/components/reviewer/CaseDetailView";
import { pl } from "@/lib/copy/pl";
import { getDb } from "@/lib/db/client";
import { getCaseWithHistory } from "@/lib/db/cases";

interface ReviewerCaseDetailPageProps {
  params: Promise<{ caseId: string }>;
}

export default async function ReviewerCaseDetailPage({ params }: ReviewerCaseDetailPageProps) {
  const { caseId } = await params;
  const caseDetail = getCaseWithHistory(getDb(), caseId);

  if (!caseDetail) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-secondary p-6 text-center">
        <p>{pl.errors.caseNotFound}</p>
      </div>
    );
  }

  return <CaseDetailView caseDetail={caseDetail} />;
}
