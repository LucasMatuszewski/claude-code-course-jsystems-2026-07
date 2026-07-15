import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPolicy } from "@/lib/policies/loader";

const REPO_ROOT_POLICIES_DIR = path.join(process.cwd(), "..", "docs", "policies");

describe("loadPolicy", () => {
  it("returns the exact content of the real repo return policy file", () => {
    const expected = fs.readFileSync(
      path.join(REPO_ROOT_POLICIES_DIR, "zasady-zwrotow.md"),
      "utf-8",
    );

    expect(loadPolicy("zwrot")).toBe(expected);
  });

  it("returns the exact content of the real repo complaint policy file", () => {
    const expected = fs.readFileSync(
      path.join(REPO_ROOT_POLICIES_DIR, "zasady-reklamacji.md"),
      "utf-8",
    );

    expect(loadPolicy("reklamacja")).toBe(expected);
  });

  describe("with an injected docs base dir", () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-policies-"));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("throws a descriptive error naming the resolved path when the file is missing", () => {
      expect(() => loadPolicy("zwrot", dir)).toThrow(
        path.join(dir, "zasady-zwrotow.md"),
      );
    });

    it("reads fresh content on every call (no caching)", () => {
      const filePath = path.join(dir, "zasady-reklamacji.md");
      fs.writeFileSync(filePath, "Wersja 1");
      expect(loadPolicy("reklamacja", dir)).toBe("Wersja 1");

      fs.writeFileSync(filePath, "Wersja 2");
      expect(loadPolicy("reklamacja", dir)).toBe("Wersja 2");
    });
  });
});
