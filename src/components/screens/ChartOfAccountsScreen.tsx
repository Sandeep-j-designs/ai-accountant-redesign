import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  X,
  ListFilter,
  Plus,
  Eye,
  FolderInput,
  Archive,
  Download,
  ListTree,
  List,
  ClipboardCheck,
  RefreshCw,
  CircleSlash,
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
import { useRegister, selection, paginate, initialMasterTab, nextSort } from "@/components/register/useRegister"
import { MasterReview, type MasterReviewRow } from "@/components/register/MasterReview"
import { MasterSplit, DetailHead, DetailStat, DetailCard, InfoGrid, SourceNote } from "@/components/register/MasterSplit"
import {
  LEDGER_GROUPS,
  LEDGER_REVIEWS,
  LEDGER_REVIEW_LABEL,
  NATURE_LABEL,
  effectiveLedgers,
  groupById,
  ledgerVouchers,
  drCr,
  type Ledger,
  type LedgerReviewKind,
} from "@/data/ledgers"

type Tab = "all" | "review"
type SortKey = "name" | "gstin" | "vouchers" | "opening" | "closing" | "sync"
type Scope = "unsynced" | "unused" | null

const COLS = "coa-grid grid items-center gap-4"
const SYNC_RANK = { failed: 0, pending: 1, synced: 2 } as const

const FACETS: Facet[] = [
  { key: "nature", label: "Nature", options: (Object.keys(NATURE_LABEL) as (keyof typeof NATURE_LABEL)[]).map((n) => ({ value: n, label: NATURE_LABEL[n] })) },
  { key: "group", label: "Group", options: LEDGER_GROUPS.map((g) => ({ value: g.id, label: g.name })) },
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

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

/** a signed balance as "₹ 1,84,080.00 Cr" — zero reads as a quiet dash */
function Balance({ value, className }: { value: number; className?: string }) {
  if (value === 0) return <span className={cn("justify-self-end text-[13px] text-faint", className)}>—</span>
  return (
    <span className={cn("inline-flex items-baseline justify-self-end gap-1 whitespace-nowrap", className)}>
      <Money value={Math.abs(value)} decimals symbolClassName="text-[12px]" decimalClassName="text-[11px]" className="text-[14px] font-semibold text-ink" />
      <span className="w-[18px] text-[11px] font-medium text-faint">{drCr(value)}</span>
    </span>
  )
}

export function ChartOfAccountsScreen() {
  const { state } = useBill()
  const toast = useToast()
  const [tab, setTabRaw] = useState<Tab>(() => initialMasterTab<Tab>("all", "review"))
  const [scope, setScope] = useState<Scope>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [returnedId, setReturnedId] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)
  const r = useRegister<SortKey>("aia-coa", { key: "name", dir: 1 })
  const { ref: headerRef, stuck } = useStuck<HTMLDivElement>()

  const ledgers = useMemo(() => effectiveLedgers(state.masterResolved), [state.masterResolved])
  const reviewRows: MasterReviewRow<LedgerReviewKind>[] = useMemo(
    () =>
      LEDGER_REVIEWS.map((x) => ({
        id: x.id,
        kind: x.kind,
        title: x.ledger,
        sub: (
          <>
            {groupById(x.group).name} · <span className="code">{x.source}</span>
          </>
        ),
        reason: x.reason,
        chip: x.chip,
        action: x.action,
        amount: x.amount,
        done:
          x.kind === "new"
            ? `Created ${x.ledger} under ${groupById(x.group).name}`
            : x.kind === "duplicate"
              ? `Merged ${x.ledger} into ${ledgers.find((l) => l.id === x.mergeInto)?.name ?? "the existing ledger"}`
              : x.kind === "regroup"
                ? `Moved ${x.ledger} to ${groupById(x.moveTo!).name}`
                : `Updated ${x.ledger}`,
      })),
    [ledgers],
  )
  const reviewOpen = LEDGER_REVIEWS.filter((x) => !state.masterResolved[x.id]).length

  const unsynced = ledgers.filter((l) => l.sync !== "synced")
  const unused = ledgers.filter((l) => l.vouchers === 0)

  const setTab = (t: Tab) => {
    setDetailId(null)
    r.setSelected(new Set())
    setTabRaw(t)
  }

  // ── filter + sort ──
  const rows = useMemo(() => {
    const q = r.query.trim().toLowerCase()
    const out = ledgers.filter((l) => {
      const g = groupById(l.group)
      if (q && !l.name.toLowerCase().includes(q) && !(l.gstin ?? "").toLowerCase().includes(q) && !g.name.toLowerCase().includes(q)) return false
      if (scope === "unsynced" && l.sync === "synced") return false
      if (scope === "unused" && l.vouchers > 0) return false
      return r.has("nature", g.nature) && r.has("group", l.group) && r.has("sync", l.sync) && r.has("source", l.source)
    })
    const { key, dir } = r.sort
    return out.sort((a, b) => {
      const d =
        key === "name"
          ? a.name.localeCompare(b.name)
          : key === "gstin"
            ? (a.gstin ?? "~").localeCompare(b.gstin ?? "~")
            : key === "vouchers"
              ? a.vouchers - b.vouchers
              : key === "opening"
                ? Math.abs(a.opening) - Math.abs(b.opening)
                : key === "closing"
                  ? Math.abs(a.closing) - Math.abs(b.closing)
                  : SYNC_RANK[a.sync] - SYNC_RANK[b.sync]
      return d * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgers, r.query, r.facets, r.sort, scope])

  const grouped = r.view === "grouped"
  const { safePage, paged } = paginate(rows, r.page, r.pageSize)
  const visible = grouped ? rows : paged
  const sel = selection(r.selected, r.setSelected, visible.map((l) => l.id))
  const toggleSort = (k: SortKey) => r.setSort((s) => nextSort(s, k))

  const clearEverything = () => {
    r.clearAll()
    setScope(null)
  }

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

  const match = useCallback((l: Ledger, q: string) => l.name.toLowerCase().includes(q) || groupById(l.group).name.toLowerCase().includes(q), [])

  if (tab === "all" && detailId) {
    return (
      <MasterSplit
        items={rows}
        initialId={detailId}
        noun="ledger"
        backLabel="All ledgers"
        onBack={(last) => {
          setReturnedId(last)
          setDetailId(null)
        }}
        match={match}
        renderItem={(l, selected) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <span title={l.name} className={cn("min-w-0 truncate text-[13.5px] font-semibold leading-tight", selected ? "text-brand" : "text-ink")}>
                {l.name}
              </span>
              <Balance value={l.closing} className="[&_.fig]:text-[13px]" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-faint">
              <span className="truncate">{groupById(l.group).name}</span>
              <span className="flex-none">·</span>
              <span className="flex-none tabular">{l.vouchers} {l.vouchers === 1 ? "voucher" : "vouchers"}</span>
            </div>
            {l.sync !== "synced" && <SyncPill status={l.sync} note={l.syncNote} className="-ml-2 py-0.5" />}
          </>
        )}
        renderDetail={(l) => <LedgerDetail ledger={l} />}
      />
    )
  }

  const groupsShown = LEDGER_GROUPS.filter((g) => rows.some((l) => l.group === g.id))

  return (
    <div ref={pageRef} className={cn("bills-workspace min-h-full bg-page p-[var(--inset-page)]", r.compact && "density-compact")}>
      <div className="max-w-[1600px]">
        <div className="register-page-heading mb-5 flex items-center justify-between gap-4">
          <div>
            <span className="workspace-eyebrow">ACCOUNTING WORKSPACE</span>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink">Chart of Accounts</h1>
            <p className="mt-1 text-[13px] text-muted-ink">
              {ledgers.length} ledgers in {new Set(ledgers.map((l) => l.group)).size} groups · FY 2026–27
            </p>
          </div>
          <Button size="lg" icon={<Plus strokeWidth={2} />} onClick={() => toast({ message: "New ledger opens Tally's ledger creation, pre-filled from the bill you're on" })}>
            New ledger
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
                  <span className="ml-2 text-[14px] font-normal text-body">ledgers</span>
                </>
              }
              meta={reviewOpen ? "Suggested from your bills" : "You're caught up"}
            />
            <SummaryCard
              label="Not synced to Tally"
              icon={<RefreshCw size={17} />}
              danger={unsynced.some((l) => l.sync === "failed")}
              active={tab === "all" && scope === "unsynced"}
              onClick={() => {
                setTab("all")
                setScope(scope === "unsynced" ? null : "unsynced")
              }}
              value={
                <>
                  {unsynced.length}
                  <span className="ml-2 text-[14px] font-normal text-body">ledgers</span>
                </>
              }
              meta={`${unsynced.filter((l) => l.sync === "failed").length} failed · ${unsynced.filter((l) => l.sync === "pending").length} pending`}
            />
            <SummaryCard
              label="Unused this year"
              icon={<CircleSlash size={17} />}
              active={tab === "all" && scope === "unused"}
              onClick={() => {
                setTab("all")
                setScope(scope === "unused" ? null : "unused")
              }}
              value={
                <>
                  {unused.length}
                  <span className="ml-2 text-[14px] font-normal text-body">ledgers</span>
                </>
              }
              meta="No vouchers since 1 Apr"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <QueueTabs
            tab={tab}
            setTab={setTab}
            tabs={[
              { key: "all", label: "All ledgers", count: ledgers.length },
              { key: "review", label: "Needs review", count: reviewOpen, warn: true },
            ]}
          />
          {tab === "all" && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="list-search">
                <Search className="size-4 text-faint" />
                <input
                  aria-label="Search ledgers"
                  placeholder="Find a ledger…"
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
              {scope === "unsynced" ? "Ledgers not yet in Tally" : "Ledgers with no vouchers this year"} <span className="text-faint">· {rows.length} results</span>
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
              kinds={LEDGER_REVIEW_LABEL}
              noun="ledger"
              eyebrow="SUGGESTED FROM YOUR BILLS"
              blurb="Confirm new ledgers, merge duplicates and fix groups before they reach Tally."
            />
          </div>
        ) : (
          <section className="ledger-scroll" aria-label="Ledgers">
            <div className={cn(LIST_SHELL, "master-table")}>
              {r.selected.size > 0 ? (
                <BulkBar
                  count={r.selected.size}
                  noun="ledger"
                  allSelected={sel.all}
                  indeterminate={sel.some}
                  onToggleAll={sel.toggleAll}
                  onClear={() => r.setSelected(new Set())}
                  actions={[
                    { icon: <FolderInput className="size-3.5" strokeWidth={2} />, label: "Move to group", verb: "queued to move — pick the group in Tally" },
                    { icon: <Download className="size-3.5" strokeWidth={2} />, label: "Export", verb: "exported", kind: "info", undo: false },
                    { icon: <Archive className="size-3.5" strokeWidth={2} />, label: "Archive", verb: "archived" },
                  ]}
                />
              ) : (
                <div ref={headerRef} className={cn(COLS, TABLE_HEAD_ROW, "master-head", stuck && "shadow-1")}>
                  <RowCheck checked={sel.all} indeterminate={sel.some} onChange={sel.toggleAll} label="Select all" />
                  <SortTh label="Ledger" col="name" onSort={toggleSort} sort={r.sort} />
                  <SortTh label="GSTIN" col="gstin" onSort={toggleSort} sort={r.sort} />
                  <SortTh label="Vouchers" col="vouchers" onSort={toggleSort} sort={r.sort} className="justify-self-end" />
                  <SortTh label="Opening" col="opening" onSort={toggleSort} sort={r.sort} className="justify-self-end" />
                  <SortTh label="Closing balance" col="closing" onSort={toggleSort} sort={r.sort} className="justify-self-end" />
                  <SortTh label="Tally sync" col="sync" onSort={toggleSort} sort={r.sort} />
                  <span aria-hidden />
                </div>
              )}

              {rows.length === 0 ? (
                <EmptyState
                  illustration="search"
                  title="No ledgers match"
                  description="Nothing lines up with your search and filters. Try loosening them."
                  cta={{ label: "Clear filters", onClick: clearEverything }}
                />
              ) : grouped ? (
                groupsShown.map((g) => {
                  const inGroup = rows.filter((l) => l.group === g.id)
                  const isOpen = !r.collapsed.has(g.id)
                  return (
                    <div key={g.id}>
                      <GroupRow
                        cols={COLS}
                        labelSpan={5}
                        label={g.name}
                        meta={NATURE_LABEL[g.nature]}
                        count={inGroup.length}
                        open={isOpen}
                        onToggle={() => r.toggleGroup(g.id)}
                        total={<Balance value={inGroup.reduce((n, l) => n + l.closing, 0)} className="[&_.fig]:text-[13px]" />}
                      />
                      {isOpen &&
                        inGroup.map((l) => (
                          <LedgerRow key={l.id} l={l} grouped sel={r.selected.has(l.id)} returned={returnedId === l.id} onToggle={() => sel.toggle(l.id)} onOpen={() => open(l.id)} />
                        ))}
                    </div>
                  )
                })
              ) : (
                paged.map((l) => <LedgerRow key={l.id} l={l} sel={r.selected.has(l.id)} returned={returnedId === l.id} onToggle={() => sel.toggle(l.id)} onOpen={() => open(l.id)} />)
              )}

              {rows.length > 0 && !grouped && (
                <div className="flex justify-end border-t border-line px-5 py-3">
                  <TablePagination
                    page={safePage}
                    pageSize={r.pageSize}
                    total={rows.length}
                    onPage={r.setPage}
                    onPageSize={(s) => {
                      r.setPageSize(s)
                      r.setPage(0)
                    }}
                  />
                </div>
              )}
              {rows.length > 0 && grouped && (
                <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-faint">
                  <span>
                    {rows.length} ledgers in {groupsShown.length} groups
                  </span>
                  <span>Balances as of 30 Jun 2026</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function LedgerRow({
  l,
  grouped,
  sel,
  returned,
  onToggle,
  onOpen,
}: {
  l: Ledger
  grouped?: boolean
  sel: boolean
  returned: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const toast = useToast()
  const g = groupById(l.group)
  return (
    <div
      role="button"
      tabIndex={0}
      data-row-id={l.id}
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
      <RowCheck checked={sel} onChange={onToggle} label={`Select ${l.name}`} />
      <div className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1", grouped && "pl-5")}>
        <span title={l.name} className="w-full truncate text-[14px] font-medium leading-tight text-ink">
          {l.name}
        </span>
        <span className="min-w-0 truncate text-[12px] leading-tight text-faint">
          {grouped ? (l.lastUsed ? `Last used ${l.lastUsed}` : "Not used this year") : g.name}
        </span>
        {l.source === "ai" && (
          <span title={`Created by AI Accountant from ${l.sourceBill}`} className="flex-none whitespace-nowrap rounded-xs bg-accent-wash px-1.5 py-0.5 text-[11px] font-medium leading-none text-accent-sig-ink">
            AI
          </span>
        )}
      </div>
      <span className={cn("truncate text-[12px] tabular-nums", l.gstin ? "code text-body" : "text-faint")}>{l.gstin ?? "—"}</span>
      <span className={cn("justify-self-end text-[13px] tabular-nums", l.vouchers ? "text-body" : "text-faint")}>{l.vouchers}</span>
      <Balance value={l.opening} className="[&_.fig]:font-normal [&_.fig]:text-body" />
      <Balance value={l.closing} />
      <div className="min-w-0">
        <SyncPill status={l.sync} note={l.syncNote} />
      </div>
      <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
        <RowMenu
          label={l.name}
          items={[
            { icon: Eye, label: "View", onClick: onOpen },
            { icon: FolderInput, label: "Move to group", onClick: () => toast({ message: <>Pick a new group for <b className="font-medium">{l.name}</b> in Tally</> }) },
            { icon: Archive, label: "Archive", onClick: () => toast({ message: <>Archived <b className="font-medium">{l.name}</b></>, undo: () => {} }) },
          ]}
        />
      </div>
    </div>
  )
}

function LedgerDetail({ ledger: l }: { ledger: Ledger }) {
  const toast = useToast()
  const g = groupById(l.group)
  const vouchers = ledgerVouchers(l)
  const net = l.closing - l.opening
  return (
    <>
      <DetailHead title={l.name} sync={l.sync} syncNote={l.syncNote} monogram={initials(l.name)} code={g.name} />
      <div className="flex flex-col gap-4 p-6">
        <SourceNote source={l.source} bill={l.sourceBill} />
        {l.sync === "failed" && (
          <div className="flex items-start gap-3 rounded-[10px] border border-danger/25 bg-danger-bg px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 flex-none text-danger" strokeWidth={2} />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="font-medium text-ink">Tally rejected the last push</div>
              <div className="mt-0.5 text-body">{l.syncNote}</div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => toast({ kind: "success", message: <>Retrying sync for <b className="font-medium">{l.name}</b></> })}>
              Retry sync
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <DetailStat label="Opening balance" value={<BalanceFigure value={l.opening} />} meta="1 Apr 2026" />
          <DetailStat label="Net movement" value={<BalanceFigure value={net} />} meta={net === 0 ? "No change" : net > 0 ? "Debit side" : "Credit side"} />
          <DetailStat label="Closing balance" value={<BalanceFigure value={l.closing} />} meta="30 Jun 2026" />
          <DetailStat label="Vouchers this year" value={l.vouchers} meta={l.lastUsed ? `Last on ${l.lastUsed}` : "Not used yet"} />
        </div>
        <DetailCard title="Ledger details">
          <InfoGrid
            rows={[
              ["Group", g.name],
              ["Nature", NATURE_LABEL[g.nature]],
              ["GSTIN", l.gstin && <span className="code">{l.gstin}</span>],
              ["PAN", l.pan && <span className="code">{l.pan}</span>],
              ["State", l.state],
              ["Default GST rate", l.gstRate !== undefined ? `${l.gstRate}%` : undefined],
              ["Maintain bill-by-bill", g.id === "creditors" || g.id === "debtors" ? "Yes" : "No"],
              ["Cost centres", g.nature === "expenses" ? "Applicable" : "Not applicable"],
            ]}
          />
        </DetailCard>
        <DetailCard title="Recent vouchers" aside={vouchers.length ? `${Math.min(vouchers.length, 6)} of ${l.vouchers}` : undefined} flush>
          {vouchers.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-faint">No vouchers posted to this ledger this year.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[96px_132px_88px_minmax(0,1fr)_112px_112px] gap-3 border-b border-line bg-[var(--head-bg)] px-5 py-2.5">
                  {["Date", "Voucher", "Type", "Particulars"].map((h) => (
                    <span key={h} className={COL_HEAD}>
                      {h}
                    </span>
                  ))}
                  <span className={cn(COL_HEAD, "justify-self-end")}>Debit</span>
                  <span className={cn(COL_HEAD, "justify-self-end")}>Credit</span>
                </div>
                {vouchers.map((v) => (
                  <div key={v.voucherNo + v.date} className="grid grid-cols-[96px_132px_88px_minmax(0,1fr)_112px_112px] items-center gap-3 px-5 py-2.5 text-[13px] shadow-[inset_0_-1px_0_var(--line)] last:shadow-none">
                    <span className="tabular text-body">{v.date}</span>
                    <span className="code truncate text-body">{v.voucherNo}</span>
                    <span className="text-body">{v.type}</span>
                    <span className="truncate text-ink">{v.particulars}</span>
                    {v.debit ? <Money value={v.debit} className="justify-self-end text-[13px] text-ink" symbolClassName="text-[11px]" decimalClassName="text-[11px]" /> : <span className="justify-self-end text-faint">—</span>}
                    {v.credit ? <Money value={v.credit} className="justify-self-end text-[13px] text-ink" symbolClassName="text-[11px]" decimalClassName="text-[11px]" /> : <span className="justify-self-end text-faint">—</span>}
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

function BalanceFigure({ value }: { value: number }) {
  if (value === 0) return <span className="text-faint">₹0</span>
  return (
    <span className="inline-flex items-baseline gap-1">
      <Money value={Math.abs(value)} decimals={false} />
      <span className="text-[12px] font-medium text-faint">{drCr(value)}</span>
    </span>
  )
}
