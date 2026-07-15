import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PolicyConfigError, loadPolicy, loadPolicyFromFile } from "./index";

describe("loadPolicy — real policy documents (docs/policies)", () => {
  it("parses the return policy frontmatter and prose (TAC-001-06 contract: return = 14 / R-1)", () => {
    const policy = loadPolicy("return");

    expect(policy.windowDays).toBe(14);
    expect(policy.windowRuleId).toBe("R-1");
    expect(policy.prose).toContain("# Return Policy");
    // The frontmatter block must not leak into the prose handed to the LLM.
    expect(policy.prose).not.toContain("window_days");
    expect(policy.prose).not.toContain("---");
  });

  it("parses the complaint policy frontmatter and prose (contract: complaint = 730 / C-1)", () => {
    const policy = loadPolicy("complaint");

    expect(policy.windowDays).toBe(730);
    expect(policy.windowRuleId).toBe("C-1");
    expect(policy.prose).toContain("# Complaint Policy");
    expect(policy.prose).not.toContain("window_days");
  });
});

describe("loadPolicy — no caching (PRD §8 / TAC-001-06: content edits apply without restart)", () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "policy-loader-test-"));
    tempFile = path.join(tempDir, "return-policy.md");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("picks up an edited window_days value on the next call, with no restart or process caching", () => {
    writeFileSync(
      tempFile,
      ["---", "window_days: 14", "window_rule_id: R-1", "---", "", "# Return Policy", "", "Body text."].join("\n"),
      "utf-8"
    );

    const first = loadPolicyFromFile(tempFile);
    expect(first.windowDays).toBe(14);

    // Simulate an operator editing the policy file on disk while the app keeps running.
    writeFileSync(
      tempFile,
      ["---", "window_days: 21", "window_rule_id: R-1", "---", "", "# Return Policy", "", "Body text."].join("\n"),
      "utf-8"
    );

    const second = loadPolicyFromFile(tempFile);
    expect(second.windowDays).toBe(21);
  });
});

describe("loadPolicyFromFile — malformed frontmatter", () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "policy-loader-test-"));
    tempFile = path.join(tempDir, "broken-policy.md");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws PolicyConfigError when the file has no frontmatter block at all", () => {
    writeFileSync(tempFile, "# Just a heading\n\nNo frontmatter here.", "utf-8");

    expect(() => loadPolicyFromFile(tempFile)).toThrow(PolicyConfigError);
  });

  it("throws PolicyConfigError when the opening frontmatter delimiter is never closed", () => {
    writeFileSync(tempFile, ["---", "window_days: 14", "window_rule_id: R-1", "", "# Unterminated"].join("\n"), "utf-8");

    expect(() => loadPolicyFromFile(tempFile)).toThrow(PolicyConfigError);
  });

  it("throws PolicyConfigError when window_days is missing", () => {
    writeFileSync(tempFile, ["---", "window_rule_id: R-1", "---", "", "# Body"].join("\n"), "utf-8");

    expect(() => loadPolicyFromFile(tempFile)).toThrow(PolicyConfigError);
  });

  it("throws PolicyConfigError when window_days is not a positive integer", () => {
    writeFileSync(tempFile, ["---", "window_days: not-a-number", "window_rule_id: R-1", "---", "", "# Body"].join("\n"), "utf-8");

    expect(() => loadPolicyFromFile(tempFile)).toThrow(PolicyConfigError);
  });

  it("throws PolicyConfigError when window_rule_id is missing", () => {
    writeFileSync(tempFile, ["---", "window_days: 14", "---", "", "# Body"].join("\n"), "utf-8");

    expect(() => loadPolicyFromFile(tempFile)).toThrow(PolicyConfigError);
  });

  it("throws PolicyConfigError with the offending file path when the file does not exist", () => {
    const missingFile = path.join(tempDir, "does-not-exist.md");

    expect(() => loadPolicyFromFile(missingFile)).toThrow(PolicyConfigError);
    try {
      loadPolicyFromFile(missingFile);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyConfigError);
      expect((error as InstanceType<typeof PolicyConfigError>).filePath).toBe(missingFile);
    }
  });
});
