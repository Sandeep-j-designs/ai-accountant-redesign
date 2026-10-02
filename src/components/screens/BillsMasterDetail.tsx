import { useMemo, useState } from "react"
import { ArrowLeft, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseBillDate, dueInDays } from "@/lib/format"
import { Money } from "@/components/bills/Money"
import { StatusPill } from "@/components/bills/status"
import { EmptyState } from "@/components/common/EmptyState"
import { FilterMenu, FilterTokens, type Field } from "@/components/bills/FilterMenu"
import { BillDetailView } from "@/components/screens/BillDetailScreen"
import type { BillRow, BillStatus } from "@/data/invoice"

/**
 * The All-bills register as a master-detail split: a scrollable bill list on
 * the left, the selected bill's full details on the right — no page hop when
 * moving between bills. Selection is local to the view; opening a bill just
 * swaps the right pane. Search + filters live in the list toolbar; a Back
 * control returns to the standard full-width table.
 */
export function BillsMasterDetail({
  bills,
  initialId = null,
  onBack,
}: {
  bills: BillRow[]
  initialId?: string | null
  onBack?: () => void
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<BillStatus>>(new Set())
  const [amtMin, setAmtMin] = useState("")
  const [amtMax, setAmtMax] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<Field | null>(null)
  const [rawSelected, setRawSelected] = useState<string | null>(initialId)

  const clearFilter = (f: Field) => {
    if (f === "status") setStatusFilter(new Set())
    if (f === "amount") {
      setAmtMin("")
      setAmtMax("")
    }
    if (f === "date") {
      setDateFrom("")
      setDateTo("")
    }
    if (f === "vendor") setQuery("")
  }

  const clearAll = () => {
    setQuery("")
    setStatusFilter(new Set())
    setAmtMin("")
    setAmtMax("")
    setDateFrom("")
    setDateTo("")
  }

  // filtered, newest-first — the list mirrors how bills arrive
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const r = bills.filter((b) => {
      if (
        q &&
        !b.vendor.toLowerCase().includes(q) &&
        !b.number.toLowerCase().includes(q) &&
        !b.voucherNo?.toLowerCase().includes(q)
      )
        return false
      if (statusFilter.size && !statusFilter.has(b.status)) return false
      if (amtMin && b.amount < Number(amtMin)) return false
      if (amtMax && b.amount > Number(amtMax)) return false
      if (dateFrom && parseBillDate(b.date) < new Date(dateFrom)) return false
      if (dateTo && parseBillDate(b.date) > new Date(dateTo)) return false
      return true
    })
    return [...r].sort((a, b) => parseBillDate(b.date).getTime() - parseBillDate(a.date).getTime())
  }, [bills, query, statusFilter, amtMin, amtMax, dateFrom, dateTo])

  // selection falls back to the first row whenever the raw pick drops out of
  // the filtered set (deleted, filtered away) — the detail pane is never blank
  // while bills exist.
  const selectedId = rows.some((r) => r.id === rawSelected) ? rawSelected : rows[0]?.id ?? null

  const filtersActive = statusFilter.size > 0 || !!amtMin || !!amtMax || !!dateFrom || !!dateTo
  const tokensShown = filtersActive || !!query

  return (
    <div className="register-detail-workspace flex h-full min-h-0 overflow-hidden bg-surface">
      {/* ── master: the bill list ── */}
      <div className="register-detail-list flex h-full min-h-0 w-[290px] flex-none flex-col border-r border-line">
        <div className="flex-none border-b border-line p-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-ink outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              <ArrowLeft className="size-4" strokeWidth={2} />
              Recorded bills
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
                strokeWidth={1.75}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bills…"
                aria-label="Search bills"
                className="h-9 w-full rounded-md border border-line-2 bg-surface pl-8 pr-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
            </div>
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
          {tokensShown && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            </div>
          )}
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            {rows.length} {rows.length === 1 ? "bill" : "bills"}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((b) => (
            <BillListItem
              key={b.id}
              b={b}
              selected={b.id === selectedId}
              onSelect={() => setRawSelected(b.id)}
            />
          ))}
          {rows.length === 0 && (
            <EmptyState
              illustration="search"
              title="No bills match"
              description="Nothing lines up with your search and filters."
              cta={{ label: "Clear filters", onClick: clearAll }}
            />
          )}
        </div>
      </div>

      {/* ── detail: the selected bill ── */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <BillDetailView billId={selectedId} />
      </div>
    </div>
  )
}

/** One row in the master list — vendor + amount, reference + date, and a
 *  single status line (overdue reads red with its day count; everything else
 *  shows its lifecycle status). The active row carries a brand tint and a
 *  3px left rail, mirroring the sidebar's active treatment. */
function BillListItem({
  b,
  selected,
  onSelect,
}: {
  b: BillRow
  selected: boolean
  onSelect: () => void
}) {
  const overdueDays = b.status === "overdue" ? Math.max(0, -dueInDays(b.due)) : 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "relative flex w-full flex-col gap-1.5 border-b border-line px-4 py-3 text-left outline-none transition-colors",
        selected ? "bg-brand-tint" : "hover:bg-row-hover",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
      <div className="flex items-start justify-between gap-2">
        <span
          title={b.vendor}
          className={cn(
            "min-w-0 truncate text-[13.5px] font-semibold leading-tight",
            selected ? "text-brand" : "text-ink",
          )}
        >
          {b.vendor}
        </span>
        <Money
          value={b.amount}
          decimals
          symbolClassName="text-[11px]"
          decimalClassName="text-[11px]"
          className="flex-none text-[13.5px] font-semibold text-ink"
        />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-faint">
        <span className="code min-w-0 truncate">{b.voucherNo ?? b.number}</span>
        <span className="flex-none">·</span>
        <span className="flex-none tabular">{b.date}</span>
      </div>
      {overdueDays > 0 ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-danger">
          Overdue by {overdueDays} {overdueDays === 1 ? "day" : "days"}
        </span>
      ) : (
        <StatusPill status={b.status} />
      )}
    </button>
  )
}
