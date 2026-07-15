/**
 * `chat_messages` repository (ADR-003 §4).
 *
 * `parts` is the full `UIMessage.parts` array (owned by the chat/AI layer,
 * not this module) so the transcript can be replayed exactly as rendered;
 * stored as JSON text and round-tripped via `JSON.stringify`/`parse`.
 * Also bumps `cases.updated_at` (ADR-003 §4 "bumped on every new
 * decision/chat message"). Throws (FK violation) if `caseId` does not exist.
 */

import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  caseId: string;
  role: ChatMessageRole;
  parts: unknown[];
  createdAt: string;
}

interface ChatMessageRow {
  id: string;
  case_id: string;
  role: ChatMessageRole;
  parts_json: string;
  created_at: string;
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    caseId: row.case_id,
    role: row.role,
    parts: JSON.parse(row.parts_json) as unknown[],
    createdAt: row.created_at,
  };
}

export function appendChatMessage(
  db: Database,
  caseId: string,
  role: ChatMessageRole,
  parts: unknown[],
): ChatMessage {
  const insertTx = db.transaction(() => {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const partsJson = JSON.stringify(parts);

    db.prepare(
      `INSERT INTO chat_messages (id, case_id, role, parts_json, created_at)
       VALUES (@id, @caseId, @role, @partsJson, @createdAt)`,
    ).run({ id, caseId, role, partsJson, createdAt });

    db.prepare(`UPDATE cases SET updated_at = ? WHERE id = ?`).run(createdAt, caseId);

    return { id, createdAt };
  });

  const { id, createdAt } = insertTx();

  return { id, caseId, role, parts, createdAt };
}

/** Lists all chat messages for a case, oldest first (chronological transcript order). */
export function listChatMessagesByCaseId(db: Database, caseId: string): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM chat_messages WHERE case_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(caseId) as ChatMessageRow[];

  return rows.map(toChatMessage);
}
