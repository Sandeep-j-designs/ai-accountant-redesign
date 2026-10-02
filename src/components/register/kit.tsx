/* ── Register kit ───────────────────────────────────────────────
   The pieces every register page shares — Bills, Chart of Accounts,
   Inventory. Lifted out of BillsScreen so the three read as one product:
   the same tabs, the same sortable headers, the same row menu, the same
   filter chips, the same collapsible group rows.
   ───────────────────────────────────────────────────────────── */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreHorizontal,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { COL_HEAD } from "@/components/bills/NeedsReview"

/* ── tabs ─────────────────────────────────────────────────────── */

export interface QueueTab<K extends string> {
  key: K
  label: string
  count: number
  /** work waiting → the count reads amber, active or not */
  warn?: boolean
}

/** label + count tabs with a 3px brand underline that SLIDES to the active
 *  tab (180ms; instant under reduced motion). Arrow keys / Home / End move. */
export function QueueTabs<K extends string>({
  tabs,
  tab,
  setTab,
}: {
  tabs: QueueTab<K>[]
  tab: K
  setTab: (t: K) => void
}) {
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const [underline, setUnderline] = useState({ left: 0, width: 0 })
  const sig = tabs.map((t) => `${t.key}:${t.count}`).join("|")

  useLayoutEffect(() => {
    const el = tabsRef.current[tab]
    const cont = containerRef.current
    if (!el || !cont) return
    const r = el.getBoundingClientRect()
    const cr = cont.getBoundingClientRect()
    setUnderline({ left: r.left - cr.left, width: r.width })
  }, [tab, sig])

  return (
    <div ref={containerRef} role="tablist" className="relative flex items-end gap-5">
      {tabs.map((t, index) => {
        const active = tab === t.key
        const countCls = t.warn && t.count > 0 ? "text-warning" : active ? "text-brand" : "text-faint"
        return (
          <button
            key={t.key}
            ref={(el) => {
              tabsRef.current[t.key] = el
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : e.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : -1
              if (next >= 0) {
                e.preventDefault()
                setTab(tabs[next].key)
                tabsRef.current[tabs[next].key]?.focus()
              }
            }}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex h-9 items-center gap-1.5 text-[13px] outline-none transition-colors focus-visible:text-ink",
              active ? "font-semibold text-ink" : "font-medium text-body hover:text-ink",
            )}
          >
            <span>{t.label}</span>
            <span className={cn("text-[13px] tabular-nums", countCls)}>{t.count}</span>
          </button>
        )
      })}
      <span
        aria-hidden
        className="absolute bottom-0 h-[3px] rounded-full bg-brand"
        style={{
          left: underline.left,
          width: underline.width,
          transition: reduced ? "none" : "left 180ms ease-out, width 180ms ease-out",
        }}
      />
    </div>
  )
}

/* ── sortable column header ───────────────────────────────────── */

export type SortState<K extends string> = { key: K; dir: 1 | -1 }

/** sort glyph: a 12px chevron on every sortable column; the active one swaps
 *  to a brand arrow. */
export function SortTh<K extends string>({
  label,
  col,
  onSort,
  className,
  sort,
}: {
  label: string
  col: K
  onSort: (k: K) => void
  className?: string
  sort: SortState<K>
}) {
  const active = sort.key === col
  return (
    <button
      onClick={() => onSort(col)}
      aria-label={`Sort by ${label}${active ? `, currently ${sort.dir === 1 ? "ascending" : "descending"}` : ""}`}
      className={cn(
        COL_HEAD,
        "inline-flex items-center gap-1 whitespace-nowrap outline-none transition-colors hover:text-ink focus-visible:text-ink",
        className,
      )}
    >
      {label}
      {active ? (
        sort.dir === 1 ? (
          <ArrowUp className="size-3 text-brand" />
        ) : (
          <ArrowDown className="size-3 text-brand" />
        )
      ) : (
        <ChevronsUpDown className="size-3 shrink-0 text-faint opacity-50" strokeWidth={2} />
      )}
    </button>
  )
}

/* ── row checkbox ─────────────────────────────────────────────── */

/** 16px checkbox with an 8px padding hit-area; stops propagation so a tick
 *  never opens the row. */
export function RowCheck({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean
  onChange: () => void
  label: string
  indeterminate?: boolean
}) {
  return (
    <label className="-m-2 inline-flex w-max cursor-pointer p-2" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate
        }}
        onChange={onChange}
        aria-label={label}
        style={{ accentColor: "var(--accent-sig)" }}
        className="size-4 cursor-pointer"
      />
    </label>
  )
}

/* ── row overflow menu ────────────────────────────────────────── */

export interface RowMenuItem {
  icon: LucideIcon
  label: string
  onClick: () => void
}

/** the ⋯ trigger — a portalled menu, flips up near the viewport bottom */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const close = () => setOpen(false)
    window.addEventListener("keydown", escape)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("keydown", escape)
      window.removeEventListener("resize", close)
    }
  }, [open])
  const menuH = items.length * 32 + 10
  return (
    <div className="relative justify-self-end">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setPosition({
            left: Math.max(8, Math.min(r.right - 176, window.innerWidth - 184)),
            top: r.bottom + menuH + 6 > window.innerHeight ? r.top - menuH - 6 : r.bottom + 6,
          })
          setOpen((v) => !v)
        }}
        className={cn(
          "grid size-7 place-items-center rounded-md transition-colors",
          open ? "bg-panel-2 text-ink" : "text-faint hover:bg-panel-2 hover:text-ink",
        )}
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </button>
      {open &&
        createPortal(
          <>
            <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
            <div
              role="menu"
              style={position}
              className="animate-rise fixed z-40 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-2"
            >
              {items.map(({ icon: Icon, label: l, onClick }) => (
                <button
                  key={l}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onClick()
                  }}
                  className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
                >
                  <Icon className="size-3.5 flex-none text-faint" strokeWidth={1.9} />
                  {l}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

/* ── facet filters ────────────────────────────────────────────────
   The Bills FilterMenu knows bill fields only. Masters filter on facets —
   group, sync state, source — each a multi-select list. Same trigger, same
   popover, same removable tokens as Bills. */

export interface Facet {
  key: string
  label: string
  options: { value: string; label: string; dot?: string }[]
}
export type FacetState = Record<string, Set<string>>

export function FacetFilter({
  facets,
  value,
  onChange,
  open,
  setOpen,
  field,
  setField,
}: {
  facets: Facet[]
  value: FacetState
  onChange: (key: string, next: Set<string>) => void
  open: boolean
  setOpen: (v: boolean) => void
  field: string | null
  setField: (f: string | null) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen])
  const active = Object.values(value).some((s) => s.size > 0)
  const facet = facets.find((f) => f.key === field)

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => {
          setOpen(!open)
          setField(null)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[13px] font-semibold shadow-[0_1px_2px_rgba(21,26,38,0.05)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          open || active ? "border-line-strong text-ink" : "border-line-2 text-body hover:border-line-strong",
        )}
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={2} />
        Filters
      </button>

      {open && (
        <div role="menu" className="animate-rise absolute right-0 top-[38px] z-50 w-[260px] overflow-hidden rounded-lg border border-line bg-surface shadow-2">
          {!facet ? (
            <div className="py-1">
              {facets.map((f) => (
                <button
                  key={f.key}
                  role="menuitem"
                  onClick={() => setField(f.key)}
                  className="flex h-8 w-full items-center justify-between px-3 text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
                >
                  <span>
                    {f.label}
                    {value[f.key]?.size ? <span className="ml-1.5 text-brand tabular-nums">{value[f.key].size}</span> : null}
                  </span>
                  <ChevronRight className="size-4 text-faint" strokeWidth={2} />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setField(null)}
                className="flex h-9 w-full items-center gap-1.5 border-b border-line px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-panel"
              >
                <ChevronLeft className="size-4 text-faint" strokeWidth={2} />
                {facet.label}
              </button>
              <div className="max-h-[300px] overflow-y-auto p-1.5">
                {facet.options.map((o) => {
                  const cur = value[facet.key] ?? new Set<string>()
                  const on = cur.has(o.value)
                  return (
                    <button
                      key={o.value}
                      role="menuitemcheckbox"
                      aria-checked={on}
                      onClick={() => {
                        const n = new Set(cur)
                        if (on) n.delete(o.value)
                        else n.add(o.value)
                        onChange(facet.key, n)
                      }}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors",
                        on ? "bg-brand-tint text-brand" : "text-body hover:bg-panel hover:text-ink",
                      )}
                    >
                      {o.dot && <span className={cn("size-[7px] flex-none rounded-full", o.dot)} />}
                      <span className="flex-1 truncate">{o.label}</span>
                      {on && <Check className="size-3.5 flex-none" strokeWidth={2.4} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** applied facets as removable inline tokens — click the label to reopen its editor */
export function FacetTokens({
  facets,
  value,
  onEdit,
  onClear,
}: {
  facets: Facet[]
  value: FacetState
  onEdit: (key: string) => void
  onClear: (key: string) => void
}) {
  const tokens = facets
    .filter((f) => value[f.key]?.size)
    .map((f) => ({
      key: f.key,
      label: `${f.label}: ${f.options
        .filter((o) => value[f.key].has(o.value))
        .map((o) => o.label)
        .join(", ")}`,
    }))
  if (!tokens.length) return null
  return (
    <>
      {tokens.map((t) => (
        <span key={t.key} className="inline-flex h-7 items-center gap-0.5 rounded-[6px] border border-line-2 bg-surface pl-2.5 pr-0.5 text-[13px] text-body">
          <button onClick={() => onEdit(t.key)} className="max-w-[220px] truncate outline-none transition-colors hover:text-ink focus-visible:text-ink">
            {t.label}
          </button>
          <button
            onClick={() => onClear(t.key)}
            aria-label={`Remove ${t.label} filter`}
            className="grid size-6 flex-none place-items-center rounded-md text-faint outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        </span>
      ))}
    </>
  )
}

/* ── collapsible group row ────────────────────────────────────── */

/** a group header inside a grouped register — name, count, and a subtotal
 *  that sits in the same grid column as the figures beneath it. The label
 *  spans the leading `labelSpan` columns; `total` takes the next one. */
export function GroupRow({
  cols,
  labelSpan,
  label,
  meta,
  count,
  total,
  open,
  onToggle,
}: {
  cols: string
  labelSpan: number
  label: string
  meta?: string
  count: number
  total?: ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        cols,
        "register-group-row min-h-10 w-full border-l-2 border-transparent bg-[var(--row-stripe)] px-4 py-2 text-left shadow-[inset_0_-1px_0_var(--line)] outline-none transition-colors hover:bg-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2" style={{ gridColumn: `1 / span ${labelSpan}` }}>
        <ChevronRight className={cn("size-3.5 flex-none text-faint transition-transform duration-150", open && "rotate-90")} strokeWidth={2.2} />
        <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
        {meta && <span className="flex-none text-[12px] text-faint">{meta}</span>}
        <span className="flex-none text-[12px] tabular-nums text-faint">· {count}</span>
      </span>
      {total}
    </button>
  )
}

/* ── view-mode switch ─────────────────────────────────────────── */

/** a two-way segmented switch — grouped tree vs flat sortable list */
export function SegmentSwitch<K extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: K
  options: { key: K; label: string; icon: LucideIcon }[]
  onChange: (k: K) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-[34px] items-center gap-0.5 rounded-[7px] border border-line bg-surface p-0.5">
      {options.map(({ key, label: l, icon: Icon }) => (
        <button
          key={key}
          role="radio"
          aria-checked={value === key}
          title={l}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-[5px] px-2 text-[13px] transition-colors",
            value === key ? "bg-brand-tint font-medium text-brand" : "text-body hover:text-ink",
          )}
        >
          <Icon className="size-4" strokeWidth={1.9} />
          <span className="register-segment-label">{l}</span>
        </button>
      ))}
    </div>
  )
}
