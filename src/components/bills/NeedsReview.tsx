import { useState, type ReactNode } from "react"
import { Cloud, MoreHorizontal, Eye, FileText, Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStuck } from "@/hooks/useStuck"
import { Money } from "@/components/bills/Money"
import { SuggestedTag } from "@/components/cockpit/Diff"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { isBatchable, needsThought, ISSUE_WORD, type ReviewItem } from "@/data/review"

// ── ONE calm, typographic table shell used by BOTH the "In the books" table
//    and the Needs-review table. Hierarchy comes from type (size/weight/
//    colour), not decoration: no tints, no rules beyond a barely-there row
//    divider, no hover effects beyond a background wash.
// same elevation treatment as the summary KPI cards, so both read as one
// family of pure-white surfaces lifted off the cool-gray canvas. No horizontal
// padding here on purpose — the padding lives on the header/row/footer
// themselves so a row's own background (hover, zebra, selected) can span
// the card's FULL width edge-to-edge, not just the inset content area.
// No overflow-hidden either — the row ⋯ menu opens past the card edge for
// bottom rows and must not be clipped.
export const LIST_SHELL =
  "rounded-lg border border-line bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
export const TABLE_TOOLBAR = "flex min-h-11 flex-wrap items-center gap-3 border-b border-line px-4 py-2.5"
/** sentence case, 12px/500, tertiary — no uppercase, no letter-spacing */
export const COL_HEAD = "text-[12px] font-medium text-body"
/* header row — transparent (matches the white card exactly); the separator
   from the first row is a 24px gap, not a line. Sticky; scroll shadow
   toggled by the consumer. rounded-t-lg matches the card's own top corners
   since the header now sits flush against them (no more card padding). */
export const TABLE_HEAD_ROW =
  "sticky top-0 z-10 min-h-12 rounded-t-lg border-b border-line bg-[var(--head-bg)] px-4 py-3 transition-shadow duration-150"
/* row divider is almost invisible — just enough to separate rows on focus.
   A box-shadow inset line rather than a border: a border painted alongside
   a transitioning background is what caused a WebKit/Safari seam/short-fill
   glitch on hover; box-shadow doesn't participate in that paint order.
   No divider after the last row (the footer's own rule takes over). Full-
   width px-6 so the row's own background bleeds to the card's true edges —
   the fix for hover/zebra/selected stopping short at the old card padding. */
export const TABLE_ROW =
  "cmd-row group shadow-[inset_0_-1px_0_var(--line)] last:shadow-none last:rounded-b-lg min-h-14 p-[var(--pad-cell)] cursor-pointer"

// ONE column grid for the header AND every row — mirrors the "In the books"
// anatomy: FILE · VENDOR · ISSUE TO DECIDE · STATUS · AMOUNT · ⋯menu
const COLS =
  "grid grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1.6fr)_104px_128px_32px] items-center gap-3"

/**
 * Needs-review — ONE flat table of uniform, clickable rows. Every row is the
 * affordance: click (or Enter/Space) opens the bill in the detail screen,
 * which carries its own Prev/Next to move through the rest of this list in
 * place. A chevron surfaces on hover. AiA's voice is the ⚡ glyph + indigo —
 * never a second hue.
 */
export function NeedsReview({
  items,
  onReview,
}: {
  items: ReviewItem[]
  onReview: (billId: string) => void
}) {
  const toast = useToast()
  const { ref: headerRef, stuck } = useStuck<HTMLDivElement>()

  if (items.length === 0) {
    return (
      <EmptyState
        illustration="caughtup"
        title="You're all caught up"
        description="No bills need your review right now. New uploads will land here."
      />
    )
  }

  const decideItems = items.filter(needsThought)
  const totalValue = items.reduce((s, i) => s + i.amount, 0)
  // every review bill is a row — auto-fixable ones carry their SUGGESTED fix
  // chip inline; the rest state their issue
  const rows = items

  const openBill = (vendor: string) =>
    toast({ message: <>Opening bill for <b className="font-medium">{vendor}</b></> })

  return (
    <div>
      {/* SAME shell as the "All bills" table (LIST_SHELL / TABLE_* tokens) */}
      {rows.length > 0 && (
      <div className={LIST_SHELL}>
        <div>
          <div className="min-w-[760px] [&>*:last-child]:border-b-0">
            <div ref={headerRef} className={cn(COLS, TABLE_HEAD_ROW, stuck && "shadow-1")}>
              <span className={COL_HEAD}>File</span>
              <span className={COL_HEAD}>Vendor</span>
              <span className={COL_HEAD}>Issue to decide</span>
              <span className={COL_HEAD}>Status</span>
              <span className={cn(COL_HEAD, "justify-self-end")}>Amount</span>
              <span aria-hidden />
            </div>

            {/* uniform, clickable rows — even rows carry a very light zebra tint */}
            {rows.map((item, i) => (
              <Row
                key={item.billId}
                item={item}
                tinted={i % 2 === 1}
                onOpenRow={() => onReview(item.billId)}
                onOpenDoc={() => openBill(item.vendor)}
              />
            ))}
          </div>
        </div>
      </div>
      )}

      <p className="px-1 pt-3 text-[12px] text-ink-3">
        {items.length} {items.length === 1 ? "bill" : "bills"} · {decideItems.length} to decide ·{" "}
        <Money value={totalValue} decimals={false} className="font-medium text-body" /> total value
      </p>
    </div>
  )
}

/* ── the one row — a clickable surface, no per-row button ─────────────────── */

function Row({
  item,
  tinted,
  onOpenRow,
  onOpenDoc,
}: {
  item: ReviewItem
  tinted: boolean
  onOpenRow: () => void
  onOpenDoc: () => void
}) {
  const auto = isBatchable(item)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Review ${item.vendor}`}
      onClick={onOpenRow}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenRow()
        }
      }}
      className={cn(
        COLS,
        TABLE_ROW,
        "outline-none",
        tinted && "bg-[#F6F7FB] dark:bg-white/[0.02]",
        "focus-visible:bg-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50",
      )}
    >
      <FileGlyph present onOpen={onOpenDoc} label={item.vendor} />
      <VendorRef vendor={item.vendor} refNo={item.invoiceNo} />
      <div className="min-w-0">
        {auto ? (
          /* the proposed fix is a CONTAINED chip — a real affordance, not a
             text link. Provenance is the neutral SUGGESTED tag, no colour/glyph */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenRow()
            }}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line-2 bg-surface px-2 py-1 text-[13px] font-normal text-body outline-none transition-colors hover:bg-panel hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2"
          >
            <SuggestedTag className="rounded border-[rgba(21,26,38,0.12)] font-medium" />
            <span className="truncate">{fixLabel(item)}</span>
          </button>
        ) : (
          <IssueText item={item} />
        )}
      </div>
      <div>
        {auto ? (
          <Tag tone="accent">Suggested</Tag>
        ) : (
          <Tag tone="amber">{item.issues.length} open</Tag>
        )}
      </div>
      <Money
        value={item.amount}
        decimals={false}
        symbolClassName="text-[14px]"
        className="justify-self-end text-[14px] font-semibold text-ink"
      />
      <span className="justify-self-end">
        <RowMenu vendor={item.vendor} onReview={onOpenRow} onOpenDoc={onOpenDoc} />
      </span>
    </div>
  )
}

/** The ⋯ row menu — mirrors the "In the books" table's overflow menu. Its whole
 *  subtree stops click propagation so the row's click-to-review never fires. */
function RowMenu({
  vendor,
  onReview,
  onOpenDoc,
}: {
  vendor: string
  onReview: () => void
  onOpenDoc: () => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative justify-self-end" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${vendor}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-7 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-vivid/40",
          open ? "bg-panel-2 text-ink" : "text-faint hover:bg-panel-2 hover:text-ink",
        )}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={close} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-[34px] z-40 w-48 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-lift"
          >
            <MenuItem icon={Eye} label="Review" onClick={() => { close(); onReview() }} />
            <MenuItem icon={FileText} label="Open source document" onClick={() => { close(); onOpenDoc() }} />
            <MenuItem
              icon={Flag}
              label="Flag for review"
              onClick={() => { close(); toast({ message: <>Flagged <b className="font-medium">{vendor}</b> for review</> }) }}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
    >
      <Icon className="size-3.5 flex-none text-faint" strokeWidth={1.9} />
      {label}
    </button>
  )
}

/* ── shared bits ────────────────────────────────────────────────────────── */

function VendorRef({ vendor, refNo }: { vendor: string; refNo: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[14px] font-semibold leading-tight text-ink">{vendor}</div>
      <div className="mt-0.5 truncate text-[13px] font-normal leading-tight text-faint">{refNo}</div>
    </div>
  )
}

/** The issue as plain metadata — one uniform run, no bold/primary emphasis.
 *  Vendor and Amount are the only 14/600 elements in the row. */
function IssueText({ item }: { item: ReviewItem }) {
  if (item.issues.length === 1) {
    const iss = item.issues[0]
    const word = ISSUE_WORD[iss.type]
    return (
      <span className="text-[13px] font-normal text-body">
        {word.charAt(0).toUpperCase() + word.slice(1)} unclear · {iss.detail ?? "needs a choice"}
      </span>
    )
  }
  const list = item.issues.map((i) => ISSUE_WORD[i.type]).join(", ")
  return (
    <span className="text-[13px] font-normal text-body">
      {item.issues.length} things to decide · {list}
    </span>
  )
}

/** "Change GST to IGST" → "Correct GST → IGST" — data-driven, no hard-coding. */
function fixLabel(item: ReviewItem): string {
  const f = item.issues[0].proposedFix ?? "Apply fix"
  return f.replace(/^Change /, "Correct ").replace(/ to /, " → ")
}

/** File affordance — a calm 26px rounded tile holding a faint cloud glyph. */
export function FileGlyph({
  present,
  onOpen,
  label,
  file,
}: {
  present: boolean
  onOpen: () => void
  label: string
  file?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            // rows are clickable; opening the source doc must not also open the row
            e.stopPropagation()
            onOpen()
          }}
          aria-label={file ? `Open ${file}` : present ? `Open source document for ${label}` : `No source document for ${label}`}
          className="grid size-[26px] flex-none place-items-center rounded-md bg-panel transition-colors hover:bg-panel-2"
        >
          <Cloud
            className={cn("size-3.5", present ? "text-muted-ink" : "text-faint")}
            strokeWidth={1.75}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{file ?? (present ? "Open source document" : "No source document attached")}</TooltipContent>
    </Tooltip>
  )
}

/** A dot-style status chip — the Status language across both pages. Colour
 *  lives ONLY in the 8px dot; the label stays text-secondary on a transparent
 *  background. amber = "your turn", accent = navy, green = posted/synced,
 *  red = failure/overdue. */
export function Tag({ tone, children }: { tone: "red" | "amber" | "accent" | "green"; children: ReactNode }) {
  const dot =
    tone === "red"
      ? "bg-danger-dot"
      : tone === "amber"
        ? "bg-warning-dot"
        : tone === "accent"
          ? "bg-accent-sig"
          : "bg-success-dot"
  // a light background pill matching the dot's own tone — better scanability
  // at a glance, without introducing a new colour beyond what's already used
  const bg =
    tone === "red"
      ? "bg-danger-bg"
      : tone === "amber"
        ? "bg-warning-bg"
        : tone === "accent"
          ? "bg-accent-wash"
          : "bg-success-bg"
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium tabular-nums text-body", bg)}>
      <span className={cn("size-2 flex-none rounded-full", dot)} />
      {children}
    </span>
  )
}
