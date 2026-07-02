import { Lock } from "lucide-react"
import { useBill, openCount, isReady, flaggedKeys, DECISION_TOTAL, type Flagged } from "@/state/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FlagButton } from "./FlagButton"
import { FACTS, type FactKey } from "@/data/invoice"

/**
 * Pinned action bar at the bottom of the right panel. It mirrors the actions
 * for the *focused* decision so they never scroll out of view, and flips to
 * the commit affordance once every decision is resolved.
 */
export function ActionDock({
  committing,
  onAccept,
  onOverride,
  onThrow,
  onFlagPick,
  flagOpen,
  setFlagOpen,
}: {
  committing: boolean
  onAccept: () => void
  onOverride: () => void
  onThrow: () => void
  onFlagPick: (to: string) => void
  flagOpen: boolean
  setFlagOpen: (v: boolean) => void
}) {
  const { state } = useBill()
  const open = openCount(state)
  const ready = isReady(state)
  const flagged = flaggedKeys(state)
  const focusKey: FactKey | null = state.focus !== "commit" ? (state.focus as FactKey) : null

  return (
    <div className="flex-none border-t border-line bg-surface/95 px-12 py-3 shadow-lift backdrop-blur">
      <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
        {ready ? (
          <>
            <span className="min-w-0 text-[12.5px] text-body">
              <span className="font-medium text-ink">All decisions resolved.</span>{" "}
              <span className="text-muted-ink">Review the entry, then record.</span>
            </span>
            <PostToBooks ready committing={committing} onThrow={onThrow} />
          </>
        ) : open > 0 && focusKey ? (
          <>
            <span className="min-w-0 truncate text-[12.5px] text-muted-ink">
              Current — <span className="font-medium text-ink">{FACTS[focusKey].label}</span>
            </span>
            <div className="flex flex-none items-center gap-2.5">
              <FlagButton
                variant="dock"
                placement="top"
                open={flagOpen}
                onOpenChange={setFlagOpen}
                onPick={onFlagPick}
              />
              {focusKey !== "totals" && (
                <Button variant="outline" onClick={onOverride} className="min-w-[92px] px-4 text-body">
                  Override
                </Button>
              )}
              <Button onClick={onAccept} className="min-w-[92px] px-4">
                Accept
              </Button>
              <span className="mx-0.5 h-6 w-px flex-none bg-line-2" aria-hidden />
              <PostToBooks ready={false} committing={false} onThrow={onThrow} />
            </div>
          </>
        ) : (
          // no open decisions, but not ready — flagged and/or an active error
          <>
            <span className="inline-flex min-w-0 items-center gap-2 text-[12.5px] text-warning">
              <Lock className="size-3.5 flex-none" strokeWidth={1.8} />
              <span className="truncate">
                {flagged.length > 0
                  ? `${flagged.length} decision${flagged.length === 1 ? "" : "s"} flagged — ${flagReviewers(state.flagged)}`
                  : "Resolve the flagged item below to record"}
              </span>
            </span>
            <PostToBooks ready={false} committing={false} onThrow={onThrow} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The single, final commit affordance — always the same physical button
 * across every dock state. Locked-gray while any decision is open or
 * flagged; transitions (color only, 200ms) to active indigo the instant
 * every decision resolves. Clicking while ready starts the forcing-function
 * confirm summary in <CommitZone>, then actually records.
 */
function PostToBooks({
  ready,
  committing,
  onThrow,
}: {
  ready: boolean
  committing: boolean
  onThrow: () => void
}) {
  return (
    <button
      type="button"
      disabled={!ready || committing}
      onClick={ready ? onThrow : undefined}
      aria-label={ready ? `Post to books — ${DECISION_TOTAL} decisions` : `Post to books — locked until ${DECISION_TOTAL} decisions resolve`}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-colors duration-200 ease-out disabled:cursor-not-allowed",
        ready
          ? "bg-accent-sig text-accent-sig-contrast hover:bg-accent-hover"
          : "bg-panel-2 text-body", // text-body, not text-faint — 4.5:1 against panel-2 in both themes
      )}
    >
      {!ready && <Lock className="size-3.5 flex-none" strokeWidth={1.8} />}
      {committing ? "Recording…" : <>Post to books <span className="tabular-nums">({DECISION_TOTAL})</span></>}
    </button>
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
