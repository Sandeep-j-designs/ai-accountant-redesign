import { Check, CalendarClock, Download, X } from "lucide-react"
import { Amt } from "@/components/cockpit/kit"
import { useToast } from "@/components/common/toast"

/** The bulk-action bar — docked in the table-header slot (replacing it) while
 *  rows are selected. Brand-tint ground, brand-border bottom rule. Actions are
 *  demo-safe: they toast (with undo) and clear the selection. */
export interface BulkActionDef {
  icon: React.ReactNode
  label: string
  /** past-tense verb for the toast — "approved", "moved to Indirect Expenses" */
  verb: string
  kind?: "success" | "info"
  undo?: boolean
}

const BILL_ACTIONS: BulkActionDef[] = [
  { icon: <Check className="size-3.5" strokeWidth={2} />, label: "Approve", verb: "approved" },
  { icon: <CalendarClock className="size-3.5" strokeWidth={2} />, label: "Schedule", verb: "scheduled for payment" },
  { icon: <Download className="size-3.5" strokeWidth={2} />, label: "Export", verb: "exported", kind: "info", undo: false },
]

export function BulkBar({
  count,
  total,
  allSelected,
  indeterminate,
  onToggleAll,
  onClear,
  noun: nounWord = "bill",
  actions = BILL_ACTIONS,
}: {
  count: number
  /** money total of the selection — omitted where a sum means nothing */
  total?: number
  allSelected: boolean
  indeterminate: boolean
  onToggleAll: () => void
  onClear: () => void
  noun?: string
  actions?: BulkActionDef[]
}) {
  const toast = useToast()
  const noun = `${count} ${nounWord}${count === 1 ? "" : "s"}`
  const act = (kind: "success" | "info", verb: string, undo = true) => {
    toast({ kind, message: `${noun} ${verb}`, undo: undo ? onClear : undefined })
    onClear()
  }

  return (
    <div className="bulk-selection-bar shadow-1 sticky top-0 z-10 flex h-12 items-center gap-3 rounded-t-lg border-b border-brand-border bg-brand-tint px-6">
      {/* select-all with indeterminate when only some rows are selected */}
      <label className="-m-2 inline-flex w-max cursor-pointer p-2">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate
          }}
          onChange={onToggleAll}
          aria-label="Select all rows"
          style={{ accentColor: "var(--brand)" }}
          className="size-4 cursor-pointer"
        />
      </label>
      <span className="text-[13px] font-semibold tabular-nums text-ink">{count} selected</span>
      {total !== undefined && (
        <>
          <span className="text-[13px] text-body">·</span>
          <Amt value={total} className="text-[13px] text-body" />
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        {actions.map((a) => (
          <BulkAction key={a.label} icon={a.icon} label={a.label} onClick={() => act(a.kind ?? "success", a.verb, a.undo ?? true)} />
        ))}
        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="grid size-7 place-items-center rounded-md text-body transition-colors hover:bg-[rgba(21,26,38,0.04)] hover:text-ink"
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
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-body transition-colors hover:bg-[rgba(21,26,38,0.04)] hover:text-ink"
    >
      {icon}
      {label}
    </button>
  )
}
