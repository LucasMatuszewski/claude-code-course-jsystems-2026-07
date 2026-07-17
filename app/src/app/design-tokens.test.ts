import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level check: confirms the Play design tokens (docs/design-guidelines.md,
// assets/design-tokens.json) are actually wired into the Tailwind v4 CSS-based
// theme (globals.css `@theme` blocks), not just documented. jsdom does not run
// the PostCSS/Tailwind pipeline, so we assert against the CSS source text.
describe("globals.css design tokens", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "./globals.css"),
    "utf-8"
  );

  it("exposes Play brand colors as theme CSS vars", () => {
    expect(css).toMatch(/--color-brand-primary:\s*var\(--brand-primary\)/);
    expect(css).toMatch(/--brand-primary:\s*#6C43BF/i);
    expect(css).toMatch(/--brand-accent:\s*#E6144B/i);
  });

  it("exposes decision-badge color tokens per ADR-002", () => {
    expect(css).toMatch(/--badge-approve:\s*#15803D/i);
    expect(css).toMatch(/--badge-reject:\s*#E6144B/i);
    expect(css).toMatch(/--badge-more-info:\s*#B45309/i);
    expect(css).toMatch(/--badge-escalate:\s*#6C43BF/i);
  });

  it("maps the Manrope font loaded via next/font to the Tailwind sans theme entry", () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-manrope\)/);
  });
});
