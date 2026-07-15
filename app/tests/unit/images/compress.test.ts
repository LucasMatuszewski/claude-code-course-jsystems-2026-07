import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressImage, JPEG_QUALITY, MAX_DIMENSION } from "@/lib/images/compress";

/** Generates a synthetic solid-color PNG buffer for use as test input (ADR-002 §6, §8). */
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("compressImage", () => {
  it("resizes an oversized image so the longest edge is at most MAX_DIMENSION (TAC-002-02)", async () => {
    const input = await makePng(3000, 2000);

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeDefined();
    expect(meta.height).toBeDefined();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(MAX_DIMENSION);
    // Aspect ratio (3:2) preserved, longest edge (width) hits the ceiling exactly.
    expect(meta.width).toBe(MAX_DIMENSION);
    expect(meta.height).toBe(Math.round((MAX_DIMENSION * 2000) / 3000));
  });

  it("does not upscale an image already smaller than the ceiling", async () => {
    const input = await makePng(800, 600);

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
    expect(meta.format).toBe("jpeg");
  });

  it("produces a valid, decodable JPEG buffer", async () => {
    const input = await makePng(800, 600);

    const output = await compressImage(input);

    expect(Buffer.isBuffer(output)).toBe(true);
    // JPEG magic bytes (SOI marker).
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("re-encodes at the fixed JPEG_QUALITY setting (documented ceiling: quality 80)", () => {
    expect(JPEG_QUALITY).toBe(80);
    expect(MAX_DIMENSION).toBe(1600);
  });
});
