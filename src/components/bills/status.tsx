import { cn } from "@/lib/utils"
import type { BillStatus } from "@/data/invoice"

/** Status meaning is carried by a colored dot; the label stays neutral so the
 *  column reads as one calm line, not a rainbow. Overdue earns red text too. */
type Meta = { label: string; dot: string; labelClass?: string }

export const STATUS_META: Record<BillStatus, Meta> = {
  // "live" statuses carry a static concentric ring (awaiting action)
  review: { label: "Review", dot: "bg-warning ring-2 ring-warning/25" },
  reading: { label: "Reading", dot: "bg-warning ring-2 ring-warning/25" },
  approved: { label: "Approved", dot: "border-2 border-success bg-transparent" }, // hollow = go-ahead
  scheduled: { label: "Scheduled", dot: "bg-info ring-2 ring-info/25" },
  posted: { label: "Posted", dot: "bg-muted-ink" }, // bg-faint falls under 3:1 on the row surface
  overdue: { label: "Overdue", dot: "bg-danger", labelClass: "text-danger" },
  paid: { label: "Paid", dot: "bg-success ring-2 ring-success/25" }, // filled = done
}

/** rank for sorting by status (open work first, done last) */
export const STATUS_RANK: Record<BillStatus, number> = {
  review: 0,
  reading: 1,
  overdue: 2,
  approved: 3,
  scheduled: 4,
  posted: 5,
  paid: 6,
}

export function StatusPill({ status, className }: { status: BillStatus; className?: string }) {
  const m = STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-[7px] flex-none rounded-full", m.dot)} />
      <span className={cn("text-[12.5px]", m.labelClass ?? "text-body")}>{m.label}</span>
    </span>
  )
}
