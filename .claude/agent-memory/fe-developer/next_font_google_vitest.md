---
name: next-font-google-vitest
description: next/font/google cannot be imported/rendered under Vitest; test layout.tsx via string-level source reads instead
metadata:
  type: feedback
---

`next/font/google` calls (e.g. `Manrope({...})`) throw `TypeError: X is not a function` when the module is imported directly in a Vitest test, because the actual font-loading logic only exists inside Next's special webpack loader — it doesn't run under Vite/Vitest's transform pipeline.

**Why:** Confirmed empirically in this repo (`app/`) while testing `app/src/app/layout.tsx` for the Play brand theme (P0.4): a smoke test that imported and called `RootLayout` failed at the `Manrope(...)` call site, not in any of our own code.

**How to apply:** When a root layout or any component uses `next/font/google` (or likely `next/font/local`), do not unit-test it by importing/rendering the module in Vitest. Instead assert on the file's source as text (`readFileSync` + regex/string matches) — e.g. checking the font is imported, the `variable` name, weight list, and `lang` attribute. This is the same "string-level read is acceptable" pattern already sanctioned for CSS files. See `app/tests/unit/theme.test.tsx` for the pattern.
