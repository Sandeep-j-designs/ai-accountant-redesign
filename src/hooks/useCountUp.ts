import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "./useReducedMotion"

/**
 * Rolls a number 0 → target over `duration` (ease-out cubic), firing once when
 * the element scrolls into view. Skips entirely under prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 600) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  const ref = useRef<HTMLElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    const el = ref.current
    if (!el || started.current) {
      setValue(target)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true
            const t0 = performance.now()
            const tick = (now: number) => {
              const p = Math.min(1, (now - t0) / duration)
              const eased = 1 - Math.pow(1 - p, 3) // ease-out
              setValue(Math.round(target * eased))
              if (p < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
          }
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target, duration, reduced])

  return { ref, value }
}
