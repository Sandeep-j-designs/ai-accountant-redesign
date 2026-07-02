import { useCallback, useEffect, useState } from "react"

type Theme = "light" | "dark"

const STORE_KEY = "finops-theme-v3"

function initial(): Theme {
  if (typeof window === "undefined") return "dark"
  const q = new URLSearchParams(window.location.search).get("theme")
  if (q === "dark" || q === "light") return q
  const saved = localStorage.getItem(STORE_KEY)
  if (saved === "dark" || saved === "light") return saved
  return "light" // warm-stone is the default register; dark is a deliberate pair
}

function apply(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark")
  document.documentElement.style.colorScheme = t
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    apply(theme)
    localStorage.setItem(STORE_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    // brief crossfade only during the switch, then back to instant interactions
    const root = document.documentElement
    root.classList.add("theme-anim")
    window.setTimeout(() => root.classList.remove("theme-anim"), 360)
    setTheme((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  return { theme, toggle }
}
