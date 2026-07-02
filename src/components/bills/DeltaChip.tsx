import type { ReactNode } from "react"
import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "positive" | "negative" | "neutral"
type Dir = "up" | "down" | "flat"

// No chrome — just an inline arrow + text. Direction drives the arrow; tone
// drives ONLY the arrow colour (text stays secondary), so a rising "overdue"
// reads red-up (accurate) while a neutral rise stays quiet.
const ARROW: Record<Tone, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-muted-ink", // text-faint reads under 3:1 on white — too quiet for a meaningful glyph
}

export function DeltaChip({
  dir,
  tone,
  children,
  className,
}: {
  dir: Dir
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  const t: Tone = tone ?? (dir === "up" ? "positive" : dir === "down" ? "negative" : "neutral")
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : ArrowRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] text-body tabular-nums",
        className,
      )}
    >
      <Icon className={cn("size-3.5 flex-none", ARROW[t])} strokeWidth={2} />
      {children}
    </span>
  )
}
