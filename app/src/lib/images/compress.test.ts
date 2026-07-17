import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createExifRotatedFixture,
  createJpegWithExifForStrippingCheck,
  createLargeNoiseJpeg,
  createSmallPng,
  createUndecodableBytes,
  createWebp,
} from "@/test/fixtures/images-unit/generate";
import { compressImage } from "./compress";
import { MAX_DIMENSION_PX } from "./constants";

describe("compressImage", () => {
  it("shrinks a large JPEG to fit within the max dimension and reduces byte size", async () => {
    const input = await createLargeNoiseJpeg(4000, 3000);
    expect(input.byteLength).toBeGreaterThan(2 * 1024 * 1024); // sanity: fixture is genuinely large

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeLessThanOrEqual(MAX_DIMENSION_PX);
    expect(meta.height).toBeLessThanOrEqual(MAX_DIMENSION_PX);
    // The longest edge should land on (or within a rounding pixel of) the target.
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeGreaterThanOrEqual(
      MAX_DIMENSION_PX - 1,
    );
    expect(output.byteLength).toBeLessThan(input.byteLength);
  });

  it("does not upscale a small PNG smaller than the max dimension", async () => {
    const input = await createSmallPng(100, 80);
    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });

  it("converts a WebP input to JPEG output", async () => {
    const input = await createWebp(300, 200);
    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(200);
  });

  it("auto-rotates an EXIF-oriented (sideways) portrait photo to the correct visual orientation", async () => {
    const { jpeg, rawWidth, rawHeight } = await createExifRotatedFixture(40, 20);

    // Sanity: the fixture's raw pixel grid is genuinely unrotated landscape,
    // and the EXIF tag says orientation=6.
    const rawMeta = await sharp(jpeg).metadata();
    expect(rawMeta.width).toBe(rawWidth);
    expect(rawMeta.height).toBe(rawHeight);
    expect(rawMeta.orientation).toBe(6);

    const output = await compressImage(jpeg);
    const meta = await sharp(output).metadata();

    // Dimensions swap: a 90 degree rotation turns WxH into HxW.
    expect(meta.width).toBe(rawHeight);
    expect(meta.height).toBe(rawWidth);
    // No EXIF orientation should survive (either stripped or normalized to 1
    // now that the pixels themselves are physically corrected).
    expect(meta.orientation ?? 1).toBe(1);

    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    const samplePixel = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    };

    // Per the 90CW rotation mapping (x,y) -> (H-1-y, x): the original top
    // (red) band ends up on the RIGHT half of the rotated image, and the
    // original bottom (blue) band ends up on the LEFT half.
    const midY = Math.floor(info.height / 2);
    const rightSide = samplePixel(info.width - 5, midY);
    const leftSide = samplePixel(4, midY);

    expect(rightSide.r).toBeGreaterThan(150);
    expect(rightSide.b).toBeLessThan(100);
    expect(leftSide.b).toBeGreaterThan(150);
    expect(leftSide.r).toBeLessThan(100);
  });

  it("strips EXIF/ICC metadata from the output", async () => {
    const input = await createJpegWithExifForStrippingCheck();
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.exif).toBeDefined();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();

    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it("rejects for undecodable input without producing any output", async () => {
    const input = createUndecodableBytes();
    await expect(compressImage(input)).rejects.toThrow();
  });
});
