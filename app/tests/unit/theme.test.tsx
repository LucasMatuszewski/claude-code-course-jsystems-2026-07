import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// next/font/google relies on Next's build-time webpack loader and cannot be
// imported directly under Vitest (see AGENTS.md P0.4 notes), so these
// assertions read the source files as text rather than rendering the layout.
const layoutSource = readFileSync(
  path.resolve(__dirname, "../../src/app/layout.tsx"),
  "utf-8",
);
const globalsCss = readFileSync(
  path.resolve(__dirname, "../../src/app/globals.css"),
  "utf-8",
);

describe("Play brand theme", () => {
  it("loads Manrope as the --font-sans variable in the root layout", () => {
    expect(layoutSource).toMatch(/from ["']next\/font\/google["']/);
    expect(layoutSource).toMatch(/Manrope\(/);
    expect(layoutSource).toMatch(/variable:\s*["']--font-sans["']/);
  });

  it("uses weight 500 as the default body weight (Play's 'regular')", () => {
    expect(layoutSource).toMatch(/weight:\s*\[["']500["'],\s*["']600["'],\s*["']700["']\]/);
    expect(layoutSource).toMatch(/font-medium/);
  });

  it("sets the html lang attribute to pl", () => {
    expect(layoutSource).toMatch(/lang=["']pl["']/);
  });

  it("defines the Play primary color as a CSS variable", () => {
    expect(globalsCss).toMatch(/--primary:\s*oklch\([^)]*\);\s*\/\*\s*#6C43BF/i);
  });

  it("sets the base border radius to 7px", () => {
    expect(globalsCss).toMatch(/--radius:\s*7px;/);
  });
});
