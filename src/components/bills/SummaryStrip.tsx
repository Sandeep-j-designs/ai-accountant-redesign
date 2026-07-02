import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { dueInDays } from "@/lib/format"
import { Currency } from "@/components/cockpit/Currency"
import { BILLS } from "@/data/invoice"

const sum = (bs: typeof BILLS) => bs.reduce((s, b) => s + b.amount, 0)

/**
 * Slate Console stat row — three flat bordered cards on the slate canvas.
 * Values are mono/tabular. Payable → accent-ink (Trust Blue); Overdue → a
 * red-washed alert card; the third stays calm ink. Eyebrow + sub-line mono.
 */
export function SummaryStrip() {
  const unpaid = BILLS.filter((b) => b.status !== "paid")
  const dueThisWeek = unpaid.filter((b) => dueInDays(b.due) <= 7)
  const overdue = BILLS.filter((b) => b.status === "overdue")
  const review = BILLS.filter((b) => b.status === "review")

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="Payable this week"
        value={<Currency value={sum(dueThisWeek)} size="stat" className="text-accent-sig-ink" />}
        delta="↑ ₹12,400 vs last week"
        meta={`${dueThisWeek.length} bills due`}
      />
      <StatCard
        alert
        label="Overdue"
        value={<Currency value={sum(overdue)} size="stat" className="text-danger" />}
        delta="↑ 1 vs last week"
        meta="1 to pay"
      />
      <StatCard
        label="Awaiting your review"
        value={<span className="fig text-[23px] font-semibold leading-none text-ink">{review.length}</span>}
        delta="→ same as last week"
        meta={<Currency value={sum(review)} size="sm" className="text-faint" />}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  delta,
  meta,
  alert,
}: {
  label: string
  value: ReactNode
  delta: ReactNode
  meta: ReactNode
  alert?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[9px] border px-4 py-3.5 shadow-l1",
        alert ? "border-danger-line bg-danger-bg" : "border-line bg-surface",
      )}
    >
      <span
        className={cn(
          "font-mono text-[10.5px] font-medium uppercase tracking-[0.06em]",
          alert ? "text-danger" : "text-faint",
        )}
      >
        {label}
      </span>

      <div className="mt-2.5">{value}</div>

      <div className="mt-2.5 flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-faint">
        <span>{delta}</span>
        <span>{meta}</span>
      </div>
    </div>
  )
}
