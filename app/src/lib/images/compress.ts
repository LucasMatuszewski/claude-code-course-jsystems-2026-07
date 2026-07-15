/**
 * Image compression (ADR-002 §6): resize to a maximum longest-edge
 * dimension and re-encode as JPEG at a fixed quality, in a single pass,
 * before any multimodal LLM call and before persisting to disk.
 *
 * Smaller inputs are never upscaled (`withoutEnlargement`), so the output
 * may be smaller than `MAX_DIMENSION` on its longest edge, but never larger.
 */

import sharp from "sharp";

/** Longest-edge ceiling in pixels (ADR-002 §6). */
export const MAX_DIMENSION = 1600;

/** Fixed JPEG re-encode quality (ADR-002 §6). */
export const JPEG_QUALITY = 80;

/**
 * Resizes `input` so its longest edge is at most `MAX_DIMENSION` pixels
 * (never upscaling smaller images) and re-encodes it as JPEG at
 * `JPEG_QUALITY` (TAC-002-02).
 */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
