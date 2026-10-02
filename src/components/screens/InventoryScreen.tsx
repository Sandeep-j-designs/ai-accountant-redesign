import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  X,
  ListFilter,
  Plus,
  Eye,
  Archive,
  Download,
  ListTree,
  List,
  ClipboardCheck,
  PackageMinus,
  PackageX,
  ArrowRightLeft,
  BellRing,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { useStuck } from "@/hooks/useStuck"
import { Button } from "@/components/ui/button"
import { Money } from "@/components/bills/Money"
import { SyncPill } from "@/components/bills/status"
import { SummaryCard } from "@/components/bills/SummaryStrip"
import { BulkBar } from "@/components/bills/BulkBar"
import { TABLE_HEAD_ROW, TABLE_ROW, LIST_SHELL, COL_HEAD } from "@/components/bills/NeedsReview"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { TablePagination } from "@/components/screens/BillsScreen"
import {
  QueueTabs,
  SortTh,
  RowCheck,
  RowMenu,
  FacetFilter,
  FacetTokens,
  GroupRow,
  SegmentSwitch,
  type Facet,
} from "@/components/register/kit"
import { useRegister, selection, paginate, initialMasterTab, nextSort, fmtQty } from "@/components/register/useRegister"
import { MasterReview, type MasterReviewRow } from "@/components/register/MasterReview"
import { MasterSplit, DetailHead, DetailStat, DetailCard, InfoGrid, SourceNote } from "@/components/register/MasterSplit"
import {
  GODOWNS,
  STOCK_GROUPS,
  STOCK_REVIEWS,
  STOCK_REVIEW_LABEL,
  effectiveStock,
  isLow,
  qtyOf,
  stockGroupName,
  stockMovements,
  valueOf,
  type StockItem,
  type StockReviewKind,
} from "@/data/stockItems"

type Tab = "all" | "review"
type SortKey = "name" | "hsn" | "qty" | "rate" | "value" | "sync"
type Scope = "low" | "out" | null

const COLS = "stock-grid grid items-center gap-4"
const SYNC_RANK = { failed: 0, pending: 1, synced: 2 } as const

const FACETS: Facet[] = [
  { key: "group", label: "Stock group", options: STOCK_GROUPS.map((g) => ({ value: g.id, label: g.name })) },
  { key: "godown", label: "Godown", options: GODOWNS.map((g) => ({ value: g, label: g })) },
  {
    key: "sync",
    label: "Tally sync",
    options: [
      { value: "synced", label: "Synced", dot: "bg-success-dot" },
      { value: "pending", label: "Pending", dot: "bg-warning-dot" },
      { value: "failed", label: "Failed", dot: "bg-danger-dot" },
    ],
  },
  {
    key: "source",
    label: "Created by",
    options: [
      { value: "tally", label: "Imported from Tally" },
      { value: "ai", label: "AI Accountant" },
      { value: "user", label: "By hand" },
    ],
  },
]

/** stock against its reorder level — green when healthy, amber below, red at zero */
function StockLevel({ s, wide }: { s: StockItem; wide?: boolean }) {
  const q = qtyOf(s)
  const out = q === 0
  const low = isLow(s)
  // the meter fills to 2× reorder, so the reorder line sits at the middle
  const pct = s.reorder > 0 ? Math.min(100, (q / (s.reorder * 2)) * 100) : q > 0 ? 100 : 0
  return (
    <div className={cn("min-w-0", wide && "w-full")}>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-[14px] font-semibold tabular-nums", out ? "text-danger" : "text-ink")}>{fmtQty(q)}</span>
        <span className="text-[12px] text-faint">{s.unit}</span>
        {out ? (
          <span className="ml-auto whitespace-nowrap rounded-xs bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium leading-none text-danger">Out</span>
        ) : low ? (
          <span className="ml-auto whitespace-nowrap rounded-xs bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium leading-none text-warning">Low</span>
        ) : null}
      </div>
      {s.reorder > 0 && (
        <div className={cn("stock-meter mt-1.5", low && "is-low", out && "is-out")} title={`Reorder at ${fmtQty(s.reorder)} ${s.unit}`}>
          <span style={{ width: `${Math.max(out ? 0 : 4, pct)}%` }} />
        </div>
      )}
    </div>
  )
}

export function InventoryScreen() {
  const { state } = useBill()
  const toast = useToast()
  const [tab, setTabRaw] = useState<Tab>(() => initialMasterTab<Tab>("all", "review"))
  const [scope, setScope] = useState<Scope>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [returnedId, setReturnedId] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)
  const r = useRegister<SortKey>("aia-stock", { key: "name", dir: 1 })
  const { ref: headerRef, stuck } = useStuck<HTMLDivElement>()

  const items = useMemo(() => effectiveStock(state.masterResolved), [state.masterResolved])
  const reviewRows: MasterReviewRow<StockReviewKind>[] = useMemo(
    () =>
      STOCK_REVIEWS.map((x) => {
        const target = items.find((s) => s.id === x.itemId)
        return {
          id: x.id,
          kind: x.kind,
          title: x.billLine,
          sub: (
            <>
              {x.vendor} · <span className="code">{x.billNo}</span> · {x.qty}
            </>
          ),
          reason: x.reason,
          chip: x.chip,
          action: x.action,
          amount: x.amount,
          done:
            x.kind === "new"
              ? `Created ${x.creates?.name} in ${stockGroupName(x.creates?.group ?? "")}`
              : x.kind === "match"
                ? `Mapped to ${target?.name} — future bills will match on their own`
                : x.kind === "unit"
                  ? `Set 1 Bundle = 25 Nos on ${target?.name}`
                  : `Updated HSN on ${target?.name} to ${x.chip}`,
        }
      }),
    [items],
  )
  const reviewOpen = STOCK_REVIEWS.filter((x) => !state.masterResolved[x.id]).length

  const low = items.filter((s) => isLow(s) && qtyOf(s) > 0)
  const out = items.filter((s) => qtyOf(s) === 0)
  const totalValue = items.reduce((n, s) => n + valueOf(s), 0)

  const setTab = (t: Tab) => {
    setDetailId(null)
    r.setSelected(new Set())
    setTabRaw(t)
  }

  const rows = useMemo(() => {
    const q = r.query.trim().toLowerCase()
    const filtered = items.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.sku.toLowerCase().includes(q) && !s.hsn.includes(q)) return false
      if (scope === "low" && !(isLow(s) && qtyOf(s) > 0)) return false
      if (scope === "out" && qtyOf(s) > 0) return false
      const inGodown = !r.facets.godown?.size || Object.entries(s.holdings).some(([g, n]) => r.facets.godown.has(g) && (n ?? 0) > 0)
      return inGodown && r.has("group", s.group) && r.has("sync", s.sync) && r.has("source", s.source)
    })
    const { key, dir } = r.sort
    return filtered.sort((a, b) => {
      const d =
        key === "name"
          ? a.name.localeCompare(b.name)
          : key === "hsn"
            ? a.hsn.localeCompare(b.hsn)
            : key === "qty"
              ? qtyOf(a) - qtyOf(b)
              : key === "rate"
                ? a.rate - b.rate
                : key === "value"
                  ? valueOf(a) - valueOf(b)
                  : SYNC_RANK[a.sync] - SYNC_RANK[b.sync]
      return d * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, r.query, r.facets, r.sort, scope])

  const grouped = r.view === "grouped"
  const { safePage, paged } = paginate(rows, r.page, r.pageSize)
  const visible = grouped ? rows : paged
  const sel = selection(r.selected, r.setSelected, visible.map((s) => s.id))
  const toggleSort = (k: SortKey) => r.setSort((s) => nextSort(s, k))
  const selectedValue = items.filter((s) => r.selected.has(s.id)).reduce((n, s) => n + valueOf(s), 0)

  useLayoutEffect(() => {
    if (detailId || !returnedId) return
    const main = pageRef.current?.closest("main")
    if (main) main.scrollTop = listScroll.current
    pageRef.current?.querySelector<HTMLElement>(`[data-row-id="${returnedId}"]`)?.focus({ preventScroll: true })
    const t = setTimeout(() => setReturnedId(null), 1600)
    return () => clearTimeout(t)
  }, [detailId, returnedId])

  const open = (id: string) => {
    listScroll.current = pageRef.current?.closest("main")?.scrollTop ?? 0
    setDetailId(id)
  }
  const match = useCallback((s: StockItem, q: string) => s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q), [])

  if (tab === "all" && detailId) {
    return (
      <MasterSplit
        items={rows}
        initialId={detailId}
        noun="item"
        backLabel="All stock items"
        onBack={(last) => {
          setReturnedId(last)
          setDetailId(null)
        }}
        match={match}
        renderItem={(s, selected) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <span title={s.name} className={cn("min-w-0 truncate text-[13.5px] font-semibold leading-tight", selected ? "text-brand" : "text-ink")}>
                {s.name}
              </span>
              <Money value={valueOf(s)} decimals={false} symbolClassName="text-[11px]" className="flex-none text-[13px] font-semibold text-ink" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-faint">
              <span className="code truncate">{s.sku}</span>
              <span className="flex-none">·</span>
              <span className={cn("flex-none tabular", qtyOf(s) === 0 ? "text-danger" : isLow(s) && "text-warning")}>
                {fmtQty(qtyOf(s))} {s.unit}
              </span>
            </div>
            {s.sync !== "synced" && <SyncPill status={s.sync} note={s.syncNote} className="-ml-2 py-0.5" />}
          </>
        )}
        renderDetail={(s) => <StockDetail item={s} />}
      />
    )
  }

  const groupsShown = STOCK_GROUPS.filter((g) => rows.some((s) => s.group === g.id))

  return (
    <div ref={pageRef} className={cn("bills-workspace min-h-full bg-page p-[var(--inset-page)]", r.compact && "density-compact")}>
      <div className="max-w-[1600px]">
        <div className="register-page-heading mb-5 flex items-center justify-between gap-4">
          <div>
            <span className="workspace-eyebrow">INVENTORY WORKSPACE</span>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink">Stock items</h1>
            <p className="mt-1 text-[13px] text-muted-ink">
              <Money value={totalValue} decimals={false} className="text-muted-ink" /> in stock across {items.length} items and {GODOWNS.length} godowns · weighted average
            </p>
          </div>
          <Button size="lg" icon={<Plus strokeWidth={2} />} onClick={() => toast({ message: "New stock item opens Tally's item creation, pre-filled from the bill line" })}>
            New item
          </Button>
        </div>

        <div className="enter-up mb-5">
          <div className="summary-grid">
            <SummaryCard
              label="Needs review"
              icon={<ClipboardCheck size={17} />}
              active={tab === "review"}
              onClick={() => setTab("review")}
              value={
                <>
                  {reviewOpen}
                  <span className="ml-2 text-[14px] font-normal text-body">bill lines</span>
                </>
              }
              meta={reviewOpen ? "Not matched to a stock item" : "You're caught up"}
            />
            <SummaryCard
              label="Below reorder level"
              icon={<PackageMinus size={17} />}
              active={tab === "all" && scope === "low"}
              onClick={() => {
                setTab("all")
                setScope(scope === "low" ? null : "low")
              }}
              value={
                <>
                  {low.length}
                  <span className="ml-2 text-[14px] font-normal text-body">items</span>
                </>
              }
              meta={low.length ? "Reorder before they run out" : "Everything is stocked"}
            />
            <SummaryCard
              label="Out of stock"
              icon={<PackageX size={17} />}
              danger={out.length > 0}
              active={tab === "all" && scope === "out"}
              onClick={() => {
                setTab("all")
                setScope(scope === "out" ? null : "out")
              }}
              value={
                <>
                  {out.length}
                  <span className="ml-2 text-[14px] font-normal text-body">items</span>
                </>
              }
              meta={out.length ? "Zero across every godown" : "Nothing at zero"}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <QueueTabs
            tab={tab}
            setTab={setTab}
            tabs={[
              { key: "all", label: "All items", count: items.length },
              { key: "review", label: "Needs review", count: reviewOpen, warn: true },
            ]}
          />
          {tab === "all" && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="list-search">
                <Search className="size-4 text-faint" />
                <input
                  aria-label="Search stock items"
                  placeholder="Find an item…"
                  value={r.query}
                  onChange={(e) => {
                    r.setQuery(e.target.value)
                    r.setPage(0)
                  }}
                />
                {r.query && (
                  <button aria-label="Clear search" onClick={() => r.setQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </label>
              <SegmentSwitch
                label="Table layout"
                value={r.view}
                onChange={r.setView}
                options={[
                  { key: "grouped", label: "By group", icon: ListTree },
                  { key: "list", label: "List", icon: List },
                ]}
              />
              <button
                className="density-toggle"
                aria-label={r.compact ? "Use comfortable row density" : "Use compact row density"}
                aria-pressed={r.compact}
                title="Toggle row density"
                onClick={() => r.setCompact((v) => !v)}
              >
                <ListFilter size={16} />
                <span>{r.compact ? "Compact" : "Comfortable"}</span>
              </button>
              <FacetTokens
                facets={FACETS}
                value={r.facets}
                onEdit={(k) => {
                  r.setFilterField(k)
                  r.setFilterOpen(true)
                }}
                onClear={r.clearFacet}
              />
              <FacetFilter
                facets={FACETS}
                value={r.facets}
                onChange={r.setFacet}
                open={r.filterOpen}
                setOpen={r.setFilterOpen}
                field={r.filterField}
                setField={r.setFilterField}
              />
            </div>
          )}
        </div>

        {tab === "all" && scope && (
          <div className="scope-caption" role="status">
            <span>
              {scope === "low" ? "Items below their reorder level" : "Items out of stock"} <span className="text-faint">· {rows.length} results</span>
            </span>
            <button onClick={() => setScope(null)} className="inline-flex items-center gap-1 text-brand">
              Clear view <X size={14} />
            </button>
          </div>
        )}

        {tab === "review" ? (
          <div className="enter-up">
            <MasterReview
              rows={reviewRows}
              kinds={STOCK_REVIEW_LABEL}
              noun="bill line"
              eyebrow="READ OFF YOUR BILLS"
              blurb="Match bill lines to stock items so purchases move quantity, not just money."
            />
          </div>
        ) : (
          <section className="ledger-scroll" aria-label="Stock items">
            <div className={cn(LIST_SHELL, "master-table")}>
              {r.selected.size > 0 ? (
                <BulkBar
                  count={r.selected.size}
                  total={selectedValue}
                  noun="item"
                  allSelected={sel.all}
                  indeterminate={sel.some}
                  onToggleAll={sel.toggleAll}
                  onClear={() => r.setSelected(new Set())}
                  actions={[
                    { icon: <ArrowRightLeft className="size-3.5" strokeWidth={2} />, label: "Transfer", verb: "queued for a godown transfer" },
                    { icon: <BellRing className="size-3.5" strokeWidth={2} />, label: "Set reorder", verb: "set to alert at their reorder level" },
                    { icon: <Download className="size-3.5" strokeWidth={2} />, label: "Export", verb: "exported", kind: "info", undo: false },
                  ]}
                />
              ) : (
                <div ref={headerRef} className={cn(COLS, TABLE_HEAD_ROW, "master-head", stuck && "shadow-1")}>
                  <RowCheck checked={sel.all} indeterminate={sel.some} onChange={sel.toggleAll} label="Select all" />
                  <SortTh label="Item" col="name" onSort={toggleSort} sort={r.sort} />
                  <SortTh label="HSN · GST" col="hsn" onSort={toggleSort} sort={r.sort} />
                  <SortTh label="In stock" col="qty" onSort={toggleSort} sort={r.sort} />
                  <SortTh label="Avg rate" col="rate" onSort={toggleSort} sort={r.sort} className="justify-self-end" />
                  <SortTh label="Stock value" col="value" onSort={toggleSort} sort={r.sort} className="justify-self-end" />
                  <SortTh label="Tally sync" col="sync" onSort={toggleSort} sort={r.sort} />
                  <span aria-hidden />
                </div>
              )}

              {rows.length === 0 ? (
                <EmptyState
                  illustration="search"
                  title="No items match"
                  description="Nothing lines up with your search and filters. Try loosening them."
                  cta={{
                    label: "Clear filters",
                    onClick: () => {
                      r.clearAll()
                      setScope(null)
                    },
                  }}
                />
              ) : grouped ? (
                groupsShown.map((g) => {
                  const inGroup = rows.filter((s) => s.group === g.id)
                  const isOpen = !r.collapsed.has(g.id)
                  return (
                    <div key={g.id}>
                      <GroupRow
                        cols={COLS}
                        labelSpan={5}
                        label={g.name}
                        count={inGroup.length}
                        open={isOpen}
                        onToggle={() => r.toggleGroup(g.id)}
                        total={<Money value={inGroup.reduce((n, s) => n + valueOf(s), 0)} decimals={false} symbolClassName="text-[11px]" className="justify-self-end text-[13px] font-semibold text-ink" />}
                      />
                      {isOpen &&
                        inGroup.map((s) => (
                          <StockRow key={s.id} s={s} grouped sel={r.selected.has(s.id)} returned={returnedId === s.id} onToggle={() => sel.toggle(s.id)} onOpen={() => open(s.id)} />
                        ))}
                    </div>
                  )
                })
              ) : (
                paged.map((s) => <StockRow key={s.id} s={s} sel={r.selected.has(s.id)} returned={returnedId === s.id} onToggle={() => sel.toggle(s.id)} onOpen={() => open(s.id)} />)
              )}

              {rows.length > 0 && !grouped && (
                <div className="flex justify-end border-t border-line px-5 py-3">
                  <TablePagination
                    page={safePage}
                    pageSize={r.pageSize}
                    total={rows.length}
                    onPage={r.setPage}
                    onPageSize={(n) => {
                      r.setPageSize(n)
                      r.setPage(0)
                    }}
                  />
                </div>
              )}
              {rows.length > 0 && grouped && (
                <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-faint">
                  <span>
                    {rows.length} items in {groupsShown.length} groups
                  </span>
                  <span>Valued at weighted average · 30 Jun 2026</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StockRow({
  s,
  grouped,
  sel,
  returned,
  onToggle,
  onOpen,
}: {
  s: StockItem
  grouped?: boolean
  sel: boolean
  returned: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const toast = useToast()
  return (
    <div
      role="button"
      tabIndex={0}
      data-row-id={s.id}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(COLS, TABLE_ROW, "master-row outline-none", sel && "is-selected", returned && "returned-row")}
    >
      <RowCheck checked={sel} onChange={onToggle} label={`Select ${s.name}`} />
      <div className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1", grouped && "pl-5")}>
        <span title={s.name} className="w-full truncate text-[14px] font-medium leading-tight text-ink">
          {s.name}
        </span>
        <span className="code min-w-0 truncate text-[12px] leading-tight text-faint">
          {s.sku}
          {!grouped && <span className="font-sans"> · {stockGroupName(s.group)}</span>}
        </span>
        {s.source === "ai" && (
          <span title={`Created by AI Accountant from ${s.sourceBill}`} className="flex-none whitespace-nowrap rounded-xs bg-accent-wash px-1.5 py-0.5 text-[11px] font-medium leading-none text-accent-sig-ink">
            AI
          </span>
        )}
      </div>
      <span className="truncate text-[12px] tabular-nums text-body">
        <span className="code">{s.hsn}</span> <span className="text-faint">· {s.gstRate}%</span>
      </span>
      <StockLevel s={s} />
      <Money value={s.rate} decimals symbolClassName="text-[12px]" decimalClassName="text-[11px]" className="justify-self-end text-[13px] text-body" />
      <Money value={valueOf(s)} decimals={false} symbolClassName="text-[12px]" className={cn("justify-self-end text-[14px] font-semibold", valueOf(s) ? "text-ink" : "text-faint")} />
      <div className="min-w-0">
        <SyncPill status={s.sync} note={s.syncNote} />
      </div>
      <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
        <RowMenu
          label={s.name}
          items={[
            { icon: Eye, label: "View", onClick: onOpen },
            { icon: ArrowRightLeft, label: "Transfer stock", onClick: () => toast({ message: <>Pick a godown to move <b className="font-medium">{s.name}</b> into</> }) },
            { icon: Archive, label: "Archive", onClick: () => toast({ message: <>Archived <b className="font-medium">{s.name}</b></>, undo: () => {} }) },
          ]}
        />
      </div>
    </div>
  )
}

function StockDetail({ item: s }: { item: StockItem }) {
  const toast = useToast()
  const q = qtyOf(s)
  const moves = stockMovements(s)
  const maxHold = Math.max(1, ...Object.values(s.holdings).map((n) => n ?? 0))
  const tone = q === 0 ? "danger" : isLow(s) ? "warning" : undefined
  return (
    <>
      <DetailHead title={s.name} code={s.sku} sync={s.sync} syncNote={s.syncNote} monogram={stockGroupName(s.group).slice(0, 2).toUpperCase()} />
      <div className="flex flex-col gap-4 p-6">
        <SourceNote source={s.source} bill={s.sourceBill} />
        {s.sync === "failed" && (
          <div className="flex items-start gap-3 rounded-[10px] border border-danger/25 bg-danger-bg px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 flex-none text-danger" strokeWidth={2} />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="font-medium text-ink">Tally rejected the last push</div>
              <div className="mt-0.5 text-body">{s.syncNote}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => toast({ kind: "success", message: <>Retrying sync for <b className="font-medium">{s.name}</b></> })}>
              Retry sync
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <DetailStat label="In stock" value={<>{fmtQty(q)} <span className="text-[13px] font-normal text-faint">{s.unit}</span></>} meta={q === 0 ? "Out of stock" : isLow(s) ? "Below reorder level" : "Healthy"} tone={tone} />
          <DetailStat label="Avg rate" value={<Money value={s.rate} decimals />} meta={`per ${s.unit}`} />
          <DetailStat label="Stock value" value={<Money value={valueOf(s)} decimals={false} />} meta="Weighted average" />
          <DetailStat label="Reorder level" value={s.reorder ? <>{fmtQty(s.reorder)} <span className="text-[13px] font-normal text-faint">{s.unit}</span></> : <span className="text-faint">Not set</span>} meta={s.reorder ? `Alert below ${fmtQty(s.reorder)}` : "No alert"} />
        </div>
        <DetailCard title="By godown" aside={`${Object.keys(s.holdings).length} of ${GODOWNS.length} godowns`}>
          <div className="flex flex-col gap-3.5">
            {GODOWNS.map((g) => {
              const n = s.holdings[g]
              return (
                <div key={g} className="grid grid-cols-[160px_minmax(0,1fr)_120px] items-center gap-4">
                  <span className={cn("truncate text-[13px]", n === undefined ? "text-faint" : "text-ink")}>{g}</span>
                  <div className="stock-meter h-2">
                    <span style={{ width: `${((n ?? 0) / maxHold) * 100}%`, background: "var(--brand)" }} />
                  </div>
                  <span className="justify-self-end text-[13px] tabular-nums text-body">
                    {n === undefined ? <span className="text-faint">Not stocked</span> : <>{fmtQty(n)} {s.unit}</>}
                  </span>
                </div>
              )
            })}
          </div>
        </DetailCard>
        <DetailCard title="Item details">
          <InfoGrid
            rows={[
              ["Stock group", stockGroupName(s.group)],
              ["Base unit", s.unit],
              ["HSN / SAC", <span className="code">{s.hsn}</span>],
              ["GST rate", `${s.gstRate}%`],
              ["Costing method", "Weighted average"],
              ["Last movement", s.lastMovement],
            ]}
          />
        </DetailCard>
        <DetailCard title="Recent movements" flush>
          {moves.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-faint">No stock movement this year.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[96px_118px_104px_minmax(0,1fr)_minmax(0,0.8fr)_72px_72px] gap-3 border-b border-line bg-[var(--head-bg)] px-5 py-2.5">
                  {["Date", "Voucher", "Type", "Party", "Godown"].map((h) => (
                    <span key={h} className={COL_HEAD}>
                      {h}
                    </span>
                  ))}
                  <span className={cn(COL_HEAD, "justify-self-end")}>In</span>
                  <span className={cn(COL_HEAD, "justify-self-end")}>Out</span>
                </div>
                {moves.map((m) => (
                  <div key={m.voucherNo + m.date} className="grid grid-cols-[96px_118px_104px_minmax(0,1fr)_minmax(0,0.8fr)_72px_72px] items-center gap-3 px-5 py-2.5 text-[13px] shadow-[inset_0_-1px_0_var(--line)] last:shadow-none">
                    <span className="tabular text-body">{m.date}</span>
                    <span className="code truncate text-body">{m.voucherNo}</span>
                    <span className="truncate text-body">{m.type}</span>
                    <span className="truncate text-ink">{m.party}</span>
                    <span className="truncate text-body">{m.godown}</span>
                    <span className={cn("justify-self-end tabular-nums", m.inQty ? "text-success" : "text-faint")}>{m.inQty ? `+${fmtQty(m.inQty)}` : "—"}</span>
                    <span className={cn("justify-self-end tabular-nums", m.outQty ? "text-ink" : "text-faint")}>{m.outQty ? `−${fmtQty(m.outQty)}` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DetailCard>
      </div>
    </>
  )
}
