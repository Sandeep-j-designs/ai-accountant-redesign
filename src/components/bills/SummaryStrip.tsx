import type { ReactNode } from "react"
import { ArrowUpRight, ClipboardCheck, CalendarClock, AlertCircle } from "lucide-react"
import { Money } from "./Money"
import { dueInDays } from "@/lib/format"
import type { BillRow } from "@/data/invoice"
import { cn } from "@/lib/utils"

export type SummaryScope = "due" | "overdue" | null
export function SummaryStrip({ bills, reviewCount, highestReview, active, onSelect }: {
  bills: BillRow[]; reviewCount: number; highestReview: number
  active: SummaryScope | "review"; onSelect: (scope: "review" | "due" | "overdue") => void
}) {
  const unpaid = bills.filter(b => b.status !== "paid")
  const due = unpaid.filter(b => dueInDays(b.due) >= 0 && dueInDays(b.due) <= 7)
  const overdue = unpaid.filter(b => dueInDays(b.due) < 0)
  const sum = (rows: BillRow[]) => rows.reduce((n, b) => n + b.amount, 0)
  return <div className="summary-grid">
    <SummaryCard label="Needs review" icon={<ClipboardCheck size={17} />} active={active === "review"} onClick={() => onSelect("review")}
      value={<>{reviewCount}<span className="ml-2 text-[14px] font-normal text-body">bills</span></>}
      meta={reviewCount ? <>Highest <Money value={highestReview} decimals={false} /></> : "You're caught up"} />
    <SummaryCard label="Due in the next 7 days" icon={<CalendarClock size={17} />} active={active === "due"} onClick={() => onSelect("due")}
      value={<Money value={sum(due)} decimals={false} />} meta={`${due.length} bills to pay`} />
    <SummaryCard label="Overdue" icon={<AlertCircle size={17} />} danger={overdue.length > 0} active={active === "overdue"} onClick={() => onSelect("overdue")}
      value={<Money value={sum(overdue)} decimals={false} />} meta={`${overdue.length} bills need attention`} />
  </div>
}
export function SummaryCard({ label, icon, value, meta, active, danger, onClick }: {
  label: string; icon: ReactNode; value: ReactNode; meta: ReactNode; active: boolean; danger?: boolean; onClick: () => void
}) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("summary-card group", label === "Needs review" && "summary-review", active && "is-active")}>
    {label === "Needs review" && <div className="summary-paper-stack" aria-hidden="true"><i/><i/><i><span/><span/><span/></i></div>}
    <span className="flex items-center gap-2 text-[13px] font-medium text-body">{icon}{label}<ArrowUpRight className="summary-arrow ml-auto size-4" /></span>
    <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className={cn("text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums", danger ? "text-danger" : "text-ink")}>{value}</span>
      <span className="text-[12px] font-normal text-muted-ink">{meta}</span>
    </span>
  </button>
}
