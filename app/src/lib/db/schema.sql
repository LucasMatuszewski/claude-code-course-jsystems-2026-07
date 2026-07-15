-- ADR-003 §4: persistence schema for the Hardware Service Decision Copilot.
-- No migration framework at this scale (ADR-003 §3): edit this file and
-- delete the local dev DB file when the schema needs to change.
-- All statements are idempotent so this can be applied on every connection.

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL,
  request_type TEXT NOT NULL,
  category TEXT NOT NULL,
  product_name TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  description TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_number ON cases (case_number);
CREATE INDEX IF NOT EXISTS idx_cases_needs_review_created_at ON cases (needs_review, created_at);

CREATE TABLE IF NOT EXISTS case_images (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (id),
  file_path TEXT NOT NULL,
  source TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_images_case_id ON case_images (case_id);

CREATE TABLE IF NOT EXISTS image_analyses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (id),
  case_image_id TEXT NOT NULL REFERENCES case_images (id),
  conclusive INTEGER NOT NULL,
  analysis_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_analyses_case_id ON image_analyses (case_id);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (id),
  status TEXT NOT NULL,
  justification TEXT NOT NULL,
  next_steps_json TEXT NOT NULL,
  is_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON decisions (case_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (id),
  role TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_case_id_created_at ON chat_messages (case_id, created_at);
