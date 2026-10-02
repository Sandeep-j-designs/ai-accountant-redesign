/** Uploads — what was sent, when, and what came of it.
 *
 *  One row per RUN, following the decision already taken for sync history
 *  (2026-08-11, "Sync history lists rows by sync run, not by item"). The run is
 *  the unit of the action: one drop of 217 documents is one thing the operator
 *  did, and flattening it to 217 rows would make the history unscannable at
 *  exactly the volume it exists to serve. Run-level state has no per-item
 *  equivalent either — "partially read" describes the job, not any one bill.
 *
 *  Item-level status stays where that decision put it: in the module's own
 *  tables (Needs review, All bills) and inside a run's detail view.
 *
 *  The detail keeps the sheet the operator watched while the run was going —
 *  same cells, same colours, frozen. The thing you waited on becomes the thing
 *  that is filed, so the record is recognisable rather than a fresh table of
 *  numbers describing something you already saw.
 */

import { useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, Loader2, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { Money } from "@/components/bills/Money"
import { Button } from "@/components/ui/button"
import { LIST_SHELL, COL_HEAD, Tag } from "@/components/bills/NeedsReview"
import { classifyIntake, openIntake, pileById } from "@/data/patterns"
import { pileRun, runAt, runSpeed } from "@/data/runModel"
import { runCells, runSize, runStamp, type UploadRun } from "@/data/uploads"

/* when · documents · outcome band · value · state */
const COLS = "grid grid-cols-[minmax(0,1.1fr)_88px_minmax(0,1fr)_128px_112px_24px] items-center gap-3"

export function UploadHistory() {
  const { state, dispatch } = useBill()
  const [openId, setOpenId] = useState<string | null>(null)

  // newest first — the run you just did is the one you are looking for
  const runs = useMemo(() => [...state.uploadRuns].reverse(), [state.uploadRuns])
  const open = runs.find((r) => r.id === openId)

  if (open) return <RunDetail run={open} onBack={() => setOpenId(null)} />

  return (
    <div className="upload-history-workspace flex flex-col gap-3">
      <div className="history-overview"><div className="history-archive-art" aria-hidden="true"><i/><i/><i/><span>DOCUMENT ARCHIVE</span></div><div className="history-overview-copy"><span className="workspace-eyebrow">FROM DOCUMENT TO DECISION</span><h2>Your upload history</h2><div className="history-metrics"><span><b>{runs.reduce((n,r) => n + r.docs, 0).toLocaleString("en-IN")}</b> documents</span><span><b>{runs.length}</b> batches</span><span><b>{runs.reduce((n,r) => n + r.unreadable, 0)}</b> need a re-scan</span></div></div><Button variant="outline" onClick={() => dispatch({ type: "SHOW", screen: "entry" })}>Add bills</Button></div>
      {/* an in-flight run gets a row before it has a record, so the history is
          never briefly missing the thing happening right now */}
      {state.run && <LiveRow />}

      <div className={cn(LIST_SHELL, "upload-history-table")}>
        <div className="min-w-[760px]">
          <div className={cn(COLS, "px-4 pb-3 pt-4")}>
            <span className={COL_HEAD}>Uploaded</span>
            <span className={cn(COL_HEAD, "justify-self-end")}>Documents</span>
            <span className={COL_HEAD}>What came of it</span>
            <span className={cn(COL_HEAD, "justify-self-end")}>Value</span>
            <span className={COL_HEAD}>State</span>
            <span aria-hidden />
          </div>

          {runs.map((r, i) => (
            <Row key={r.id} run={r} tinted={i % 2 === 1} onOpen={() => setOpenId(r.id)} />
          ))}
        </div>
      </div>

      <p className="px-1 text-[12px] text-ink-3">
        {runs.length} uploads on record ·{" "}
        {runs.reduce((n, r) => n + r.docs, 0).toLocaleString("en-IN")} documents
      </p>

      {runs.length > 0 && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispatch({ type: "SHOW", screen: "entry" })}
          >
            Upload more bills
          </Button>
        </div>
      )}
    </div>
  )
}

function LiveRow() {
  const { state, dispatch } = useBill()
  const speed = useMemo(runSpeed, [])
  if (!state.run) return null
  const r = runAt((Date.now() - state.run.startedAt) * speed, state.run.pileId)
  const total = pileRun(state.run.pileId).bills.length
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "SHOW", screen: "entry" })}
      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50"
    >
      <Loader2 className="size-4 flex-none animate-spin text-accent-sig" strokeWidth={2} />
      <span className="flex-1 text-[13px] text-body">
        <b className="font-medium text-ink">Running now</b> ·{" "}
        {r.phase === "upload"
          ? `uploading ${r.uploaded} of ${total}`
          : `reading ${r.read} of ${total}`}
      </span>
      <span className="text-[12px] text-faint">View</span>
    </button>
  )
}

function Row({ run, tinted, onOpen }: { run: UploadRun; tinted: boolean; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Upload of ${run.docs} documents on ${runStamp(run.at)}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        COLS,
        "cursor-pointer p-[var(--pad-cell)] shadow-[inset_0_-1px_0_var(--line)] outline-none",
        tinted && "bg-[#F6F7FB] dark:bg-white/[0.02]",
        "focus-visible:bg-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold leading-tight text-ink">
          {runStamp(run.at)}
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-tight text-faint">
          {run.by} · {runSize(run.bytes)}
          {run.retried > 0 && <> · {run.retried} retried</>}
        </div>
      </div>

      <span className="fig justify-self-end text-[14px] font-semibold text-ink">{run.docs}</span>

      {/* the run's shape, in the same three colours as its sheet */}
      <div className="min-w-0">
        <span className="flex h-1.5 overflow-hidden rounded-full bg-panel-2/70">
          <span className="bg-success-dot" style={{ width: `${(run.recurring / run.docs) * 100}%` }} />
          <span className="bg-warning-dot" style={{ width: `${(run.changed / run.docs) * 100}%` }} />
          <span className="bg-brand-vivid" style={{ width: `${(run.new / run.docs) * 100}%` }} />
        </span>
        <div className="mt-1.5 truncate text-[12px] tabular-nums text-faint">
          {run.recurring} recurring · {run.changed} changed · {run.new} new
        </div>
      </div>

      <Money
        value={run.value}
        decimals={false}
        symbolClassName="text-[14px]"
        className="justify-self-end text-[14px] font-semibold text-ink"
      />

      <span>
        {run.unreadable > 0 ? (
          <Tag tone="amber">{run.unreadable} to re-scan</Tag>
        ) : (
          <Tag tone="green">Read</Tag>
        )}
      </span>

      <ChevronRight className="size-4 justify-self-end text-faint" strokeWidth={2} />
    </div>
  )
}

/* ── one run, in full ─────────────────────────────────────────── */

function RunDetail({ run, onBack }: { run: UploadRun; onBack: () => void }) {
  const { state, dispatch } = useBill()
  const items = useMemo(() => classifyIntake(openIntake(state.readPiles)), [state.readPiles])

  /** A run made this session knows exactly which documents it carried, so its
   *  cells are the real ones in real arrival order. Seeded history holds counts
   *  only — those cells stand for one document each and claim nothing more. */
  const mine = run.pileId ? pileById(run.pileId)?.bills : undefined
  const cells = useMemo(() => {
    if (!mine) return runCells(run)
    const by = new Map(items.map((c) => [c.bill.id, c.stratum]))
    const { order } = pileRun(run.pileId!)
    return order.map((i) => by.get(mine[i].id) ?? "routine")
  }, [mine, items, run])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-sm text-[13px] text-body outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          All uploads
        </button>
        {run.unreadable > 0 && (
          <Button variant="secondary" size="sm" icon={<RotateCw strokeWidth={2} />}>
            Re-scan {run.unreadable}
          </Button>
        )}
      </div>

      <div className={cn(LIST_SHELL, "px-5 py-5")}>
        <p className="eyebrow">Upload</p>
        <h2 className="mt-2 flex items-baseline gap-3 text-left">
          <span className="type-display fig text-ink">{run.docs}</span>
          <span className="type-h3 font-normal text-body">documents</span>
        </h2>
        <p className="mt-2 text-[13px] text-faint">
          {runStamp(run.at)} · {run.by} · {runSize(run.bytes)}
          {run.retried > 0 && <> · {run.retried} files retried after the connection dropped</>}
        </p>

        {/* the sheet as filed — the picture the operator watched being made */}
        <div
          className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(13px,1fr))] gap-[3px]"
          role="img"
          aria-label={`${run.recurring} recurring, ${run.changed} changed, ${run.new} new`}
        >
          {cells.map((c, i) => (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-[2px]",
                c === "routine"
                  ? "bg-success-dot"
                  : c === "changed"
                    ? "bg-warning-dot"
                    : "bg-brand-vivid",
              )}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-px sm:grid-cols-3">
          <Outcome dot="bg-success-dot" n={run.recurring} label="Seen before, nothing changed" />
          <Outcome dot="bg-warning-dot" n={run.changed} label="Known vendor, something changed" />
          <Outcome dot="bg-brand-vivid" n={run.new} label="New vendors, no precedent" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12px] leading-relaxed text-faint">
            Total value{" "}
            <Money value={run.value} decimals={false} className="fig font-medium text-body" /> ·
            every document from this upload is in the register, with its own state.
          </p>
          {run.pileId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "SET_BILLS_TAB", tab: "review" })}
            >
              Open in Needs review
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Outcome({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <div className="py-2 pr-4">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 flex-none rounded-full", dot)} />
        <span className="fig text-[20px] font-semibold text-ink">{n}</span>
      </div>
      <div className="mt-0.5 text-[12px] leading-snug text-faint">{label}</div>
    </div>
  )
}
