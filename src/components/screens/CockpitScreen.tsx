import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { openReviewItems, COCKPIT_REVIEW_ID } from "@/data/review"
import { Button } from "@/components/ui/button"
import { CodingCockpitScreen } from "@/components/screens/CodingCockpitScreen"

/**
 * The bill detail screen — one bill at a time, with Prev/Next to walk the
 * Needs-review list in place. The list is snapshotted once on entry so
 * recording bill 1 never reshuffles bill 2's position underneath you;
 * navigating never leaves this screen or drops back to the Needs-review tab.
 */
export function CockpitScreen() {
  const { state, dispatch } = useBill()
  const [items] = useState(() => openReviewItems(state.postedReviewIds, state.ingestedIds))

  const activeId = state.reviewBillId ?? COCKPIT_REVIEW_ID
  const foundIndex = items.findIndex((i) => i.billId === activeId)
  const index = foundIndex === -1 ? 0 : foundIndex
  const bill = items[index]
  const isLast = index === items.length - 1

  const exitToList = useCallback(() => {
    dispatch({ type: "SET_BILLS_TAB", tab: "review" })
    dispatch({ type: "SHOW", screen: "bills" })
  }, [dispatch])

  const goTo = useCallback(
    (i: number) => dispatch({ type: "SET_REVIEW_BILL", billId: items[i].billId }),
    [dispatch, items],
  )
  const goNext = useCallback(() => (isLast ? exitToList() : goTo(index + 1)), [isLast, exitToList, goTo, index])
  const goPrev = useCallback(() => index > 0 && goTo(index - 1), [index, goTo])

  // [ / ] walk the review queue — only when focus is inside the cockpit
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return
      if (!rootRef.current || !rootRef.current.contains(document.activeElement)) return
      if (e.key === "]") { e.preventDefault(); goNext() }
      else if (e.key === "[") { e.preventDefault(); goPrev() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      <BillNavBar
        index={index}
        total={items.length}
        canPrev={index > 0}
        canNext={!isLast}
        onPrev={goPrev}
        onNext={goNext}
        onExit={exitToList}
      />
      <div className="min-h-0 flex-1">
        {/* every needs-review bill uses the line-centric coding cockpit */}
        {!bill ? null : (
          <CodingCockpitScreen key={bill.billId} bill={bill} isLast={isLast} onAdvance={goNext} />
        )}
      </div>
    </div>
  )
}

function BillNavBar({
  index,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onExit,
}: {
  index: number
  total: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}) {
  return (
    <div className="review-navigation flex flex-none items-center justify-between gap-3 border-b border-line bg-surface px-6 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[12.5px] font-medium tabular-nums text-ink">
          Bill {index + 1} of {total}
        </span>
        <NavArrow disabled={!canPrev} onClick={onPrev} label="Previous bill">
          <ChevronLeft className="size-4" strokeWidth={2} />
        </NavArrow>
        <NavArrow disabled={!canNext} onClick={onNext} label="Next bill">
          <ChevronRight className="size-4" strokeWidth={2} />
        </NavArrow>
      </div>
      <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5 text-muted-ink">
        <X className="size-3.5" strokeWidth={2} />
        Exit to list
      </Button>
    </div>
  )
}

function NavArrow({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid size-6 place-items-center rounded-md text-muted-ink outline-none transition-colors",
        "hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid/40",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      {children}
    </button>
  )
}
