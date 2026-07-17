# E2E fixture images

Three fixture photos used by vision-model E2E specs (ADR-000 §10 - "Vision/decision
prompt quality is validated by E2E with fixture images: a clean product photo, a
damaged product photo, an unusable/blurry photo").

| File | Purpose | Expected vision-model read |
|---|---|---|
| `clean-product.jpg` | Intact laptop (Lenovo ThinkPad, powered on) | Product is undamaged |
| `damaged-product.jpg` | Smartphone (iPhone) with a shattered screen | Product is damaged |
| `unusable-blurry.jpg` | A real device photo destroyed by heavy camera blur | Image cannot be assessed (AC-10) |

## Provenance

These are **real photographs of real hardware** - the correct domain for this app
(electronics returns/complaints) and the kind of image a real vision LLM can actually
assess. They are derived from the project's own curated photo set in
[`assets/example-images-for-tests/`](../../../assets/example-images-for-tests), which
are Lucas's own photos reused from the prior NBP course build (no third-party
licensing). Each fixture is produced from a source photo through the project's own
`sharp` dependency (EXIF-rotated, resized to <=1280px, recompressed to JPEG q82) so
the committed files stay small and git-friendly.

| Fixture | Source photo | Transform |
|---|---|---|
| `clean-product.jpg` | `laptop-2.webp` (intact Lenovo ThinkPad) | rotate + resize + jpeg |
| `damaged-product.jpg` | `phone-1.jpg` (iPhone, shattered screen) | rotate + resize + jpeg |
| `unusable-blurry.jpg` | `phone-2.jpeg` (intact iPhone back) | rotate + resize + **blur(22)** + jpeg |

The curated set also includes `laptop-1.png` (Surface laptop, cracked screen - a
second damaged example) and `phone-3.jpeg` (Samsung S24 Ultra, intact) for future
specs that need additional cases.

The `unusable-blurry` fixture is a genuine device photograph made unusable by heavy
out-of-focus blur - i.e. a realistic bad customer upload, not a synthetic drawing.
This was verified with an independent vision model: clean reads as an intact laptop,
damaged reads as a shattered-screen phone, and blurry reads as unassessable.

## Regenerating / swapping

The fixtures are built deterministically from the curated set:

```bash
node app/e2e/fixtures/build-fixtures.mjs
```

To swap a case, drop a new real photo into `assets/example-images-for-tests/`,
point `build-fixtures.mjs` at it, re-run, and keep the fixture **file names**
unchanged (E2E specs reference these paths).
