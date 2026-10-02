/** The month, as a sheet.
 *
 *  ── the concept ────────────────────────────────────────────────
 *  A file list with a progress bar is what every uploader looks like, and it
 *  tells the operator the one thing she already knows: it is not finished yet.
 *  This shows her the actual object instead — 217 cells, one per document,
 *  laid out like a sheet of vouchers on a desk.
 *
 *  Cells fill as bytes land, then take a colour as each document is read:
 *  green for billed-before, amber for changed, indigo for a vendor with no
 *  precedent. So the wait is not dead time — it is the sort happening in front
 *  of her, and the sort is the whole product. By the end the sheet IS the
 *  month, a speckled field that is overwhelmingly green, and the summary modal
 *  that follows simply puts numbers to a picture she has already read. Same
 *  three colours in both, so the wait and the answer are one thought.
 *
 *  It also earns its keep against this product's real constraints: per-file
 *  status is a hard requirement (every cell IS a file, and the stuck one goes
 *  amber where a bar would just stop), and 217 cells transitioning a paint
 *  property costs a contended Windows laptop far less than 217 rows entering
 *  and leaving a list.
 *
 *  ── leaving ────────────────────────────────────────────────────
 *  The run is store state, so "Continue in the background" is real: the
 *  operator goes back to Bills, a strip there keeps the count, and the summary
 *  finds her when the read lands. Nobody should have to watch a progress bar
 *  for the privilege of using the product.
 */

import { useEffect, useMemo, useState } from "react"
import { Check, ArrowRight, RotateCw, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Button } from "@/components/ui/button"
import { ProgressDial } from "@/components/upload/ProgressDial"
import { Money } from "@/components/bills/Money"
import { classifyIntake, openIntake, PILES } from "@/data/patterns"
import { TOTAL_MS, fileSize, pileRun, runAt, runRecord, runSpeed } from "@/data/runModel"

export function ExtractionRun({
  filenames,
  onReset,
  onComplete,
}: {
  filenames?: string[]
  onReset: () => void
  onComplete?: () => void
}) {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()
  const speed = useMemo(runSpeed, [])

  /** a run carries the next upload nobody has read yet */
  const [pileId] = useState(() => state.run?.pileId ?? PILES.find((p) => !state.readPiles.includes(p.id))?.id ?? null)

  /** Classified against every OPEN upload, not this pile alone — a bill can
   *  be a duplicate of one still waiting in an earlier pile, and a per-pile
   *  pass cannot see that. */
  const items = useMemo(
    () => classifyIntake(openIntake([...state.readPiles, ...(pileId ? [pileId] : [])])),
    [state.readPiles, pileId],
  )
  const byId = useMemo(() => new Map(items.map((c) => [c.bill.id, c])), [items])

  /** documents in arrival order, paired with what the read will make of them */
  const feed = useMemo(() => {
    if (!pileId) return []
    const { bills, order } = pileRun(pileId)
    return order.map((i, pos) => ({
      doc: { ...bills[i], file: filenames?.[pos] ?? bills[i].file },
      cls: byId.get(bills[i].id)!,
    }))
  }, [filenames, byId, pileId])
  const total = feed.length

  // the run belongs to the session, not to this screen
  useEffect(() => {
    if (!state.run && pileId) dispatch({ type: "START_RUN", pileId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [, force] = useState(0)
  const [inspected, setInspected] = useState<string | null>(null)
  useEffect(() => {
    if (!state.run) return
    const timer = setInterval(() => force(n => n + 1), 120)
    return () => clearInterval(timer)
  }, [state.run])

  const elapsed = state.run
    ? (Date.now() - state.run.startedAt) * speed
    : pileId && state.readPiles.includes(pileId) ? TOTAL_MS : 0

  const r = runAt(elapsed, pileId ?? "u1")
  useEffect(() => { if (r.phase === "done") onComplete?.() }, [r.phase, onComplete])

  const seen = feed.slice(0, r.read).map((f) => f.cls)
  const recurring = seen.filter((c) => c.stratum === "routine").length
  const changed = seen.filter((c) => c.stratum === "changed").length
  const fresh = seen.filter((c) => c.stratum === "new").length
  const value = seen.reduce((n, c) => n + c.bill.amount, 0)

  const finish = () => {
    dispatch({
      type: "EXTRACTION_DONE",
      record: runRecord(
        pileId ?? "u1",
        openIntake([...state.readPiles, ...(pileId ? [pileId] : [])]),
      ),
    })
    dispatch({ type: "SET_BILLS_TAB", tab: "review" })
    dispatch({ type: "SHOW", screen: "bills" })
    dispatch({ type: "SET_RECURRING_MODAL", open: true })
  }

  /** the one file the numbers are currently about — per-file status in a line
   *  rather than in 217 rows */
  const current = (inspected ? feed.find(f => f.doc.id === inspected) : null) ?? (r.phase === "upload" ? feed[Math.min(r.uploaded, total - 1)] : feed[Math.max(0, r.read - 1)])

  const currentIndex = feed.findIndex(f => f.doc.id === current?.doc.id)
  const currentRead = currentIndex >= 0 && currentIndex < r.read
  const currentStatus = currentRead ? current?.cls.stratum === "routine" ? "Seen before" : current?.cls.stratum === "changed" ? "Changed details" : "New vendor" : currentIndex < r.uploaded ? "Awaiting extraction" : "Waiting to upload"

  if (!pileId) {
    return (
      <div className="animate-seat rounded-lg border border-line bg-surface px-4 py-6 text-center shadow-card">
        <p className="text-[13px] text-body">Every upload in this demo has been read.</p>
        <p className="mt-1 text-[12px] text-faint">
          Refresh to start the month over.
        </p>
      </div>
    )
  }

  return (
    <div className="batch-run overflow-hidden rounded-lg border border-line bg-surface text-left">
      <div className="batch-observatory">
        <aside className="batch-summary">
          <span className="batch-eyebrow">DOCUMENT PROCESSING</span>
          <ProgressDial uploaded={r.uploaded} read={r.read} total={total} done={r.phase === "done"}/>
          <h2>{r.phase === "done" ? "Ready for review" : r.phase === "upload" ? "Bringing it all in." : `Making sense of
the paperwork.`}</h2>
          <p aria-live="polite">{r.phase === "upload" ? `${r.uploaded} of ${total} files uploaded` : `${r.read} of ${total} documents read`}</p>
          <div className="batch-track-legend"><span><i/> Uploaded</span><span><i/> Extracted</span></div>
          <div className="batch-outcomes">
            <div><span className="outcome-dot outcome-routine"/>Seen before<b>{recurring}</b></div>
            <div><span className="outcome-dot outcome-changed"/>Changed details<b>{changed}</b></div>
            <div><span className="outcome-dot outcome-new"/>New vendors<b>{fresh}</b></div>
          </div>
          {r.phase !== "upload" && <div className="batch-value"><span>VALUE READ SO FAR</span><Money value={value} decimals={false}/></div>}
        </aside>
        <div className="batch-document-map">
          <div className="batch-map-heading"><div><h3>Your document batch</h3><span>Each tile is a bill. Select one to inspect its status.</span></div><b>{total}<span>documents</span></b></div>
          <div className="batch-tile-grid" aria-label="Documents in this batch">
            {feed.map((f, i) => {
              const isRead = i < r.read
              const isStuck = r.stalled !== null && i === r.uploaded
              const status = isRead ? f.cls.stratum === "routine" ? "Seen before" : f.cls.stratum === "changed" ? "Changed details" : "New vendor" : isStuck ? "Retrying upload" : i < r.uploaded ? "Uploaded, awaiting extraction" : "Waiting to upload"
              return <button key={f.doc.id} type="button" title={`${f.doc.file} · ${status}`} aria-label={`${f.doc.file}: ${status}`} aria-pressed={inspected === f.doc.id} onClick={() => setInspected(f.doc.id)} className={cn("batch-document-tile", isRead ? `tile-${f.cls.stratum}` : isStuck ? "tile-stalled" : i < r.uploaded ? "tile-uploaded" : "tile-waiting", inspected === f.doc.id && "tile-selected")}><span/><span/><span/></button>
            })}
          </div>
          <div className="batch-map-footer"><span>{r.stalled !== null ? "Connection interrupted. Retrying this file automatically." : r.phase === "upload" ? `${fileSize(r.bytesDone)} / ${fileSize(r.totalBytes)}` : `${r.read} extracted · ${total - r.read} remaining`}</span><span>{r.phase === "done" ? "Complete" : `About ${r.etaSeconds}s left`}</span></div>
        </div>
      </div>

      {/* the file those numbers are currently about */}
      <div className="batch-current-file flex items-center gap-2.5 border-t border-divider px-5 py-3 text-[12.5px]">
        {r.stalled !== null && !inspected ? (
          <RotateCw
            className={cn("size-3.5 flex-none text-warning", !reduced && "animate-spin")}
            strokeWidth={2.2}
          />
        ) : currentRead ? (
          <Check className="size-3.5 flex-none text-success" strokeWidth={2.4} />
        ) : <FileText className="size-3.5 flex-none text-faint" />}
        <span className="min-w-0 flex-1 truncate text-body">{current?.doc.file}</span>
        {inspected && <button className="text-brand text-[12px]" onClick={() => setInspected(null)}>Follow live</button>}
        <span className="text-[11px] text-faint">{currentStatus}</span>
        {!currentRead ? (
          <span className="flex-none tabular-nums text-faint">{fileSize(r.sizes[Math.max(0, currentIndex)] ?? 0)}</span>
        ) : (
          <>
            <span className="flex-none truncate text-faint">{current?.doc.vendor}</span>
            <Money
              value={current?.doc.amount ?? 0}
              decimals={false}
              className="fig flex-none text-body"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        {r.phase === "done" ? (
          <>
            <span className="text-[12.5px] text-body">
              {recurring} of {total} have been billed before
            </span>
            <div className="flex flex-none items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onReset}>
                Upload more
              </Button>
              <Button size="sm" className={cn("gap-1.5", !reduced && "enter-up")} onClick={finish}>
                Continue
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-[12.5px] text-faint">
              You don't have to wait here — we'll keep reading.
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="flex-none gap-1.5"
              onClick={() => {
                dispatch({ type: "SET_BILLS_TAB", tab: "books" })
                dispatch({ type: "SHOW", screen: "bills" })
              }}
            >
              Continue in the background
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
