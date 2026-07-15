// Generates the three E2E fixture photos (ADR-000 §10, ADR-000 §2 sharp
// reference) used by vision-model E2E specs:
//   - clean-product.jpg   an intact product photo (headphones), in focus
//   - damaged-product.jpg the same product with visible cracks/scratches
//   - unusable-blurry.jpg the clean photo destroyed by heavy blur
//
// These are synthetic composites (SVG shapes rasterized + blurred via
// sharp), not real photographs — see fixtures/README.md for full provenance
// and the rationale for choosing generation over a downloaded photo.
//
// Regenerate with: node e2e/fixtures/generate-fixtures.mjs
// (run from the app/ package so the local `sharp` install resolves)

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = 1000;
const HEIGHT = 750;

// A soft studio-style background gradient, so the product reads as
// photographed rather than a flat vector graphic.
const backgroundSvg = `
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stop-color="#f2f2f0"/>
        <stop offset="100%" stop-color="#c7c8cc"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  </svg>
`;

// A simple over-ear headphones silhouette: a headband arc plus two ear cups,
// shaded to look three-dimensional.
const headphonesSvg = `
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cup" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#3a3a3d"/>
        <stop offset="100%" stop-color="#111113"/>
      </linearGradient>
      <linearGradient id="band" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#2c2c2f"/>
        <stop offset="100%" stop-color="#1a1a1c"/>
      </linearGradient>
    </defs>
    <path d="M 300 380 A 200 220 0 0 1 700 380" stroke="url(#band)"
          stroke-width="28" fill="none" stroke-linecap="round"/>
    <ellipse cx="300" cy="430" rx="70" ry="95" fill="url(#cup)"/>
    <ellipse cx="300" cy="430" rx="40" ry="62" fill="#55565c"/>
    <ellipse cx="700" cy="430" rx="70" ry="95" fill="url(#cup)"/>
    <ellipse cx="700" cy="430" rx="40" ry="62" fill="#55565c"/>
    <!-- soft highlight for a photographed look -->
    <ellipse cx="278" cy="400" rx="14" ry="28" fill="#ffffff" opacity="0.18"/>
    <ellipse cx="678" cy="400" rx="14" ry="28" fill="#ffffff" opacity="0.18"/>
  </svg>
`;

// Cracks + scratches overlaid on the same product for the "damaged" fixture.
const damageOverlaySvg = `
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#e8e4d8" stroke-width="3" fill="none" opacity="0.85"
       stroke-linecap="round">
      <path d="M 260 360 L 300 410 L 285 440 L 320 470 L 300 500"/>
      <path d="M 320 400 L 340 430"/>
      <path d="M 660 380 L 700 415 L 690 450 L 725 480"/>
      <path d="M 640 460 L 670 470 L 660 500"/>
    </g>
    <g stroke="#9a9690" stroke-width="1.5" opacity="0.6">
      <line x1="250" y1="470" x2="340" y2="450"/>
      <line x1="660" y1="500" x2="740" y2="470"/>
    </g>
  </svg>
`;

async function buildCleanBuffer() {
  return sharp(Buffer.from(backgroundSvg))
    .composite([{ input: Buffer.from(headphonesSvg) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function main() {
  const outDir = __dirname;
  await mkdir(outDir, { recursive: true });

  const cleanBuffer = await buildCleanBuffer();
  await sharp(cleanBuffer).toFile(path.join(outDir, "clean-product.jpg"));

  const damagedBuffer = await sharp(Buffer.from(backgroundSvg))
    .composite([
      { input: Buffer.from(headphonesSvg) },
      { input: Buffer.from(damageOverlaySvg) },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  await sharp(damagedBuffer).toFile(path.join(outDir, "damaged-product.jpg"));

  await sharp(cleanBuffer)
    .blur(28)
    .jpeg({ quality: 60 })
    .toFile(path.join(outDir, "unusable-blurry.jpg"));

  console.log("Generated fixtures in", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
