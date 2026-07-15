# E2E fixture images

Three fixture photos used by vision-model E2E specs (ADR-000 §10 — "Vision/decision
prompt quality is validated by E2E with fixture images: a clean product photo, a
damaged product photo, an unusable/blurry photo").

| File | Purpose | Expected vision-model read |
|---|---|---|
| `clean-product.jpg` | Intact product (stylised over-ear headphones) | Product is undamaged |
| `damaged-product.jpg` | Same product with visible cracks/scratches | Product is damaged |
| `unusable-blurry.jpg` | The clean photo destroyed by heavy blur | Image cannot be assessed (AC-10) |

## Provenance

These are **synthetically generated composites**, not photographs or downloaded
stock images. They are built from SVG shapes (a shaded headband + ear-cup
silhouette, plus overlaid crack/scratch paths for the damaged variant)
rasterized and post-processed with `sharp` — the project's own image-processing
dependency (ADR-000 §2/§74).

Generation script: [`generate-fixtures.mjs`](./generate-fixtures.mjs). Regenerate with:

```bash
cd app
node e2e/fixtures/generate-fixtures.mjs
```

**Why synthetic instead of a downloaded license-free photo:** the sandboxed dev
environment this task ran in has outbound network access disabled for tooling
(`curl`/`WebFetch` to external hosts is blocked by the sandbox policy), so
downloading a real photo was not possible. The task card allows either approach
and asks to favor a real photo only if generation "looks too synthetic" for the
vision model to tell the three cases apart.

**Review trigger:** if E2E runs against the real vision model show it cannot
reliably distinguish clean vs. damaged vs. unusable from these composites,
replace them with real license-free photos (e.g. Unsplash/Pexels product
photography — pick images with an unambiguous crack/scratch for the damaged
case) and update this table with the source URL and license for each.
