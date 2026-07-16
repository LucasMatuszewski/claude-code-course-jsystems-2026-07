/**
 * Escalated-cases list table (PRD §9.3, AC-41; ADR-004 §6 "simple table on
 * white, `#F5F5F5` row hover, no Play magenta here — neutral utility view").
 *
 * Purely presentational: `src/app/reviewer/page.tsx` (server component)
 * calls `listEscalatedCases(getDb())` directly and passes the result here —
 * newest-first ordering is that DB query's job (ADR-003 §5/TAC-003-03),
 * this component just renders the rows it is given, in order.
 */

import Link from "next/link";

import { pl } from "@/lib/copy/pl";
import type { CaseSummary } from "@/lib/db/cases";

/** UTC-based formatting keeps rendering deterministic across machines/TZs. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}`;
}

export function EscalatedCasesTable({ cases }: { cases: CaseSummary[] }) {
  if (cases.length === 0) {
    return <p className="text-muted-foreground">{pl.reviewer.emptyState}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 font-medium text-muted-foreground" scope="col">
              {pl.reviewer.columns.caseNumber}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground" scope="col">
              {pl.reviewer.columns.createdAt}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground" scope="col">
              {pl.reviewer.columns.requestType}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground" scope="col">
              {pl.reviewer.columns.category}
            </th>
            <th className="px-4 py-2 font-medium text-muted-foreground" scope="col">
              {pl.reviewer.columns.productName}
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((caseSummary) => (
            <tr className="border-b last:border-b-0 hover:bg-[#F5F5F5]" key={caseSummary.id}>
              <td className="px-4 py-2">
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={`/reviewer/${caseSummary.id}`}
                >
                  {caseSummary.caseNumber}
                </Link>
              </td>
              <td className="px-4 py-2">{formatDateTime(caseSummary.createdAt)}</td>
              <td className="px-4 py-2">
                {pl.form.fields.requestType.options[caseSummary.requestType]}
              </td>
              <td className="px-4 py-2">{caseSummary.category}</td>
              <td className="px-4 py-2">{caseSummary.productName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
