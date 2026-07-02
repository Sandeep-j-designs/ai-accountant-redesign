import { useEffect, useMemo, useState } from "react"
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  SlidersHorizontal,
  Eye,
  Copy,
  Archive,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtINR, parseBillDate } from "@/lib/format"
import { useBill } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Amt } from "@/components/cockpit/kit"
import { STATUS_META } from "@/components/bills/status"
import { SummaryStrip } from "@/components/bills/SummaryStrip"
import { BulkBar } from "@/components/bills/BulkBar"
import { NeedsReview, COL_HEAD, TABLE_HEAD_ROW, TABLE_ROW, LIST_SHELL, TABLE_TOOLBAR, FileGlyph, Tag } from "@/components/bills/NeedsReview"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { BILLS, type BillRow, type BillStatus } from "@/data/invoice"
import { REVIEW_ITEMS } from "@/data/review"

type SortKey = "voucherNo" | "billFile" | "vendor" | "date" | "voucherDate" | "amount"
const SETTLED_STATUSES: BillStatus[] = ["approved", "scheduled", "posted", "paid", "overdue"]
// Slate Console books columns: checkbox · Voucher No · File · Vendor · Status ·
// Billing Date · Voucher Date · Amount · menu
const COLS = "grid grid-cols-[28px_112px_40px_minmax(0,1.4fr)_88px_100px_100px_124px_32px] items-center gap-4"

export function BillsScreen() {
  const { dispatch } = useBill()
  const toast = useToast()
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<BillStatus>>(new Set())
  const [amtMin, setAmtMin] = useState("")
  const [amtMax, setAmtMax] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const settled = useMemo(() => BILLS.filter((b) => b.status !== "review"), [])

  // ── tabs ──
  // dev preview of degradation states: ?review=1 (single) / ?review=0 (empty)
  const forced =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("review") : null
  const liveItems = REVIEW_ITEMS.filter((i) => !resolved.has(i.billId))
  const reviewItems = forced === "0" ? [] : forced === "1" ? liveItems.slice(0, 1) : liveItems
  const reviewCount = reviewItems.length
  const booksCount = settled.length
  const tabParam =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null
  const [tab, setTab] = useState<"review" | "books">(
    tabParam === "books"
      ? "books"
      : tabParam === "review"
        ? "review"
        : forced === "0" || REVIEW_ITEMS.length > 0
          ? "review"
          : "books",
  )

  const openReview = () => dispatch({ type: "ENTER_COCKPIT" })
  const resolveReview = (ids: string[], message: string) => {
    setResolved((prev) => new Set([...prev, ...ids]))
    toast({
      kind: "success",
      message,
      undo: () =>
        setResolved((prev) => {
          const n = new Set(prev)
          ids.forEach((id) => n.delete(id))
          return n
        }),
    })
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let r = settled.filter((b) => {
      if (
        q &&
        !b.vendor.toLowerCase().includes(q) &&
        !b.number.toLowerCase().includes(q) &&
        !(b.voucherNo?.toLowerCase().includes(q))
      )
        return false
      if (statusFilter.size && !statusFilter.has(b.status)) return false
      if (amtMin && b.amount < Number(amtMin)) return false
      if (amtMax && b.amount > Number(amtMax)) return false
      if (dateFrom && parseBillDate(b.date) < new Date(dateFrom)) return false
      if (dateTo && parseBillDate(b.date) > new Date(dateTo)) return false
      return true
    })
    r = [...r].sort((a, b) => {
      const d =
        sort.key === "vendor"
          ? a.vendor.localeCompare(b.vendor)
          : sort.key === "voucherNo"
            ? (a.voucherNo ?? "").localeCompare(b.voucherNo ?? "")
            : sort.key === "billFile"
              ? (a.billFile ?? "").localeCompare(b.billFile ?? "")
              : sort.key === "amount"
                ? a.amount - b.amount
                : sort.key === "voucherDate"
                  ? parseBillDate(a.voucherDate ?? a.date).getTime() -
                    parseBillDate(b.voucherDate ?? b.date).getTime()
                  : parseBillDate(a.date).getTime() - parseBillDate(b.date).getTime()
      return d * sort.dir
    })
    return r
  }, [settled, query, statusFilter, amtMin, amtMax, dateFrom, dateTo, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  const filtersActive =
    statusFilter.size > 0 || !!amtMin || !!amtMax || !!dateFrom || !!dateTo

  // selection is scoped to the currently-visible rows
  const visibleIds = rows.map((b) => b.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
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
  const selectedTotal = settled
    .filter((b) => selected.has(b.id))
    .reduce((s, b) => s + b.amount, 0)

  return (
    // Level 0 — the slate canvas; white surfaces float on it
    <div className="min-h-full bg-sidebar p-[22px]">
      {/* stat row — three bordered cards on the canvas */}
      <div className="enter-up mb-5">
        <SummaryStrip />
      </div>

      {/* segmented control */}
      <div className="mb-3 inline-flex items-center gap-1 rounded-lg bg-panel-2 p-[3px]">
        <TabButton active={tab === "review"} onClick={() => setTab("review")} label="Needs review" count={reviewCount} />
        <TabButton active={tab === "books"} onClick={() => setTab("books")} label="In the books" count={booksCount} />
      </div>

      {tab === "review" ? (
        <div className="enter-up">
          <NeedsReview items={reviewItems} onReview={openReview} onResolve={resolveReview} />
        </div>
      ) : booksCount === 0 ? (
        <EmptyState illustration="bills" title="No bills recorded yet" description="Committed bills land here as your permanent register." />
      ) : (
        <section className="enter-up">
          <div className={LIST_SHELL}>
          {/* table-scoped toolbar — a clearly bounded filter input (distinct from
              the global top-bar search) + the Filters toggle, inside the surface */}
          <div className={cn(TABLE_TOOLBAR, "justify-end")}>
            <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-sunken px-2.5 text-faint focus-within:border-line-strong">
              <Search className="size-3.5 flex-none" strokeWidth={1.8} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vendor or bill no.…"
                className="w-[184px] bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                showFilters || filtersActive
                  ? "border-line-strong text-ink"
                  : "border-line-2 text-body hover:border-line-strong",
              )}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={2} />
              Filters
              {filtersActive && <span className="size-[6px] rounded-full bg-accent-sig" />}
            </button>
          </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line bg-sunken/50 px-4 py-3.5">
            <div>
              <div className="eyebrow mb-1.5">Status</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={statusFilter.size === 0} onClick={() => setStatusFilter(new Set())}>
                  All
                </Chip>
                {SETTLED_STATUSES.map((s) => (
                  <Chip
                    key={s}
                    active={statusFilter.has(s)}
                    onClick={() =>
                      setStatusFilter((prev) => {
                        const n = new Set(prev)
                        if (n.has(s)) n.delete(s)
                        else n.add(s)
                        return n
                      })
                    }
                  >
                    <span className={cn("size-[6px] rounded-full", STATUS_META[s].dot)} />
                    {STATUS_META[s].label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Amount range</div>
              <div className="flex items-center gap-1.5">
                <NumInput value={amtMin} onChange={setAmtMin} placeholder="Min" />
                <span className="text-faint">–</span>
                <NumInput value={amtMax} onChange={setAmtMax} placeholder="Max" />
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Bill date</div>
              <div className="flex items-center gap-1.5">
                <DateInput value={dateFrom} onChange={setDateFrom} />
                <span className="text-faint">–</span>
                <DateInput value={dateTo} onChange={setDateTo} />
              </div>
            </div>
            {filtersActive && (
              <button
                onClick={() => {
                  setStatusFilter(new Set())
                  setAmtMin("")
                  setAmtMax("")
                  setDateFrom("")
                  setDateTo("")
                }}
                className="text-[12px] font-medium text-muted-ink transition-colors hover:text-ink"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

          {/* column headers — small tracked caps, hairline under */}
          <div className={cn(COLS, TABLE_HEAD_ROW)}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all"
              style={{ accentColor: "var(--accent-sig)" }}
              className="size-[15px] cursor-pointer"
            />
            <Th label="Voucher No" col="voucherNo" sort={sort} onSort={toggleSort} />
            <span className={COL_HEAD}>File</span>
            <Th label="Vendor" col="vendor" sort={sort} onSort={toggleSort} />
            <span className={COL_HEAD}>Status</span>
            <Th label="Billing Date" col="date" sort={sort} onSort={toggleSort} />
            <Th label="Voucher Date" col="voucherDate" sort={sort} onSort={toggleSort} />
            <Th label="Amount" col="amount" sort={sort} onSort={toggleSort} className="justify-self-end" />
            <span aria-hidden />
          </div>

          {rows.map((b) => (
            <BookRow key={b.id} b={b} sel={selected.has(b.id)} onToggle={() => toggleRow(b.id)} />
          ))}
          {rows.length === 0 && (
            <EmptyState
              illustration="search"
              title="No bills match"
              description="Nothing lines up with your search and filters. Try loosening them."
              cta={{
                label: "Clear filters",
                onClick: () => {
                  setQuery("")
                  setStatusFilter(new Set())
                  setAmtMin("")
                  setAmtMax("")
                  setDateFrom("")
                  setDateTo("")
                },
              }}
            />
          )}
          </div>

          <p className="mt-3 px-1 text-[12px] text-faint">
            {rows.length} shown · {fmtINR(rows.reduce((s, b) => s + b.amount, 0))} in the books
          </p>

          <BulkBar count={selectedVisible.length} total={selectedTotal} onClear={() => setSelected(new Set())} />
        </section>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-surface text-ink shadow-[0_1px_2px_rgba(26,34,48,0.06)]"
          : "text-body hover:text-ink",
      )}
    >
      <span>{label}</span>
      <span className={cn("font-mono text-[12px] tabular-nums", active ? "text-ink" : "text-faint")}>
        · {count}
      </span>
    </button>
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
  col: SortKey
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-line-strong bg-panel-2 text-ink"
          : "border-line-2 text-body hover:border-line-strong",
      )}
    >
      {children}
    </button>
  )
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      placeholder={placeholder}
      className="w-[84px] rounded-md border border-line-2 bg-card px-2 py-1 fig text-[12px] text-ink placeholder:text-faint focus:border-accent-sig focus:outline-none"
    />
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-line-2 bg-card px-2 py-1 fig text-[12px] text-ink focus:border-accent-sig focus:outline-none"
    />
  )
}

/** A single "In the books" row. Settled/archival, so it carries a calm SAGE
 *  spine (posted/verified) — never the active ember/teal of Needs-review.
 *  Recently-landed bills (`fresh`) get a one-time tint flash on mount. */
function BookRow({ b, sel, onToggle }: { b: BillRow; sel: boolean; onToggle: () => void }) {
  const toast = useToast()
  const reduced = useReducedMotion()
  const [flash, setFlash] = useState(b.fresh && !reduced)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={cn(
        COLS,
        TABLE_ROW,
        "text-[13px]",
        sel && "bg-accent-wash",
        flash && "animate-[settle-land_1.2s_ease-out]",
      )}
    >
      <input
        type="checkbox"
        checked={sel}
        onChange={onToggle}
        aria-label={`Select ${b.vendor}`}
        style={{ accentColor: "var(--accent-sig)" }}
        className="size-[15px] cursor-pointer"
      />
      <span className="truncate code text-[12px] text-body">{b.voucherNo ?? "—"}</span>
      <FileGlyph
        present={!!b.billFile}
        file={b.billFile}
        label={b.vendor}
        onOpen={() =>
          toast({ message: <>Opening bill for <b className="font-medium">{b.vendor}</b></> })
        }
      />
      <div className="min-w-0">
        <div className="truncate font-medium leading-tight text-ink">{b.vendor}</div>
        <div className="code mt-0.5 truncate text-[11.5px] leading-tight text-faint">{b.number}</div>
      </div>
      {/* calm green — recorded to the books (archival, no alarm) */}
      <div className="min-w-0"><Tag tone="green">posted</Tag></div>
      <span className="font-mono text-[12px] tabular-nums text-muted-ink">{b.date}</span>
      <span className="font-mono text-[12px] tabular-nums text-muted-ink">{b.voucherDate ?? "—"}</span>
      <Amt value={b.amount} className="justify-self-end font-medium text-ink" />
      <RowMenu
        onView={() => toast({ message: <>Viewing <b className="font-medium">{b.number}</b></> })}
        onDuplicate={() => toast({ kind: "success", message: <>Duplicated <b className="font-medium">{b.number}</b></> })}
        onArchive={() => toast({ message: <>Archived <b className="font-medium">{b.vendor}</b></>, undo: () => {} })}
        label={b.vendor}
      />
    </div>
  )
}

/** row overflow menu — the ⋯ trigger opens View / Duplicate / Archive */
function RowMenu({
  label,
  onView,
  onDuplicate,
  onArchive,
}: {
  label: string
  onView: () => void
  onDuplicate: () => void
  onArchive: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative justify-self-end">
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-7 place-items-center rounded-md transition-colors",
          open ? "bg-panel-2 text-ink" : "text-faint hover:bg-panel-2 hover:text-ink",
        )}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </button>
      {open && (
        <>
          {/* outside-click catcher */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-[34px] z-40 w-40 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-lift"
          >
            <MenuItem icon={Eye} label="View" onClick={() => { setOpen(false); onView() }} />
            <MenuItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); onDuplicate() }} />
            <MenuItem icon={Archive} label="Archive" onClick={() => { setOpen(false); onArchive() }} />
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
