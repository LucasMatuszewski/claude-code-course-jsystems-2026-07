/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/sessions (ADR-000 section 6).
 *
 * Runs under the Node environment so undici's `Request`/`FormData`/`File`
 * support multipart bodies end-to-end (jsdom's Request rejects FormData
 * bodies). Real SQLite + real sharp; no LLM, no mocked deps. The POST
 * handler is invoked directly with a constructed Request — no Next server.
 *
 * Isolation: each test gets its own in-memory SQLite via `createDb`. The
 * handler resolves `getDb()` from `@/lib/db/client`; its `DEFAULT_DB_PATH` is
 * fixed at module load (app/data/copilot.sqlite) so `process.chdir()` cannot
 * redirect it. We therefore mock only the singleton accessor `getDb` to
 * return the per-test DB; `createDb` is re-exported unchanged from the real
 * module (REAL SQLite, not a mock). `storeImage`'s `baseDir` defaults to
 * `process.cwd()` (evaluated at call time), so a per-test `chdir` keeps
 * uploads out of the real app tree.
 */
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db/client";
import { getSessionWithHistory } from "@/lib/db/repositories";
import { sessions } from "@/lib/db/schema";
import { MAX_IMAGE_SIZE_BYTES, VALIDATION_MESSAGES_PL } from "@/lib/validation";
import { createSmallPng } from "@/test/fixtures/images-unit/generate";

import { POST } from "./route";

// Capture the real app root at module load, BEFORE any test calls chdir().
const APP_ROOT = process.cwd();
const DRIZZLE_DIR = path.join(APP_ROOT, "drizzle");

// Per-test holder for the in-memory DB. vi.hoisted runs before imports
// resolve, so the vi.mock factory below can close over it.
const testDb = vi.hoisted<{
  db: AppDatabase | null;
  close: (() => void) | null;
}>(() => ({ db: null, close: null }));

vi.mock("@/lib/db/client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    getDb: () => {
      if (!testDb.db) {
        throw new Error("Test DB not initialized for this test");
      }
      return testDb.db;
    },
  };
});

// Imported AFTER vi.mock: createDb is the real function (re-exported), getDb
// is the per-test mock.
const { createDb, getDb } = await import("@/lib/db/client");

const VALID_FORM_FIELDS = {
  requestType: "complaint",
  category: "smartphone",
  productName: "iPhone 15 Pro",
  purchaseDate: "2026-01-15",
  reason: "Ekran pękł po upadku.",
} as const;

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function makePngFile(
  name = "photo.png",
  type = "image/png",
  width = 220,
  height = 160,
): Promise<File> {
  const buffer = await createSmallPng(width, height);
  return new File([buffer], name, { type });
}

/** Returns a shallow copy of `obj` with the given keys removed (AC-02/AC-03 omissions). */
function omitKeys<T extends Record<string, string>>(obj: T, ...keys: Array<keyof T>): Record<string, string> {
  const copy: Record<string, string> = { ...obj };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function buildMultipartRequest(
  fields: Record<string, string>,
  file?: File | null,
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  if (file !== undefined && file !== null) {
    form.set("image", file);
  }
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/sessions (AC-01..AC-08, AC-25)", () => {
  let tmpRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    const handle = createDb({
      filePath: ":memory:",
      migrationsFolder: DRIZZLE_DIR,
    });
    testDb.db = handle.db;
    testDb.close = handle.close;

    tmpRoot = await mkdtemp(path.join(tmpdir(), "sessions-post-route-"));
    originalCwd = process.cwd();
    process.chdir(tmpRoot);
  });

  afterEach(async () => {
    testDb.close?.();
    testDb.db = null;
    testDb.close = null;
    process.chdir(originalCwd);
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe("happy path", () => {
    it("returns 201 with { sessionId } for a valid multipart form (AC-01, AC-25)", async () => {
      const file = await makePngFile();
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, file));

      expect(res.status).toBe(201);
      const body = (await res.json()) as { sessionId?: unknown };
      expect(typeof body.sessionId).toBe("string");
      expect(body.sessionId).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    });

    it("persists a session row with status 'created' and the submitted form fields (AC-26)", async () => {
      const file = await makePngFile();
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, file));
      const { sessionId } = (await res.json()) as { sessionId: string };

      const history = getSessionWithHistory(getDb(), sessionId);
      expect(history).not.toBeNull();
      expect(history?.session.status).toBe("created");
      expect(history?.session.requestType).toBe("complaint");
      expect(history?.session.category).toBe("smartphone");
      expect(history?.session.productName).toBe("iPhone 15 Pro");
      expect(history?.session.purchaseDate).toBe("2026-01-15");
      expect(history?.session.reason).toBe("Ekran pękł po upadku.");
      expect(history?.decisions).toEqual([]);
      expect(history?.messages).toEqual([]);
    });

    it("stores a compressed image file at session.imagePath (AC-08)", async () => {
      const original = await makePngFile();
      const originalBytes = Buffer.from(await original.arrayBuffer());
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, original));
      const { sessionId } = (await res.json()) as { sessionId: string };

      const history = getSessionWithHistory(getDb(), sessionId);
      const storedPath = history?.session.imagePath;
      expect(typeof storedPath).toBe("string");
      expect(storedPath).toMatch(/^[\\/?]|^data[\\/]/);
      expect(storedPath).toMatch(/\.jpg$/);

      const onDisk = await readFile(path.join(tmpRoot, storedPath!));
      // The stored bytes must differ from the original PNG: sharp
      // re-encoded to JPEG (AC-08 / TAC-06: different bytes + format).
      expect(onDisk.equals(originalBytes)).toBe(false);
    });

    it("does not retain the original uploaded bytes anywhere (TAC-06)", async () => {
      const original = await makePngFile("customer-photo.png", "image/png");
      const originalBytes = Buffer.from(await original.arrayBuffer());
      await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, original));

      const uploadsDir = path.join(tmpRoot, "data", "uploads");
      const files = await readdir(uploadsDir);
      // Exactly one file (the compressed JPEG); the original PNG is gone.
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/\.jpg$/);
      const onDisk = await readFile(path.join(uploadsDir, files[0]!));
      expect(onDisk.equals(originalBytes)).toBe(false);
    });

    it("records the original filename and uploaded media type as metadata", async () => {
      const file = await makePngFile("my-phone.png", "image/png");
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, file));
      const { sessionId } = (await res.json()) as { sessionId: string };

      const history = getSessionWithHistory(getDb(), sessionId);
      // ADR-003 section 3: media type stored as-uploaded (image/png), not the
      // compressed output format (image/jpeg).
      expect(history?.session.imageMediaType).toBe("image/png");
      expect(history?.session.imageOriginalName).toBe("my-phone.png");
    });

    it("accepts a return request without a reason field (AC-03)", async () => {
      const file = await makePngFile();
      const fields = {
        requestType: "return",
        category: "laptop",
        productName: "ThinkPad X1",
        purchaseDate: isoDaysFromNow(-5),
      };
      const res = await POST(buildMultipartRequest(fields, file));
      expect(res.status).toBe(201);
      const { sessionId } = (await res.json()) as { sessionId: string };
      const history = getSessionWithHistory(getDb(), sessionId);
      expect(history?.session.reason).toBeNull();
    });
  });

  describe("validation errors -> 400 with field-keyed Polish messages (AC-02..AC-05)", () => {
    it("rejects a missing required text field (AC-02)", async () => {
      const file = await makePngFile();
      const withoutName = omitKeys(VALID_FORM_FIELDS, "productName");
      const res = await POST(buildMultipartRequest(withoutName, file));

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.productName).toBe(VALIDATION_MESSAGES_PL.productNameRequired);
      // No session row should have been created.
      expect(getDb().select().from(sessions).all()).toEqual([]);
    });

    it("rejects a complaint without a reason (AC-03)", async () => {
      const file = await makePngFile();
      const withoutReason = omitKeys(VALID_FORM_FIELDS, "reason");
      const res = await POST(buildMultipartRequest(withoutReason, file));

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.reason).toBe(VALIDATION_MESSAGES_PL.reasonRequiredForComplaint);
    });

    it("rejects a future purchase date (AC-04)", async () => {
      const file = await makePngFile();
      const res = await POST(
        buildMultipartRequest({ ...VALID_FORM_FIELDS, purchaseDate: isoDaysFromNow(1) }, file),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.purchaseDate).toBe(VALIDATION_MESSAGES_PL.purchaseDateFuture);
    });

    it("rejects a wrong image file type with the image field error (AC-05)", async () => {
      const textFile = new File([Buffer.from("not an image")], "doc.txt", { type: "text/plain" });
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, textFile));

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.image).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
    });

    it("rejects a file over 10 MB with the image field error, not a 500 (AC-05)", async () => {
      const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1, 0xff);
      const file = new File([oversized], "huge.jpg", { type: "image/jpeg" });
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, file));

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.image).toBe(VALIDATION_MESSAGES_PL.imageInvalid);
    });

    it("rejects a submission with no image at all (AC-02)", async () => {
      const res = await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, null));

      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: Record<string, string> };
      expect(body.errors.image).toBe(VALIDATION_MESSAGES_PL.imageRequired);
    });

    it("does not persist a session or write a file when validation fails", async () => {
      const textFile = new File([Buffer.from("nope")], "x.txt", { type: "text/plain" });
      await POST(buildMultipartRequest({ ...VALID_FORM_FIELDS }, textFile));

      expect(getDb().select().from(sessions).all()).toEqual([]);
      // No uploads directory should have been created.
      await expect(readdir(path.join(tmpRoot, "data", "uploads"))).rejects.toThrow();
    });
  });
});
