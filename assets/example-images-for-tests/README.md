# Example device photos for tests

Real photographs of real hardware, provided as a ready-to-use set for building and
testing the course app (a hardware returns/complaints assistant). They are the kind
of image a real vision LLM can actually assess, across the three cases the app cares
about: an intact product, a visibly damaged product, and a usable-vs-unusable upload.

| File | Device | Condition |
|---|---|---|
| `laptop-1.png` | Microsoft Surface laptop | Damaged - cracked screen |
| `laptop-2.webp` | Lenovo ThinkPad | Intact, powered on |
| `phone-1.jpg` | Apple iPhone | Damaged - shattered screen |
| `phone-2.jpeg` | Apple iPhone (back) | Intact |
| `phone-3.jpeg` | Samsung Galaxy S24 Ultra | Intact, with box |

## Provenance & licensing

These are the course author's own photos, reused from a prior course build. No
third-party licensing applies - they ship with the base repository so every group
starts with a real, correct-domain photo set from day one.

## Suggested use

- **Clean / intact** case: `laptop-2.webp` or `phone-3.jpeg`
- **Damaged** case: `phone-1.jpg` (clear shattered screen) or `laptop-1.png`
- **Unusable / blurry** case: take any intact photo above and blur it heavily
  (e.g. `sharp(input).blur(22)`) to simulate a bad out-of-focus customer upload.

If your app derives smaller test fixtures from these, process them through your
image pipeline (resize + recompress) so the committed fixtures stay small, and keep
these originals as the source of truth.
