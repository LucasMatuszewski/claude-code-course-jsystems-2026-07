import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCaseImage, writeCaseImage } from "@/lib/images/storage";

function tempUploadsDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hsc-uploads-"));
}

describe("image storage", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = tempUploadsDir();
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it("writes an image and returns an uploads/<caseId>/<seq>.jpg-shaped relative path", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const result = writeCaseImage("case-1", buffer, baseDir);

    expect(result.relativePath).toBe("uploads/case-1/1.jpg");
    expect(fs.existsSync(result.absolutePath)).toBe(true);
  });

  it("auto-creates the case directory", () => {
    const caseDir = path.join(baseDir, "case-1");
    expect(fs.existsSync(caseDir)).toBe(false);

    writeCaseImage("case-1", Buffer.from("a"), baseDir);

    expect(fs.existsSync(caseDir)).toBe(true);
  });

  it("reads back identical bytes via the returned relative path", () => {
    const buffer = Buffer.from("test-image-bytes-12345");
    const { relativePath } = writeCaseImage("case-1", buffer, baseDir);

    const readBack = readCaseImage(relativePath, baseDir);

    expect(readBack.equals(buffer)).toBe(true);
  });

  it("assigns increasing sequence numbers for sequential writes on the same case", () => {
    const first = writeCaseImage("case-1", Buffer.from("a"), baseDir);
    const second = writeCaseImage("case-1", Buffer.from("b"), baseDir);
    const third = writeCaseImage("case-1", Buffer.from("c"), baseDir);

    expect(first.relativePath).toBe("uploads/case-1/1.jpg");
    expect(second.relativePath).toBe("uploads/case-1/2.jpg");
    expect(third.relativePath).toBe("uploads/case-1/3.jpg");
  });

  it("keeps sequence numbers independent per case", () => {
    const a1 = writeCaseImage("case-a", Buffer.from("a"), baseDir);
    const b1 = writeCaseImage("case-b", Buffer.from("b"), baseDir);
    const a2 = writeCaseImage("case-a", Buffer.from("a2"), baseDir);

    expect(a1.relativePath).toBe("uploads/case-a/1.jpg");
    expect(b1.relativePath).toBe("uploads/case-b/1.jpg");
    expect(a2.relativePath).toBe("uploads/case-a/2.jpg");
  });

  it("rejects a relative path containing '..' and never returns file contents (TAC-003-05 groundwork)", () => {
    writeCaseImage("case-1", Buffer.from("secret-bytes"), baseDir);

    expect(() => readCaseImage("uploads/../../etc/passwd", baseDir)).toThrow();
    expect(() => readCaseImage("../case-1/1.jpg", baseDir)).toThrow();
    expect(() => readCaseImage("uploads/case-1/../../1.jpg", baseDir)).toThrow();
  });

  it("rejects a path that resolves outside the base dir even given as an absolute path", () => {
    const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-secret-"));
    const secretFile = path.join(secretDir, "secret.txt");
    fs.writeFileSync(secretFile, "top secret");

    try {
      expect(() => readCaseImage(secretFile, baseDir)).toThrow();
    } finally {
      fs.rmSync(secretDir, { recursive: true, force: true });
    }
  });

  it("throws for a nonexistent (but validly-shaped) relative path", () => {
    expect(() => readCaseImage("uploads/case-missing/1.jpg", baseDir)).toThrow();
  });
});
