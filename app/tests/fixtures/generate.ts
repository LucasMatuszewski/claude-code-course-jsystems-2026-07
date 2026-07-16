/**
 * Deterministic generator for the E2E test image fixtures (P4.1, PRD AC-05).
 *
 * Regenerate with:
 *   node tests/fixtures/generate.ts
 * (run from `app/`; Node 24 executes `.ts` files natively via type-stripping).
 *
 * Every fixture is produced by pure, seed-free math (fixed SVG markup, a
 * deterministic integer hash for "noise", fixed blur/quality parameters) so
 * re-running this script reproduces byte-identical files. No `Math.random()`,
 * no `Date.now()`, no external input.
 *
 * Fixtures produced (all in this directory):
 *  - clean-product.jpg     valid JPEG, well under 10 MB (happy-path upload).
 *  - damaged-product.jpg   same base shape + drawn "crack" lines/noise dots.
 *  - blurry.jpg            same base shape, heavy gaussian blur applied.
 *  - oversized.jpg         a genuinely valid JPEG that is > 10 MB on disk.
 *  - wrong-type.gif        a tiny, valid GIF (wrong MIME type for uploads).
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const FIXTURES_DIR = path.resolve(import.meta.dirname);

const WIDTH = 800;
const HEIGHT = 600;

/** Fixed "product box on a gradient background" SVG — the shared base shape. */
function baseProductSvg(): string {
  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eef1f5"/>
          <stop offset="100%" stop-color="#c9d6e3"/>
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
      <rect x="200" y="150" width="400" height="300" rx="12" fill="#4a4a4a" stroke="#1f1f1f" stroke-width="6"/>
      <rect x="240" y="190" width="320" height="220" rx="6" fill="#2d2d2d"/>
      <circle cx="400" cy="300" r="40" fill="#6c43bf"/>
      <rect x="380" y="280" width="40" height="40" rx="4" fill="#e6144b"/>
    </svg>
  `;
}

/** Fixed crack lines + noise dots overlaid on the base shape (damaged-product.jpg). */
function damageOverlaySvg(): string {
  const cracks = [
    "M220,170 L320,240 L280,320 L360,380",
    "M600,180 L520,260 L560,340 L500,410",
    "M400,150 L410,260 L390,340",
  ]
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#0d0d0d" stroke-width="3" stroke-linecap="round"/>`,
    )
    .join("");

  // Deterministic "noise" dots: fixed integer hash walk, no Math.random/Date.now.
  let seed = 12345;
  const dots: string[] = [];
  for (let i = 0; i < 40; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const x = 220 + (seed % 380);
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const y = 170 + (seed % 280);
    dots.push(`<circle cx="${x}" cy="${y}" r="1.5" fill="#111111" fill-opacity="0.5"/>`);
  }

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${cracks}
      ${dots.join("")}
    </svg>
  `;
}

async function generateCleanProduct(): Promise<Buffer> {
  return sharp(Buffer.from(baseProductSvg())).jpeg({ quality: 85 }).toBuffer();
}

async function generateDamagedProduct(): Promise<Buffer> {
  const base = sharp(Buffer.from(baseProductSvg()));
  return base
    .composite([{ input: Buffer.from(damageOverlaySvg()) }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function generateBlurry(): Promise<Buffer> {
  return sharp(Buffer.from(baseProductSvg())).blur(25).jpeg({ quality: 85 }).toBuffer();
}

/**
 * Deterministic pseudo-random RGB noise buffer (integer hash of the pixel
 * index — no Math.random/Date.now) used only to make `oversized.jpg`
 * genuinely incompressible enough to exceed 10 MB as a real JPEG.
 */
function deterministicNoiseRaw(width: number, height: number): Buffer {
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  let h = 0x2545f491;
  for (let i = 0; i < buf.length; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h |= 0;
    buf[i] = h & 0xff;
  }
  return buf;
}

async function generateOversized(): Promise<Buffer> {
  // Broadband noise + quality 100 + no chroma subsampling: JPEG's DCT
  // compression cannot exploit noise, so the encoded file stays close to
  // raw size (~12 MB here) — comfortably over the 10 MB (AC-05) limit
  // without bloating the repo more than necessary.
  const width = 2048;
  const height = 2048;
  const raw = deterministicNoiseRaw(width, height);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * A tiny, spec-valid 1x1 transparent GIF89a (wrong MIME type for the upload
 * constraint). This is the well-known minimal-valid-GIF byte sequence
 * (fixed base64 constant, not sharp-encoded — GIF output is not guaranteed
 * available in every libvips build, and hand-rolled LZW is easy to get
 * subtly wrong; this constant is a real, widely-used valid GIF).
 */
function wrongTypeGif(): Buffer {
  const base64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7";
  return Buffer.from(base64, "base64");
}

async function main() {
  const clean = await generateCleanProduct();
  writeFileSync(path.join(FIXTURES_DIR, "clean-product.jpg"), clean);

  const damaged = await generateDamagedProduct();
  writeFileSync(path.join(FIXTURES_DIR, "damaged-product.jpg"), damaged);

  const blurry = await generateBlurry();
  writeFileSync(path.join(FIXTURES_DIR, "blurry.jpg"), blurry);

  const oversized = await generateOversized();
  writeFileSync(path.join(FIXTURES_DIR, "oversized.jpg"), oversized);

  writeFileSync(path.join(FIXTURES_DIR, "wrong-type.gif"), wrongTypeGif());

  console.log("Generated fixtures:");
  console.log(`  clean-product.jpg   ${clean.length} bytes`);
  console.log(`  damaged-product.jpg ${damaged.length} bytes`);
  console.log(`  blurry.jpg          ${blurry.length} bytes`);
  console.log(`  oversized.jpg       ${oversized.length} bytes`);
}

main().catch((error) => {
  console.error("Fixture generation failed:", error);
  process.exitCode = 1;
});
