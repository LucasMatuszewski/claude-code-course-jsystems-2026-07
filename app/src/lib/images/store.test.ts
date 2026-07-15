import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createJpegWithExifForStrippingCheck,
  createUndecodableBytes,
} from "@/test/fixtures/images-unit/generate";
import { compressImage } from "./compress";
import { getImagePath, readImage, storeImage } from "./store";

describe("lib/images store", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "images-unit-"));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("getImagePath returns the expected relative path shape without touching disk", () => {
    const relativePath = getImagePath("abc123SESSION");
    expect(relativePath).toBe(path.join("data", "uploads", "abc123SESSION.jpg"));
  });

  it("writes the buffer to data/uploads/{sessionId}.jpg under the base dir and returns the relative path", async () => {
    const buffer = Buffer.from("fake-compressed-jpeg-bytes");
    const relativePath = await storeImage("session-1", buffer, baseDir);

    expect(relativePath).toBe(path.join("data", "uploads", "session-1.jpg"));

    const files = await readdir(path.join(baseDir, "data", "uploads"));
    expect(files).toEqual(["session-1.jpg"]);
  });

  it("creates the uploads directory when it does not exist yet", async () => {
    const buffer = Buffer.from("bytes");
    await storeImage("session-2", buffer, baseDir);

    const files = await readdir(path.join(baseDir, "data", "uploads"));
    expect(files).toContain("session-2.jpg");
  });

  it("readImage reads back exactly what storeImage wrote", async () => {
    const buffer = Buffer.from("round-trip-bytes");
    const relativePath = await storeImage("session-3", buffer, baseDir);

    const readBack = await readImage(relativePath, baseDir);
    expect(readBack.equals(buffer)).toBe(true);
  });

  it("rejects a sessionId containing path traversal characters", async () => {
    await expect(storeImage("../evil", Buffer.from("x"), baseDir)).rejects.toThrow();
    await expect(readdir(baseDir).catch(() => [])).resolves.not.toContain("evil.jpg");
  });

  it("TAC-003-03: stored file on disk contains no EXIF/GPS metadata after compress+store", async () => {
    const input = await createJpegWithExifForStrippingCheck();
    const compressed = await compressImage(input);
    const relativePath = await storeImage("session-4", compressed, baseDir);

    const onDisk = await readImage(relativePath, baseDir);
    const meta = await sharp(onDisk).metadata();

    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it("leaves no orphan file on disk when compression fails before store is called", async () => {
    const bad = createUndecodableBytes();

    await expect(
      (async () => {
        const compressed = await compressImage(bad); // rejects
        await storeImage("session-5", compressed, baseDir);
      })(),
    ).rejects.toThrow();

    // storeImage was never reached, so nothing — not even the uploads
    // directory itself — should have been written under baseDir.
    const entries = await readdir(baseDir);
    expect(entries).toEqual([]);
  });
});
