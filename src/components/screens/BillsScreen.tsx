import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useStuck } from "@/hooks/useStuck"
import {
  Search,
  X,
  ListFilter,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Archive,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parseBillDate, dueInDays } from "@/lib/format"
import { activeSync, approvedBillIds, useBill, type BillsTab } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { QueueTabs, SortTh, RowMenu } from "@/components/register/kit"
import { nextSort } from "@/components/register/useRegister"
import { Money } from "@/components/bills/Money"
import { SummaryStrip, type SummaryScope } from "@/components/bills/SummaryStrip"
import { BulkBar } from "@/components/bills/BulkBar"
import { Button } from "@/components/ui/button"
import { FilterMenu, FilterTokens, type Field } from "@/components/bills/FilterMenu"
import { TABLE_HEAD_ROW, TABLE_ROW, LIST_SHELL } from "@/components/bills/NeedsReview"
import { ReviewQueue } from "@/components/bills/ReviewQueue"
import { RunStrip } from "@/components/bills/RunStrip"
import { RecurringSummary } from "@/components/bills/RecurringSummaryDialog"
import { UploadHistory } from "@/components/bills/UploadHistory"
import { classifyIntake, openIntake } from "@/data/patterns"
import { SyncPill, StatusPill } from "@/components/bills/status"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { BillsMasterDetail } from "@/components/screens/BillsMasterDetail"
import { type BillRow, type BillStatus } from "@/data/invoice"
import { openReviewItems, booksRows, applyEdits } from "@/data/review"

type SortKey = "voucherNo" | "sync" | "vendor" | "due" | "date" | "voucherDate" | "amount"

/** sort order for the Tally-sync column — trouble first */
const SYNC_RANK: Record<NonNullable<BillRow["tallySync"]>, number> = {
  failed: 0,
  pending: 1,
  synced: 2,
}
// books columns: checkbox · Voucher No · Sync · Vendor(+ref) · Billing Date ·
// Voucher Date · Total Amount · ⋯menu. Vendor takes the slack; overdue pressure
// rides inline next to the billing date (the old "Due in" column is gone).
// Flat grid, uniform 12px rhythm — no clustering, no column tints.
const COLS = "books-grid grid items-center gap-4"
/** dates: 13px/400 secondary, tabular-nums, right-aligned */
const DATE_TEXT = "whitespace-nowrap text-right text-[13px] font-normal tabular text-body"

export function BillsScreen() {
  const { state, dispatch } = useBill()
  const [query, setQuery] = useState("")
  const [showDates, setShowDates] = useState(false)
  const [scope, setScope] = useState<SummaryScope>(null)
  const [compact, setCompact] = useState(() => { try { return localStorage.getItem("aia-bills-density") === "compact" } catch { return false } })
  const [returnedId, setReturnedId] = useState<string | null>(null)
  const listScroll = useRef(0)
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => { try { localStorage.setItem("aia-bills-density", compact ? "compact" : "comfortable") } catch { /* optional preference */ } }, [compact])
  const [statusFilter, setStatusFilter] = useState<Set<BillStatus>>(new Set())
  const [amtMin, setAmtMin] = useState("")
  const [amtMax, setAmtMax] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 })
  // filter popover (controlled so an applied token can reopen its editor)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<Field | null>(null)
  // which bill (if any) is opened into the master-detail split. null = the
  // standard full-width table; set = the reference-style list + detail view.
  const [detailId, setDetailId] = useState<string | null>(null)
  const clearFilter = (f: Field) => {
    if (f === "status") setStatusFilter(new Set())
    if (f === "amount") { setAmtMin(""); setAmtMax("") }
    if (f === "date") { setDateFrom(""); setDateTo("") }
    if (f === "vendor") setQuery("")
  }
  // client-side pagination — presentational only (slices the already-loaded rows)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  // sticky header gains a Level-1 shadow only once content scrolls beneath it
  const { ref: headerRef, stuck } = useStuck<HTMLDivElement>()
  // selection lives in the store — the TopBar sync scopes itself to it
  const selected = useMemo(() => new Set(state.selectedBills), [state.selectedBills])
  const setSelected = (next: Set<string>) =>
    dispatch({ type: "SET_BILL_SELECTION", ids: [...next] })

  // confirmed review items + clean bulk reads land here as PENDING-sync rows
  // (Tally comes later, via the sync run). Session deletes/edits from the
  // Bill Details page apply on top so the list never disagrees with it.
  // ...and so do approved routine groups. They take voucher numbers after
  // everything already booked, and stay PENDING until a sync run — which is
  // what keeps a whole batch reversible from the To-approve strip.
  const settled = useMemo(
    () =>
      booksRows(
        state.postedReviewIds,
        state.voucher,
        state.ingestedIds,
        activeSync(state).syncedIds,
        state.deletedBillIds,
        {
          bills: [...approvedBillIds(state)],
          autoPatterns: state.autoPostPatterns,
          open: openIntake(state.readPiles),
        },
      ).map((b) => applyEdits(b, state.billFieldEdits[b.id])),
    [state],
  )

  // ── tabs ──
  // dev preview of degradation states: ?review=1 (single) / ?review=0 (empty)
  const forced =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("review") : null
  const liveItems = useMemo(
    () => openReviewItems(state.postedReviewIds, state.ingestedIds),
    [state.postedReviewIds, state.ingestedIds],
  )
  const reviewItems = useMemo(
    () => (forced === "0" ? [] : forced === "1" ? liveItems.slice(0, 1) : liveItems),
    [forced, liveItems],
  )
  // The To-approve surface reads the month's intake (data/patterns.ts). The
  // original 9 review fixtures are superseded by it — only the bulk-UPLOADED
  // exceptions still fold in, so a live upload keeps landing somewhere while
  // ingestion gets re-laned into the strata. Keeping the static fixtures too
  // would double up vendors and put the counts out of step with each other.
  const ingestedReview = useMemo(
    () => reviewItems.filter((r) => r.billId.startsWith("bulk-")),
    [reviewItems],
  )
  // the tab count is everything still awaiting a decision: unapproved routine
  // bills + deviations + new vendors. Bills, not groups — the operator is
  // asking "how much is left", and a group answers a different question
  const intake = useMemo(() => classifyIntake(openIntake(state.readPiles)), [state.readPiles])
  const reviewCount = useMemo(() => {
    const settled = approvedBillIds(state)
    let n = state.readPiles.length ? ingestedReview.length : reviewItems.length
    for (const c of intake) {
      // an approved bill has left the queue; everything else is still a row
      if (settled.has(c.bill.id)) continue
      n++
    }
    return n
  }, [intake, state, ingestedReview, reviewItems])
  const booksCount = settled.length
  // tab lives in the store so other surfaces (the sync popover) can route here
  const tab = state.billsTab
  const setTab = (t: BillsTab) => {
    setDetailId(null) // leaving the split whenever the tab changes
    dispatch({ type: "SET_BILLS_TAB", tab: t })
  }

  // the detail screen carries its own Prev/Next across the Needs-review list —
  // opening any row just enters it at that bill.
  const openReview = (billId: string) => dispatch({ type: "ENTER_COCKPIT", billId })

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
      if (scope === "due" && (b.status === "paid" || dueInDays(b.due) < 0 || dueInDays(b.due) > 7)) return false
      if (scope === "overdue" && (b.status === "paid" || dueInDays(b.due) >= 0)) return false
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
            : sort.key === "sync"
              ? SYNC_RANK[a.tallySync ?? "synced"] - SYNC_RANK[b.tallySync ?? "synced"]
              : sort.key === "due"
                ? parseBillDate(a.due).getTime() - parseBillDate(b.due).getTime()
              : sort.key === "amount"
                ? a.amount - b.amount
                : sort.key === "voucherDate"
                  ? parseBillDate(a.voucherDate ?? a.date).getTime() -
                    parseBillDate(b.voucherDate ?? b.date).getTime()
                  : parseBillDate(a.date).getTime() - parseBillDate(b.date).getTime()
      return d * sort.dir
    })
    return r
  }, [settled, query, statusFilter, amtMin, amtMax, dateFrom, dateTo, sort, scope])

  const toggleSort = (key: SortKey) => setSort((s) => nextSort(s, key))

  // paginate the filtered/sorted rows — page is clamped so a shrinking result
  // set (new filters) never strands the view on an empty page
  const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1)
  const safePage = Math.min(page, maxPage)
  const pagedRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const filtersActive =
    statusFilter.size > 0 || !!amtMin || !!amtMax || !!dateFrom || !!dateTo

  // selection is scoped to the currently-visible rows
  const visibleIds = rows.map((b) => b.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const toggleRow = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }
  const toggleAll = () => {
    const n = new Set(selected)
    if (allSelected) visibleIds.forEach((id) => n.delete(id))
    else visibleIds.forEach((id) => n.add(id))
    setSelected(n)
  }
  const selectedTotal = settled
    .filter((b) => selected.has(b.id))
    .reduce((s, b) => s + b.amount, 0)

  useLayoutEffect(() => {
    if (detailId || !returnedId) return
    const main = pageRef.current?.closest("main")
    if (main) main.scrollTop = listScroll.current
    pageRef.current?.querySelector<HTMLElement>(`[data-bill-id="${returnedId}"]`)?.focus({ preventScroll: true })
    const timer = setTimeout(() => setReturnedId(null), 1600)
    return () => clearTimeout(timer)
  }, [detailId, returnedId])

  // ── the reference split — a row was opened. Fills the viewport; its own
  // Back returns to the standard table. ──
  if (tab === "books" && detailId) {
    return (
      <BillsMasterDetail
        bills={settled}
        initialId={detailId}
        onBack={() => { setReturnedId(detailId); setDetailId(null) }}
      />
    )
  }

  return (
    // Level 0 — the warm-paper canvas; white surfaces float on it. Capped
    // at a max content width (left-anchored, not centered — the sidebar
    // already anchors the eye to the left) so the KPI cards and table don't
    // stretch into awkward dead space on large/ultra-wide screens.
    <div ref={pageRef} className={cn("bills-workspace min-h-full bg-page p-[var(--inset-page)]", compact && "density-compact")}>
      <div className="max-w-[1600px]">
      {/* page-level action — sits above the KPI row, always visible */}
<div className="register-page-heading mb-5 flex items-center justify-between gap-4">
        <div><span className="workspace-eyebrow">PAYABLES WORKSPACE</span><h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink">Bills</h1></div>
        <Button
          variant="default"
          size="lg"
          icon={<Plus strokeWidth={2} />}
          onClick={() => dispatch({ type: "SHOW", screen: "entry" })}
        >
          Add bills
        </Button>
      </div>

      {/* the summary belongs to the SCREEN, not to one tab — a run can finish
          while she is looking at All bills */}
      <RecurringSummary />

      {/* an upload she walked away from keeps its presence here */}
      {state.run && (
        <div className="enter-up mb-4">
          <RunStrip />
        </div>
      )}

      {/* stat row — three bordered cards on the canvas */}
      <div className="enter-up mb-5">
        <SummaryStrip bills={settled} reviewCount={reviewCount}
          highestReview={Math.max(0, ...reviewItems.map(r => r.amount), ...intake.filter(c => !approvedBillIds(state).has(c.bill.id)).map(c => c.bill.amount))}
          active={tab === "review" ? "review" : tab === "books" ? scope : null}
          onSelect={(next) => { setPage(0); setQuery(""); setStatusFilter(new Set()); setAmtMin(""); setAmtMax(""); setDateFrom(""); setDateTo(""); setSelected(new Set()); setTab(next === "review" ? "review" : "books"); setScope(next === "review" ? null : scope === next ? null : next) }} />
      </div>

      {/* ONE header row — tabs at left, search + Filters sitting parallel at
          the right (books tab only). No full-width baseline; the active tab
          carries its own accent underline. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <QueueTabs
          tab={tab}
          setTab={setTab}
          tabs={[
            { key: "books", label: "Recorded", count: booksCount },
            { key: "review", label: "Needs review", count: reviewCount, warn: true },
            // the record of what came in, one row per run (data/uploads.ts)
            { key: "uploads", label: "Uploads", count: state.uploadRuns.length },
          ]}
        />
        {tab === "books" && booksCount > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="list-search"><Search className="size-4 text-faint" /><input aria-label="Search recorded bills" placeholder="Find a bill…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
            <button className="density-toggle" aria-label={compact ? "Use comfortable row density" : "Use compact row density"} aria-pressed={compact} title="Toggle row density" onClick={() => setCompact(v => !v)}><ListFilter size={16} /><span>{compact ? "Compact" : "Comfortable"}</span></button>
            <details className="column-picker relative" onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus() } }}>
              <summary title="Columns" aria-label="Configure date columns" className="density-toggle list-none"><Columns3 size={16} /></summary>
              <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-line bg-surface p-3 shadow-overlay"><label className="flex cursor-pointer items-start gap-2 text-[13px] text-body"><input type="checkbox" checked={showDates} onChange={e => setShowDates(e.target.checked)} className="mt-1 accent-brand" />Show billing and voucher dates</label></div>
            </details>
            {/* applied filters render as removable inline tokens, then Filters */}
            <FilterTokens
              status={statusFilter}
              amtMin={amtMin}
              amtMax={amtMax}
              dateFrom={dateFrom}
              dateTo={dateTo}
              vendor={query}
              onEdit={(f) => {
                setFilterField(f)
                setFilterOpen(true)
              }}
              onClear={clearFilter}
            />
            <FilterMenu
              active={filtersActive}
              open={filterOpen}
              setOpen={setFilterOpen}
              field={filterField}
              setField={setFilterField}
              status={statusFilter}
              onStatus={setStatusFilter}
              amtMin={amtMin}
              amtMax={amtMax}
              onAmount={(min, max) => {
                setAmtMin(min)
                setAmtMax(max)
              }}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDate={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
              }}
              vendor={query}
              onVendor={setQuery}
            />
          </div>
        )}
      </div>

      {tab === "books" && scope && <div className="scope-caption" role="status"><span>{scope === "due" ? "Due in the next 7 days" : "Overdue bills"} <span className="text-faint">· {rows.length} results</span></span><button onClick={() => setScope(null)} className="inline-flex items-center gap-1 text-brand">Clear view <X size={14} /></button></div>}
      {tab === "uploads" ? (
        <div className="enter-up">
          <UploadHistory />
        </div>
      ) : tab === "review" ? (
        <div className="enter-up">
          <ReviewQueue legacy={reviewItems} onReview={openReview} />
        </div>
      ) : booksCount === 0 ? (
        <EmptyState illustration="bills" title="No bills recorded yet" description="Committed bills land here as your permanent register." />
      ) : (
        <section className="ledger-scroll" aria-label="Recorded bills">
          <div className={cn(LIST_SHELL, "books-table", showDates && "with-date-columns")}>
          {/* selecting rows swaps the header for a docked bulk-action bar */}
          {selected.size > 0 ? (
            <BulkBar
              count={selected.size}
              total={selectedTotal}
              allSelected={allSelected}
              indeterminate={selectedVisible.length > 0 && !allSelected}
              onToggleAll={toggleAll}
              onClear={() => setSelected(new Set())}
            />
          ) : (
            <div ref={headerRef} className={cn(COLS, TABLE_HEAD_ROW, "group", stuck && "shadow-1")}>
              <label className="-m-2 inline-flex w-max cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  style={{ accentColor: "var(--accent-sig)" }}
                  className="size-4 cursor-pointer"
                />
              </label>
              <SortTh label="Vendor / bill" col="vendor" onSort={toggleSort} sort={sort} />
              <SortTh label="Amount" col="amount" onSort={toggleSort} sort={sort} className="justify-self-end" />
              <SortTh label="Due date" col="due" onSort={toggleSort} sort={sort} className="justify-self-end" />
              <SortTh label="Voucher no" col="voucherNo" onSort={toggleSort} sort={sort} />
              {showDates && <><SortTh label="Billing date" col="date" onSort={toggleSort} sort={sort} className="justify-self-end" /><SortTh label="Voucher date" col="voucherDate" onSort={toggleSort} sort={sort} className="justify-self-end" /></>}
              <SortTh label="Tally sync" col="sync" onSort={toggleSort} sort={sort} />
              <span aria-hidden />
            </div>
          )}

          {pagedRows.map((b) => (
            <BookRow
              key={b.id}
              b={b}
              returned={returnedId === b.id}
              showDates={showDates}
              sel={selected.has(b.id)}
              onToggle={() => toggleRow(b.id)}
              onOpen={() => { listScroll.current = pageRef.current?.closest("main")?.scrollTop ?? 0; setDetailId(b.id) }}
            />
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
                  setScope(null)
                  setStatusFilter(new Set())
                  setAmtMin("")
                  setAmtMax("")
                  setDateFrom("")
                  setDateTo("")
                },
              }}
            />
          )}

          {rows.length > 0 && (
            <div className="flex justify-end border-t border-line px-5 py-3">
              <TablePagination
                page={safePage}
                pageSize={pageSize}
                total={rows.length}
                onPage={setPage}
                onPageSize={(s) => {
                  setPageSize(s)
                  setPage(0)
                }}
              />
            </div>
          )}
          </div>
        </section>
      )}
      </div>
    </div>
  )
}

/** Table pagination footer — rows-per-page selector + range + page nav.
 *  Purely presentational: it slices the already-loaded rows, no fetching. */
export function TablePagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize: (s: number) => void
}) {
  const start = total === 0 ? 0 : page * pageSize + 1
  const end = Math.min(total, (page + 1) * pageSize)
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-body">
      <label className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-md border border-line-2 bg-surface px-1.5 py-1 text-[13px] text-ink shadow-[0_1px_2px_rgba(21,26,38,0.05)] outline-none transition-colors hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span className="tabular-nums">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <PageBtn disabled={page <= 0} onClick={() => onPage(page - 1)} label="Previous page">
          <ChevronLeft className="size-4" strokeWidth={2} />
        </PageBtn>
        <PageBtn disabled={page >= maxPage} onClick={() => onPage(page + 1)} label="Next page">
          <ChevronRight className="size-4" strokeWidth={2} />
        </PageBtn>
      </div>
    </div>
  )
}

function PageBtn({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md border border-line-2 bg-surface text-ink shadow-[0_1px_2px_rgba(21,26,38,0.05)] outline-none transition-colors duration-150 hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {children}
    </button>
  )
}

/** A single "All bills" row. The row itself is the affordance — clicking it
 *  opens the master-detail split at that bill. The checkbox and ⋯ menu stop
 *  propagation so they act on their own. Recently-landed bills (`fresh`) get
 *  a one-time tint flash. */
function BookRow({
  b,
  returned,
  showDates,
  sel,
  onToggle,
  onOpen,
}: {
  b: BillRow
  returned: boolean
  showDates: boolean
  sel: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const toast = useToast()
  const reduced = useReducedMotion()
  const [flash, setFlash] = useState(b.fresh && !reduced)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overdueDays = b.status !== "paid" ? Math.max(0, -dueInDays(b.due)) : 0

  return (
    <div
      role="button"
      data-bill-id={b.id}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        COLS,
        TABLE_ROW,
        "book-row outline-none transition-colors",
        sel && "is-selected",
        returned && "returned-row",
        flash && "animate-[settle-land_1.2s_ease-out]",
      )}
    >
      {/* 16px checkbox with an 8px padding hit-area (negative margin keeps
          the 40px column from growing) — stops propagation so a tick never
          opens the split */}
      <label
        className="-m-2 inline-flex w-max cursor-pointer p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={sel}
          onChange={onToggle}
          aria-label={`Select ${b.vendor}`}
          style={{ accentColor: "var(--accent-sig)" }}
          className="size-4 cursor-pointer"
        />
      </label>
      {/* Vendor stays on its own line; reference and status form a quieter second line. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span title={b.vendor} className="w-full truncate text-[14px] font-semibold leading-tight text-ink">
          {b.vendor}
        </span>
        <span title={b.number} className="min-w-0 truncate text-[12px] font-normal leading-tight text-faint">{b.number}</span>
        {overdueDays === 0 && <StatusPill status={b.status} />}
        {overdueDays > 0 && (
          <span className="flex-none whitespace-nowrap rounded-xs bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium leading-none text-danger">
            {overdueDays}d overdue
          </span>
        )}
        {/* recorded with no keystroke — the register has to say so, or the
            audit trail can't answer "what did nobody look at?" */}
        {b.autoPosted && (
          <span
            title="Posted automatically under an approved vendor pattern"
            className="flex-none whitespace-nowrap rounded-xs bg-accent-wash px-1.5 py-0.5 text-[11px] font-medium leading-none text-accent-sig-ink"
          >
            Auto
          </span>
        )}
      </div>
      <Money value={b.amount} decimals symbolClassName="text-[13px]" decimalClassName="text-[12px]" className="justify-self-end text-right text-[14px] font-semibold text-ink" />
      <span className={cn(DATE_TEXT, "text-[14px]", overdueDays > 0 && "text-danger")}>{b.due}</span>
      <span title={`Billing date: ${b.date} · Voucher date: ${b.voucherDate ?? "—"}`} className="truncate text-[12px] tabular-nums text-faint">{b.voucherNo ?? "—"}</span>
      {showDates && <><span className={DATE_TEXT}>{b.date}</span><span className={DATE_TEXT}>{b.voucherDate ?? "—"}</span></>}
      <div className="min-w-0">
        <SyncPill status={b.tallySync ?? "synced"} note={b.syncNote} />
        {b.tallySync === "failed" && <button onClick={e => { e.stopPropagation(); onOpen() }} className="mt-1 block max-w-full truncate text-[12px] text-danger underline decoration-danger/30 underline-offset-2" title={b.syncNote}>{b.syncNote ?? "View sync issue"} →</button>}
      </div>
      {/* row actions — the ⋯ menu, always visible */}
      <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
        <RowMenu
          label={b.vendor}
          items={[
            { icon: Eye, label: "View", onClick: onOpen },
            { icon: Copy, label: "Duplicate", onClick: () => toast({ kind: "success", message: <>Duplicated <b className="font-medium">{b.number}</b></> }) },
            { icon: Archive, label: "Archive", onClick: () => toast({ message: <>Archived <b className="font-medium">{b.vendor}</b></>, undo: () => {} }) },
          ]}
        />
      </div>
    </div>
  )
}
