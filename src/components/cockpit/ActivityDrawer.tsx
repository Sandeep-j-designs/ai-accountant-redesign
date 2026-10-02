import { useEffect } from "react"
import {
  X,
  FileText,
  Link2,
  Check,
  Flag,
  Undo2,
  RotateCcw,
  Lock,
} from "lucide-react"
import { useBill, type ActivityKind } from "@/state/store"
import { cn } from "@/lib/utils"
import { relTime } from "@/lib/format"

const ICON: Record<ActivityKind, typeof Check> = {
  extracted: FileText,
  matched: Link2,
  decided: Check,
  flagged: Flag,
  unflagged: Undo2,
  reopened: RotateCcw,
  committed: Lock,
}

function toneFor(kind: ActivityKind, label: string): string {
  if (kind === "committed") return "text-ink"
  if (kind === "flagged" || kind === "reopened") return "text-warning"
  if (kind === "decided") return label.startsWith("Overr") ? "text-warning" : "text-success"
  return "text-muted-ink"
}

/** Slide-in voucher history. The full audit trail: read → matched → each
 *  decision (who, when, how) → flags → recorded. */
export function ActivityDrawer() {
  const { state, dispatch } = useBill()
  const open = state.activityOpen
  const close = () => dispatch({ type: "TOGGLE_ACTIVITY", open: false })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <div
        onClick={close}
        className={cn(
          "fixed inset-0 z-[70] bg-ink/20 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Voucher activity"
        className={cn(
          "fixed inset-y-0 right-0 z-[71] flex w-[360px] max-w-[90vw] flex-col border-l border-line bg-surface shadow-pop transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex flex-none items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-medium text-ink">Activity</div>
            <div className="eyebrow mt-0.5">Voucher history · who did what</div>
          </div>
          <button
            onClick={close}
            aria-label="Close activity"
            className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-panel hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <ol className="relative">
            {state.activity.map((e, i) => {
              const Icon = ICON[e.kind]
              const last = i === state.activity.length - 1
              return (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-line" />}
                  <span
                    className={cn(
                      "z-10 grid size-[23px] flex-none place-items-center rounded-full border border-line bg-card",
                      toneFor(e.kind, e.label),
                    )}
                  >
                    <Icon className="size-3" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className={cn("text-[12.5px] font-medium", toneFor(e.kind, e.label))}>{e.label}</div>
                    {e.detail && <div className="mt-0.5 text-[11.5px] text-body">{e.detail}</div>}
                    <div className="mt-0.5 text-[11px] text-faint">
                      {e.by} · {relTime(e.at)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>
    </>
  )
}
