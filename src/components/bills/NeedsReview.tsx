import { useMemo, useState, type ReactNode } from "react"
import { Zap, Cloud, Eye, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtINR } from "@/lib/format"
import { Currency } from "@/components/cockpit/Currency"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { BatchConfirmDialog } from "./BatchConfirmDialog"
import {
  isBatchable,
  needsThought,
  ISSUE_WORD,
  largestIdenticalFix,
  type ReviewItem,
} from "@/data/review"

type SortKey = "priority" | "vendor" | "amount"
// Slate Console review columns:
// checkbox · File · Vendor · Issue to decide · Status · Amount · action
const RCOLS = "grid grid-cols-[28px_40px_minmax(0,1.35fr)_minmax(0,1.5fr)_88px_128px_148px] items-center gap-4"

// ── shared Slate Console shell (used by both review + books tables) ──
// one white --surface container, 1px --rule border, 9px radius, faint shadow,
// clipped rows — the whole table reads as one contained object.
export const LIST_SHELL = "overflow-hidden rounded-[9px] border border-line bg-surface shadow-l1"
// a slim in-container toolbar strip (helper text left / filter action right)
export const TABLE_TOOLBAR = "flex min-h-11 items-center gap-3 border-b border-line bg-surface px-4 py-2"
// column-header band — small tracked-out mono caps on the tinted head strip
export const COL_HEAD = "font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint"
export const TABLE_HEAD_ROW = "border-b border-line bg-head-bg px-4 h-9"
// body rows: LOCKED 56px height (uniform rhythm), soft --rule-2 inner dividers,
// flat --accent-hover wash on hover via .cmd-row
export const TABLE_ROW =
  "cmd-row group h-14 border-b border-rule-2 last:border-b-0 px-4 cursor-pointer"

export function NeedsReview({
  items,
  onReview,
  onResolve,
}: {
  items: ReviewItem[]
  onReview: () => void
  onResolve: (ids: string[], message: string) => void
}) {
  const toast = useToast()
  const [fixAllOpen, setFixAllOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "priority", dir: 1 })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const byAmount = (a: ReviewItem, b: ReviewItem) => b.amount - a.amount
  const ordered = useMemo(() => {
    // default: most important on top — bills needing thought, then one-tap fixes
    if (sort.key === "priority") {
      return [
        ...items.filter(needsThought).sort(byAmount),
        ...items.filter(isBatchable).sort(byAmount),
      ]
    }
    return [...items].sort((a, b) => {
      const d = sort.key === "vendor" ? a.vendor.localeCompare(b.vendor) : a.amount - b.amount
      return d * sort.dir
    })
  }, [items, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  const visibleIds = ordered.map((i) => i.billId)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length
  const toggleRow = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) visibleIds.forEach((id) => n.delete(id))
      else visibleIds.forEach((id) => n.add(id))
      return n
    })

  if (items.length === 0) {
    return (
      <EmptyState
        illustration="caughtup"
        title="You're all caught up"
        description="No bills need your review right now. New uploads will land here."
      />
    )
  }

  const single = items.length === 1
  const total = ordered.reduce((s, i) => s + i.amount, 0)
  const fixAll = single ? null : largestIdenticalFix(items)
  const fixAllItems = fixAll ? items.filter((i) => fixAll.ids.includes(i.billId)) : []

  return (
    <div>
      {/* Level-1 list surface — column headers · uniform rows */}
      <div className={LIST_SHELL}>
        <div className={cn(RCOLS, TABLE_HEAD_ROW)}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all"
            style={{ accentColor: "var(--accent-sig)" }}
            className="size-[15px] cursor-pointer"
          />
          <span className={COL_HEAD}>File</span>
          <Th label="Vendor" col="vendor" sort={sort} onSort={toggleSort} />
          <span className={COL_HEAD}>Issue to decide</span>
          <span className={COL_HEAD}>Status</span>
          <Th label="Amount" col="amount" sort={sort} onSort={toggleSort} className="justify-self-end" />
          <span aria-hidden />
        </div>

        {ordered.map((item) => {
          const sel = selected.has(item.billId)
          const oneClick = isBatchable(item)
          return (
            <div
              key={item.billId}
              className={cn(RCOLS, TABLE_ROW, "text-[13px]", sel && "bg-accent-wash")}
            >
              <input
                type="checkbox"
                checked={sel}
                onChange={() => toggleRow(item.billId)}
                aria-label={`Select ${item.vendor}`}
                style={{ accentColor: "var(--accent-sig)" }}
                className="size-[15px] cursor-pointer"
              />
              <FileGlyph
                present
                label={item.vendor}
                onOpen={() =>
                  toast({ message: <>Opening bill for <b className="font-medium">{item.vendor}</b></> })
                }
              />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium leading-tight text-ink">{item.vendor}</div>
                <div className="code mt-0.5 truncate text-[11.5px] leading-tight text-faint">{item.invoiceNo}</div>
              </div>
              <div className="min-w-0 text-[13px]">
                <IssueSummary item={item} />
              </div>
              <div className="min-w-0">
                {oneClick ? (
                  <Tag tone="accent">auto</Tag>
                ) : (
                  <Tag tone="red">{item.issues.length} open</Tag>
                )}
              </div>
              <Currency value={item.amount} className="justify-self-end text-[13px] font-medium text-ink" />
              <div className="min-w-0 justify-self-end">
                {oneClick ? (
                  <Button
                    variant="lilac"
                    size="lg"
                    className="w-full gap-1.5 px-4"
                    onClick={() => onResolve([item.billId], `${item.vendor} fixed & saved`)}
                  >
                    <Zap className="size-3.5 flex-none" strokeWidth={2} />
                    Fix &amp; save
                  </Button>
                ) : (
                  <Button variant="outline" size="lg" className="w-full gap-1.5 px-4" onClick={onReview}>
                    <Eye className="size-3.5 flex-none" strokeWidth={1.9} />
                    Review
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 px-1 text-[12px] text-faint">
        {selectedCount > 0 && (
          <>
            <span className="font-medium text-body">{selectedCount} selected</span>
            <span className="mx-1.5">·</span>
          </>
        )}
        {ordered.length} to review · {fmtINR(total)} in value
      </p>

      {fixAll && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-[9px] border border-lilac-line bg-lilac-bg px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-[13px] text-body">
            <Zap className="size-4 flex-none text-accent-sig-ink" strokeWidth={2} />
            <span>
              <b className="font-medium text-ink">{fixAll.ids.length} bills</b> have the same simple fix. Fix
              them together in one step.
            </span>
          </div>
          <Button
            variant="lilac"
            size="lg"
            className="flex-none gap-1.5 px-4"
            onClick={() => setFixAllOpen(true)}
          >
            <Zap className="size-3.5" strokeWidth={2} />
            Fix all {fixAll.ids.length}
          </Button>
        </div>
      )}

      <BatchConfirmDialog
        open={fixAllOpen}
        onOpenChange={setFixAllOpen}
        items={fixAllItems}
        onConfirm={() => {
          setFixAllOpen(false)
          onResolve(fixAll!.ids, `${fixAll!.ids.length} bills fixed & saved`)
        }}
      />
    </div>
  )
}

/** File affordance — a calm 26px rounded tile holding a faint cloud glyph,
 *  clickable to preview. When a file is attached the cloud reads a touch
 *  stronger; when none, it stays faint. Filename/absence surfaces on hover. */
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
          onClick={onOpen}
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

/** A small mono status tag pill — the Status column's language across both
 *  pages. red = open judgment, accent = auto-fixable, green = posted/synced. */
export function Tag({ tone, children }: { tone: "red" | "accent" | "green"; children: ReactNode }) {
  const cls =
    tone === "red"
      ? "bg-danger-bg text-danger"
      : tone === "accent"
        ? "bg-accent-wash text-accent-sig-ink"
        : "bg-success-bg text-success"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-medium tabular-nums",
        cls,
      )}
    >
      {children}
    </span>
  )
}

function Th({
  label,
  col,
  sort,
  onSort,
  className,
}: {
  label: string
  col: "vendor" | "amount"
  sort: { key: SortKey; dir: 1 | -1 }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === col
  return (
    <button
      onClick={() => onSort(col)}
      className={cn(COL_HEAD, "group inline-flex items-center gap-1 transition-colors hover:text-ink", className)}
    >
      {label}
      {active ? (
        sort.dir === 1 ? (
          <ChevronUp className="size-3 text-body" strokeWidth={2.4} />
        ) : (
          <ChevronDown className="size-3 text-body" strokeWidth={2.4} />
        )
      ) : (
        <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-50" strokeWidth={2} />
      )}
    </button>
  )
}

function IssueSummary({ item }: { item: ReviewItem }) {
  // one-tap AI fix → Trust Blue accent text (the fix-action colour)
  if (isBatchable(item)) {
    return <span className="font-medium text-accent-sig-ink">{item.issues[0].proposedFix}</span>
  }
  // single ambiguous issue → red judgment — "Ledger unclear · 2 possible accounts"
  if (item.issues.length === 1) {
    const iss = item.issues[0]
    const word = ISSUE_WORD[iss.type]
    return (
      <span>
        <span className="font-medium text-danger">
          {word.charAt(0).toUpperCase() + word.slice(1)} unclear
        </span>
        <span className="text-faint"> · </span>
        <span className="text-body">{iss.detail ?? "needs a choice"}</span>
      </span>
    )
  }
  // multiple issues → red judgment — "3 things to decide · GST head, ledger, voucher"
  const list = item.issues.map((i) => ISSUE_WORD[i.type]).join(", ")
  return (
    <span>
      <span className="font-medium text-danger">{item.issues.length} things to decide</span>
      <span className="text-faint"> · </span>
      <span className="text-body">{list}</span>
    </span>
  )
}
