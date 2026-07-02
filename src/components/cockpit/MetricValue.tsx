import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/hooks/useCountUp"
import { Currency } from "./Currency"

/**
 * A KPI number as hero: very large display cut, rolls up 0 → target on first
 * in-view. Currency values render through <Currency> (split treatment).
 * Never abbreviated — one numeral rule holds across the whole app, so a KPI
 * hero and a table amount always read the same way.
 * The `delta` slot below reserves space for the Phase 2C delta chip.
 */
export function MetricValue({
  value,
  format = "currency",
  tone,
  delta,
  className,
}: {
  value: number
  format?: "currency" | "count"
  tone?: "danger" | "warning" | "ember"
  delta?: ReactNode
  className?: string
}) {
  const { ref, value: v } = useCountUp(value)
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "ember"
          ? "text-ember" // the one warm hero figure per screen
          : "text-ink"

  return (
    <div className={className}>
      <span ref={ref as React.Ref<HTMLSpanElement>} className="block">
        {format === "currency" ? (
          <Currency value={v} size="metric" className={color} />
        ) : (
          <span
            className={cn("block text-[28px] font-medium leading-none tabular-nums tracking-[-0.02em]", color)}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {v}
          </span>
        )}
      </span>
      {delta && <div className="mt-2">{delta}</div>}
    </div>
  )
}
