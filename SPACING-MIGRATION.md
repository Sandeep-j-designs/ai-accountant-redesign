# Spacing + radius migration

Adds a semantic spacing layer and expands the radius token into a full scale wired
to Tailwind's `rounded-*` utilities. **Color, font, and type tokens are untouched.**
The 4px base grid (`--spacing: 0.25rem`) is preserved; semantic tokens sit on top.

## 1. Tokens

### Spacing (`src/index.css` `:root`, additive)
```css
--gap-inline: 8px;       --gap-stack: 12px;
--pad-control: 8px 12px; --pad-cell: 10px 16px;
--pad-card: 16px;        --pad-card-lg: 20px;   --pad-section: 24px;
--gap-card: 16px;        --gap-section: 32px;   --inset-page: 24px;
```
Responsive page gutter:
```css
@media (min-width: 1280px) { :root { --inset-page: 40px; } }
```

### Radius scale (`@theme inline`, wired to `rounded-*`)
| token | value | utility | was |
|---|---|---|---|
| `--radius-xs`   | 4px    | `rounded-xs`   | (new) |
| `--radius-sm`   | 6px    | `rounded-sm`   | 4px |
| `--radius-md`   | 8px (`var(--radius)`) | `rounded-md` | 8px — **unchanged** |
| `--radius-lg`   | 12px   | `rounded-lg`   | 8px |
| `--radius-xl`   | 16px   | `rounded-xl`   | 12px |
| `--radius-full` | 9999px | `rounded-full` | 9999px |

Verified against the compiled bundle — `rounded-md` still emits `border-radius:var(--radius)`
(pixel-identical); the others resolve to the new scale.

## 2. Radius remap (element → rung)

Done at the **shared primitives** so the whole app inherits, plus per-screen cards:

| Element | file(s) | change |
|---|---|---|
| Buttons | `ui/button.tsx` | `rounded-md` → `rounded-sm` (8→6) |
| Inputs | `ui/input.tsx` | `rounded-md` → `rounded-sm` (8→6) |
| Badges/chips | `ui/badge.tsx` | `rounded-sm` → `rounded-xs` (restored 4px) |
| Ad-hoc inline chips/tags | TopBar (kbd), Diff, decisions, BillDetail, EntryScreen, ReadScreen, BillsScreen, GenericBillDetail, dialogs/parts | `rounded-sm` → `rounded-xs` (match the badge at 4px) |
| Card | `ui/card.tsx` | `rounded-xl` → `rounded-lg` (12) |
| Screen cards/panels | BillDetailScreen (×3), BulkQueue, EntryScreen (×3), GenericBillDetail, CommitZone, kit, SummaryStrip | `rounded-xl` → `rounded-lg` (12) |
| Modals | `ui/dialog.tsx`, `CommandPalette.tsx` | dialog `rounded-lg` → `rounded-xl` (16); command palette kept `rounded-xl` |
| Dialog close (icon button) | `ui/dialog.tsx` | `rounded-md` → `rounded-sm` |
| Menus / dropdowns / tooltips / toasts | (unchanged) | stay `rounded-md` (8) — treated as "small cards" |
| Avatars / pills | (unchanged) | stay `rounded-full` |

**Single-side border accents:** audited — none carry a `rounded-*` class, so the
"no rounding on single-sided borders" rule already holds. Nothing to change.

Elements left on `rounded-sm` (6px) intentionally: buttons, inputs, dialog close,
command-palette items, flag/settled small buttons, focusable text links, skeleton bars.

## 3. Spacing token adoption (where a token matched cleanly — identical render)

| Surface | file | change |
|---|---|---|
| Table cells (both tables) | `bills/NeedsReview.tsx` `TABLE_ROW` | `px-6 py-4` → `p-[var(--pad-cell)]` (10/16); `last:pb-6` kept |
| Table header row | `bills/NeedsReview.tsx` `TABLE_HEAD_ROW` | `px-6` → `px-4` to keep columns aligned with the 16px rows (24px vertical gap-before-first-row preserved) |
| Table footers (align to rows) | `BillsScreen.tsx` (pagination), `BillDetailScreen.tsx` (totals) | `px-6` → `px-4` |
| Card padding | `ui/card.tsx` (Header/Content/Footer) | `p-5` → `p-[var(--pad-card-lg)]` (20 = exact) |
| Input padding | `ui/input.tsx` | `px-3 py-2` → `p-[var(--pad-control)]` (8/12 = exact) |
| KPI card grid | `bills/SummaryStrip.tsx` | `gap-4` → `gap-[var(--gap-card)]` (16 = exact) |
| Page gutter | `BillsScreen.tsx` | `p-[22px]` → `p-[var(--inset-page)]` (→24, and 40 ≥1280px) |

Tables now run tighter (16px horizontal cell padding, matching the existing toolbar
gutter; vertical 16→10). Cards/inputs render identically (exact-match tokens). Bordered
rows (box-shadow inset divider, no per-row card wrapper) were already in place.

## 4. Judgment calls / couldn't auto-map

1. **Control height ≥36px vs "don't change layout structure" (conflict).** Existing
   buttons are `h-8`/32px (default), `h-7`/28px (sm), `h-9`/36px (lg); inputs are
   `h-9`/36px. Bumping every button to 36px would ripple through fixed-height bars
   (h-14 topbar, h-11 toolbars) and vertical centering — a structural change the brief
   also forbids. **Resolution:** heights left as-is to preserve the dense desktop
   cockpit; only radius/padding changed. Inputs already meet 36px. → *If you want the
   36px floor enforced on buttons, say so and I'll bump the height ramp + retest the bars.*
2. **Asymmetric panel padding left as one-offs** (none of the single-value `--pad-card`/
   `-lg` tokens match cleanly): `CommitZone` (`px-6 py-5` = 24/20), `ActivityDrawer`
   (`px-5 py-3.5`/`py-4`), the EntryScreen dropzone (`px-10 py-14`), SummaryStrip KPI
   card (`px-[18px] py-4`). These use deliberate horizontal>vertical rhythms; forcing a
   symmetric token would change their look, so per "leave one-offs alone" they're kept.
3. **Page inset adopted on the main Bills page only.** Gutters are per-screen (e.g.
   `BillDetailScreen` uses `mx-auto max-w-[980px] px-8`). `--inset-page` is wired +
   responsive and adopted on the primary payables page; other screens keep their bespoke
   gutters. Easy to extend screen-by-screen if you want one uniform page gutter.
4. **Small arbitrary radii** (`rounded-[3px]`/`[4px]`/`[5px]`/`[6px]`, 5 spots) left
   as-is — intentional micro-tuning, not scale rungs.

## 5. Verification
- `npm run build` — TypeScript passes, Vite builds clean (only the pre-existing
  JS chunk-size note). All six `rounded-*` utilities emit the intended values;
  `rounded-md` is byte-identical (`var(--radius)`). All five spacing tokens present.
- `npm run dev` renders.
- Color/font/type tokens: unchanged (diff is limited to spacing/radius tokens + the
  component classes listed above).
