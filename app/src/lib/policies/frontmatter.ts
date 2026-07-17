import { z } from "zod";
import { PolicyConfigError } from "./types";

const FRONTMATTER_DELIMITER = "---";

/**
 * Schema for the machine-readable frontmatter block (ADR-001 §3).
 * `window_days` arrives as a YAML-ish scalar string and is coerced to a
 * positive integer; `window_rule_id` must be a non-empty string.
 */
const frontmatterSchema = z.object({
  window_days: z.coerce.number().int("window_days must be an integer").positive("window_days must be a positive number"),
  window_rule_id: z.string().trim().min(1, "window_rule_id must not be empty"),
});

export interface ParsedPolicyFile {
  windowDays: number;
  windowRuleId: string;
  prose: string;
}

/**
 * Splits a policy markdown file's raw text into its frontmatter values and
 * prose body, throwing a typed `PolicyConfigError` on any structural or
 * validation failure. Intentionally does not depend on a YAML library: the
 * frontmatter contract is a flat `key: value` block, which a full YAML
 * parser would be overkill for.
 */
export function parsePolicyFile(content: string, filePath: string): ParsedPolicyFile {
  const lines = content.split(/\r?\n/);

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    throw new PolicyConfigError(
      `Policy file is missing the required frontmatter block (must start with "---"): ${filePath}`,
      filePath
    );
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_DELIMITER);
  if (closingIndex === -1) {
    throw new PolicyConfigError(
      `Policy file frontmatter block is never closed with a second "---": ${filePath}`,
      filePath
    );
  }

  const rawFrontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, closingIndex)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new PolicyConfigError(
        `Invalid frontmatter line (expected "key: value") in ${filePath}: "${line}"`,
        filePath
      );
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    rawFrontmatter[key] = value;
  }

  const result = frontmatterSchema.safeParse(rawFrontmatter);
  if (!result.success) {
    throw new PolicyConfigError(
      `Invalid policy frontmatter in ${filePath}: ${result.error.issues.map((issue) => issue.message).join("; ")}`,
      filePath,
      { cause: result.error }
    );
  }

  const prose = lines
    .slice(closingIndex + 1)
    .join("\n")
    .replace(/^\n+/, "");

  return {
    windowDays: result.data.window_days,
    windowRuleId: result.data.window_rule_id,
    prose,
  };
}
