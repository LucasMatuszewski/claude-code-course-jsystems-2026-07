import fs from "node:fs";
import path from "node:path";
import { parsePolicyFile } from "./frontmatter";
import type { PolicyDocument, PolicyRequestType } from "./types";
import { PolicyConfigError } from "./types";

export type { PolicyDocument, PolicyRequestType } from "./types";
export { PolicyConfigError } from "./types";

const POLICY_FILENAMES: Record<PolicyRequestType, string> = {
  return: "return-policy.md",
  complaint: "complaint-policy.md",
};

/**
 * Resolves the absolute path of the policy markdown file for a request type.
 * `docs/policies/` lives one level above the app (repo-root/docs), the same
 * convention already used for the repo-root `.env` in vitest.setup.ts.
 */
function resolvePolicyPath(requestType: PolicyRequestType): string {
  return path.resolve(process.cwd(), "..", "docs", "policies", POLICY_FILENAMES[requestType]);
}

/**
 * Reads and parses a policy document from an explicit file path. No
 * module-level caching: every call re-reads the file from disk, so an
 * operator editing `docs/policies/*.md` takes effect on the very next
 * request without restarting the app (PRD §8, ADR-001 §3, TAC-001-06).
 *
 * Throws `PolicyConfigError` when the file cannot be read, or its
 * frontmatter is missing, unterminated, or fails validation.
 */
export function loadPolicyFromFile(filePath: string): PolicyDocument {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new PolicyConfigError(`Could not read policy file: ${filePath}`, filePath, { cause: error });
  }

  return parsePolicyFile(content, filePath);
}

/**
 * Loads the policy document for a request type ("return" | "complaint")
 * from `docs/policies/`. See `loadPolicyFromFile` for the no-caching and
 * error-handling contract.
 */
export function loadPolicy(requestType: PolicyRequestType): PolicyDocument {
  return loadPolicyFromFile(resolvePolicyPath(requestType));
}
