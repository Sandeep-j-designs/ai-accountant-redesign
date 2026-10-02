/** The run, once the operator has walked away from it.
 *
 *  RunWatcher is mounted at the app root so the read finishes wherever she
 *  happens to be standing — a run that only completes while you are watching
 *  it is not a background run, it is a progress bar with extra steps.
 *
 *  RunStrip is the thin presence it leaves on the Bills page: the same three
 *  colours as the sheet she left behind, so it reads as the same run rather
 *  than a second thing that started.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useBill } from "@/state/store"
import { ProgressDial } from "@/components/upload/ProgressDial"
import { Button } from "@/components/ui/button"
import { classifyIntake, openIntake } from "@/data/patterns"
import { TOTAL_MS, pileRun, runAt, runRecord, runSpeed } from "@/data/runModel"

/** ticks while a run is live, and ends it exactly once */
export function RunWatcher() {
  const { state, dispatch } = useBill()
  const speed = useMemo(runSpeed, [])
  const done = useRef(false)

  useEffect(() => {
    if (!state.run) return
    done.current = false
    const id = setInterval(() => {
      if (!state.run || done.current) return
      if ((Date.now() - state.run.startedAt) * speed >= TOTAL_MS) {
        done.current = true
        clearInterval(id)
        dispatch({
          type: "EXTRACTION_DONE",
          record: runRecord(state.run.pileId, openIntake([...state.readPiles, state.run.pileId])),
        })
        dispatch({ type: "SET_RECURRING_MODAL", open: true })
      }
    }, 250)
    return () => clearInterval(id)
  }, [state.run, state.readPiles, speed, dispatch])

  return null
}

export function RunStrip() {
  const { state, dispatch } = useBill()
  const speed = useMemo(runSpeed, [])
  const items = useMemo(
    () => classifyIntake(openIntake(state.run ? [...state.readPiles, state.run.pileId] : state.readPiles)),
    [state.readPiles, state.run],
  )
  const byId = useMemo(() => new Map(items.map((c) => [c.bill.id, c])), [items])
  const [, force] = useState(0)

  useEffect(() => {
    if (!state.run) return
    const id = setInterval(() => force((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [state.run])

  if (!state.run) return null

  const r = runAt((Date.now() - state.run.startedAt) * speed, state.run.pileId)
  const { bills, order } = pileRun(state.run.pileId)
  const seen = order.slice(0, r.read).map((i) => byId.get(bills[i].id)!)
  const recurring = seen.filter((c) => c.stratum === "routine").length
  const changed = seen.filter((c) => c.stratum === "changed").length
  const fresh = seen.filter((c) => c.stratum === "new").length
  const total = bills.length

  return (
    <div className="upload-run-strip flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface pr-4">
      <div className="run-strip-dial"><ProgressDial uploaded={r.uploaded} read={r.read} total={total}/></div>
      <span className="text-[13px] text-body">
        {r.phase === "upload" ? (
          <>
            Uploading <b className="font-medium text-ink">{r.uploaded} of {total}</b> documents
          </>
        ) : (
          <>
            Reading <b className="font-medium text-ink">{r.read} of {total}</b> documents
          </>
        )}
        <span className="text-faint"> · about {r.etaSeconds}s left</span>
      </span>

      {/* the same field she left behind, compressed to one line */}
      <span className="flex h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-panel-2/70">
        <span className="bg-success-dot" style={{ width: `${(recurring / total) * 100}%` }} />
        <span className="bg-warning-dot" style={{ width: `${(changed / total) * 100}%` }} />
        <span className="bg-brand-vivid" style={{ width: `${(fresh / total) * 100}%` }} />
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="flex-none"
        onClick={() => dispatch({ type: "SHOW", screen: "entry" })}
      >
        View
      </Button>
    </div>
  )
}
