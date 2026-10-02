import { Lock, LockOpen, TriangleAlert } from "lucide-react"
import {
  useBill,
  isReady,
  enterChain,
  decisionTotal,
  decisionDone,
  flaggedExceptions,
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
  const total = decisionTotal(state)
  const done = decisionDone(state)
  const flagged = flaggedExceptions(state)
  const open = enterChain(state).length
  const ready = isReady(state)
  const handled = Math.min(done + flagged, total)

  let lock: { tone: "ready" | "warn" | "lock"; text: string }
  if (ready) {
    lock = { tone: "ready", text: "Ready to record" }
  } else if (state.activeError) {
    lock = {
      tone: "warn",
      text: state.activeError === "dup" ? "Voucher conflict, resolve below" : "Does not reconcile",
    }
  } else if (open > 0) {
    lock = { tone: "lock", text: `Commit locked · ${open} decision${open === 1 ? "" : "s"} open` }
  } else {
    lock = { tone: "warn", text: `Commit locked · ${flagged} flagged for review` }
  }

  return (
    <div className="flex-none border-b border-line bg-surface/95 px-12 py-3 backdrop-blur">
      <div className="mx-auto max-w-[640px]">
        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-[12.5px] text-body">
            <TickNumber value={handled} className="fig font-medium text-ink" />
            <span className="text-faint"> of </span>
            <span className="font-medium tabular-nums text-ink">{total}</span> decisions resolved
            {flagged > 0 && (
              <span className="text-warning"> · {flagged} flagged</span>
            )}
          </span>

          <span
            key={lock.tone}
            className={cn(
              "screen-in inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium",
              lock.tone === "ready" && "text-success",
              lock.tone === "warn" && "text-warning",
              lock.tone === "lock" && "text-faint",
            )}
          >
            {lock.tone === "ready" ? (
              <LockOpen className="unlock-in size-3.5 flex-none" strokeWidth={2.2} />
            ) : lock.tone === "warn" ? (
              <TriangleAlert className="size-3.5 flex-none" strokeWidth={2} />
            ) : (
              <Lock className="size-3 flex-none" strokeWidth={1.8} />
            )}
            <span className="truncate">{lock.text}</span>
          </span>
        </div>

        {/* segmented indicator — one segment per decision. Resolved segments
            fill in the AI accent (the machine's proposals, confirmed); flagged
            ones hold amber; open ones stay empty track. */}
        <div
          className="mt-2 flex w-full gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={handled}
          aria-label={`${handled} of ${total} decisions resolved`}
        >
          {Array.from({ length: total }, (_, i) => {
            const seg = i < done ? "done" : i < done + flagged ? "flagged" : "open"
            return (
              <span
                key={i}
                className={cn(
                  "h-[4px] flex-1 rounded-full transition-colors duration-300",
                  seg === "done" ? "bg-brand-vivid" : seg === "flagged" ? "bg-warning-dot" : "bg-panel-2",
                )}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
