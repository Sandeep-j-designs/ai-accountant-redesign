import { useState, type ReactNode } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Neutral provenance tag — replaces colour/sparkle as the "this came from
 *  extraction" signal. 11px uppercase, tertiary ink, 1px hairline, radius-sm. */
export function SuggestedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center rounded-xs border border-line px-1 py-px text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-faint",
        className,
      )}
    >
      Suggested
    </span>
  )
}

/**
 * AI "diff" — a developer-style before/after for an AI correction. The old
 * value reads as a deletion (muted, struck through); the new value is the AI
 * PROPOSAL, so it carries the reserved AI accent (green is reserved for
 * resolved/success states). The reasoning ("Why") is an inline disclosure —
 * it expands beneath the row with the rule citation; the chevron rotates.
 *
 * Reusable across any single-value correction (GST head, ledger, voucher …).
 */
export function Diff({
  label,
  before,
  after,
  why,
  defaultOpen = false,
}: {
  /** short uppercase tag for what changed, e.g. "GST head" */
  label?: ReactNode
  before: ReactNode
  after: ReactNode
  /** optional reasoning revealed by the "Why" accordion */
  why?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-sunken/50">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2.5">
        {label && <span className="eyebrow mr-0.5">{label}</span>}

        {/* deletion → suggested value. Provenance is the neutral tag, not a
            colour or glyph; the value keeps the sanctioned #5B4DEE. */}
        <span className="text-[13px] text-faint line-through decoration-faint/60">{before}</span>
        <ArrowRight className="size-3.5 flex-none text-faint" strokeWidth={2.2} aria-hidden />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ai-ink">
          {after}
          <SuggestedTag />
        </span>

        {why && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-ink outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid/40"
          >
            Why
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
              strokeWidth={2.2}
            />
          </button>
        )}
      </div>

      {why && open && (
        <div className="animate-expand border-t border-line bg-sunken/60 px-3 py-3 text-[13px] leading-[1.5] text-body">
          {why}
        </div>
      )}
    </div>
  )
}
