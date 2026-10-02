import { useEffect, useMemo, useState } from "react"
import type { FacetState, SortState } from "@/components/register/kit"

/** flips direction on the active key, else starts ascending on the new one */
export function nextSort<K extends string>(s: SortState<K>, key: K): SortState<K> {
  return s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }
}

/** URL deep link for screenshots and demos: ?mtab=review opens a master
 *  register straight on its Needs-review tab */
export function initialMasterTab<T extends string>(fallback: T, review: T): T {
  if (typeof window === "undefined") return fallback
  return new URLSearchParams(window.location.search).get("mtab") === "review" ? review : fallback
}

/**
 * The list-side state every master register keeps — search, facets, sort,
 * grouped/flat view, collapsed groups, density, pagination, selection.
 * Filtering and sorting stay with the screen (they know the record shape);
 * this hook only owns the knobs, so the two registers can't drift apart.
 */
export function useRegister<K extends string>(storageKey: string, defaultSort: SortState<K>) {
  const [query, setQuery] = useState("")
  const [facets, setFacets] = useState<FacetState>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState<K>>(defaultSort)
  const [view, setView] = useState<"grouped" | "list">("grouped")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(`${storageKey}-density`) === "compact"
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-density`, compact ? "compact" : "comfortable")
    } catch {
      /* optional preference */
    }
  }, [compact, storageKey])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const setFacet = (key: string, next: Set<string>) => {
    setFacets((f) => ({ ...f, [key]: next }))
    setPage(0)
  }
  const clearFacet = (key: string) => setFacet(key, new Set())
  const clearAll = () => {
    setQuery("")
    setFacets({})
    setPage(0)
  }
  const toggleGroup = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const facetActive = useMemo(() => Object.values(facets).some((s) => s.size > 0), [facets])
  const has = (key: string, v: string) => !facets[key]?.size || facets[key].has(v)

  return {
    query, setQuery,
    facets, setFacet, clearFacet, clearAll, facetActive, has,
    filterOpen, setFilterOpen, filterField, setFilterField,
    sort, setSort,
    view, setView,
    collapsed, toggleGroup,
    compact, setCompact,
    page, setPage, pageSize, setPageSize,
    selected, setSelected,
  }
}

/** selection helpers scoped to the visible ids */
export function selection(selected: Set<string>, setSelected: (s: Set<string>) => void, visibleIds: string[]) {
  const picked = visibleIds.filter((id) => selected.has(id))
  const all = visibleIds.length > 0 && picked.length === visibleIds.length
  return {
    all,
    some: picked.length > 0 && !all,
    toggle: (id: string) => {
      const n = new Set(selected)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      setSelected(n)
    },
    toggleAll: () => {
      const n = new Set(selected)
      if (all) visibleIds.forEach((id) => n.delete(id))
      else visibleIds.forEach((id) => n.add(id))
      setSelected(n)
    },
  }
}

/** a page slice, clamped so a shrinking result set never strands the view */
export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1)
  const safe = Math.min(page, maxPage)
  return { safePage: safe, paged: rows.slice(safe * pageSize, safe * pageSize + pageSize) }
}

export const fmtQty = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
