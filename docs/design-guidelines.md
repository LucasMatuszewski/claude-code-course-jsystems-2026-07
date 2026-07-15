# Design Guidelines — Play (play.pl)

Design system extracted from the live [play.pl](https://www.play.pl) homepage on 2026-07-14 (computed styles via Playwright). Use these tokens when building UIs that should feel consistent with the Play brand.

---

## 1. Assets

| Asset | Path (relative to `docs/`) | Notes |
|---|---|---|
| Homepage screenshot | `../assets/homepage.png` | Visual reference of the live site |
| Logo (SVG) | `../assets/logo.svg` | White "P L A Y" wordmark on a dark-violet (#2D0066) rectangle |
| Favicon | `../assets/favicon.ico` | 16/32/48 px multi-size ICO |
| Design tokens (JSON) | `../assets/design-tokens.json` | Machine-readable source of truth for all values below |

---

## 2. Colors

| Token | Value | Usage |
|---|---|---|
| `brand.primary` | `#6C43BF` | Primary CTA buttons, active nav item, carousel bullets — the dominant interactive purple |
| `brand.primaryDark` | `#2D0066` | Logo background, dark brand surfaces |
| `brand.accent` | `#E6144B` | Play's signature magenta — promo banners, highlight surfaces (white text on top) |
| `brand.link` | `#266DD9` | Inline text links |
| `background.default` | `#FFFFFF` | Page background |
| `background.light` | `#F5F5F5` | Section alternation, cards, subtle panels |
| `background.subtle` | `#FAFAFA` | Very light section backgrounds |
| `text.primary` | `#1F1F1F` | Body text, headings |
| `text.secondary` | `#404040` | Secondary text |
| `text.muted` | `#707070` | Muted/helper text |
| `text.onDark` / `text.onBrand` | `#FFFFFF` | Text on purple/magenta/dark surfaces |
| `border.default` | `#D6D6D6` | Hairline borders (e.g., circular icon buttons use 0.8px) |

---

## 3. Typography

**Font family:** `"Manrope", Arial, sans-serif`

Manrope is loaded via `@font-face` from Play's CDN in three weights. Note the unusual mapping: the file named *Regular* is served as weight **500** — Play's "normal" text is 500, not 400.

| Weight token | Value | @font-face source |
|---|---|---|
| `regular` | 500 | `Manrope-Regular.woff2` |
| `semibold` | 600 | `Manrope-SemiBold.woff2` |
| `bold` | 700 | `Manrope-Bold.woff2` |

For a project that can't load Play's CDN fonts, use [Manrope from Google Fonts](https://fonts.google.com/specimen/Manrope) with the same weights.

**Size scale** (fractional values are intentional — see Spacing):

| Token | Size | Observed usage |
|---|---|---|
| `xs` | 10.5px | Top nav links |
| `sm` | 12.25px | Utility nav (e.g., "Kontakt") |
| `base` | 14px | Body, buttons, inputs |
| `lg` | 21px | h3 subsection headings (line-height 1.3) |
| `xl` | 40px | h2 section headings (line-height 1.5) |

**Line heights:** `base` 1.5 (body 14/21, h2 40/60), `tight` 1.3 (h3 21/27.3).

---

## 4. Spacing

Play uses a **7px base unit** — this is why fractional pixel values (3.5, 10.5, 21) appear throughout the site instead of the common 4/8px grid.

| Token | Value |
|---|---|
| 1 | 3.5px |
| 2 | 7px |
| 3 | 10.5px |
| 4 | 14px |
| 5 | 21px |
| 6 | 28px |
| 7 | 35px |
| 8 | 42px |

Example: primary buttons use `0 21px` horizontal padding (3 units).

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `xs` | 3.5px | Small chips/tags |
| `sm` | 5px | Carousel bullets |
| `md` | 7px | **Buttons** (the standard interactive radius) |
| `lg` | 10.5px | Small cards |
| `xl` | 12px | Panels |
| `2xl` | 14px | Large cards / banner tiles |
| `circle` | 50% | Circular icon buttons (slider arrows) |

---

## 6. Components

### Buttons
- **Primary:** `#6C43BF` background, white text, radius 7px, padding `0 21px`, 14px / weight 500, no border. Label style: short imperatives ("Sprawdź").
- **Secondary (on colored/imagery backgrounds):** white background, `#6C43BF` text, same geometry.
- **Circular icon button:** white background, `50%` radius, `0.8px solid #D6D6D6` border (carousel/slider navigation).

### Header & navigation
- Transparent header over white page background; text `#1F1F1F`.
- Main nav links: 10.5px, weight 500; the **active** section link switches to weight 700 and `#6C43BF`.
- Utility links (Kontakt): 12.25px, weight 700.

### Content sections
- White base with `#F5F5F5` alternating panels; large 40px h2 headings, generous whitespace.
- Promo/accent tiles use the magenta `#E6144B` with white text.
- Cards and banner tiles round at 10.5–14px.

### Inputs
- 14px Manrope, weight 500, transparent background with bordered container (border `#D6D6D6`).

---

## 7. Logo Usage

- `assets/logo.svg` is the official wordmark: white "P L A Y" letterforms on a `#2D0066` dark-violet rectangle (the SVG carries its own background, so it works on any surface).
- Rendered in the site header at ~88×28 px; keep the 125:40 aspect ratio.
- On dark surfaces the same file works as-is. If a transparent-background variant is ever needed, remove the first `<path>` (the background rectangle) and recolor the letter paths to `#2D0066` for light surfaces.
- Do not recolor the wordmark to the interactive purple `#6C43BF` — the logo violet (`#2D0066`) and the CTA purple are distinct brand colors.

## 8. Visual Style Summary

Play's visual language is bright, modern, and consumer-friendly: a white canvas with soft gray section panels, energized by a dominant interactive purple (`#6C43BF`) and the brand's signature magenta (`#E6144B`) for promotions. Typography is a single variable-feeling family (Manrope) where even "regular" text sits at weight 500, giving the whole UI a slightly bold, confident tone. Corners are consistently rounded on a 7px-based scale (7px buttons, up to 14px cards), and layouts breathe with generous spacing on the same 7px rhythm. Imagery-heavy promo tiles carry white or purple CTAs with short imperative labels ("Sprawdź"), keeping the interface action-oriented but uncluttered.
