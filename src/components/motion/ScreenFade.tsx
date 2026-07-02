import { useEffect, useRef, useState, type ReactNode } from "react"
import { useReducedMotion } from "@/hooks/useReducedMotion"

/**
 * Clean route crossfade: fade the old content out (100ms), swap, fade the new
 * in (150ms). No slide, no stagger. Reduced motion swaps instantly.
 */
export function ScreenFade({ screen, children }: { screen: string; children: ReactNode }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState({ screen, children })
  const [phase, setPhase] = useState<"in" | "out">("in")
  const pending = useRef<{ screen: string; children: ReactNode } | null>(null)

  useEffect(() => {
    if (screen === shown.screen) {
      // same route, content may have updated — keep it live
      setShown({ screen, children })
      return
    }
    if (reduced) {
      setShown({ screen, children })
      return
    }
    pending.current = { screen, children }
    setPhase("out")
    const t = setTimeout(() => {
      if (pending.current) setShown(pending.current)
      setPhase("in")
    }, 100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, children])

  return (
    <div className={phase === "out" ? "screen-out h-full" : "screen-in h-full"}>
      {shown.children}
    </div>
  )
}
