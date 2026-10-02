import { Lock, Check, ArrowRight } from "lucide-react"
import {
  useBill,
  isReady,
  flaggedKeys,
  enterChain,
  decisionTotal,
  decisionDone,
  isFactKey,
  isAdditionalKey,
  type Flagged,
} from "@/state/store"
import { cn } from "@/lib/utils"
import { Button, primaryButtonSurface } from "@/components/ui/button"
import { FlagButton } from "./FlagButton"
import { FACTS, type FactKey } from "@/data/invoice"
import { ADDITIONAL_FIELD_MAP } from "@/data/additionalFields"

/**
 * Pinned action bar at the bottom of the verify board. While any decision is
 * open it shows the flow's position + the focused decision's Override/Flag
 * ghosts. Once the board is clean (gate passed) it collapses to a single
 * affirmative — "Review & post →" — that opens the posting checkpoint (§4).
 * The accountable Tally write itself lives in the preview, not here.
 */
export function ActionDock({
  onReview,
  onOverride,
  onFlagPick,
  flagOpen,
  setFlagOpen,
}: {
  /** ready board → open the split-view posting preview */
  onReview: () => void
  onOverride: () => void
  onFlagPick: (to: string) => void
  flagOpen: boolean
  setFlagOpen: (v: boolean) => void
}) {
  const { state } = useBill()
  const ready = isReady(state)
  const flagged = flaggedKeys(state)
  const remaining = enterChain(state).length
  const total = decisionTotal(state)
  const done = decisionDone(state)
  const coreFocus: FactKey | null = isFactKey(state.focus) ? state.focus : null
  const focusLabel =
    state.focus === "commit"
      ? null
      : isAdditionalKey(state.focus)
        ? ADDITIONAL_FIELD_MAP[state.focus].label
        : FACTS[state.focus].label
  const position = Math.min(done + 1, total)

  return (
    <div className="flex-none border-t border-line bg-surface/95 px-12 py-3 shadow-commit-bar backdrop-blur">
      <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
        {/* left — where the flow stands */}
        {ready ? (
          <span className="min-w-0 truncate text-[12.5px] text-muted-ink">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 flex-none text-success" strokeWidth={2.4} />
              <span className="font-medium text-ink">All decisions resolved.</span> Review the posting.
            </span>
          </span>
        ) : remaining > 0 && focusLabel ? (
          <span className="min-w-0 truncate text-[12.5px] text-muted-ink">
            Viewing {position} of {total} · <span className="font-medium text-ink">{focusLabel}</span>
          </span>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-2 text-[12.5px] text-warning">
            <Lock className="size-3.5 flex-none" strokeWidth={1.8} />
            <span className="truncate">
              {flagged.length > 0
                ? `${flagged.length} decision${flagged.length === 1 ? "" : "s"} flagged · ${flagReviewers(state.flagged)}`
                : "Resolve the flagged item below to record"}
            </span>
          </span>
        )}

        {/* right — quiet ghosts · the single affirmative (or a locked stand-in) */}
        <div className="flex flex-none items-center gap-1.5">
          {coreFocus && (
            <>
              <FlagButton
                variant="dock"
                placement="top"
                open={flagOpen}
                onOpenChange={setFlagOpen}
                onPick={onFlagPick}
              />
              {coreFocus !== "totals" && (
                <Button variant="ghost" size="sm" onClick={onOverride} className="text-muted-ink">
                  Override
                </Button>
              )}
              <span className="mx-1 h-6 w-px flex-none bg-line-2" aria-hidden />
            </>
          )}

          {ready ? (
            <button
              type="button"
              onClick={onReview}
              aria-label="Review the posting before it writes to Tally"
              className={cn(
                "inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold",
                primaryButtonSurface,
              )}
            >
              Review &amp; post
              <ArrowRight className="size-3.5 flex-none" strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            <span
              aria-label={`Locked · ${remaining || flagged.length} decision${(remaining || flagged.length) === 1 ? "" : "s"} left`}
              className={cn(
                "inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold opacity-40",
                primaryButtonSurface,
              )}
            >
              <Lock className="size-3.5 flex-none" strokeWidth={2} aria-hidden />
              Post to Tally <span className="tabular-nums">({total})</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function flagReviewers(flagged: Flagged): string {
  const names = Object.values(flagged)
    .filter(Boolean)
    .map((f) => f!.to)
  const uniq = [...new Set(names)]
  if (uniq.length === 1) return `assigned to ${uniq[0]}`
  return `assigned to ${uniq.length} reviewers`
}
