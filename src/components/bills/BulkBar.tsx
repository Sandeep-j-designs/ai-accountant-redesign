import { Check, CalendarClock, Download, X } from "lucide-react"
import { Amt } from "@/components/cockpit/kit"
import { useToast } from "@/components/common/toast"

/** Appears only while rows are selected. Actions are demo-safe — they toast
 *  (with undo) and clear the selection. */
export function BulkBar({
  count,
  total,
  onClear,
}: {
  count: number
  total: number
  onClear: () => void
}) {
  const toast = useToast()
  if (count === 0) return null

  const noun = `${count} bill${count === 1 ? "" : "s"}`
  const act = (kind: "success" | "info", verb: string, undo = true) => {
    toast({ kind, message: `${noun} ${verb}`, undo: undo ? onClear : undefined })
    onClear()
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="enter-up pointer-events-auto flex items-center gap-2 rounded-xl border border-line-2 bg-raised px-3 py-2 shadow-lift">
        <span className="px-2 text-[12.5px] text-body">
          <span className="fig font-medium text-ink">{count}</span> selected
          <span className="mx-2 text-faint">·</span>
          <Amt value={total} className="text-muted-ink" />
        </span>
        <span className="mx-0.5 h-5 w-px bg-line-2" />
        <BulkAction icon={<Check className="size-3.5" strokeWidth={2} />} label="Approve" onClick={() => act("success", "approved")} />
        <BulkAction icon={<CalendarClock className="size-3.5" strokeWidth={2} />} label="Schedule" onClick={() => act("success", "scheduled for payment")} />
        <BulkAction icon={<Download className="size-3.5" strokeWidth={2} />} label="Export" onClick={() => act("info", "exported", false)} />
        <span className="mx-0.5 h-5 w-px bg-line-2" />
        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-panel hover:text-ink"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function BulkAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-body transition-colors hover:bg-panel hover:text-ink"
    >
      {icon}
      {label}
    </button>
  )
}
