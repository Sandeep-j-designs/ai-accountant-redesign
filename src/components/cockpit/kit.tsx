import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Currency } from "./Currency"

/** A keycap — the instrument speaks in keystrokes. */
export function Kbd({ children, tone }: { children: ReactNode; tone?: "onaccent" }) {
  return (
    <kbd
      className={cn(
        "inline-grid h-[17px] min-w-[17px] place-items-center rounded-[4px] border px-1 font-mono text-[10px] font-medium leading-none",
        tone === "onaccent"
          ? "border-transparent bg-white/20 text-white"
          : "border-line-2 bg-panel text-muted-ink shadow-[0_1px_0_0_var(--line-2)]",
      )}
    >
      {children}
    </kbd>
  )
}

/** The eyebrow that labels a live decision — neutral; the accent is the rule
 *  and the CTA, not the label. */
export function LiveLabel({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

/**
 * A financial figure. Now a thin wrapper over <Currency> so the split
 * treatment (₹ + decimals dimmed, numerals leading) reaches every money spot.
 * Size/colour still come from the call-site className.
 */
export function Amt({
  value,
  className,
  strike,
  decimals,
}: {
  value: number
  className?: string
  strike?: boolean
  /** opt-in — ".00" renders only in the facsimile + printed→corrected table */
  decimals?: boolean
}) {
  return <Currency value={value} className={className} strike={strike} decimals={decimals} />
}

/** A quiet labelled row for settled / receipt blocks. */
export function MiniRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]">
      <span className="text-[12px] text-muted-ink">{label}</span>
      <span className="text-[12.5px] text-ink">{children}</span>
    </div>
  )
}

/**
 * The one decision-card shell — every editable fact (in the top queue, or
 * re-opened inline in the settled stack) sits inside this same chrome: 20px
 * padding, 12px radius, a subtle border, one elevation. The focused card
 * additionally carries the accent rail + ring so the keyboard cursor stays
 * legible; a flashing card borrows the resolve-moment ring color.
 */
export function DecisionCard({
  focused,
  flashing,
  flashTone = "success",
  onClick,
  children,
  className,
}: {
  focused?: boolean
  flashing?: boolean
  flashTone?: "success" | "warning"
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div
      onClick={onClick}
      style={
        flashing
          ? ({ "--flash-color": flashTone === "success" ? "var(--success)" : "var(--warning)" } as CSSProperties)
          : undefined
      }
      className={cn(
        "relative rounded-lg border bg-surface p-5 shadow-card transition-colors duration-150",
        flashing && "flash-ring",
        focused
          ? "border-accent-sig/40 ring-1 ring-accent-sig/20"
          : cn("border-line", onClick && "cursor-pointer hover:border-line-strong"),
        className,
      )}
    >
      {children}
    </div>
  )
}
