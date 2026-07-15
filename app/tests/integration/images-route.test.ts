// @vitest-environment node

/**
 * Integration tests for `GET /api/images/[...path]` (ADR-003 §3, §6, TAC-003-05).
 *
 * Real temp uploads dir + real `lib/images/storage` writes/reads; no DB, no
 * AI. Exercised through the dependency-injected factory
 * `createImagesGetHandler`, matching the P2.1 DI seam pattern. Traversal
 * segments are passed already-decoded to `params`, matching how Next.js
 * itself decodes dynamic route segments (including `%2e%2e`) before handing
 * them to the Route Handler.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { createImagesGetHandler } from "@/app/api/images/[...path]/route";
import { writeCaseImage } from "@/lib/images/storage";

let uploadsBaseDir: string;

beforeEach(() => {
  uploadsBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), "hsc-images-route-"));
});

function makeContext(segments: string[]): { params: Promise<{ path: string[] }> } {
  return { params: Promise.resolve({ path: segments }) };
}

async function bodyBytes(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer());
}

describe("GET /api/images/[...path]", () => {
  it("returns 200 with the exact stored bytes and image/jpeg content type", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xaa, 0xbb, 0x01, 0x02]);
    const stored = writeCaseImage("case-1", bytes, uploadsBaseDir);
    const segments = stored.relativePath.split("/");

    const handler = createImagesGetHandler({ uploadsBaseDir });
    const res = await handler(
      new Request(`http://localhost/api/images/${segments.join("/")}`),
      makeContext(segments),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect((await bodyBytes(res)).equals(bytes)).toBe(true);
  });

  it("returns 404 for a missing file, exposing no content", async () => {
    const handler = createImagesGetHandler({ uploadsBaseDir });
    const segments = ["uploads", "does-not-exist", "1.jpg"];
    const res = await handler(
      new Request(`http://localhost/api/images/${segments.join("/")}`),
      makeContext(segments),
    );

    expect(res.status).toBe(404);
    expect((await bodyBytes(res)).length).toBe(0);
  });

  it("rejects a literal .. traversal segment with 400/404, never returning file contents", async () => {
    // Plant a real secret file just outside the uploads base dir to prove
    // nothing leaks if the guard were broken.
    const secretPath = path.join(path.dirname(uploadsBaseDir), "secret.txt");
    fs.writeFileSync(secretPath, "top-secret");

    const handler = createImagesGetHandler({ uploadsBaseDir });
    const segments = ["..", path.basename(secretPath)];
    const res = await handler(
      new Request(`http://localhost/api/images/${segments.join("/")}`),
      makeContext(segments),
    );

    expect([400, 404]).toContain(res.status);
    const bytes = await bodyBytes(res);
    expect(bytes.length).toBe(0);
    expect(bytes.toString()).not.toContain("top-secret");
  });

  it("rejects an already-decoded %2e%2e traversal segment with 400/404, never returning file contents", async () => {
    // Next.js decodes dynamic route segments (including %2e%2e -> "..")
    // before invoking the handler, so this is what the route actually sees.
    const decoded = decodeURIComponent("%2e%2e");
    expect(decoded).toBe("..");

    const handler = createImagesGetHandler({ uploadsBaseDir });
    const segments = [decoded, decoded, "etc", "passwd"];
    const res = await handler(
      new Request(`http://localhost/api/images/${segments.join("/")}`),
      makeContext(segments),
    );

    expect([400, 404]).toContain(res.status);
    expect((await bodyBytes(res)).length).toBe(0);
  });
});
