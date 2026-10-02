# Typography migration — Precision Indigo type system

Swaps the product's type foundation to a token-driven scale on new SIL OFL
variable fonts. **No color tokens were touched** — the indigo brand ramp
(`--brand: #3146b0`, …) is byte-for-byte unchanged. Layout, spacing, and
component structure are unchanged; this is typography only.

## 1. Fonts

| Role            | Before                          | After                       | Package |
|-----------------|---------------------------------|-----------------------------|---------|
| Primary UI/body | Inter Variable                  | **IBM Plex Sans**           | `@fontsource-variable/ibm-plex-sans` (5.2.8) |
| Display/accent  | Hanken Grotesk (+ Geist)        | **Space Grotesk**           | `@fontsource-variable/space-grotesk` (5.2.10) |
| Numeric/mono    | IBM Plex Mono                   | IBM Plex Mono *(kept)*      | `@fontsource/ibm-plex-mono` |
| Editorial/serif | —                               | **skipped** (see below)     | — |

- Added `@fontsource-variable/ibm-plex-sans` + `@fontsource-variable/space-grotesk`.
- **Removed** now-unused packages: `@fontsource-variable/inter`, `hanken-grotesk`,
  `geist`, `geist-mono`. Imports updated in `src/main.tsx`; type shims in
  `src/fonts.d.ts` updated to match. Build confirms no Inter/Hanken/Geist
  `@font-face` remain in the bundle (CSS shrank ~109 KB → ~97 KB).
- **IBM Plex Serif skipped on purpose.** The spec says add serif *only if
  long-form/prose surfaces exist*. This product has none — the only
  `leading-relaxed` text is short microcopy (empty states, dialog bodies, the
  paper-invoice note), not editorial reading surfaces. (`@fontsource-variable/ibm-plex-serif`
  also has no variable build, reinforcing the skip.) If a prose surface is added
  later, define `--font-serif: "IBM Plex Serif", Georgia, serif;` and install the
  static `@fontsource/ibm-plex-serif`.

### Token values (`src/index.css`, `@theme inline`)
```css
--font-sans:    "IBM Plex Sans", -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
--font-display: "Space Grotesk", "IBM Plex Sans", system-ui, sans-serif;
--font-mono:    "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```
Every fallback stack is intact. Space Grotesk is reserved for the **display
register only** — hero numerals (`.fig`, `.type-kpi`) and `.type-display`.
All headings/body/labels are IBM Plex Sans.

## 2. Type scale

Defined as role tokens in `:root` (`--type-<role>-size / -line / -track / -weight`)
and exposed as utilities in `@layer base`: `.type-display`, `.type-h1`,
`.type-h2`, `.type-h3`, `.type-h4`, `.type-body-lg`, `.type-body`, `.type-label`,
`.type-caption`, `.type-overline`.

| Role      | size / line / tracking / weight | Notes |
|-----------|--------------------------------|-------|
| display   | 36 / 1.15 / -0.02em / **700**  | font-display; hero metrics only — the *only* sanctioned 700 |
| h1        | 28 / 1.2  / -0.02em / 600      | |
| h2        | 22 / 1.25 / -0.01em / 600      | |
| h3        | 18 / 1.3  / 0 / 600            | |
| h4        | 16 / 1.4  / 0 / 600            | |
| body-lg   | 16 / 1.6  / 0 / 400            | |
| body      | 14 / 1.5  / 0 / 400            | default UI text |
| label     | 13 / 1.4  / 0 / 500            | |
| caption   | 12 / 1.4  / 0 / 400            | color = `--body` (text-secondary) |
| overline  | 11 / 1.4  / +0.08em / 600      | uppercase |

Weights are **400 / 500 / 600 only**; 700 lives on `display` alone.

### Shared classes refactored to consume the scale (call-sites upgrade in place)
- `.eyebrow` / `.label` / `.type-micro-label` → **overline** role (tracking
  0.06em → **0.08em**, now with an explicit 1.4 line-height; tertiary ink kept).
- `.type-section-title` → **h2** role: **20px → 22px** and **700 → 600**.
- `.fig` (money numerals) → Space Grotesk + tabular **+ lining** figures; weight
  still owned by the call-site.
- `.code` (voucher/invoice IDs) → IBM Plex Mono + tabular **+ lining** figures.
- `.type-kpi` → display register (Space Grotesk, 700) held at the **28px** KPI
  card scale so cards don't resize (see judgment calls).
- `.masthead` → weight 560 → 600 (560 was off-scale); still Space Grotesk.
- `body` → weight **450 → 400** (450 was off-scale; role = body/400).
- Dropped Inter-specific `"ss01"` from `body` (it selects a different glyph set
  in IBM Plex Sans); replaced with `tnum + lnum`.

## 3. Tabular figures — `.tabular`

Added the canonical utility:
```css
.tabular, .tabular-nums { font-variant-numeric: tabular-nums lining-nums;
                          font-feature-settings: "tnum" 1, "lnum" 1; }
```
`.tabular-nums` is kept as an **exact alias**, so every one of the ~17 existing
`tabular-nums` call-sites automatically gains lining figures — no churn needed.

`.tabular` was applied explicitly at the numeric **choke-points** (single sources
of truth), which is where "every numeric value" actually flows:
- `Money.tsx` — the one money primitive (all Bills + cockpit currency). Removed a
  redundant inline `fontVariantNumeric` style in favor of `.tabular`.
- `Currency.tsx` — wraps `Money`, inherits it.
- `MetricValue.tsx` — KPI count fallback span.
- `TickNumber.tsx` — animated numeric ticker.
- `BillsScreen.tsx` `DATE_TEXT` — both date columns (Billing date, Voucher date).
- `BillsMasterDetail.tsx` — list-row date.
- Voucher / invoice IDs: covered by `.code` (now tnum + lnum).

## 4. Scope decisions / judgment calls

1. **KPI hero size held at 28px.** The scale's `display` role is 36px, but KPI
   cards render at 28px today. Bumping to 36 would resize cards (layout change,
   which was out of scope). Resolution: `.type-kpi` uses the *display treatment*
   (Space Grotesk, 700, tabular+lining) at the **28px** h1 scale. The full 36px
   `.type-display` token exists for a true page-hero metric if one is introduced.
2. **`.type-section-title` 20 → 22px / 700 → 600.** Adopting the h2 role shifts
   these headings up 2px and off 700 (the no-700 rule). Used in 2 files; low risk.
3. **Ad-hoc inline sizes left as-is (intentional).** Typography is dominated by
   ~300 inline `text-[Npx]` utilities (78× 13px, 37× 12px, …). Converting them all
   to `.type-*` classes would be a large, layout-affecting change explicitly ruled
   out ("minimal diffs / don't alter layout"). They already render in IBM Plex Sans
   via the body font. The `.type-*` utilities are in place to adopt incrementally.

## 5. Couldn't auto-map / follow-ups (optional)

- **Inline invoice-ref spans** (e.g. `{b.number}` on the Bills vendor line) render
  as plain secondary text, not `.code`/`.tabular`. Left as-is (treated as prose
  meta, not a figure column). Promote to `.code` if you want ID alignment there.
- **Timestamps** like `relTime()` ("3 min ago") and `CommitZone`'s inline
  `invoiceDate` are non-columnar meta and were not force-tabbed. Easy to add
  `.tabular` if desired.
- **The paper-invoice facsimile** (`InvoiceDocument.tsx`, `GenericBillDetail.tsx`)
  keeps its own self-contained type — it's a photographed physical document, not
  app chrome, so it should not follow the UI type system.
- Inline `text-[Npx]` → `.type-*` adoption can be done screen-by-screen later.

## 6. Verification

- `npm run build` — TypeScript passes, Vite builds clean. Only warning is the
  pre-existing JS chunk-size note (unrelated to fonts). **No unused-font warnings.**
- Bundle contains only IBM Plex Sans / Space Grotesk / IBM Plex Mono `@font-face`.
- `npm run dev` boots and renders.
