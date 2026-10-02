import { cn } from "@/lib/utils"
import { groupIndianInt } from "@/lib/format"

/**
 * The one locked money primitive for the Bills / Needs-review screen.
 *
 * Rendering contract (do not fork per call-site):
 *   [₹  0.75×, ink3, SAME baseline as the digits — never superscript]
 *   [1,84,080  tabular integer at base size]
 *   [.00  ~0.6×, ink3 — only where a call-site opts in]
 * Always carries `.tabular` (tnum + lnum) so columns of figures align and
 * digit width never shifts as values change.
 *
 * Size/weight/colour of the integer come from the call-site `className`
 * (that is where type-scale hierarchy is set), keeping this component the
 * single source of truth for the split treatment itself.
 */
export function Money({
  value,
  decimals = true,
  strike = false,
  suffix,
  className,
  decimalClassName,
  symbolClassName,
}: {
  value: number
  decimals?: boolean
  strike?: boolean
  /** abbreviated-scale tail (e.g. "cr" / "L"); rendered in the muted decimal ink. */
  suffix?: string
  className?: string
  /** override the ".00" decimal-tail styling (size/colour); defaults to 0.6em ink-3 */
  decimalClassName?: string
  /** override the "₹" symbol's size (colour/weight stay ink-3/normal); defaults to 0.75em */
  symbolClassName?: string
}) {
  const neg = value < 0
  const [intRaw, fracRaw] = Math.abs(value).toFixed(2).split(".")
  const intStr = groupIndianInt(intRaw)

  return (
    <span
      className={cn(
        "fig tabular inline-block whitespace-nowrap",
        strike && "text-ink-3 line-through decoration-ink-3/60",
        className,
      )}
    >
      <span className={cn("mr-[0.05em] font-normal text-ink-3", symbolClassName ?? "text-[0.75em]")}>
        {neg && "-"}₹
      </span>
      <span>{intStr}</span>
      {decimals && (
        <span className={cn("ml-[0.04em] font-normal text-ink-3", decimalClassName ?? "text-[0.8em]")}>
          .{fracRaw}
        </span>
      )}
      {suffix && (
        <span className="ml-[0.22em] text-[0.6em] font-medium text-ink-3">{suffix}</span>
      )}
    </span>
  )
}
