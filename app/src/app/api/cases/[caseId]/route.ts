/**
 * `GET /api/cases/[caseId]` — full case state (ADR-000 §6, ADR-003 §5).
 *
 * Returns form data, all stored images, all image analyses, the ordered
 * decision history, and the ordered chat transcript for one case. Used to
 * hydrate the chat page on load and by the reviewer detail page.
 *
 * ## Testability
 * `createCaseGetHandler(deps)` is the dependency-injected seam, matching the
 * pattern established by `POST /api/cases` (P2.1): integration tests pass a
 * temp SQLite handle; the exported `GET` wires the production `getDb()`.
 */

import type Database from "better-sqlite3";

import { pl } from "@/lib/copy/pl";
import { getCaseWithHistory } from "@/lib/db/cases";
import { getDb } from "@/lib/db/client";

export interface CaseGetDeps {
  db: Database.Database;
}

type RouteContext = { params: Promise<{ caseId: string }> };

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** DI factory: builds the `GET` handler from injectable dependencies. */
export function createCaseGetHandler(deps: CaseGetDeps) {
  return async function GET(_request: Request, context: RouteContext): Promise<Response> {
    const { caseId } = await context.params;

    const detail = getCaseWithHistory(deps.db, caseId);
    if (!detail) {
      return json({ error: pl.errors.caseNotFound }, 404);
    }

    return json(detail, 200);
  };
}

/** Production handler: wires the shared DB connection. */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return createCaseGetHandler({ db: getDb() })(request, context);
}
