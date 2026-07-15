import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TAC-002-01: `generateObject` is deprecated per ADR-002 §3 in favor of
 * `generateText` with `output: Output.object(...)`. Statically forbids the
 * import anywhere under `src/` so a future edit cannot silently reintroduce it.
 */

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursive(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("no generateObject usage (TAC-002-01)", () => {
  it("no file under src/ imports or references generateObject", () => {
    const srcDir = path.join(process.cwd(), "src");
    const files = listFilesRecursive(srcDir);
    const offenders = files.filter((file) => fs.readFileSync(file, "utf-8").includes("generateObject"));

    expect(offenders).toEqual([]);
  });
});
