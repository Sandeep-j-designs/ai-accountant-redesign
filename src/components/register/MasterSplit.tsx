/**
 * A master register as a list + detail split — the ledger / stock-item
 * counterpart of BillsMasterDetail. Scrollable list on the left, the picked
 * record on the right, no page hop between records. Back returns to the
 * full-width table at the row you left from.
 */

import { useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, Pencil, Search, Copy, Archive, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/common/EmptyState"
import { SyncPill } from "@/components/bills/status"
import { RowMenu } from "@/components/register/kit"
import { useToast } from "@/components/common/toast"
import type { MasterSync } from "@/data/ledgers"

export function MasterSplit<T extends { id: string }>({
  items,
  initialId,
  onBack,
  backLabel,
  noun,
  match,
  renderItem,
  renderDetail,
}: {
  items: T[]
  initialId: string | null
  onBack: (lastId: string | null) => void
  backLabel: string
  /** singular — "ledger", "item" */
  noun: string
  match: (item: T, q: string) => boolean
  renderItem: (item: T, selected: boolean) => ReactNode
  renderDetail: (item: T) => ReactNode
}) {
  const [query, setQuery] = useState("")
  const [raw, setRaw] = useState(initialId)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((i) => match(i, q)) : items
  }, [items, query, match])
  // the pick falls back to the first row when it filters away — the detail
  // pane is never blank while records exist
  const selected = rows.find((r) => r.id === raw) ?? rows[0] ?? null

  return (
    <div className="register-detail-workspace flex h-full min-h-0 overflow-hidden bg-surface">
      <div className="register-detail-list flex h-full min-h-0 w-[300px] flex-none flex-col border-r border-line">
        <div className="flex-none border-b border-line p-3">
          <button
            type="button"
            onClick={() => onBack(selected?.id ?? null)}
            className="mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-ink outline-none transition-colors hover:text-ink focus-visible:text-ink"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            {backLabel}
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun}s…`}
              aria-label={`Search ${noun}s`}
              className="h-9 w-full rounded-md border border-line-2 bg-surface pl-8 pr-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
          </div>
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            {rows.length} {noun}
            {rows.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRaw(r.id)}
              aria-current={selected?.id === r.id}
              className={cn(
                "relative flex w-full flex-col gap-1.5 border-b border-line px-4 py-3 text-left outline-none transition-colors",
                selected?.id === r.id ? "bg-brand-tint" : "hover:bg-row-hover",
              )}
            >
              {selected?.id === r.id && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
              {renderItem(r, selected?.id === r.id)}
            </button>
          ))}
          {rows.length === 0 && (
            <EmptyState
              illustration="search"
              title={`No ${noun}s match`}
              description="Nothing lines up with your search."
              cta={{ label: "Clear search", onClick: () => setQuery("") }}
            />
          )}
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-page">{selected && renderDetail(selected)}</div>
    </div>
  )
}

/* ── detail-pane building blocks ──────────────────────────────── */

/** the record's header — monogram, name, code, sync, and Edit / ⋯ */
export function DetailHead({
  title,
  code,
  sync,
  syncNote,
  monogram,
  tags,
}: {
  title: string
  code?: string
  sync: MasterSync
  syncNote?: string
  monogram: string
  tags?: ReactNode
}) {
  const toast = useToast()
  return (
    <div className="sticky top-0 z-10 flex flex-none items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-panel-2 text-[11px] font-semibold text-muted-ink">
          {monogram}
        </span>
        <span className="truncate text-[14px] font-semibold text-ink" title={title}>
          {title}
        </span>
        {code && <span className="code flex-none text-[13px] text-faint">{code}</span>}
        <SyncPill status={sync} note={syncNote} className="flex-none" />
        {tags}
      </div>
      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          aria-label="Edit"
          title="Edit"
          onClick={() => toast({ message: <>Editing <b className="font-medium">{title}</b> opens in Tally's alter screen</> })}
          className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <Pencil className="size-4" strokeWidth={2} />
        </button>
        <RowMenu
          label={title}
          items={[
            { icon: Download, label: "Export", onClick: () => toast({ kind: "info", message: <>Exported <b className="font-medium">{title}</b></> }) },
            { icon: Copy, label: "Duplicate", onClick: () => toast({ kind: "success", message: <>Duplicated <b className="font-medium">{title}</b></> }) },
            { icon: Archive, label: "Archive", onClick: () => toast({ message: <>Archived <b className="font-medium">{title}</b></>, undo: () => {} }) },
          ]}
        />
      </div>
    </div>
  )
}

/** one figure card in the detail pane's stat row */
export function DetailStat({ label, value, meta, tone }: { label: string; value: ReactNode; meta?: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line bg-surface px-4 py-3.5">
      <div className="text-[12px] font-medium text-body">{label}</div>
      <div className={cn("mt-1.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink")}>
        {value}
      </div>
      {meta && <div className="mt-1 truncate text-[12px] text-muted-ink">{meta}</div>}
    </div>
  )
}

/** a titled white card in the detail pane */
export function DetailCard({ title, aside, children, flush }: { title: string; aside?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {aside && <span className="text-[12px] text-faint">{aside}</span>}
      </header>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  )
}

/** label / value pairs in a two-column grid */
export function InfoGrid({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-faint">{k}</dt>
          <dd className="mt-0.5 truncate text-[13.5px] text-ink">{v ?? <span className="text-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

/** where a master came from — a quiet line under the header */
export function SourceNote({ source, bill }: { source: "tally" | "user" | "ai"; bill?: string }) {
  return (
    <p className="text-[12px] text-faint">
      {source === "ai" ? (
        <>
          Created by AI Accountant from <span className="code text-body">{bill}</span>
        </>
      ) : source === "user" ? (
        "Created by hand in AI Accountant"
      ) : (
        "Imported from Tally"
      )}
    </p>
  )
}
