import { cn } from "@/lib/utils"

/** A neutral placeholder block. Static (no shimmer) to respect the motion
 *  budget; compose these to mirror the layout of what's loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-panel-2/70", className)} />
}
