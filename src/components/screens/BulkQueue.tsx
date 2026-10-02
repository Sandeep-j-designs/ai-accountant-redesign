import { useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  Check,
  TriangleAlert,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Button } from "@/components/ui/button"
import { ProgressDial } from "@/components/upload/ProgressDial"
import { Money } from "@/components/bills/Money"
import { BULK_FILES, ISSUE_WORD, type BulkFile } from "@/data/review"

type RowState = "queued" | "reading" | BulkFile["outcome"]

/**
 * The bulk-ingestion queue — every dropped file extracts in parallel and
 * lands in one of three lanes:
 *
 *   clean      → recorded straight to All bills, PENDING sync (no review)
 *   review     → joins the Needs-review queue; batchable issues fold into
 *                the grouped decisions
 *   unreadable → parked for a re-scan; enters nothing
 *
 * Review effort scales with EXCEPTIONS, not uploads: the queue's job is to
 * make most files never need a human at all.
 */
export function BulkQueue({
  filenames,
  onReset,
  onComplete,
}: {
  /** real dropped filenames override the fixture names, position-wise */
  filenames?: string[]
  onReset: () => void
  onComplete?: () => void
}) {
  const { dispatch } = useBill()
  const reduced = useReducedMotion()
  const files = useMemo(
    () =>
      (filenames?.length ? BULK_FILES.slice(0, filenames.length).map((f, i) => ({ ...f, file: filenames[i] })) : BULK_FILES),
    [filenames],
  )

  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(files.map((f) => [f.id, "queued" as RowState])),
  )
  /** files whose retry read succeeded — they display their retry identity */
  const [retried, setRetried] = useState<Set<string>>(new Set())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // simulated parallel read: staggered starts, per-file durations. Each file
  // that lands successfully ingests IMMEDIATELY — clean ones surface in All
  // bills (and the sync badge) while the rest are still reading.
  useEffect(() => {
    const pending = timers.current
    const land = (f: BulkFile) => {
      setStates((s) => ({ ...s, [f.id]: f.outcome }))
      if (f.outcome !== "unreadable") dispatch({ type: "INGEST_BILLS", ids: [f.id] })
    }
    if (reduced) {
      pending.push(setTimeout(() => files.forEach(land), 350))
    } else {
      files.forEach((f, i) => {
        pending.push(
          setTimeout(() => setStates((s) => ({ ...s, [f.id]: "reading" })), 180 + i * 220),
          setTimeout(() => land(f), f.ms),
        )
      })
    }
    return () => pending.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a re-read failed file re-runs the pipeline: back to "reading", then this
  // time the clearer scan comes through clean and ingests like any other
  const retry = (f: BulkFile) => {
    setStates((s) => ({ ...s, [f.id]: "reading" }))
    timers.current.push(
      setTimeout(() => {
        setStates((s) => ({ ...s, [f.id]: "clean" }))
        setRetried((s) => new Set(s).add(f.id))
        dispatch({ type: "INGEST_BILLS", ids: [f.id] })
      }, reduced ? 300 : 1700),
    )
  }

  // counts follow the LIVE row state (a retried file counts as clean)
  const st = (f: BulkFile) => states[f.id]
  const done = files.filter((f) => st(f) === "clean" || st(f) === "review" || st(f) === "unreadable")
  const clean = files.filter((f) => st(f) === "clean")
  const review = files.filter((f) => st(f) === "review")
  const unreadable = files.filter((f) => st(f) === "unreadable")
  const finished = done.length === files.length
  useEffect(() => { if (finished) onComplete?.() }, [finished, onComplete])

  const goReview = () => {
    dispatch({ type: "SET_BILLS_TAB", tab: "review" })
    dispatch({ type: "SHOW", screen: "bills" })
  }
  const goBooks = () => {
    dispatch({ type: "SET_BILLS_TAB", tab: "books" })
    dispatch({ type: "SHOW", screen: "bills" })
  }

  return (
    // text-left resets the page-level text-center (set on the ancestor for
    // the "New bill" heading) so plain-text children here don't inherit
    // centered text — the same fix as ReadingCard in EntryScreen.tsx.
    <div className="batch-queue overflow-hidden rounded-lg border border-line bg-surface text-left">
      <div className="small-batch-hero"><ProgressDial uploaded={files.length} read={done.length} total={files.length} done={finished}/><div><span className="batch-eyebrow">BATCH EXTRACTION</span><h2>{finished ? "Your batch is ready." : "Every bill, accounted for."}</h2><p>{finished ? `${clean.length} recorded · ${review.length} need review · ${unreadable.length} need a new scan` : "Reading documents and separating clear results from decisions."}</p><div className="small-batch-docs" aria-hidden="true">{files.slice(0, 18).map(f => <span key={f.id} className={cn("mini-batch-paper", st(f) === "clean" && "mini-clean", st(f) === "review" && "mini-review")}><i/><i/><i/></span>)}</div></div></div>
      {/* header — live tally of the run */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-divider px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-8 flex-none place-items-center rounded-md bg-panel-2 text-muted-ink">
            <Layers className="size-4" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">
              {finished
                ? `${files.length} documents read`
                : `Reading ${files.length} documents…`}
            </div>
            <div className="mt-0.5 text-[12px] tabular-nums text-muted-ink" aria-live="polite">
              {done.length} of {files.length} read
              {clean.length > 0 && <> · <span className="text-success">{clean.length} recorded</span></>}
              {review.length > 0 && <> · <span className="text-warning">{review.length} need review</span></>}
              {unreadable.length > 0 && <> · <span className="text-danger">{unreadable.length} unreadable</span></>}
            </div>
          </div>
        </div>
        <span className="text-[12px] text-faint">
          Clean reads skip review. They record as pending sync.
        </span>
      </div>

      {/* the queue — one row per file. A retried file presents its retry
          identity (the clearer scan's read). */}
      <div className="[&>*:last-child]:border-b-0">
        {files.map((f) => (
          <QueueRow
            key={f.id}
            file={retried.has(f.id) && f.retry ? { ...f, ...f.retry } : f}
            state={states[f.id]}
            onRetry={f.retry ? () => retry(f) : undefined}
          />
        ))}
      </div>

      {/* run progress — navy accent */}
      <div className="h-[3px] w-full overflow-hidden bg-panel-2/60">
        <div
          className="h-full origin-left bg-brand-vivid ease-out"
          style={{
            transform: `scaleX(${done.length / files.length})`,
            transition: reduced ? "none" : "transform 300ms var(--ease-enter)",
          }}
        />
      </div>

      {/* done — route to the exceptions or the books */}
      {finished && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="flex items-center gap-1.5 text-[12.5px] text-body">
            <span className="grid size-4 place-items-center rounded-full bg-success text-white">
              <Check className="draw-check size-3" strokeWidth={3} />
            </span>
            {clean.length} recorded without review
            {unreadable.length > 0 && (
              <span className="text-faint"> · {unreadable.length} needs a re-scan</span>
            )}
          </span>
          <div className="flex flex-none items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onReset}>
              Upload more
            </Button>
            <Button variant="outline" size="sm" onClick={goBooks}>
              View recorded bills
            </Button>
            {review.length > 0 && (
              <Button size="sm" className="enter-up gap-1.5" onClick={goReview}>
                Review {review.length} {review.length === 1 ? "exception" : "exceptions"}
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function QueueRow({
  file,
  state,
  onRetry,
}: {
  file: BulkFile
  state: RowState
  onRetry?: () => void
}) {
  const reading = state === "reading"
  return (
    <div className="flex items-center gap-3 border-b border-divider px-4 py-2.5">
      {/* status glyph */}
      <span className="grid size-5 flex-none place-items-center">
        {state === "queued" && <Clock className="size-3.5 text-faint" strokeWidth={1.9} />}
        {reading && <Loader2 className="size-3.5 animate-spin text-muted-ink" strokeWidth={2.2} />}
        {state === "clean" && (
          <Check className="enter-up size-4 text-success" strokeWidth={2.6} />
        )}
        {state === "review" && (
          <TriangleAlert className="enter-up size-4 text-warning" strokeWidth={2} />
        )}
        {state === "unreadable" && (
          <AlertCircle className="enter-up size-4 text-danger" strokeWidth={2} />
        )}
      </span>

      {/* filename */}
      <span
        className={cn(
          "code w-[220px] flex-none truncate text-[12px]",
          state === "queued" ? "text-faint" : "text-body",
        )}
      >
        {file.file}
      </span>

      {/* live middle — shimmer while reading, result after */}
      <span className="min-w-0 flex-1 text-[12.5px]">
        {state === "queued" && <span className="text-faint">Waiting…</span>}
        {reading && (
          <span className="dz-shimmer block h-3 w-[46%] rounded bg-panel-2/70" aria-label="Reading" />
        )}
        {state === "clean" && (
          <span className="enter-up block truncate">
            <span className="font-medium text-ink">{file.vendor}</span>
            <span className="text-muted-ink"> · recorded, pending sync</span>
          </span>
        )}
        {state === "review" && (
          <span className="enter-up block truncate">
            <span className="font-medium text-ink">{file.vendor}</span>
            <span className="text-warning">
              {" "}· needs review · {ISSUE_WORD[file.issues![0].type]}
            </span>
          </span>
        )}
        {state === "unreadable" && (
          <span className="enter-up inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-danger">Couldn't read. Try a clearer scan.</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md border border-line-2 bg-surface px-2 py-0.5 text-[12px] font-medium text-body outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2"
              >
                <RefreshCw className="size-3 flex-none" strokeWidth={2} />
                Try again
              </button>
            )}
          </span>
        )}
      </span>

      {/* amount, once known */}
      {(state === "clean" || state === "review") && file.amount > 0 && (
        <Money
          value={file.amount}
          decimals={false}
          className="enter-up flex-none text-[13px] font-medium text-ink"
        />
      )}
    </div>
  )
}
