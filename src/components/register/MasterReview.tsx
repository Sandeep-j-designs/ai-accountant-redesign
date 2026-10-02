/** Needs review for masters — the ledger and stock-item counterpart of the
 *  Bills review queue.
 *
 *  Every row is one thing the AI stopped on, with the one fix it proposes.
 *  The primary button applies that fix; × keeps things as they are. Either
 *  way the row leaves the queue — and stays reversible from the strip below
 *  the table until the next sync, the same promise the Bills queue makes.
 */

import { useMemo, useState, type ReactNode } from "react"
import { Check, ChevronRight, Undo2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { Money } from "@/components/bills/Money"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { LIST_SHELL, COL_HEAD, Tag } from "@/components/bills/NeedsReview"

export interface MasterReviewRow<K extends string> {
  id: string
  kind: K
  title: string
  /** quieter second line — group, vendor · bill no */
  sub: ReactNode
  reason: string
  chip: string
  /** primary button label — "Create ledger", "Merge", "Map to item" */
  action: string
  amount: number
  /** past-tense outcome for the toast — "Created ABCom Technologies" */
  done: string
}

const COLS = "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)_150px_112px_minmax(150px,auto)] items-center gap-4"

/** tag tone per kind — new is accent, everything that corrects an existing
 *  master is amber */
const toneFor = (kind: string): "accent" | "amber" => (kind === "new" ? "accent" : "amber")
const dotFor = (kind: string) => (kind === "new" ? "kind-new" : "kind-changed")

export function MasterReview<K extends string>({
  rows,
  kinds,
  noun,
  eyebrow,
  blurb,
}: {
  rows: MasterReviewRow<K>[]
  kinds: Record<K, string>
  /** singular — "ledger", "item" */
  noun: string
  eyebrow: string
  blurb: string
}) {
  const { state, dispatch } = useBill()
  const toast = useToast()
  const [kindFilter, setKindFilter] = useState<K | "all">("all")

  const open = rows.filter((r) => !state.masterResolved[r.id])
  const resolved = rows.filter((r) => state.masterResolved[r.id])
  const view = kindFilter === "all" ? open : open.filter((r) => r.kind === kindFilter)
  const counts = useMemo(() => {
    const c = {} as Record<K, number>
    for (const k of Object.keys(kinds) as K[]) c[k] = open.filter((r) => r.kind === k).length
    return c
  }, [open, kinds])

  const resolve = (targets: MasterReviewRow<K>[], how: "accepted" | "dismissed") => {
    const ids = targets.map((r) => r.id)
    dispatch({ type: "RESOLVE_MASTER", ids, how })
    const undo = () => dispatch({ type: "UNRESOLVE_MASTER", ids })
    if (targets.length === 1) {
      const r = targets[0]
      toast({
        kind: how === "accepted" ? "success" : "info",
        message: how === "accepted" ? r.done : <>Kept <b className="font-medium">{r.title}</b> as it is</>,
        undo,
      })
    } else {
      toast({ kind: "success", message: `Applied ${targets.length} suggestions`, undo })
    }
  }

  if (open.length === 0 && resolved.length === 0) {
    return (
      <EmptyState
        illustration="caughtup"
        title="You're all caught up"
        description={`No ${noun}s need your review right now. New ones read off bills will land here.`}
      />
    )
  }

  return (
    <div className="review-queue-workspace flex flex-col gap-4">
      {open.length > 0 ? (
        <div className="review-queue-intro">
          <div className="queue-paper-icon" aria-hidden="true">
            <i />
            <i />
            <span>✓</span>
          </div>
          <div>
            <span className="workspace-eyebrow">{eyebrow}</span>
            <h2>
              {open.length} {noun}
              {open.length === 1 ? "" : "s"} to review
            </h2>
            <p>{blurb}</p>
          </div>
          <Button onClick={() => resolve(view, "accepted")}>
            Accept {view.length === open.length ? "all" : view.length} <ChevronRight size={15} />
          </Button>
        </div>
      ) : (
        <EmptyState illustration="caughtup" title="You're all caught up" description="Everything here has been decided. Undo any of it below until the next sync." className="py-8" />
      )}

      {open.length > 0 && (
        <div className="review-kind-filters" aria-label="Filter review queue">
          <button aria-pressed={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            <span className="kind-dot kind-all" />
            All
            <b>{open.length}</b>
          </button>
          {(Object.keys(kinds) as K[])
            .filter((k) => counts[k] > 0)
            .map((k) => (
              <button key={k} aria-pressed={kindFilter === k} onClick={() => setKindFilter(k)}>
                <span className={cn("kind-dot", dotFor(k))} />
                {kinds[k]}
                <b>{counts[k]}</b>
              </button>
            ))}
        </div>
      )}

      {open.length > 0 && (
        <section>
          <div className={cn(LIST_SHELL, "review-queue-table")}>
            <div className="min-w-[860px]">
              <div className={cn(COLS, "min-h-12 rounded-t-lg border-b border-line bg-[var(--head-bg)] px-4 py-3")}>
                <span className={COL_HEAD}>{noun === "ledger" ? "Ledger" : "Bill line"}</span>
                <span className={COL_HEAD}>Why it's here</span>
                <span className={COL_HEAD}>Suggestion</span>
                <span className={cn(COL_HEAD, "justify-self-end")}>Amount</span>
                <span aria-hidden />
              </div>
              {view.map((r, i) => (
                <div
                  key={r.id}
                  className={cn(
                    COLS,
                    "min-h-16 p-[var(--pad-cell)] shadow-[inset_0_-1px_0_var(--line)] transition-colors last:rounded-b-lg last:shadow-none hover:bg-row-hover",
                    i % 2 === 1 && "bg-[var(--row-stripe)]",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold leading-tight text-ink" title={r.title}>
                      {r.title}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] leading-tight text-faint">{r.sub}</div>
                  </div>
                  <span className="line-clamp-2 text-[13px] leading-snug text-body" title={r.reason}>
                    {r.reason}
                  </span>
                  <span className="whitespace-nowrap [&>span]:h-7 [&>span]:text-[12px]">
                    <Tag tone={toneFor(r.kind)}>{r.chip}</Tag>
                  </span>
                  <Money value={r.amount} decimals={false} symbolClassName="text-[14px]" className="justify-self-end text-[14px] font-semibold text-ink" />
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => resolve([r], "accepted")}>
                      {r.action}
                    </Button>
                    <button
                      type="button"
                      aria-label={`Keep ${r.title} as it is`}
                      title="Keep as it is"
                      onClick={() => resolve([r], "dismissed")}
                      className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-panel-2 hover:text-ink"
                    >
                      <X className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="px-1 pt-3 text-[12px] text-ink-3">
            {open.length} open ·{" "}
            {(Object.keys(kinds) as K[])
              .filter((k) => counts[k] > 0)
              .map((k) => `${counts[k]} ${kinds[k].toLowerCase()}`)
              .join(" · ")}
          </p>
        </section>
      )}

      {resolved.length > 0 && <ResolvedStrip rows={resolved} noun={noun} />}
    </div>
  )
}

/** what has been decided this session, each individually reversible */
function ResolvedStrip<K extends string>({ rows, noun }: { rows: MasterReviewRow<K>[]; noun: string }) {
  const { state, dispatch } = useBill()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const accepted = rows.filter((r) => state.masterResolved[r.id] === "accepted").length

  return (
    <div className="rounded-lg border border-line bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50"
      >
        <Check className="size-4 flex-none text-success" strokeWidth={2.4} />
        <span className="text-[13px] text-body">
          <b className="font-medium text-ink">
            {rows.length} {noun}
            {rows.length === 1 ? "" : "s"}
          </b>{" "}
          decided this session · {accepted} accepted · pending sync to Tally
        </span>
        <ChevronRight className={cn("ml-auto size-3.5 flex-none text-faint transition-transform duration-150", open && "rotate-90")} strokeWidth={2} />
      </button>
      {open && (
        <div className="border-t border-line">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_120px_96px] items-center gap-3 px-4 py-2 shadow-[inset_0_-1px_0_var(--line)] last:shadow-none">
              <span className="truncate text-[13px] text-ink">{r.title}</span>
              <span className="text-[12px] text-faint">{state.masterResolved[r.id] === "accepted" ? r.action : "Kept as is"}</span>
              <span className="justify-self-end">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Undo2 strokeWidth={2} />}
                  onClick={() => {
                    dispatch({ type: "UNRESOLVE_MASTER", ids: [r.id] })
                    toast({ message: <>Returned <b className="font-medium">{r.title}</b> to the queue</> })
                  }}
                >
                  Undo
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
