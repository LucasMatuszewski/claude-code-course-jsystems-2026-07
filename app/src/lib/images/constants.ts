/**
 * Compression profile constants (ADR-003 D3-04).
 *
 * These are implementation tuning, not runtime configuration — they are
 * deliberately hardcoded here rather than read from environment variables.
 */

/** Longest edge (px) the compressed image is fit within; never upscaled. */
export const MAX_DIMENSION_PX = 1568;

/** JPEG encode quality (0-100) used for the compressed output. */
export const JPEG_QUALITY = 80;
