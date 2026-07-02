import { Check, PenLine, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { relTime } from "@/lib/format"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { DecisionRecord } from "@/state/store"

/** "✓ Accepted by Sandeep Balaji · 2 min ago" — reasoning shown on hover if noted. */
export function Attribution({ record }: { record: DecisionRecord }) {
  const accepted = record.how === "accepted"
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className={cn("inline-flex items-center gap-1", accepted ? "text-success" : "text-warning")}>
        {accepted ? <Check className="draw-check size-3" strokeWidth={2.6} /> : <PenLine className="size-3" strokeWidth={2.2} />}
        {accepted ? "Accepted" : "Overridden"}
      </span>
      <span className="text-faint">
        by {record.by} · {relTime(record.at)}
      </span>
      {record.note && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Reasoning"
              className="inline-grid place-items-center rounded-full text-faint outline-none transition-colors hover:text-body focus-visible:ring-2 focus-visible:ring-accent-sig/40"
            >
              <Info className="size-3" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            <div className="font-medium">Reasoning</div>
            <div className="mt-0.5 font-normal text-white/70">{record.note}</div>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}
