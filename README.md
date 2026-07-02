# FinOps · Bill Verification Cockpit

An AI-assisted bill-entry flow, rebuilt on **React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui**, themed to the FinOps teal design system.

A user hands the AI a supplier bill; it reads the document, extracts every fact it
is confident about, and asks the user to resolve only the few items it is unsure
of (voucher number, GST treatment, an ambiguous ledger) before posting to Tally.

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict, `verbatimModuleSyntax`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) with the FinOps palette mapped onto
  shadcn semantic tokens in `src/index.css`
- **shadcn/ui** primitives (Radix-based) under `src/components/ui`
- **cmdk** for the ledger search, **lucide-react** for icons

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
```

## Architecture

| Area | Path |
| --- | --- |
| Design tokens (FinOps → shadcn) | `src/index.css` |
| State machine (reducer + context) | `src/state/store.tsx` |
| Demo data | `src/data/invoice.ts` |
| Screens | `src/components/screens/*` (Entry → Read → Cockpit) |
| Cockpit pieces | `src/components/cockpit/*` (verdict, checklist, facts, money) |
| Resolution dialogs | `src/components/dialogs/*` |
| UI primitives | `src/components/ui/*` |

All flow state lives in a single typed reducer (`src/state/store.tsx`). Screens and
dialogs are pure views over that state; advancing through the review queue,
edge-case errors, and the commit decision are all modelled as actions.

## Flow covered

- **Entry** — drag/drop or browse; or "Enter manually"
- **The Read** — animated document scan with facts streaming in
- **Cockpit** — verdict bar, checklist, grouped facts with document provenance
  highlighting on hover, live money block
- **Resolution dialogs** — voucher number, IGST vs CGST/SGST, ledger picker with
  search/create
- **Inspect** — drill into any confident fact
- **Edge cases** (via the Demo controls) — duplicate voucher, doesn't-balance,
  read failure
- **Commit → Success** — records the bill and queues the voucher for Tally sync

Respects `prefers-reduced-motion` throughout.
