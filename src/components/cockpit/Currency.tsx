import { cn } from "@/lib/utils"
import { Money } from "@/components/bills/Money"

type Unit = "L" | "Cr"
const FACTOR: Record<Unit, number> = { L: 1e5, Cr: 1e7 }

const SIZE: Record<string, string> = {
  sm: "text-[12.5px]",
  md: "text-[14px]",
  lg: "text-[20px]",
  stat: "text-[23px] leading-none font-semibold", // Slate Console stat-card value
  display: "text-[26px]",
  metric: "text-[28px] leading-none",
}

/**
 * The cockpit money renderer — now a thin wrapper over the single <Money>
 * primitive, so the ₹ symbol size, the dimmed `.00`, the tabular numerals and
 * the muted-ink treatment are IDENTICAL to every amount on the Bills screen.
 * This component only adds the cockpit's size ramp + optional L/Cr abbreviation;
 * the split treatment itself lives in one place (Money).
 */
export function Currency({
  value,
  size,
  display = false,
  // decimals rule: ".00" appears ONLY in the source-document facsimile and
  // the Printed → Corrected table — call-sites there opt in explicitly.
  decimals = false,
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
  const abs = Math.abs(value)

  let u: Unit | null = unit ?? null
  if (!u && abbreviate) u = abs >= 1e7 ? "Cr" : abs >= 1e5 ? "L" : null

  const scaled = u ? value / FACTOR[u] : value
  const suffix = u === "Cr" ? "cr" : u === "L" ? "L" : undefined
  const heroInt = display || size === "display" || size === "metric"

  return (
    <Money
      value={scaled}
      decimals={decimals}
      strike={strike}
      suffix={suffix}
      className={cn(
        "font-medium",
        size && SIZE[size],
        heroInt && "tracking-[-0.02em]",
        className,
      )}
    />
  )
}
