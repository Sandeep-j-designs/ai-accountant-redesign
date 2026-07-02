import { useEffect, useRef, useState, type ReactNode } from "react"
import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { REVIEWERS } from "@/data/invoice"

/**
 * The third path — route a decision to a teammate or a shared queue instead of
 * deciding it here. A small self-contained menu (no popover primitive in the
 * kit); closes on outside-click or Escape. `open`/`onOpenChange` are optional
 * so the dock can drive it from the F key; left uncontrolled it manages itself.
 */
export function FlagButton({
  onPick,
  variant = "inline",
  placement = "bottom",
  open: openProp,
  onOpenChange,
  trigger,
}: {
  onPick: (to: string) => void
  variant?: "inline" | "dock"
  placement?: "top" | "bottom"
  open?: boolean
  onOpenChange?: (v: boolean) => void
  trigger?: ReactNode
}) {
  const [openSelf, setOpenSelf] = useState(false)
  const open = openProp ?? openSelf
  const setOpen = (v: boolean) => {
    onOpenChange?.(v)
    if (openProp === undefined) setOpenSelf(v)
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger ? (
        <span onClick={() => setOpen(!open)}>{trigger}</span>
      ) : variant === "dock" ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line-2 bg-surface px-3 text-[12.5px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink"
        >
          <Flag className="size-3.5" strokeWidth={2} />
          Flag
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-sm text-[12px] font-medium text-muted-ink transition-colors hover:text-ink"
        >
          <Flag className="size-3" strokeWidth={2} />
          Flag for review
        </button>
      )}

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={cn(
              "absolute z-50 w-[248px] overflow-hidden rounded-lg border border-line-2 bg-popover shadow-pop",
              placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
              variant === "dock" ? "right-0" : "left-0",
            )}
          >
            <div className="eyebrow border-b border-line px-3 py-2">Assign to review</div>
            {REVIEWERS.map((r) => (
              <button
                key={r.id}
                role="menuitem"
                onClick={() => {
                  onPick(r.name)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-panel"
              >
                <span className="grid size-6 flex-none place-items-center rounded-full bg-panel-2 text-[10px] font-medium text-muted-ink">
                  {r.id === "queue" ? "Q" : r.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[12.5px] font-medium text-ink">{r.name}</span>
                  <span className="block truncate text-[11px] text-faint">{r.role}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
