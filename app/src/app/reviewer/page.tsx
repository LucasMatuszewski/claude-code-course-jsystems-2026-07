/**
 * Reviewer list view (PRD §9.3, AC-40/41; ADR-004 §3/§6).
 *
 * Server component: calls `listEscalatedCases(getDb())` directly (no HTTP
 * round trip — ADR-004 §6 "Reviewer pages as server components with direct
 * DB access"). Not linked from the customer UI; reached directly by route.
 */

import { EscalatedCasesTable } from "@/components/reviewer/EscalatedCasesTable";
import { pl } from "@/lib/copy/pl";
import { getDb } from "@/lib/db/client";
import { listEscalatedCases } from "@/lib/db/cases";

export default function ReviewerListPage() {
  const cases = listEscalatedCases(getDb());

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{pl.reviewer.listTitle}</h1>
      <EscalatedCasesTable cases={cases} />
    </div>
  );
}
