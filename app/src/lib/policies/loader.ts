/**
 * Policy document loader (ADR-000 §8, "Policy documents read from the
 * repository-root docs/policies/").
 *
 * The two policy documents (`docs/policies/zasady-zwrotow.md`,
 * `docs/policies/zasady-reklamacji.md`) live at the repository root, one
 * level above the Next.js project root (`app/`). They are read from disk at
 * request time via a plain relative filesystem path — not bundled at build
 * time — so an ops/policy update only requires editing the markdown file,
 * no rebuild or redeploy. This assumes the running process has filesystem
 * access to a path outside its own project root, which holds for local/VM
 * dev and traditional Node hosting but not for typical serverless bundling
 * (see the ADR's review trigger for that case).
 *
 * Content is read fresh on every call (`fs.readFileSync`, no in-memory
 * cache): policy documents change rarely and are small, so the simplicity
 * of "always read the current file" outweighs any caching benefit, and it
 * avoids serving stale policy text after an edit until the next deploy.
 */

import fs from "node:fs";
import path from "node:path";

export type PolicyType = "zwrot" | "reklamacja";

const POLICY_FILENAMES: Record<PolicyType, string> = {
  zwrot: "zasady-zwrotow.md",
  reklamacja: "zasady-reklamacji.md",
};

/**
 * Default policies directory: resolved from the app root (`process.cwd()`),
 * matching the project convention that npm scripts and `next dev/build/start`
 * always run with cwd `app/` (see `lib/db/client.ts` for the same
 * `process.cwd()`-relative pattern). `docs/policies/` sits one level above
 * the app root, at the repository root.
 */
const DEFAULT_POLICIES_DIR = path.join(process.cwd(), "..", "docs", "policies");

/**
 * Reads the full markdown content of the policy document matching the given
 * request type. `policiesDir` defaults to the repository-root
 * `docs/policies/` directory; tests may inject an alternate directory (e.g.
 * a temp dir) to exercise the missing-file case without touching real docs.
 *
 * Throws a descriptive error naming the resolved path if the file does not
 * exist (or is otherwise unreadable).
 */
export function loadPolicy(type: PolicyType, policiesDir: string = DEFAULT_POLICIES_DIR): string {
  const filePath = path.join(policiesDir, POLICY_FILENAMES[type]);

  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Policy document not found: ${filePath}`);
  }
}
