import { createContext, useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { DocRegion } from "@/components/InvoiceDocument"
import { FIELD_CONFIDENCE, type ConfLevel } from "@/data/invoice"

/** Lets any field in the decision panel light up its region on the document —
 *  and, in reverse, light itself up when that region is hovered on the source.
 *  Correspondence is carried by shared state, not a drawn line. */
type OnRegion = (r: DocRegion | null, el?: HTMLElement | null) => void
type EvidenceCtx = { set: OnRegion; active: DocRegion | null }
const EvidenceContext = createContext<EvidenceCtx>({ set: () => {}, active: null })

export function EvidenceProvider({
  onRegion,
  active = null,
  children,
}: {
  onRegion: OnRegion
  active?: DocRegion | null
  children: ReactNode
}) {
  return (
    <EvidenceContext.Provider value={{ set: onRegion, active }}>{children}</EvidenceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvidence() {
  return useContext(EvidenceContext).set
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveRegion() {
  return useContext(EvidenceContext).active
}

/**
 * Wraps an extracted value so hovering or focusing it highlights the matching
 * region on the source document. Focusable (Tab) for keyboard parity.
 */
export function Evidence({
  region,
  children,
  className,
}: {
  region: DocRegion
  children: ReactNode
  className?: string
}) {
  const setRegion = useEvidence()
  const active = useActiveRegion()
  return (
    <span
      tabIndex={0}
      data-source-id={region}
      onMouseEnter={(e) => setRegion(region, e.currentTarget)}
      onMouseLeave={() => setRegion(null)}
      onFocus={(e) => setRegion(region, e.currentTarget)}
      onBlur={() => setRegion(null)}
      className={cn(
        "rounded-[3px] outline-none ring-offset-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-vivid/40",
        "hover:decoration-accent-sig/40",
        active === region && "bg-panel", // source-side hover lights the field
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A calm status indicator on the ONE app-wide vocabulary:
 * green = resolved/verified · amber = decision open. The tooltip names the
 * state in those words and carries the reason.
 */
export function Confidence({ field, className }: { field: string; className?: string }) {
  const c = FIELD_CONFIDENCE[field]
  if (!c) return null
  const resolved = c.level === "high"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={resolved ? "Resolved, verified against the document" : "Decision open"}
          className={cn("inline-grid place-items-center rounded-full p-[3px] align-middle outline-none focus-visible:ring-2 focus-visible:ring-brand-vivid/40", className)}
        >
          <span className={cn("block size-[7px] rounded-full ring-2", dot(c.level))} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <div className="font-medium">{resolved ? "Resolved · verified" : "Decision open"}</div>
        <div className="mt-0.5 font-normal text-white/70">{c.basis}</div>
      </TooltipContent>
    </Tooltip>
  )
}

function dot(level: ConfLevel): string {
  return level === "high" ? "bg-success ring-success/20" : "bg-warning ring-warning/20"
}
