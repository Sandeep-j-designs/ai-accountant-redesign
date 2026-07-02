import { cn } from "@/lib/utils"

/** Indian digit grouping for an integer string: 184080 → "1,84,080" */
function groupINR(int: string): string {
  let last3 = int.slice(-3)
  let rest = int.slice(0, -3)
  if (rest) {
    last3 = "," + last3
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  }
  return rest + last3
}

type Unit = "L" | "Cr"
const FACTOR: Record<Unit, number> = { L: 1e5, Cr: 1e7 }

const SIZE: Record<string, string> = {
  sm: "text-[12.5px]",
  md: "text-[14px]",
  lg: "text-[20px]",
  stat: "text-[23px] leading-none font-semibold", // Slate Console stat-card value (mono)
  display: "text-[26px]",
  metric: "text-[28px] leading-none",
}

/**
 * The universal money renderer. Splits the figure so the numerals lead:
 *   [₹ 70%, tertiary] [1,84,080 weighted] [.00 62%, tertiary]
 * `size` is optional so callers that size via className (e.g. Amt) still work.
 * `display`/metric sizes render the integer in the display cut.
 */
export function Currency({
  value,
  size,
  display = false,
  decimals = true,
  abbreviate = false,
  unit,
  strike = false,
  className,
}: {
  value: number
  size?: "sm" | "md" | "lg" | "stat" | "display" | "metric"
  display?: boolean
  decimals?: boolean
  abbreviate?: boolean
  unit?: Unit
  strike?: boolean
  className?: string
}) {
  const neg = value < 0
  const abs = Math.abs(value)

  let u: Unit | null = unit ?? null
  if (!u && abbreviate) u = abs >= 1e7 ? "Cr" : abs >= 1e5 ? "L" : null

  const base = u ? abs / FACTOR[u] : abs
  const [intRaw, fracRaw] = base.toFixed(2).split(".")
  const intStr = groupINR(intRaw)
  const suffix = u === "Cr" ? "cr" : u === "L" ? "L" : ""

  const heroInt = display || size === "display" || size === "metric"

  return (
    <span
      className={cn(
        "fig inline-flex items-baseline whitespace-nowrap",
        size && SIZE[size],
        strike && "text-faint line-through decoration-faint/60",
        className,
      )}
    >
      <span className="mr-[0.14em] text-[0.7em] font-normal text-faint">
        {neg && "-"}₹
      </span>
      <span className={cn("font-medium", heroInt && "tracking-[-0.02em]")}>{intStr}</span>
      {decimals && (
        <span className="ml-[0.05em] text-[0.7em] font-normal text-faint">.{fracRaw}</span>
      )}
      {suffix && (
        <span className="ml-[0.22em] text-[0.6em] font-medium text-faint">{suffix}</span>
      )}
    </span>
  )
}
