import { Lock, LockOpen, TriangleAlert } from "lucide-react"
import {
  useBill,
  openCount,
  isReady,
  resolvedExceptions,
  flaggedExceptions,
  DECISION_TOTAL,
} from "@/state/store"
import { cn } from "@/lib/utils"
import { TickNumber } from "./TickNumber"

/**
 * Sticky decision header for the right panel. Always shows how many of the
 * open decisions are resolved, a linear indicator, and the commit-lock state —
 * so the "why can't I commit yet" answer is visible without scrolling.
 */
export function DecisionProgress() {
  const { state } = useBill()
  const total = DECISION_TOTAL
  const done = resolvedExceptions(state)
  const flagged = flaggedExceptions(state)
  const open = openCount(state)
  const ready = isReady(state)
  const handled = Math.min(done + flagged, total)

  const donePct = (done / total) * 100
  const flaggedPct = (flagged / total) * 100

  let lock: { tone: "ready" | "warn" | "lock"; text: string }
  if (ready) {
    lock = { tone: "ready", text: "Ready to record" }
  } else if (state.activeError) {
    lock = {
      tone: "warn",
      text: state.activeError === "dup" ? "Voucher conflict — resolve below" : "Does not reconcile",
    }
  } else if (open > 0) {
    lock = { tone: "lock", text: `Commit locked — ${open} decision${open === 1 ? "" : "s"} open` }
  } else {
    lock = { tone: "warn", text: `Commit locked — ${flagged} flagged for review` }
  }

  return (
    <div className="flex-none border-b border-line bg-surface/95 px-12 py-3 backdrop-blur">
      <div className="mx-auto max-w-[640px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12.5px] text-body">
            <TickNumber value={handled} className="fig font-medium text-ink" />
            <span className="text-faint"> of </span>
            <span className="fig font-medium text-ink">{total}</span> decisions resolved
            {flagged > 0 && (
              <span className="text-warning"> · {flagged} flagged</span>
            )}
          </span>

          <span
            key={lock.tone}
            className={cn(
              "screen-in inline-flex items-center gap-1.5 text-[11.5px] font-medium",
              lock.tone === "ready" && "text-success",
              lock.tone === "warn" && "text-warning",
              lock.tone === "lock" && "text-faint",
            )}
          >
            {lock.tone === "ready" ? (
              <LockOpen className="unlock-in size-3.5" strokeWidth={2.2} />
            ) : lock.tone === "warn" ? (
              <TriangleAlert className="size-3.5" strokeWidth={2} />
            ) : (
              <Lock className="size-3" strokeWidth={1.8} />
            )}
            {lock.text}
          </span>
        </div>

        {/* linear indicator — resolved (blue) then flagged (amber) */}
        <div className="mt-2 flex h-[3px] w-full overflow-hidden rounded-full bg-panel-2">
          <span
            className="h-full bg-accent-sig transition-[width] duration-200 ease-out"
            style={{ width: `${donePct}%` }}
          />
          <span
            className="h-full bg-warning transition-[width] duration-200 ease-out"
            style={{ width: `${flaggedPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
