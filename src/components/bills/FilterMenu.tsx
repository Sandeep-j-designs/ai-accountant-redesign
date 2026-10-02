import { useEffect, useRef, useState } from "react"
import { SlidersHorizontal, ChevronRight, ChevronLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { STATUS_META } from "@/components/bills/status"
import type { BillStatus } from "@/data/invoice"

const FILTER_STATUSES: BillStatus[] = ["approved", "scheduled", "posted", "paid", "overdue"]

export type Field = "status" | "amount" | "date" | "vendor"
const FIELD_LABEL: Record<Field, string> = {
  status: "Status",
  amount: "Amount",
  date: "Bill date",
  vendor: "Vendor",
}

export type FilterMenuProps = {
  active: boolean
  open: boolean
  setOpen: (v: boolean) => void
  field: Field | null
  setField: (f: Field | null) => void
  status: Set<BillStatus>
  onStatus: (s: Set<BillStatus>) => void
  amtMin: string
  amtMax: string
  onAmount: (min: string, max: string) => void
  dateFrom: string
  dateTo: string
  onDate: (from: string, to: string) => void
  vendor: string
  onVendor: (v: string) => void
}

/** Fields opens a Level-2 popover; each field opens its editor in-place. All
 *  edits wire straight to the existing filter state — no new filtering logic. */
export function FilterMenu(props: FilterMenuProps) {
  const { open, setOpen, field, setField } = props
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

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
          open || props.active
            ? "border-line-strong text-ink"
            : "border-line-2 text-body hover:border-line-strong",
        )}
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={2} />
        Filters
      </button>

      {open && (
        <div
          role="menu"
          className="animate-rise absolute right-0 top-[38px] z-50 w-[280px] overflow-hidden rounded-lg border border-line bg-surface shadow-2"
        >
          {field === null ? (
            <div className="py-1">
              {(Object.keys(FIELD_LABEL) as Field[]).map((f) => (
                <button
                  key={f}
                  role="menuitem"
                  onClick={() => setField(f)}
                  className="flex h-8 w-full items-center justify-between px-3 text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
                >
                  {FIELD_LABEL[f]}
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
                {FIELD_LABEL[field]}
              </button>
              <div className="p-3">
                {field === "status" && <StatusEditor {...props} />}
                {field === "amount" && <AmountEditor {...props} />}
                {field === "date" && <DateEditor {...props} />}
                {field === "vendor" && <VendorEditor {...props} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── field editors ────────────────────────────────────────────── */

function StatusEditor({ status, onStatus }: FilterMenuProps) {
  // single-select: pick one status (or All)
  const pick = (s: BillStatus | null) => onStatus(s ? new Set([s]) : new Set())
  const current = status.size === 1 ? [...status][0] : null
  return (
    <div className="flex flex-col gap-0.5">
      <StatusRow label="All statuses" active={status.size === 0} onClick={() => pick(null)} />
      {FILTER_STATUSES.map((s) => (
        <StatusRow
          key={s}
          label={STATUS_META[s].label}
          dot={STATUS_META[s].dot}
          active={current === s}
          onClick={() => pick(s)}
        />
      ))}
    </div>
  )
}

function StatusRow({
  label,
  dot,
  active,
  onClick,
}: {
  label: string
  dot?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
        active ? "bg-brand-tint font-semibold text-brand" : "text-body hover:bg-panel hover:text-ink",
      )}
    >
      {dot ? <span className={cn("size-2 flex-none rounded-full", dot)} /> : <span className="size-2" />}
      {label}
    </button>
  )
}

function AmountEditor({ amtMin, amtMax, onAmount }: FilterMenuProps) {
  const inp =
    "h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-[13px] tabular-nums text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid"
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="numeric"
        value={amtMin}
        onChange={(e) => onAmount(e.target.value.replace(/[^\d]/g, ""), amtMax)}
        placeholder="Min"
        className={inp}
      />
      <span className="text-faint">–</span>
      <input
        inputMode="numeric"
        value={amtMax}
        onChange={(e) => onAmount(amtMin, e.target.value.replace(/[^\d]/g, ""))}
        placeholder="Max"
        className={inp}
      />
    </div>
  )
}

// TODO(data): presets compute from the real `new Date()`; fixtures are dated
// July 2026, so a preset may return no rows if the runtime clock differs. The
// Custom path (two text inputs) always drives the existing dateFrom/dateTo.
function DateEditor({ dateFrom, dateTo, onDate }: FilterMenuProps) {
  const [custom, setCustom] = useState(!!(dateFrom || dateTo))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const preset = (from: Date, to: Date) => {
    onDate(iso(from), iso(to))
    setCustom(false)
  }
  const now = new Date()
  const presets: [string, () => void][] = [
    ["This week", () => preset(new Date(now.getTime() - now.getDay() * 864e5), now)],
    ["This month", () => preset(new Date(now.getFullYear(), now.getMonth(), 1), now)],
    ["Last 30 days", () => preset(new Date(now.getTime() - 30 * 864e5), now)],
  ]
  const dinp =
    "h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-[13px] tabular-nums text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid"
  return (
    <div className="flex flex-col gap-1">
      {presets.map(([label, fn]) => (
        <button
          key={label}
          onClick={fn}
          className="flex h-8 items-center rounded-md px-2 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
        >
          {label}
        </button>
      ))}
      <button
        onClick={() => setCustom((v) => !v)}
        className={cn(
          "flex h-8 items-center rounded-md px-2 text-left text-[13px] transition-colors",
          custom ? "bg-brand-tint font-semibold text-brand" : "text-body hover:bg-panel hover:text-ink",
        )}
      >
        Custom range
      </button>
      {custom && (
        <div className="mt-1 flex items-center gap-2">
          {/* styled TEXT inputs — never native <input type="date"> */}
          <input
            type="text"
            value={dateFrom}
            onChange={(e) => onDate(e.target.value, dateTo)}
            placeholder="YYYY-MM-DD"
            className={dinp}
          />
          <span className="text-faint">–</span>
          <input
            type="text"
            value={dateTo}
            onChange={(e) => onDate(dateFrom, e.target.value)}
            placeholder="YYYY-MM-DD"
            className={dinp}
          />
        </div>
      )}
    </div>
  )
}

/* ── applied-filter tokens — removable chips before the Filters button ── */
export function FilterTokens({
  status,
  amtMin,
  amtMax,
  dateFrom,
  dateTo,
  vendor,
  onEdit,
  onClear,
}: {
  status: Set<BillStatus>
  amtMin: string
  amtMax: string
  dateFrom: string
  dateTo: string
  vendor: string
  onEdit: (f: Field) => void
  onClear: (f: Field) => void
}) {
  const tokens: { f: Field; label: string }[] = []
  if (status.size > 0)
    tokens.push({ f: "status", label: `Status: ${[...status].map((s) => STATUS_META[s].label).join(", ")}` })
  if (amtMin || amtMax) tokens.push({ f: "amount", label: `Amount: ${amtMin || "0"}–${amtMax || "∞"}` })
  if (dateFrom || dateTo) tokens.push({ f: "date", label: `Bill date: ${dateFrom || "…"} – ${dateTo || "…"}` })
  if (vendor) tokens.push({ f: "vendor", label: `Vendor: ${vendor}` })
  if (tokens.length === 0) return null
  return (
    <>
      {tokens.map((t) => (
        <span
          key={t.f}
          className="inline-flex h-7 items-center gap-0.5 rounded-[6px] border border-line-2 bg-surface pl-2.5 pr-0.5 text-[13px] text-body"
        >
          <button
            onClick={() => onEdit(t.f)}
            className="max-w-[220px] truncate outline-none transition-colors hover:text-ink focus-visible:text-ink"
          >
            {t.label}
          </button>
          <button
            onClick={() => onClear(t.f)}
            aria-label={`Remove ${FIELD_LABEL[t.f]} filter`}
            className="grid size-6 flex-none place-items-center rounded-md text-faint outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        </span>
      ))}
    </>
  )
}

function VendorEditor({ vendor, onVendor }: FilterMenuProps) {
  return (
    <input
      type="text"
      autoFocus
      value={vendor}
      onChange={(e) => onVendor(e.target.value)}
      placeholder="Match vendor or bill no.…"
      className="h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-brand-vivid focus-visible:ring-2 focus-visible:ring-brand-vivid"
    />
  )
}
