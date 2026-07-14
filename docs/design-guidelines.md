# Design Guidelines — Play (play.pl)

Design system extracted from [https://www.play.pl](https://www.play.pl) on 2026-07-14 via Playwright computed-style extraction (desktop viewport, cookie consent dismissed). Use these tokens for all UI built in this project so it stays visually consistent with the Play brand.

---

## 1. Assets

| Asset | Path (relative to `docs/`) | Notes |
|---|---|---|
| Design tokens (JSON) | [`../assets/design-tokens.json`](../assets/design-tokens.json) | Machine-readable source of truth |
| Logo (SVG) | [`../assets/logo.svg`](../assets/logo.svg) | Official Play wordmark, from media-play.pl CDN |
| Favicon | [`../assets/favicon.ico`](../assets/favicon.ico) | 48×48 .ico |
| Homepage screenshot | [`../assets/homepage.png`](../assets/homepage.png) | Visual reference of the live site |

---

## 2. Colors

| Token | Hex | Usage |
|---|---|---|
| `brand.primary` | `#6C43BF` | Purple — primary CTAs ("Sprawdź"), active nav item, key interactive accents |
| `brand.dark` | `#2D0066` | Deep purple — logo background block, dark hero surfaces |
| `brand.accent` | `#E6144B` | Play magenta — promo tags ("Nasz HIT"), highlights, attention elements |
| `brand.link` | `#266DD9` | Blue — inline text links |
| `background.default` | `#FFFFFF` | Page and card background |
| `background.light` | `#F5F5F5` | Section alternation, input backgrounds |
| `background.subtle` | `#FAFAFA` | Very light panels |
| `background.overlay` | `rgba(255,255,255,0.9)` | Sticky/overlay surfaces |
| `text.primary` | `#1F1F1F` | Default text (near-black, not pure black) |
| `text.secondary` | `#707070` | Secondary/help text |
| `text.onDark` / `text.onBrand` | `#FFFFFF` | Text on purple/magenta/dark surfaces |
| `border.default` | `#EBEBEB` | Card and tertiary-button borders |
| `border.strong` | `#BBBBBB` | Form-control borders |

**Note on status colors:** the homepage exposes no dedicated success/error palette. Proposal for this project (marked as ours, not Play's): errors reuse `#E6144B`, success uses `#6C43BF` or a standard green if clearer — decide during UI implementation and keep consistent.

For this project's decision badges (APPROVE / REJECT / MORE_INFO / ESCALATE, ADR-002) map: APPROVE → success variant, REJECT → `#E6144B`, MORE_INFO → amber (not in Play palette; pick one accessible shade), ESCALATE → `#6C43BF`.

---

## 3. Typography

**Font family:** `Manrope, Arial, sans-serif` — Manrope is loaded via `@font-face` from Play's CDN in three weights:

| Weight | File | Role |
|---|---|---|
| 500 | `Manrope-Regular.woff2` | Body text (note: Play's "regular" is 500, not 400) |
| 600 | `Manrope-SemiBold.woff2` | Emphasis, subheadings |
| 700 | `Manrope-Bold.woff2` | Strong emphasis, tags, active nav |

For this project, load Manrope from Google Fonts (same typeface, license-safe) in weights 500/600/700 rather than hotlinking Play's CDN.

**Scale (as computed on the live site — small by modern defaults):**

| Token | Size | Line height | Observed on |
|---|---|---|---|
| `xs` | 9px | — | Top nav labels |
| `sm` | 10.8px | — | Small controls |
| `base` | 12px | 18px | Body, buttons, links |
| `md` | 18px | 23.4px | H3 |
| `xl` | 40px | 60px | H2 hero headings |

**Recommendation for our app:** keep the ratios and the Manrope family, but scale the base up to 14–16px for chat readability (Play's 12px base is dense retail-portal styling); headings keep weight **500** — Play headings are medium-weight, not bold.

---

## 4. Spacing

No CSS variables exposed; observed paddings cluster on a **3px base grid**: 3, 6, 12, 18, 24, 36. Buttons use `0 18px` horizontal padding; tags `0 3px`; tertiary controls `12px` vertical. Use the `spacing` scale in the tokens file.

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 3px | Promo tags, small chips |
| `md` | 6px | Buttons, inputs, standard cards |
| `lg` | 12px | Large cards, panels |

Play's look is **subtly rounded** — no pill buttons, no sharp corners.

---

## 6. Components

### Buttons
- **Primary:** purple `#6C43BF` bg, white text, radius 6px, padding `0 18px`, 12px / weight 500. No border, no shadow.
- **Secondary:** white bg, purple `#6C43BF` text, same geometry (used on colored/hero backgrounds).
- **Tertiary/quiet:** white bg, `#1F1F1F` text, `1px solid #EBEBEB` border, radius 6px.

### Promo tag / badge
Magenta `#E6144B` bg, white text, 9px / weight 700, radius 3px, padding `0 3px`. This is the visual pattern to reuse for the chat **decision badge** (with per-category colors per §2).

### Header & nav
White/transparent header on white page; logo left. Nav labels are small (9px), weight 500, `#1F1F1F`; the active section is purple `#6C43BF` at weight 700. No uppercase transform.

### Surfaces
Cards on white with `#EBEBEB` 1px borders or on `#F5F5F5` section bands; generous whitespace; content in a centered max-width column.

---

## 7. Logo Usage

- `assets/logo.svg` is the official Play lockup: a **white "PLAY" wordmark on a deep-purple `#2D0066` rectangle** (125×40 viewBox, self-contained). It works on any background because it carries its own background block.
- Default placement: top-left of the header, linking to the app root, height ~28–36px.
- For a transparent-background variant (e.g. on an already-dark surface), remove the background `path` (the first `#2D0066` rect-path) and keep the white wordmark paths; on light surfaces you may instead recolor the wordmark paths to `#2D0066`.
- Keep clear space around the logo of at least half its height; never stretch, recolor to non-brand colors, or place on the magenta accent.

---

## 8. Visual Style Summary

Play's design language is clean, light, and commercial: white surfaces, tight 3px-grid spacing, and near-black `#1F1F1F` Manrope type at medium (500) weight — headings included, which keeps the tone friendly rather than heavy. Color is used sparingly and purposefully: purple `#6C43BF` owns every primary action, magenta `#E6144B` is reserved for promotional punch, and blue marks inline links. Corners are softly rounded (3–12px), borders are hairline `#EBEBEB`, and there are no shadows or gradients doing structural work — hierarchy comes from type scale, whitespace, and color discipline. UIs built for this project should feel like a calm, trustworthy self-service tool within that same family: white background, purple actions, magenta only for the rare attention-grabbing element.
