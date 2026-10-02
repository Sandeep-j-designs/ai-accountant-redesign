import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Neutral / alarm tag shown above an edge-flow dialog title. */
export function InfoTag({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "danger"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em]",
        tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-panel-2 text-muted-ink",
      )}
    >
      {children}
    </span>
  )
}
