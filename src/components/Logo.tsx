import { cn } from "@/lib/utils"

export type LogoVariant = "wordmark" | "monogram" | "glyph"

const LEDGER_GREEN = "#0F5132"

/** The wordmark — refined display cut, tight tracking, no icon. */
function Wordmark() {
  return (
    <span
      className="text-[17px] font-medium leading-none tracking-[-0.03em] text-ink"
      style={{ fontFamily: "var(--font-display)" }}
    >
      FinOps
    </span>
  )
}

/** A geometric "F" monogram in ledger green — no container box. */
function MonogramF() {
  return (
    <svg width={19} height={19} viewBox="0 0 20 20" aria-hidden="true" className="flex-none">
      <rect x="4" y="3" width="2.6" height="14" rx="1.1" fill={LEDGER_GREEN} />
      <rect x="4" y="3" width="11" height="2.6" rx="1.1" fill={LEDGER_GREEN} />
      <rect x="4" y="8.7" width="8" height="2.6" rx="1.1" fill={LEDGER_GREEN} opacity="0.82" />
    </svg>
  )
}

/** An abstract balance/ledger glyph — a beam over a fulcrum. */
function LedgerGlyph() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none text-ink"
      aria-hidden="true"
    >
      <path d="M4 8h14" />
      <path d="M11 8v5" />
      <path d="M8 13h6" />
      <circle cx="4" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Logo({ variant, className }: { variant: LogoVariant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {variant === "monogram" && <MonogramF />}
      {variant === "glyph" && <LedgerGlyph />}
      <Wordmark />
    </span>
  )
}
