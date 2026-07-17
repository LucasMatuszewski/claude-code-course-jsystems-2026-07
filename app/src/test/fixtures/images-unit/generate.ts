/**
 * Programmatic image fixtures for `lib/images` unit tests (ADR-003 §8).
 *
 * Fixtures are generated at test time with sharp rather than committed as
 * binary blobs, per the T1.4 task card ("avoid committing binary blobs
 * except where unavoidable").
 */
import { randomFillSync } from "node:crypto";
import sharp from "sharp";

/** EXIF Orientation value meaning "rotate 90° clockwise to display correctly". */
export const EXIF_ORIENTATION_ROTATE_90_CW = 6;

/**
 * A large, high-entropy (noisy) JPEG that mirrors the ADR-003 §8 scenario
 * ("4000x3000 ~8 MB JPEG fixture"). Noise is used instead of a flat color so
 * JPEG compression cannot trivially collapse it to a tiny buffer — this
 * keeps the "input is large" assertion meaningful (TAC-06: strictly smaller
 * in bytes and dimensions than a >2 MB fixture upload).
 */
export async function createLargeNoiseJpeg(
  width = 4000,
  height = 3000,
): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  randomFillSync(raw);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** A small flat-color PNG, smaller than the 1568px compression target on both edges. */
export async function createSmallPng(width = 100, height = 80): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/** A small flat-color WebP image, to verify format conversion to JPEG. */
export async function createWebp(width = 300, height = 200): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 50, b: 50 },
    },
  })
    .webp()
    .toBuffer();
}

export interface ExifRotatedFixture {
  /** JPEG bytes: raw (unrotated) pixel data + an EXIF Orientation=6 tag. */
  jpeg: Buffer;
  /** Width/height of the raw (pre-rotation) pixel grid, as stored. */
  rawWidth: number;
  rawHeight: number;
}

/**
 * A landscape image whose raw pixel grid is NOT rotated, but carries an EXIF
 * Orientation=6 tag ("rotate 90° CW to display correctly") — the classic
 * "phone held sideways" case. Top half of the raw grid is red, bottom half
 * is blue.
 *
 * `withMetadata({ orientation })` only sets the EXIF tag; it does not touch
 * pixel data (confirmed via Context7 sharp docs for `withMetadata`). Only an
 * explicit `.rotate()`/`.autoOrient()` call physically rotates pixels, which
 * is exactly the behavior under test in `compressImage`.
 *
 * Rotating a WxH grid 90° CW maps original (x, y) -> new (H-1-y, x), so the
 * top band (y in [0, H/2)) ends up occupying the RIGHT half of the new
 * (H-wide) image, and the bottom band ends up on the LEFT half — see
 * compress.test.ts for the corresponding pixel assertions.
 */
export async function createExifRotatedFixture(
  rawWidth = 40,
  rawHeight = 20,
): Promise<ExifRotatedFixture> {
  const raw = Buffer.alloc(rawWidth * rawHeight * 3);
  for (let y = 0; y < rawHeight; y += 1) {
    const isTopBand = y < rawHeight / 2;
    for (let x = 0; x < rawWidth; x += 1) {
      const idx = (y * rawWidth + x) * 3;
      raw[idx] = isTopBand ? 255 : 0; // R
      raw[idx + 1] = 0; // G
      raw[idx + 2] = isTopBand ? 0 : 255; // B
    }
  }

  const jpeg = await sharp(raw, { raw: { width: rawWidth, height: rawHeight, channels: 3 } })
    .jpeg({ quality: 100 })
    .withMetadata({ orientation: EXIF_ORIENTATION_ROTATE_90_CW })
    .toBuffer();

  return { jpeg, rawWidth, rawHeight };
}

/** A JPEG carrying EXIF + a fake ICC-ish profile marker, to verify stripping. */
export async function createJpegWithExifForStrippingCheck(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 5, g: 5, b: 5 } },
  })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Copyright: "Test Fixture" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "51/1 30/1 3230/100",
        GPSLongitudeRef: "W",
        GPSLongitude: "0/1 7/1 4366/100",
      },
    })
    .withMetadata({ orientation: 1 })
    .toBuffer();
}

/** Bytes that are not a decodable image, for failure-path tests. */
export function createUndecodableBytes(): Buffer {
  return Buffer.from("this is definitely not an image", "utf-8");
}
