import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Stable enum keys — see ADR-003 §3 (schema) and ADR-000 §5 (data models).
// UI labels (Polish) are a presentation-layer concern; only these keys are
// ever persisted, per ADR-003 "stored as stable keys, not Polish labels".

/** PRD §8 equipment category list, as stable keys. */
export const EQUIPMENT_CATEGORIES = [
  "smartphone",
  "laptop",
  "tablet",
  "tv_monitor",
  "audio",
  "small_appliance",
  "peripherals",
  "other",
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const REQUEST_TYPES = ["complaint", "return"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const SESSION_STATUSES = ["created", "analyzed", "analysis_failed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** ADR-000 §5: the four decision categories the agent may recommend. */
export const DECISION_CATEGORIES = ["APPROVE", "REJECT", "MORE_INFO", "ESCALATE"] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

export const DECISION_SOURCES = ["initial", "chat_revision"] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

export const MESSAGE_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** Builds a `col in ('a','b',...)` SQL fragment for a CHECK constraint. */
function inList(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(","));
}

export const sessions = sqliteTable(
  "sessions",
  {
    // URL-safe random ID (nanoid, ~21 chars); customer-visible (AC-25) —
    // deliberately not an enumerable integer.
    id: text("id").primaryKey(),
    requestType: text("request_type").notNull(),
    category: text("category").notNull(),
    productName: text("product_name").notNull(),
    purchaseDate: text("purchase_date").notNull(),
    reason: text("reason"),
    // Relative path of the compressed image (data/uploads/{id}.jpg per ADR-003 §3).
    imagePath: text("image_path").notNull(),
    imageOriginalName: text("image_original_name").notNull(),
    imageMediaType: text("image_media_type").notNull(),
    // ImageAnalysis JSON (ADR-001 §4), set once analysis succeeds.
    visionAnalysis: text("vision_analysis"),
    status: text("status").notNull().default("created"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    check("sessions_request_type_check", sql`${table.requestType} in (${inList(REQUEST_TYPES)})`),
    check("sessions_category_check", sql`${table.category} in (${inList(EQUIPMENT_CATEGORIES)})`),
    check("sessions_status_check", sql`${table.status} in (${inList(SESSION_STATUSES)})`),
  ],
);

export const decisions = sqliteTable(
  "decisions",
  {
    // Autoincrement PK — ordering tiebreaker for same-millisecond timestamps.
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    // Set on revisions only; null for the initial decision.
    previousDecision: text("previous_decision"),
    justification: text("justification").notNull(),
    // JSON array of policy rule IDs cited for this decision.
    citedRuleIds: text("cited_rule_ids").notNull(),
    source: text("source").notNull(),
    // True when the guard replaced the model's requested category —
    // audit trail for staff (ADR-003 §3).
    guardOverride: integer("guard_override", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("decisions_session_id_idx").on(table.sessionId),
    check("decisions_decision_check", sql`${table.decision} in (${inList(DECISION_CATEGORIES)})`),
    check(
      "decisions_previous_decision_check",
      sql`${table.previousDecision} is null or ${table.previousDecision} in (${inList(DECISION_CATEGORIES)})`,
    ),
    check("decisions_source_check", sql`${table.source} in (${inList(DECISION_SOURCES)})`),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    // The AI SDK UI-message ID — stable across live render and restore.
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    // UI-message parts verbatim (JSON) — restore replays exactly what rendered.
    parts: text("parts").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("messages_session_id_idx").on(table.sessionId),
    index("messages_session_id_created_at_idx").on(table.sessionId, table.createdAt),
    check("messages_role_check", sql`${table.role} in (${inList(MESSAGE_ROLES)})`),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
