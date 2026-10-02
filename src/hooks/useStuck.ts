import { useEffect, useRef, useState } from "react"

/**
 * Presentational only: returns a ref to attach to a `position: sticky` element
 * and a `stuck` boolean that flips true once the element has pinned to the top
 * of its scroll container (i.e. content has scrolled beneath it). Used to fade
 * in a Level-1 shadow on sticky table headers — no layout or data effect.
 */
export function useStuck<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // nearest scrollable ancestor (falls back to the window)
    let scroller: HTMLElement | null = el.parentElement
    while (scroller && scroller !== document.body) {
      const oy = getComputedStyle(scroller).overflowY
      if (oy === "auto" || oy === "scroll") break
      scroller = scroller.parentElement
    }

    const measure = () => {
      const top = el.getBoundingClientRect().top
      const anchor = scroller ? scroller.getBoundingClientRect().top : 0
      setStuck(top <= anchor + 1)
    }

    const target: HTMLElement | Window = scroller ?? window
    measure()
    target.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure, { passive: true })
    return () => {
      target.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [])

  return { ref, stuck }
}
