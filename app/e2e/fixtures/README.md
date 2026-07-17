# E2E fixture images

Three fixture photos used by vision-model E2E specs (ADR-000 §10 - "Vision/decision
prompt quality is validated by E2E with fixture images: a clean product photo, a
damaged product photo, an unusable/blurry photo").

| File | Purpose | Expected vision-model read |
|---|---|---|
| `clean-product.jpg` | Intact product (real MacBook Air on a desk) | Product is undamaged |
| `damaged-product.jpg` | Real smartphone with a shattered screen | Product is damaged |
| `unusable-blurry.jpg` | A real device photo destroyed by heavy camera blur | Image cannot be assessed (AC-10) |

## Provenance

These are **real photographs** of real hardware, not synthetic drawings. We use a
real vision LLM in E2E and Manual QA, so the fixtures must be genuine photos it can
actually assess. Each was sourced from a license-free photograph (via the Openverse
CC search), then processed through the project's own `sharp` dependency: EXIF
orientation applied, metadata stripped, resized to <=1280px, and recompressed to
JPEG (mozjpeg q82) so the files stay small and git-friendly.

| File | Source photo | Author | License | Landing page |
|---|---|---|---|---|
| `clean-product.jpg` | "Apple Laptop Computer with Headphones, Camera, and Open Notebook" | Image Catalog | CC0 1.0 (public domain) | https://www.flickr.com/photos/132795455@N08/17652700524 |
| `damaged-product.jpg` | "Broken iPhone" | Jay Tamboli | CC BY 2.0 | https://www.flickr.com/photos/47084925@N00/3788327603 |
| `unusable-blurry.jpg` | "Man Holding Laptop Computer Typing While Dog Watches" (heavily blurred here) | Image Catalog | CC0 1.0 (public domain) | https://www.flickr.com/photos/132795455@N08/17783465600 |

### Attribution

`damaged-product.jpg` is licensed **CC BY 2.0** and requires attribution: photo by
**Jay Tamboli**, "Broken iPhone", via Flickr, CC BY 2.0. The other two are **CC0**
(public domain) and need no attribution. Keep this table in sync if any fixture is
swapped.

## Why real photos (not synthetic composites)

An earlier version of these fixtures was synthetic (SVG headphones rasterized with
`sharp`) because the generating sandbox had outbound network disabled. A real vision
model cannot reliably reason about damage/usability from vector drawings, and Manual
QA per `AGENTS.md` requires genuine device photography compared against the real
brand look. These were replaced with real license-free photos on 2026-07-17.

### Regenerating / swapping

The blurred fixture is produced from its source photo with `sharp(...).blur(22)`.
If you need to re-source or swap any fixture, download a new license-free photo,
run it through the same `sharp` pipeline (rotate -> resize inside 1280 -> jpeg q82),
overwrite the file **keeping the same name** (E2E specs reference these paths), and
update the provenance + attribution tables above with the new source URL and license.
