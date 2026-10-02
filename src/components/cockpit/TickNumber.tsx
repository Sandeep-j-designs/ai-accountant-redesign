import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/useReducedMotion"

/**
 * An in-place number change: the old value fades up and out while the new
 * fades in from below (150ms). For values that change, not mounts — use
 * <MetricValue> for the count-up-on-mount case.
 */
export function TickNumber({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const [current, setCurrent] = useState(value)
  const [leaving, setLeaving] = useState<number | null>(null)
  const prev = useRef(value)

  useEffect(() => {
    if (value === prev.current) return
    if (reduced) {
      setCurrent(value)
      prev.current = value
      return
    }
    setLeaving(prev.current)
    setCurrent(value)
    prev.current = value
    const t = setTimeout(() => setLeaving(null), 150)
    return () => clearTimeout(t)
  }, [value, reduced])

  return (
    <span className={cn("relative inline-flex justify-center tabular", className)}>
      {leaving !== null && (
        <span key={`out-${leaving}`} className="tick-out absolute inset-0 flex justify-center">
          {leaving}
        </span>
      )}
      <span key={`in-${current}`} className={leaving !== null ? "tick-in" : undefined}>
        {current}
      </span>
    </span>
  )
}
