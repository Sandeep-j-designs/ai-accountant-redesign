import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronRight, Check, Lock, Pencil, X, Plus, SlidersHorizontal, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import type { ReviewItem } from "@/data/review"
import { Button } from "@/components/ui/button"
import { Amt } from "@/components/cockpit/kit"
import { LEDGER_OPTIONS, COST_CENTRE_OPTIONS, type CodingLine, type CodingCell } from "@/data/abcomBill"
import { buildCodingModel, type BillMeta } from "@/data/codingModel"
import {
  ALL_FIELDS, CHIPS, FIELD_CATALOG, CATALOG_TOTAL, FIELD_GROUP, FEATURE_GROUPS,
  PRIMARY_FIELDS, PRIMARY_KEYS, HOST_LABEL, VENDOR_MASTER,
  defaultFeatureState, defaultFieldState,
  type RegField, type RegGroup, type ChipId,
} from "@/data/fieldCatalog"

/* ────────────────────────────────────────────────────────────────────────
   The needs-review bill detail — one field registry, three surfaces.

   Every field is defined once (data/fieldCatalog). Configure writes the
   enabled-state (feature flags + per-field toggles); the board reads it and
   renders each enabled+relevant field at its PLACEMENT: header fields fill
   their chip's sub-sheet (grouped by sub-section); line fields become inline
   rows on every line item. Enable a field in Configure and it appears here;
   disable it and it's gone. Fields not applicable to this bill are hidden.
   ──────────────────────────────────────────────────────────────────────── */

type Dim = "ledger" | "costCentre"
const DIM_LABEL: Record<Dim, string> = { ledger: "Ledger", costCentre: "Cost centre" }
const DIM_OPTS: Record<Dim, { name: string; note: string; rec?: boolean }[]> = { ledger: LEDGER_OPTIONS, costCentre: COST_CENTRE_OPTIONS }
const linePending = (l: CodingLine) => l.ledger.status === "pending" || l.costCentre.status === "pending"
const GROUP_LABEL: Record<string, string> = Object.fromEntries(FIELD_CATALOG.map((g) => [g.id, g.label]))

type Mode = "item" | "account"
/* Account (Accounting Invoice) mode — book straight to ledgers, no stock.
   One row per ledger; amounts are the taxable base and sum to the taxable
   total (tax is shown separately, exactly as Tally posts it). */
interface LedgerRow { id: number; ledger: CodingCell; costCentre: CodingCell; amount: number; lineIds: number[] }
const ledgerPending = (r: LedgerRow) => r.ledger.status === "pending" || r.costCentre.status === "pending"

/** collapse stock lines into ledger rows (Item → Account), grouping by ledger.
 *  Carries any account-only rows the user added (no backing lines) so a round
 *  trip never clears them. */
function collapseLines(lines: CodingLine[], prior: LedgerRow[] = []): LedgerRow[] {
  const groups: LedgerRow[] = []
  for (const l of lines) {
    const key = l.ledger.status === "pending" ? "__pending__" : l.ledger.value
    let g = groups.find((x) => (x.ledger.status === "pending" ? "__pending__" : x.ledger.value) === key)
    if (!g) { g = { id: 0, ledger: { ...l.ledger }, costCentre: { ...l.costCentre }, amount: 0, lineIds: [] }; groups.push(g) }
    g.amount += l.taxable
    g.lineIds.push(l.id)
    if (g.lineIds.length > 1 && (l.costCentre.value !== g.costCentre.value || l.costCentre.status !== g.costCentre.status)) g.costCentre = { value: "—", status: "pending" }
  }
  const extra = prior.filter((r) => r.lineIds.length === 0) // user-added ledgers survive the trip back
  return [...groups, ...extra].map((g, i) => ({ ...g, id: i + 1 }))
}
/** apply ledger-row coding back onto the stock lines (Account → Item). */
function expandToLines(ledgers: LedgerRow[], lines: CodingLine[]): CodingLine[] {
  const byLine = new Map<number, LedgerRow>()
  for (const r of ledgers) for (const id of r.lineIds) byLine.set(id, r)
  return lines.map((l) => { const r = byLine.get(l.id); return r ? { ...l, ledger: { ...r.ledger }, costCentre: { ...r.costCentre } } : l })
}

interface FData { value: string; status: "auto" | "pending" | "resolved" | "review"; error?: string }

/* validation — only FORMAT rules here; "required" is enforced at post time */
const GSTIN_RE = /^[0-9]{2}[0-9A-Z]{13}$/
function formatError(f: RegField, v: string): string | null {
  if (f.key === "gstin" && !GSTIN_RE.test(v)) return "Invalid GSTIN — expected 15 chars (2-digit state code + PAN block)"
  if (f.key === "ewayNo" && !/^\d{12}$/.test(v)) return "E-Way Bill no. must be exactly 12 digits"
  return null
}
type Sev = "ok" | "warn" | "err"
type Flavor = "verified" | "proposed" | "missing" | "review" | "invalid" | "required"
/** resolve a field's display state from its data + whether Post was attempted */
function fieldState(f: RegField, d: FData, posted: boolean): { sev: Sev; flavor: Flavor; msg?: string } {
  if (d.error) return { sev: "err", flavor: "invalid", msg: d.error }
  if (d.status === "pending") {
    if (!d.value) {
      if (posted && f.mandatory) return { sev: "err", flavor: "required", msg: "Required — please fill" }
      return { sev: "warn", flavor: f.hint ? "proposed" : "missing" } // proposed (has suggestion) vs couldn't-read
    }
    return { sev: "warn", flavor: "review" } // pre-filled but unconfirmed (e.g. inter-state place of supply)
  }
  if (d.status === "review") return { sev: "warn", flavor: "review" } // extracted, low confidence
  return { sev: "ok", flavor: "verified" }
}
/** a field that must be dealt with before posting. A low-confidence auto read
 *  (status "review") is advisory; a genuine pending decision blocks. */
function isBlocking(f: RegField, d: FData): boolean {
  if (d.error) return true
  if (d.status === "pending") return d.value ? true : !!f.mandatory
  return false
}

export function CodingCockpitScreen({ bill, isLast, onAdvance }: { bill: ReviewItem; isLast: boolean; onAdvance: () => void }) {
  const { state, dispatch } = useBill()
  const alreadyPosted = state.postedReviewIds.includes(bill.billId)
  const [saving, setSaving] = useState(false)
  const saveRequested = useRef(false)
  const [zoom, setZoom] = useState(() => { try { return Number(sessionStorage.getItem("aia-document-zoom")) === 125 ? 125 : 100 } catch { return 100 } })
  useEffect(() => { try { sessionStorage.setItem("aia-document-zoom", String(zoom)) } catch { /* optional preference */ } }, [zoom])
  useEffect(() => {
    if (!saving || !alreadyPosted) return
    const timer = setTimeout(onAdvance, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220)
    return () => clearTimeout(timer)
  }, [saving, alreadyPosted, onAdvance])

  // per-bill data model (rich fixture for ABCom; synthesized for the rest)
  const model = useMemo(() => buildCodingModel(bill), [bill.billId])
  // enabled-state (written by Configure, read everywhere)
  const [featureOn, setFeatureOn] = useState<Record<string, boolean>>(() => ({ ...defaultFeatureState(), ...model.featureOn }))
  const [fieldOn, setFieldOn] = useState<Record<string, boolean>>(() => defaultFieldState())
  // header-field bill data, keyed by field key (model override → registry default)
  const [data, setData] = useState<Record<string, FData>>(() =>
    Object.fromEntries(ALL_FIELDS.filter((f) => f.placement.at === "header").map((f) => [f.key, model.header[f.key] ?? { value: f.value ?? "", status: f.status ?? "auto" }])),
  )
  const [lines, setLines] = useState<CodingLine[]>(() =>
    model.lines.map((l) => ({ ...l, ledger: { ...l.ledger }, costCentre: { ...l.costCentre }, godown: { ...l.godown } })),
  )
  const lineTotal = useMemo(() => model.lines.reduce((n, l) => n + (l.ledger.status === "pending" ? 1 : 0) + (l.costCentre.status === "pending" ? 1 : 0), 0), [model])
  // ── entry mode: Tally's Item Invoice (stock lines) ⇄ Accounting Invoice (ledgers) ──
  const [mode, setMode] = useState<Mode>(() => model.defaultMode)
  const [ledgers, setLedgers] = useState<LedgerRow[]>(() => collapseLines(model.lines))
  const ledgerBaseline = useMemo(() => collapseLines(model.lines).reduce((n, r) => n + (r.ledger.status === "pending" ? 1 : 0) + (r.costCentre.status === "pending" ? 1 : 0), 0), [model])
  const [postAttempted, setPostAttempted] = useState(false)
  const [needsOpen, setNeedsOpen] = useState(false)
  const [lineCursor, setLineCursor] = useState(-1)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const enabled = (f: RegField) => fieldOn[f.key] !== false && (FEATURE_GROUPS.includes(FIELD_GROUP[f.key]) ? !!featureOn[FIELD_GROUP[f.key]] : true)
  const dOf = (f: RegField): FData => data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }
  const stOf = (f: RegField) => fieldState(f, dOf(f), postAttempted)

  // header fields grouped by chip; line fields for the cards
  // sub-screen fields exclude the primaries (those are edited in place on the voucher)
  const headerFor = (chip: ChipId) => ALL_FIELDS.filter((f) => f.placement.at === "header" && f.placement.chip === chip && enabled(f) && !f.naOnBill && !PRIMARY_KEYS.has(f.key))
  const lineFields = useMemo(() => ALL_FIELDS.filter((f) => f.placement.at === "line" && enabled(f) && !f.naOnBill), [fieldOn, featureOn])
  const headerFieldsAll = ALL_FIELDS.filter((f) => f.placement.at === "header" && enabled(f) && !f.naOnBill)

  // the chips that show for this bill — blocking count + error flag
  const chips = useMemo(
    () => CHIPS.filter((c) => !c.feature || featureOn[c.feature]).map((c) => {
      const fields = headerFor(c.id)
      let blocking = 0, error = false
      for (const f of fields) { const d = data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }; if (fieldState(f, d, postAttempted).sev === "err") error = true; if (isBlocking(f, d)) blocking++ }
      return { ...c, fields, pending: blocking, error }
    }),
    [featureOn, fieldOn, data, postAttempted], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // completion (dynamic) — blocking = errors + required gaps; review is advisory.
  // the coding count reads from the active mode: stock lines or ledger rows.
  const openCells = useMemo(() => lines.reduce((n, l) => n + (l.ledger.status === "pending" ? 1 : 0) + (l.costCentre.status === "pending" ? 1 : 0), 0), [lines])
  const ledgerOpen = useMemo(() => ledgers.reduce((n, r) => n + (r.ledger.status === "pending" ? 1 : 0) + (r.costCentre.status === "pending" ? 1 : 0), 0), [ledgers])
  const codeOpen = mode === "item" ? openCells : ledgerOpen
  const codeBaseline = mode === "item" ? lineTotal : ledgerBaseline
  const headerBlocking = headerFieldsAll.filter((f) => isBlocking(f, dOf(f))).length
  const headerResolved = headerFieldsAll.filter((f) => { const d = dOf(f); return !d.error && d.status === "resolved" }).length
  const errorCount = headerFieldsAll.filter((f) => stOf(f).sev === "err").length
  const remaining = headerBlocking + codeOpen
  const done = headerResolved + (codeBaseline - codeOpen)
  const total = remaining + done
  const codedRows = mode === "item" ? lines.filter((l) => !linePending(l)).length : ledgers.filter((r) => !ledgerPending(r)).length
  const rowCount = mode === "item" ? lines.length : ledgers.length
  const enabledFieldCount = useMemo(() => ALL_FIELDS.filter((f) => enabled(f) && (mode === "item" || f.placement.at !== "line")).length, [fieldOn, featureOn, mode])

  // aggregated "needs you" across every chip + the line coding — one to-do list
  const needsGroups = useMemo(
    () => chips.map((c) => ({ label: c.label, fields: c.fields.filter((f) => isBlocking(f, data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" })) })).filter((g) => g.fields.length > 0),
    [chips, data],
  )
  type CodeCell = { id: number; dim: Dim; title: string; sub: string }
  const codingCells = useMemo<CodeCell[]>(() => {
    const a: CodeCell[] = []
    if (mode === "item") {
      for (const l of lines) {
        if (l.ledger.status === "pending") a.push({ id: l.id, dim: "ledger", title: `Line ${l.id} · ledger`, sub: l.description })
        if (l.costCentre.status === "pending") a.push({ id: l.id, dim: "costCentre", title: `Line ${l.id} · cost centre`, sub: l.description })
      }
    } else {
      for (const r of ledgers) {
        const name = r.ledger.status === "pending" ? "needs a ledger" : r.ledger.value
        if (r.ledger.status === "pending") a.push({ id: r.id, dim: "ledger", title: "Ledger", sub: `₹${Math.round(r.amount).toLocaleString("en-IN")} to book` })
        if (r.costCentre.status === "pending") a.push({ id: r.id, dim: "costCentre", title: "Cost centre", sub: name })
      }
    }
    return a
  }, [mode, lines, ledgers])
  const codingLabel = mode === "item" ? "Line items" : "Ledger allocation"
  const openNeeds = () => { setActive(null); setNeedsOpen(true) }

  const [active, setActive] = useState<ChipId | null>(null) // sub-screens open via a field's ›, not auto
  const [configOpen, setConfigOpen] = useState(false)
  const [configSearch, setConfigSearch] = useState("")
  const [configExpanded, setConfigExpanded] = useState<string[]>(["basic"])
  const [editing, setEditing] = useState<string | null>(null)
  const [hMenu, setHMenu] = useState<{ key: string; x: number; y: number } | null>(null)
  const [sheetLine, setSheetLine] = useState<number | null>(null) // which line's detail sheet is open
  const [sheetLedger, setSheetLedger] = useState<number | null>(null) // which ledger row's detail sheet is open
  const [hover, setHover] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ lid: number; dim: Dim; x: number; y: number } | null>(null)
  const [lgMenu, setLgMenu] = useState<{ id: number; dim: Dim; x: number; y: number } | null>(null) // ledger-row picker
  const [editAmt, setEditAmt] = useState<number | null>(null) // ledger row whose amount is being typed
  // the cost-split editor targets either a stock line or a ledger row
  const [alloc, setAlloc] = useState<{ target: "line" | "ledger"; id: number; base: number; rows: { name: string; amount: number }[] } | null>(null)
  const [nudge, setNudge] = useState<{ msg: ReactNode; apply: () => void } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast((c) => (c === m ? null : c)), 2200) }

  /* header field edits */
  const commitField = (key: string, raw: string) => {
    const v = raw.trim()
    const f = ALL_FIELDS.find((x) => x.key === key)
    const err = v && f ? formatError(f, v) : null
    setData((d) => ({ ...d, [key]: { value: v !== "" ? v : (d[key]?.value ?? ""), status: v ? "resolved" : (d[key]?.status ?? "pending"), error: err ?? undefined } }))
    setEditing(null)
  }
  const acceptProposal = (key: string) => { const f = ALL_FIELDS.find((x) => x.key === key); commitField(key, (f?.hint ?? "").split(" · ")[0]) }
  const confirmReview = (key: string) => setData((d) => ({ ...d, [key]: { value: d[key]?.value ?? "", status: "resolved" } }))
  const openFieldMenu = (anchor: HTMLElement, key: string) => { const r = anchor.getBoundingClientRect(); setHMenu({ key, x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 6 }) }
  const chooseField = (name: string) => {
    if (!hMenu) return
    const key = hMenu.key
    setData((d) => {
      const next: Record<string, FData> = { ...d, [key]: { value: name, status: "resolved" } }
      if (key === "partyAcName" && VENDOR_MASTER[name]) { const m = VENDOR_MASTER[name]; for (const k in m) next[k] = { value: m[k], status: "auto" } }
      return next
    })
    if (key === "partyAcName" && VENDOR_MASTER[name]) flash(`Vendor → ${name.split(" ")[0]} · details refreshed`)
    setHMenu(null)
  }

  /* line coding edits */
  const openMenu = (anchor: HTMLElement, lid: number, dim: Dim) => { const r = anchor.getBoundingClientRect(); setMenu({ lid, dim, x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6 }) }
  const choose = (name: string) => {
    if (!menu) return
    const { lid, dim } = menu
    setLines((prev) => prev.map((l) => (l.id === lid ? { ...l, [dim]: { value: name, status: "resolved" } } : l)))
    setMenu(null); flash(`Line ${lid} · ${DIM_LABEL[dim].toLowerCase()} → ${name}`)
    const sib = lines.filter((l) => l.id !== lid && l[dim].status === "pending")
    if (sib.length) {
      const n = { msg: <>Applied to line {lid}. <b className="font-medium text-ink">{sib.length}</b> other {sib.length > 1 ? "lines" : "line"} still need a {DIM_LABEL[dim].toLowerCase()}.</>, apply: () => { setLines((prev) => prev.map((l) => (l[dim].status === "pending" ? { ...l, [dim]: { value: name, status: "resolved" } } : l))); setNudge(null); flash(`Applied to ${sib.length} more`) } }
      setNudge(n); window.setTimeout(() => setNudge((c) => (c === n ? null : c)), 7000)
    }
  }
  const openSheet = (id: number) => { setActive(null); setNeedsOpen(false); setSheetLine(id) }

  /* ledger-row (Accounting Invoice) edits */
  const openLgMenu = (anchor: HTMLElement, id: number, dim: Dim) => { const r = anchor.getBoundingClientRect(); setLgMenu({ id, dim, x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6 }) }
  const chooseLedger = (name: string) => {
    if (!lgMenu) return
    const { id, dim } = lgMenu
    setLedgers((prev) => prev.map((r) => (r.id === id ? { ...r, [dim]: { value: name, status: "resolved" } } : r)))
    setLgMenu(null); flash(`Ledger · ${DIM_LABEL[dim].toLowerCase()} → ${name}`)
  }
  const commitAmt = (id: number, raw: string) => {
    const v = Math.round(Number(raw.replace(/[^\d.]/g, "")) || 0)
    setLedgers((prev) => prev.map((r) => (r.id === id ? { ...r, amount: v } : r)))
    setEditAmt(null)
  }
  const addLedger = () => setLedgers((prev) => {
    const used = prev.reduce((s, r) => s + r.amount, 0)
    const left = Math.max(0, model.meta.taxableTotal - used)
    const nid = prev.reduce((m, r) => Math.max(m, r.id), 0) + 1
    return [...prev, { id: nid, ledger: { value: "—", status: "pending" }, costCentre: { value: "—", status: "pending" }, amount: left, lineIds: [] }]
  })
  const removeLedger = (id: number) => setLedgers((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  const openLedgerSheet = (id: number) => { setActive(null); setNeedsOpen(false); setSheetLedger(id) }

  // toggle Item ⇄ Account — converts the current coding into the other shape (Ctrl+H)
  const switchMode = (m: Mode) => {
    if (m === mode) return
    setMenu(null); setLgMenu(null); setAlloc(null); setActive(null); setNeedsOpen(false); setSheetLine(null); setSheetLedger(null); setEditAmt(null); setLineCursor(-1)
    if (m === "account") setLedgers((prev) => collapseLines(lines, prev))
    else setLines((prev) => expandToLines(ledgers, prev))
    setMode(m)
    flash(m === "account" ? "Accounting invoice · booked to ledgers" : "Item invoice · stock lines")
  }

  const saveAndAdvance = () => { if (remaining > 0 || saveRequested.current || alreadyPosted) return; saveRequested.current = true; setSaving(true); dispatch({ type: "POST_REVIEW", ids: [bill.billId] }) }
  // Post is always clickable: if anything's unresolved, flag it (escalating
  // required-empty fields to red) and jump to the first blocking sub-screen.
  const handlePost = () => {
    if (remaining > 0) {
      setPostAttempted(true)
      openNeeds() // one list of everything left, across all chips + lines
      return
    }
    saveAndAdvance()
  }

  /* cost-centre split — targets a stock line (item) or a ledger row (account) */
  const openAlloc = (target: "line" | "ledger", id: number) => {
    setMenu(null); setLgMenu(null); setActive(null); setNeedsOpen(false)
    if (target === "line") { const l = lines.find((x) => x.id === id)!; setSheetLine(id); setAlloc({ target, id, base: l.amount, rows: l.costCentre.split ? l.costCentre.split.map((r) => ({ ...r })) : [{ name: COST_CENTRE_OPTIONS[0].name, amount: l.amount }] }) }
    else { const r = ledgers.find((x) => x.id === id)!; setSheetLedger(id); setAlloc({ target, id, base: r.amount, rows: r.costCentre.split ? r.costCentre.split.map((x) => ({ ...x })) : [{ name: COST_CENTRE_OPTIONS[0].name, amount: r.amount }] }) }
  }
  const setAllocRow = (i: number, patch: Partial<{ name: string; amount: number }>) => setAlloc((a) => (a ? { ...a, rows: a.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : a))
  const addAllocRow = () => setAlloc((a) => { if (!a) return a; const used = new Set(a.rows.map((r) => r.name)); const next = COST_CENTRE_OPTIONS.find((o) => !used.has(o.name))?.name ?? COST_CENTRE_OPTIONS[0].name; return { ...a, rows: [...a.rows, { name: next, amount: 0 }] } })
  const removeAllocRow = (i: number) => setAlloc((a) => (a && a.rows.length > 1 ? { ...a, rows: a.rows.filter((_, j) => j !== i) } : a))
  const autoAlloc = () => setAlloc((a) => { if (!a) return a; const per = Math.floor(a.base / a.rows.length); return { ...a, rows: a.rows.map((r, i) => ({ ...r, amount: i === a.rows.length - 1 ? a.base - per * (a.rows.length - 1) : per })) } })
  const applyAlloc = () => {
    if (!alloc) return
    const rows = alloc.rows.filter((r) => r.amount > 0)
    if (rows.length === 0 || Math.round(rows.reduce((s, r) => s + r.amount, 0)) !== Math.round(alloc.base)) return
    const cell: CodingCell = rows.length > 1 ? { value: `Split · ${rows.length} cost centres`, status: "resolved", split: rows } : { value: rows[0].name, status: "resolved" }
    if (alloc.target === "line") setLines((prev) => prev.map((x) => (x.id === alloc.id ? { ...x, costCentre: cell } : x)))
    else setLedgers((prev) => prev.map((x) => (x.id === alloc.id ? { ...x, costCentre: cell } : x)))
    flash(`Cost split across ${rows.length} cost centre${rows.length > 1 ? "s" : ""}`)
    setAlloc(null)
  }

  const activeChip = active ? chips.find((c) => c.id === active) : null
  const sheetLineData = sheetLine !== null ? lines.find((l) => l.id === sheetLine) ?? null : null
  const sheetLedgerData = sheetLedger !== null ? ledgers.find((r) => r.id === sheetLedger) ?? null : null

  const boardRef = useRef<HTMLDivElement>(null)
  const overlayOpen = !!active || needsOpen || configOpen || !!menu || !!hMenu || !!lgMenu || shortcutsOpen || sheetLine !== null || sheetLedger !== null
  // when nothing else owns the keyboard, keep focus in the board so its shortcuts
  // (↑/↓ lines, numbers, r/c) work regardless of which board element was clicked
  useEffect(() => {
    if (!overlayOpen && !editing && !alreadyPosted) boardRef.current?.focus({ preventScroll: true })
  }, [overlayOpen, editing, alreadyPosted])

  // ── board shortcuts (numbers / r / c / post / esc) — scoped to the board ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA"
      if (e.key === "Escape") {
        if (typing) return // let the input's own Esc (cancel) handle it
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (menu) setMenu(null)
        else if (hMenu) setHMenu(null)
        else if (lgMenu) setLgMenu(null)
        else if (alloc) setAlloc(null)
        else if (needsOpen) setNeedsOpen(false)
        else if (configOpen) setConfigOpen(false)
        else if (active) setActive(null)
        else if (sheetLine !== null) setSheetLine(null)
        else if (sheetLedger !== null) setSheetLedger(null)
        return
      }
      if (typing) return
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { if (!overlayOpen) { e.preventDefault(); handlePost() } return }
      if ((e.metaKey || e.ctrlKey) && (e.key === "h" || e.key === "H")) { if (!overlayOpen && !alreadyPosted) { e.preventDefault(); switchMode(mode === "item" ? "account" : "item") } return } // Tally's Ctrl+H change-mode
      if (overlayOpen || alreadyPosted || e.metaKey || e.ctrlKey || e.altKey) return // overlays own their keys
      // arrows/Enter are handled whenever the board (or nothing) has focus — so
      // the native ↑/↓ can't scroll the panel or jump focus into the header
      const inBoard = !boardRef.current || boardRef.current.contains(document.activeElement) || document.activeElement === document.body
      if (!inBoard) return
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setLineCursor((c) => Math.min((c < 0 ? -1 : c) + 1, rowCount - 1)) }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setLineCursor((c) => (c <= 0 ? 0 : c - 1)) }
      else if (e.key === "Enter" && lineCursor >= 0) { e.preventDefault(); const row = mode === "item" ? lines[lineCursor] : ledgers[lineCursor]; if (row) (mode === "item" ? openSheet : openLedgerSheet)(row.id) }
      else if (e.key === "?") { e.preventDefault(); setShortcutsOpen((o) => !o) }
      else if (/^[1-9]$/.test(e.key)) { const c = chips[+e.key - 1]; if (c) { e.preventDefault(); setActive(c.id) } }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); openNeeds() }
      else if (e.key === "c" || e.key === "C") { e.preventDefault(); setConfigOpen(true) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="coding-workspace relative grid h-full min-h-0 grid-cols-[44%_minmax(0,1fr)] overflow-hidden">
      <aside className="review-source-stage overflow-auto border-r border-line bg-page">
        <div className="review-source-inset px-6 py-8 2xl:px-10">
          <div className="mb-4 flex items-center justify-between"><span className="eyebrow">Source document</span><label className="flex items-center gap-2 text-[12px] text-faint">Page 1 of 1 <select aria-label="Document zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-body"><option value={100}>100%</option><option value={125}>125%</option></select></label></div>
          <div style={{ width: `${zoom}%` }}><SourceDoc meta={model.meta} lines={model.lines} hover={hover} setHover={setHover} onTrace={id => {
            if (mode !== "item") switchMode("item")
            setHover(id); setLineCursor(lines.findIndex(l => l.id === id))
            requestAnimationFrame(() => { const row = boardRef.current?.querySelector<HTMLElement>(`[data-coding-line="${id}"]`); row?.scrollIntoView({ block: "nearest", behavior: "instant" }); row?.focus({ preventScroll: true }) })
          }} /></div>
          <p className="mt-4 max-w-[520px] text-[11px] leading-relaxed text-faint">Select a document line to jump to its coding. Focus a coding line to highlight its source.</p>
        </div>
      </aside>

      <div ref={boardRef} tabIndex={-1} className="review-editor flex min-h-0 flex-col bg-surface outline-none">
        {/* lean work-panel header — the money anchor + verification progress.
            Identity (vendor · invoice · place of supply) lives on the source
            document and in the chips, so it isn't repeated here. */}
        <div className="review-editor-heading flex-none border-b border-line px-6 py-4 2xl:px-10">
          <div className="review-bill-identity"><span>REVIEW & RECORD</span><h1>{bill.vendor}</h1><p>{bill.invoiceNo}</p></div>
          <div className="mx-auto flex max-w-[640px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-2.5">
              <Amt value={model.meta.grandTotal} className="fig text-[22px] font-[680] tracking-[-0.02em] text-ink" />
              <span className="eyebrow">{alreadyPosted ? "Posted" : "Draft · not in books"}</span>
            </div>
            {(!alreadyPosted || saving) && (
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-[12px] text-muted-ink"><b className="font-medium text-ink">{done} of {total}</b> resolved</span>
                <div className="flex w-[132px] gap-1">{Array.from({ length: total }).map((_, i) => (<span key={i} className={cn("h-[3px] flex-1 rounded-full transition-colors", i < done ? "bg-success-dot" : "bg-panel-2")} />))}</div>
                <span className="whitespace-nowrap">{remaining > 0 ? (<button onClick={openNeeds} className="eyebrow inline-flex items-center gap-1.5 !text-faint transition-colors hover:!text-ink"><Lock className="size-3" /> {remaining} open</button>) : (<span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success"><Check className="size-3.5" strokeWidth={2.4} /> Ready to post</span>)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="review-editor-body flex-1 overflow-auto px-6 pb-8 pt-6 2xl:px-10">
          <div className="mx-auto max-w-[640px]">
            {alreadyPosted ? (
              <RecordedBoard meta={model.meta} lineCount={lines.length} />
            ) : (
              <>
                {/* primary voucher fields — edited in place; the › opens each field's grouped details */}
                <div className="mb-6">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="eyebrow">Voucher</span>
                    <div className="flex items-center gap-2">
                      <ModeToggle mode={mode} onChange={switchMode} />
                      <button onClick={() => setConfigOpen(true)} title="Configure which fields appear" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-[12px] text-body transition-colors hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
                        <SlidersHorizontal className="size-3.5" /> Configure<span className="rounded-full bg-panel-2 px-1.5 text-[10px] font-medium text-body">{enabledFieldCount}</span>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                    {PRIMARY_FIELDS.map(({ key, host }) => {
                      const f = ALL_FIELDS.find((x) => x.key === key)
                      if (!f || !enabled(f) || f.naOnBill) return null
                      const d = data[key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }
                      const hostFields = host ? headerFor(host as ChipId) : []
                      const showHost = hostFields.length > 0 ? host : null
                      const hostPending = hostFields.filter((x) => isBlocking(x, dOf(x))).length
                      return (
                        <PrimaryRow key={key} f={f} d={d} posted={postAttempted} host={showHost} hostPending={hostPending}
                          editing={editing === key} onStartEdit={() => setEditing(key)} onCommit={(v) => commitField(key, v)}
                          onOpenMenu={(el) => openFieldMenu(el, key)} onCancel={() => setEditing(null)}
                          onAccept={() => acceptProposal(key)} onConfirm={() => confirmReview(key)}
                          onOpenHost={() => showHost && setActive(showHost as ChipId)} />
                      )
                    })}
                  </div>
                </div>

                <div className="mb-2.5 flex items-baseline justify-between">
                  <span className="eyebrow">{codingLabel} · {rowCount}</span>
                  <span className="text-[11.5px] text-muted-ink"><b className="font-medium text-ink">{codedRows}</b> of {rowCount} done{mode === "item" && lineFields.length > 0 && <> · {lineFields.length + 3} fields/line</>}</span>
                </div>
                {mode === "item" ? (
                  <>
                    <div className="flex flex-col gap-2.5">
                      {lines.map((l, idx) => (
                        <LineCard key={l.id} line={l} hovered={hover === l.id} focused={lineCursor === idx} onHover={setHover} onOpenSheet={() => openSheet(l.id)} onEdit={openMenu} />
                      ))}
                    </div>
                    <InvoiceTotals taxable={model.meta.taxableTotal} taxTotal={model.meta.cgstTotal + model.meta.sgstTotal} grand={model.meta.grandTotal} booked={lines.reduce((s, l) => s + l.amount, 0)} />
                  </>
                ) : (
                  <LedgerBoard ledgers={ledgers} taxable={model.meta.taxableTotal} taxTotal={model.meta.cgstTotal + model.meta.sgstTotal} grand={model.meta.grandTotal}
                    cursor={lineCursor} editAmt={editAmt} onOpenSheet={openLedgerSheet} onEdit={openLgMenu}
                    onEditAmt={setEditAmt} onCommitAmt={commitAmt} onAdd={addLedger} onRemove={removeLedger} />
                )}
              </>
            )}
          </div>
        </div>

        {(!alreadyPosted || saving) && (
          <div className="review-action-bar flex-none border-t border-line bg-surface/95 px-6 py-3 shadow-commit-bar backdrop-blur 2xl:px-10">
            <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
              {remaining > 0 ? (
                <button onClick={openNeeds} className="min-w-0 truncate text-left text-[12.5px] text-muted-ink transition-colors hover:text-ink"><span className="font-medium text-ink underline decoration-line-strong underline-offset-2">{remaining} to resolve</span>{errorCount > 0 && <> · <span className="font-medium text-danger">{errorCount} to fix</span></>} · {codedRows}/{rowCount} {mode === "item" ? "lines" : "ledgers"}</button>
              ) : (
                <span className="min-w-0 truncate text-[12.5px] text-muted-ink"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 flex-none text-success" strokeWidth={2.4} /><span className="font-medium text-ink">Every field verified, {mode === "item" ? "all lines" : "all ledgers"} done.</span></span></span>
              )}
              <Button disabled={saving} variant={remaining > 0 ? "outline" : "default"} onClick={handlePost} className="min-w-[150px] px-4">{saving ? <><Check className="size-4" /> Saved to books</> : <>{remaining > 0 && <Lock className="size-3.5" />}{isLast ? "Post to books" : "Save & next bill"}</>}</Button>
            </div>
          </div>
        )}
      </div>

      {/* sub-sheet */}
      {activeChip && (
        <SubSheet
          chipLabel={HOST_LABEL[activeChip.id] ?? activeChip.label} blurb={CHIPS.find((c) => c.id === activeChip.id)!.blurb} fields={activeChip.fields} data={data} pending={activeChip.pending} posted={postAttempted} menuOpen={!!hMenu}
          onClose={() => { setActive(null); setEditing(null); setHMenu(null) }}
          editing={editing} onStartEdit={setEditing} onCommit={commitField} onOpenMenu={openFieldMenu} onCancelEdit={() => setEditing(null)}
          onAccept={acceptProposal} onConfirm={confirmReview}
        />
      )}

      {/* per-line detail sheet — the line's grouped details (item attributes,
          tax, cost-centre split) behind the › on each line, editable in place */}
      {sheetLineData && (
        <LineSheet
          line={sheetLineData} lineFields={lineFields} onClose={() => { setSheetLine(null); setAlloc(null) }} onEdit={openMenu}
          alloc={alloc?.target === "line" && alloc.id === sheetLineData.id ? alloc.rows : null} onAllocOpen={() => openAlloc("line", sheetLineData.id)}
          onAllocChange={setAllocRow} onAllocAdd={addAllocRow} onAllocRemove={removeAllocRow} onAllocApply={applyAlloc} onAllocCancel={() => setAlloc(null)} onAllocAuto={autoAlloc} />
      )}

      {/* per-ledger detail sheet (Account mode) — tax + cost-centre split behind the › */}
      {sheetLedgerData && (
        <LedgerSheet
          row={sheetLedgerData} taxTotal={model.meta.cgstTotal + model.meta.sgstTotal} taxable={model.meta.taxableTotal}
          onClose={() => { setSheetLedger(null); setAlloc(null) }} onEdit={openLgMenu}
          alloc={alloc?.target === "ledger" && alloc.id === sheetLedgerData.id ? alloc.rows : null} onAllocOpen={() => openAlloc("ledger", sheetLedgerData.id)}
          onAllocChange={setAllocRow} onAllocAdd={addAllocRow} onAllocRemove={removeAllocRow} onAllocApply={applyAlloc} onAllocCancel={() => setAlloc(null)} onAllocAuto={autoAlloc} />
      )}

      {/* aggregated "Needs you" — everything unresolved across chips + lines */}
      {needsOpen && (
        <NeedsSheet
          groups={needsGroups} codingCells={codingCells} codingLabel={codingLabel} count={remaining} errorCount={errorCount} posted={postAttempted} data={data} isLast={isLast} menuOpen={!!hMenu || !!menu || !!lgMenu}
          editing={editing} onStartEdit={setEditing} onCommit={commitField} onOpenMenu={openFieldMenu} onCancel={() => setEditing(null)} onAccept={acceptProposal} onConfirm={confirmReview}
          onCodingEdit={mode === "item" ? openMenu : openLgMenu} onClose={() => { setNeedsOpen(false); setEditing(null); setHMenu(null) }} onPost={() => { setNeedsOpen(false); saveAndAdvance() }}
        />
      )}

      {/* Configure drawer */}
      {configOpen && (
        <ConfigDrawer featureOn={featureOn} fieldOn={fieldOn} search={configSearch} expanded={configExpanded} enabledCount={enabledFieldCount} mode={mode}
          onClose={() => setConfigOpen(false)} onSearch={setConfigSearch}
          onToggleGroup={(id) => setConfigExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}
          onToggleFeature={(id) => setFeatureOn((s) => ({ ...s, [id]: !s[id] }))}
          onToggleField={(key) => setFieldOn((s) => ({ ...s, [key]: !(s[key] !== false) }))} />
      )}

      {menu && (<><div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} /><OptionMenu title={`${DIM_LABEL[menu.dim]} · line ${menu.lid}`} x={menu.x} y={menu.y} options={DIM_OPTS[menu.dim]} current={lines.find((l) => l.id === menu.lid)?.[menu.dim].value} onChoose={choose} createLabel={menu.dim === "costCentre" ? "Split across cost centres…" : undefined} onCreate={menu.dim === "costCentre" ? () => openAlloc("line", menu.lid) : undefined} onClose={() => setMenu(null)} /></>)}
      {lgMenu && (<><div className="fixed inset-0 z-[60]" onClick={() => setLgMenu(null)} /><OptionMenu title={`${DIM_LABEL[lgMenu.dim]} · ledger`} x={lgMenu.x} y={lgMenu.y} options={DIM_OPTS[lgMenu.dim]} current={ledgers.find((r) => r.id === lgMenu.id)?.[lgMenu.dim].value} onChoose={chooseLedger} createLabel={lgMenu.dim === "costCentre" ? "Split across cost centres…" : undefined} onCreate={lgMenu.dim === "costCentre" ? () => openAlloc("ledger", lgMenu.id) : undefined} onClose={() => setLgMenu(null)} /></>)}
      {hMenu && (() => { const f = ALL_FIELDS.find((x) => x.key === hMenu.key); if (!f?.options) return null; return (<><div className="fixed inset-0 z-[60]" onClick={() => setHMenu(null)} /><OptionMenu title={f.label} x={hMenu.x} y={hMenu.y} options={f.options.map((o) => ({ name: o, note: "" }))} current={data[f.key]?.value} onChoose={chooseField} createLabel="Create new…" onCreate={() => { setEditing(hMenu.key); setHMenu(null) }} onClose={() => setHMenu(null)} /></>) })()}

      {nudge && (<div className="fixed bottom-[76px] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-accent-sig/30 bg-surface px-4 py-2.5 shadow-card"><span className="text-[12.5px] text-body">{nudge.msg}</span><Button size="sm" onClick={nudge.apply}>Apply to all</Button><button className="text-[12px] text-muted-ink hover:text-ink" onClick={() => setNudge(null)}>Dismiss</button></div>)}
      {toast && (<div className="fixed bottom-[76px] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-ink px-4 py-2.5 text-[12.5px] text-white shadow-card"><Check className="size-3.5" strokeWidth={2.4} /> {toast}</div>)}

      {/* keyboard hint + legend */}
      <button onClick={() => setShortcutsOpen(true)} className="absolute bottom-[68px] right-6 z-30 grid size-6 place-items-center rounded-full border border-line-2 bg-surface text-[12px] font-medium text-muted-ink shadow-card transition-colors hover:text-ink" title="Keyboard shortcuts (?)">?</button>
      {shortcutsOpen && <ShortcutsLegend onClose={() => setShortcutsOpen(false)} />}
    </div>
  )
}

function ShortcutsLegend({ onClose }: { onClose: () => void }) {
  const groups: { title: string; items: [string, string][] }[] = [
    { title: "Board", items: [["⌃H", "switch item / account mode"], ["1–9", "open a sub-screen"], ["r", "review what needs you"], ["c", "configure fields"], ["j / k · ↓ / ↑", "move between rows"], ["↵", "open the focused row's details"], ["⌘↵", "post to books"]] },
    { title: "Sub-screens & lists", items: [["↓ / ↑", "move between fields"], ["↵", "accept / confirm / edit the field"], ["Esc", "close"]] },
    { title: "Pickers", items: [["↓ / ↑", "move"], ["↵", "choose"], ["Esc", "dismiss"]] },
    { title: "Bill", items: [["[ / ]", "previous / next bill"], ["?", "this legend"]] },
  ]
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/25" />
      <div className="relative w-[440px] max-w-[90vw] rounded-xl border border-line bg-surface p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="type-section-title text-ink">Keyboard shortcuts</h3><button onClick={onClose} className="rounded-md p-1 text-faint hover:bg-panel hover:text-ink"><X className="size-4" /></button></div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="eyebrow mb-1.5">{g.title}</div>
              <div className="flex flex-col gap-1">
                {g.items.map(([k, v]) => (<div key={k} className="flex items-baseline justify-between gap-3 text-[12px]"><span className="text-body">{v}</span><kbd className="flex-none rounded border border-line-2 bg-panel px-1.5 py-0.5 font-mono text-[11px] text-muted-ink">{k}</kbd></div>))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════ */

function Dot({ tone }: { tone: "ok" | "warn" | "resolved" | "err" | "hollow" }) {
  if (tone === "hollow") return <span className="size-1.5 flex-none rounded-full border border-warning-dot" />
  return <span className={cn("size-1.5 flex-none rounded-full", tone === "ok" && "bg-success-dot", tone === "warn" && "bg-warning-dot", tone === "resolved" && "bg-accent-sig", tone === "err" && "bg-danger-dot")} />
}
const DOT_FOR = (s: string): "ok" | "warn" | "resolved" => (s === "pending" ? "warn" : s === "resolved" ? "resolved" : "ok")


function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} role="switch" aria-checked={on} className={cn("relative h-[18px] w-[30px] flex-none rounded-full transition-colors", on ? "bg-brand" : "bg-panel-2", disabled && "opacity-45")}>
      <span className={cn("absolute top-[2px] size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-all", on ? "left-[14px]" : "left-[2px]")} />
    </button>
  )
}

/* ── the slide-in sub-sheet — renders a chip's enabled fields, grouped by sub-section ── */
function SubSheet({
  chipLabel, blurb, fields, data, pending, posted, menuOpen, onClose, editing, onStartEdit, onCommit, onOpenMenu, onCancelEdit, onAccept, onConfirm,
}: {
  chipLabel: string; blurb: string; fields: RegField[]; data: Record<string, FData>; pending: number; posted: boolean; menuOpen: boolean
  onClose: () => void; editing: string | null; onStartEdit: (k: string) => void; onCommit: (k: string, v: string) => void; onOpenMenu: (anchor: HTMLElement, k: string) => void; onCancelEdit: () => void; onAccept: (k: string) => void; onConfirm: (k: string) => void
}) {
  const [shown, setShown] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => { setShown(true); asideRef.current?.focus({ preventScroll: true }) })
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey) }
  }, [onClose])
  // keep focus in the sheet so ↑/↓ keeps working after an edit or a picker closes
  useEffect(() => { if (!editing && !menuOpen) asideRef.current?.focus({ preventScroll: true }) }, [editing, menuOpen])
  const activate = (f: RegField) => {
    const d = data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }
    const st = fieldState(f, d, posted)
    if (f.kind === "readonly") return
    if (st.flavor === "proposed") return onAccept(f.key)
    if (st.flavor === "review") return onConfirm(f.key)
    if (f.kind === "select") { const el = rowRefs.current[cursor]; if (el) onOpenMenu(el, f.key); return }
    onStartEdit(f.key)
  }
  // ↑/↓ move the field cursor, ↵ runs its primary action — scoped to the sheet
  const onNav = (e: React.KeyboardEvent) => {
    if (menuOpen) return
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return
    if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setCursor((c) => { const n = Math.min(c + 1, fields.length - 1); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n }) }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setCursor((c) => { const n = Math.max(c - 1, 0); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n }) }
    else if (e.key === "Enter") { e.preventDefault(); if (fields[cursor]) activate(fields[cursor]) }
  }
  // group by sub-section, preserving order
  const subs: { name: string; items: RegField[] }[] = []
  for (const f of fields) { const s = (f.placement.at === "header" && f.placement.sub) || ""; let g = subs.find((x) => x.name === s); if (!g) { g = { name: s, items: [] }; subs.push(g) } g.items.push(f) }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className={cn("absolute inset-0 bg-ink/25 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside ref={asideRef} tabIndex={-1} onKeyDown={onNav} className={cn("relative flex max-h-[85vh] w-[440px] max-w-full flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-16px_rgba(21,26,38,0.42)] outline-none transition-all duration-200 ease-out", shown ? "scale-100 opacity-100" : "scale-[.98] opacity-0")}>
        <div className="flex flex-none items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="type-section-title text-ink">{chipLabel}</h3>
              {pending > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning"><Dot tone="warn" />{pending} need you</span> : <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" strokeWidth={2.6} />verified</span>}
            </div>
            <p className="mt-1 text-[12px] text-muted-ink">{blurb} · {fields.length} field{fields.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-faint transition-colors hover:bg-panel hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-2">
          {fields.length === 0 ? <p className="px-1 py-6 text-center text-[12px] text-muted-ink">No fields enabled for this section.</p> : subs.map((sub) => (
            <div key={sub.name} className="py-1">
              {sub.name && <div className="sticky top-0 z-[1] -mx-5 mb-1 border-b border-line/60 bg-surface px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">{sub.name}</div>}
              <div className="flex flex-col">
                {sub.items.map((f) => { const gi = fields.indexOf(f); return (<SheetRow key={f.key} f={f} d={data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }} posted={posted} focused={gi === cursor} rowRef={(el) => { rowRefs.current[gi] = el }} editing={editing === f.key} onStartEdit={() => onStartEdit(f.key)} onCommit={(v) => onCommit(f.key, v)} onOpenMenu={(el) => onOpenMenu(el, f.key)} onCancel={onCancelEdit} onAccept={() => onAccept(f.key)} onConfirm={() => onConfirm(f.key)} />) })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-none items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-panel">Done</button>
        </div>
      </aside>
    </div>
  )
}

/* ── the aggregated "Needs you" — every unresolved item, across all chips ── */
function NeedsSheet({
  groups, codingCells, codingLabel, count, errorCount, posted, data, isLast, menuOpen,
  editing, onStartEdit, onCommit, onOpenMenu, onCancel, onAccept, onConfirm, onCodingEdit, onClose, onPost,
}: {
  groups: { label: string; fields: RegField[] }[]; codingCells: { id: number; dim: Dim; title: string; sub: string }[]; codingLabel: string; count: number; errorCount: number; posted: boolean; data: Record<string, FData>; isLast: boolean; menuOpen: boolean
  editing: string | null; onStartEdit: (k: string) => void; onCommit: (k: string, v: string) => void; onOpenMenu: (anchor: HTMLElement, k: string) => void; onCancel: () => void; onAccept: (k: string) => void; onConfirm: (k: string) => void
  onCodingEdit: (anchor: HTMLElement, id: number, dim: Dim) => void; onClose: () => void; onPost: () => void
}) {
  const [shown, setShown] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const asideRef = useRef<HTMLElement>(null)
  const flatFields = groups.flatMap((g) => g.fields)
  const total = flatFields.length + codingCells.length
  useEffect(() => {
    const id = requestAnimationFrame(() => { setShown(true); asideRef.current?.focus({ preventScroll: true }) })
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey) }
  }, [onClose])
  useEffect(() => { if (!editing && !menuOpen) asideRef.current?.focus({ preventScroll: true }) }, [editing, menuOpen])
  const activateIndex = (i: number) => {
    if (i < flatFields.length) {
      const f = flatFields[i]; const d = data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }; const st = fieldState(f, d, posted)
      if (f.kind === "readonly") return
      if (st.flavor === "proposed") return onAccept(f.key)
      if (st.flavor === "review") return onConfirm(f.key)
      if (f.kind === "select") { const el = rowRefs.current[i]; if (el) onOpenMenu(el, f.key); return }
      onStartEdit(f.key)
    } else { const cell = codingCells[i - flatFields.length]; const el = rowRefs.current[i]; if (cell && el) onCodingEdit(el, cell.id, cell.dim) }
  }
  const onNav = (e: React.KeyboardEvent) => {
    if (menuOpen) return
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return
    if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setCursor((c) => { const n = Math.min(c + 1, total - 1); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n }) }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setCursor((c) => { const n = Math.max(c - 1, 0); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n }) }
    else if (e.key === "Enter") { e.preventDefault(); activateIndex(cursor) }
  }
  return (
    <div className="absolute inset-0 z-[55]">
      <div className={cn("absolute inset-0 bg-ink/15 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside ref={asideRef} tabIndex={-1} onKeyDown={onNav} className={cn("absolute right-0 top-0 flex h-full w-[420px] flex-col border-l border-line bg-surface shadow-[-8px_0_40px_-12px_rgba(21,26,38,0.28)] outline-none transition-transform duration-200 ease-out", shown ? "translate-x-0" : "translate-x-full")}>
        <div className="flex flex-none items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="type-section-title text-ink">Needs you</h3>
              {count > 0 && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", errorCount > 0 ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning")}>{count} item{count === 1 ? "" : "s"}{errorCount > 0 && ` · ${errorCount} to fix`}</span>}
            </div>
            <p className="mt-1 text-[12px] text-muted-ink">Everything left to resolve before posting — across all sub-screens and {codingLabel.toLowerCase()}.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-faint transition-colors hover:bg-panel hover:text-ink"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-2">
          {count === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-success-bg text-success"><Check className="size-5" strokeWidth={2.4} /></span>
              <p className="mt-3 text-[13px] font-medium text-ink">Nothing left to resolve</p>
              <p className="mt-1 text-[12px] text-muted-ink">Every field is verified and all lines are done.</p>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.label} className="py-1">
                  <div className="sticky top-0 z-[1] -mx-5 mb-1 border-b border-line/60 bg-surface px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">{g.label}</div>
                  <div className="flex flex-col">
                    {g.fields.map((f) => { const gi = flatFields.indexOf(f); return (<SheetRow key={f.key} f={f} d={data[f.key] ?? { value: f.value ?? "", status: (f.status as FData["status"]) ?? "auto" }} posted={posted} focused={gi === cursor} rowRef={(el) => { rowRefs.current[gi] = el }} editing={editing === f.key} onStartEdit={() => onStartEdit(f.key)} onCommit={(v) => onCommit(f.key, v)} onOpenMenu={(el) => onOpenMenu(el, f.key)} onCancel={onCancel} onAccept={() => onAccept(f.key)} onConfirm={() => onConfirm(f.key)} />) })}
                  </div>
                </div>
              ))}
              {codingCells.length > 0 && (
                <div className="py-1">
                  <div className="sticky top-0 z-[1] -mx-5 mb-1 border-b border-line/60 bg-surface px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">{codingLabel}</div>
                  {codingCells.map((cell, li) => { const gi = flatFields.length + li; return <CodingNeedRow key={`${cell.id}-${cell.dim}`} cell={cell} focused={gi === cursor} rowRef={(el) => { rowRefs.current[gi] = el }} onEdit={onCodingEdit} /> })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex-none border-t border-line px-5 py-3">
          <Button onClick={onPost} disabled={count > 0} className="w-full">{count > 0 ? `Resolve ${count} to post` : isLast ? "Post to books" : "Save & next bill"}</Button>
        </div>
      </aside>
    </div>
  )
}

function CodingNeedRow({ cell, focused, rowRef, onEdit }: { cell: { id: number; dim: Dim; title: string; sub: string }; focused?: boolean; rowRef?: (el: HTMLDivElement | null) => void; onEdit: (anchor: HTMLElement, id: number, dim: Dim) => void }) {
  return (
    <div ref={rowRef} className={cn("-mx-2 flex items-center gap-3 rounded-md border-b border-line/50 px-2 py-2 last:border-b-0", focused && "bg-brand-tint/50 ring-1 ring-accent-sig/30")}>
      <Dot tone="warn" />
      <span className="flex-none text-[12px] text-muted-ink">{cell.title}</span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">{cell.sub}</span>
      <button onClick={(e) => onEdit(e.currentTarget, cell.id, cell.dim)} className="flex-none inline-flex items-center gap-1 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">{cell.dim === "ledger" ? "Pick ledger" : "Set cost centre"}<ChevronRight className="size-3 rotate-90" /></button>
    </div>
  )
}

/* the in-place editing control for one field — shared by the sub-sheet rows
   and the primary voucher fields */
function FieldControl({ f, d, st, editing, onStartEdit, onCommit, onOpenMenu, onCancel, onAccept, onConfirm }: {
  f: RegField; d: FData; st: { sev: Sev; flavor: Flavor; msg?: string }; editing: boolean
  onStartEdit: () => void; onCommit: (v: string) => void; onOpenMenu: (anchor: HTMLElement) => void; onCancel: () => void; onAccept: () => void; onConfirm: () => void
}) {
  const openMenuHere = (e: React.MouseEvent) => onOpenMenu(e.currentTarget as HTMLElement)
  const shortLabel = f.label.replace(/\s*\(.*\)/, "").toLowerCase()
  if (editing) return <InlineInput initial={d.status === "pending" && !d.value ? (f.hint?.split(" · ")[0] ?? "") : d.value} onCommit={onCommit} onCancel={onCancel} />
  if (st.flavor === "invalid") return <button onClick={f.kind === "select" ? openMenuHere : onStartEdit} className="group inline-flex min-w-0 items-center gap-1.5 text-left"><span className={cn("truncate text-[12.5px] font-medium text-danger", f.mono && "code text-[12px]")}>{d.value || "—"}</span><Pencil className="size-3 flex-none text-danger/70" /></button>
  if (st.flavor === "required") return <button onClick={f.kind === "select" ? openMenuHere : onStartEdit} className="inline-flex items-center gap-1.5 rounded-sm border border-danger/40 bg-danger-bg px-2.5 py-1 text-[12px] font-medium text-danger">Required — add {shortLabel}{f.kind === "select" ? <ChevronRight className="size-3 rotate-90" /> : <Pencil className="size-3" />}</button>
  if (st.flavor === "proposed") return <div className="flex items-center gap-2"><button onClick={onAccept} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">Use <span className="code">{f.hint}</span></button><button onClick={onStartEdit} className="text-[11px] text-muted-ink hover:text-ink">edit</button></div>
  if (st.flavor === "missing") return <button onClick={f.kind === "select" ? openMenuHere : onStartEdit} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">Add {shortLabel}{f.kind === "select" ? <ChevronRight className="size-3 rotate-90" /> : <Pencil className="size-3" />}</button>
  if (st.flavor === "review") return <div className="flex min-w-0 items-center gap-2"><button onClick={f.kind === "select" ? openMenuHere : onStartEdit} className={cn("truncate text-left text-[12.5px] text-ink underline decoration-warning-dot decoration-dashed underline-offset-2 transition-colors hover:text-brand", f.mono && "code text-[12px]")}>{d.value || "—"}</button><button onClick={onConfirm} className="inline-flex flex-none items-center gap-1 rounded-sm border border-success-line bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success transition-colors hover:bg-success-bg/70"><Check className="size-3" strokeWidth={2.6} />Confirm</button></div>
  if (f.kind === "readonly") return <span className={cn("truncate text-[12.5px] text-ink", f.mono && "code text-[12px]")}>{d.value || "—"}</span>
  if (f.kind === "select") return <button onClick={openMenuHere} className="group inline-flex min-w-0 items-center gap-1.5 text-left text-[12.5px] text-ink transition-colors hover:text-brand"><span className="truncate">{d.value || "—"}</span><ChevronRight className="size-3 flex-none rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
  return <button onClick={onStartEdit} className="group inline-flex min-w-0 items-center gap-1.5 text-left transition-colors"><span className={cn("truncate text-[12.5px] text-ink group-hover:text-brand", f.mono && "code text-[12px]")}>{d.value || "—"}</span><Pencil className="size-3 flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
}
const dotFor = (st: { sev: Sev; flavor: Flavor }, d: FData) => st.sev === "err" ? "err" : st.flavor === "missing" ? "hollow" : st.sev === "warn" ? "warn" : d.status === "resolved" ? "resolved" : "ok"

function SheetRow({ f, d, posted, focused, rowRef, editing, onStartEdit, onCommit, onOpenMenu, onCancel, onAccept, onConfirm }: { f: RegField; d: FData; posted: boolean; focused?: boolean; rowRef?: (el: HTMLDivElement | null) => void; editing: boolean; onStartEdit: () => void; onCommit: (v: string) => void; onOpenMenu: (anchor: HTMLElement) => void; onCancel: () => void; onAccept: () => void; onConfirm: () => void }) {
  const st = fieldState(f, d, posted)
  return (
    <div ref={rowRef} className={cn("-mx-2 rounded-md border-b border-line/60 px-2 py-2.5 last:border-b-0", focused && "bg-brand-tint/50 ring-1 ring-accent-sig/30")}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-faint">{f.label}</span>
        {st.flavor === "review" && d.status === "review" && <span className="rounded-full bg-warning-bg px-1.5 py-px text-[9px] font-medium text-warning">low confidence</span>}
        {st.flavor === "missing" && <span className="rounded-full bg-warning-bg px-1.5 py-px text-[9px] font-medium text-warning">couldn't read</span>}
        {f.source && st.sev === "ok" && <span className="text-[9.5px] text-faint/70">· {f.source}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Dot tone={dotFor(st, d)} />
        <FieldControl f={f} d={d} st={st} editing={editing} onStartEdit={onStartEdit} onCommit={onCommit} onOpenMenu={onOpenMenu} onCancel={onCancel} onAccept={onAccept} onConfirm={onConfirm} />
      </div>
      {st.msg && (st.flavor === "invalid" || st.flavor === "required") && <p className="mt-1 pl-3.5 text-[11px] text-danger">{st.msg}</p>}
    </div>
  )
}

/* a primary field, edited in place on the voucher; the › opens its host sub-screen */
function PrimaryRow({ f, d, posted, host, hostPending, editing, onStartEdit, onCommit, onOpenMenu, onCancel, onAccept, onConfirm, onOpenHost }: {
  f: RegField; d: FData; posted: boolean; host: string | null; hostPending: number; editing: boolean
  onStartEdit: () => void; onCommit: (v: string) => void; onOpenMenu: (anchor: HTMLElement) => void; onCancel: () => void; onAccept: () => void; onConfirm: () => void; onOpenHost: () => void
}) {
  const st = fieldState(f, d, posted)
  return (
    <div className="grid grid-cols-[136px_1fr_auto] items-center gap-3 border-b border-line/70 px-4 py-2.5 last:border-b-0">
      <span className="text-[12px] text-muted-ink">{f.label}{f.mandatory && <span className="text-warning">*</span>}</span>
      <div className="flex min-w-0 items-center gap-2"><Dot tone={dotFor(st, d)} /><FieldControl f={f} d={d} st={st} editing={editing} onStartEdit={onStartEdit} onCommit={onCommit} onOpenMenu={onOpenMenu} onCancel={onCancel} onAccept={onAccept} onConfirm={onConfirm} /></div>
      {host ? (
        <button onClick={onOpenHost} title={HOST_LABEL[host]} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-ink transition-colors hover:bg-panel hover:text-ink">
          {hostPending > 0 && <span className="size-1.5 rounded-full bg-warning-dot" />}
          <ChevronRight className="size-4" />
        </button>
      ) : <span />}
    </div>
  )
}

function InlineInput({ initial, onCommit, onCancel }: { initial: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial)
  return <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommit(v) } if (e.key === "Escape") { e.preventDefault(); onCancel() } }} onBlur={() => onCommit(v)} className="w-full rounded-sm border border-accent-sig bg-card px-2 py-1 text-[12.5px] text-ink outline-none ring-2 ring-accent-sig/20" />
}

/* ── one line — lean on the surface: identity + the two coding decisions,
   editable in place. Everything else (item attributes, tax, cost-centre
   split) lives behind the › in the line's detail sheet. ── */
function LineCard({ line: l, hovered, focused, onHover, onOpenSheet, onEdit }: {
  line: CodingLine; hovered: boolean; focused?: boolean; onHover: (n: number | null) => void; onOpenSheet: () => void; onEdit: (anchor: HTMLElement, lid: number, dim: Dim) => void
}) {
  const attn = linePending(l)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: "nearest" }) }, [focused])
  return (
    <div ref={ref} data-coding-line={l.id} tabIndex={0} onFocus={() => onHover(l.id)} onBlur={() => onHover(null)} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)} className={cn("rounded-lg border bg-surface shadow-card transition-colors", focused ? "border-accent-sig/50 ring-1 ring-accent-sig/30" : hovered ? "border-line-strong" : "border-line")}>
      <button onClick={onOpenSheet} className="group/head flex w-full items-start gap-3 px-4 pt-3.5 pb-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-ink">{l.description}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-ink"><span className="code">HSN {l.hsn}</span><span className="text-line-strong">·</span><span>{l.qty} × <Amt value={l.rate} className="text-muted-ink" /></span></div>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <div className="flex flex-col items-end"><Amt value={l.amount} className="fig text-[16px] font-medium text-ink" />{attn && <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.05em] text-warning">Needs you</span>}</div>
          <ChevronRight className="size-4 flex-none text-faint transition-colors group-hover/head:text-muted-ink" />
        </div>
      </button>

      {/* the coding decisions stay on the card — editable in place */}
      <div className="border-t border-line/60 px-4 py-1">
        <CodeRow line={l} dim="ledger" onEdit={onEdit} />
        {l.costCentre.split ? <SplitSummaryRow line={l} onEdit={onOpenSheet} /> : <CodeRow line={l} dim="costCentre" onEdit={onEdit} />}
      </div>
    </div>
  )
}

/* ── the per-line detail sheet — the line's grouped details behind its ›:
   coding (editable), item attributes, tax, and the cost-centre split editor ── */
function LineSheet({ line: l, lineFields, onClose, onEdit, alloc, onAllocOpen, onAllocChange, onAllocAdd, onAllocRemove, onAllocApply, onAllocCancel, onAllocAuto }: {
  line: CodingLine; lineFields: RegField[]; onClose: () => void; onEdit: (anchor: HTMLElement, lid: number, dim: Dim) => void
  alloc: { name: string; amount: number }[] | null; onAllocOpen: () => void; onAllocChange: (i: number, patch: Partial<{ name: string; amount: number }>) => void; onAllocAdd: () => void; onAllocRemove: (i: number) => void; onAllocApply: () => void; onAllocCancel: () => void; onAllocAuto: () => void
}) {
  const [shown, setShown] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => { const id = requestAnimationFrame(() => { setShown(true); asideRef.current?.focus({ preventScroll: true }) }); return () => cancelAnimationFrame(id) }, [])
  const attn = linePending(l)
  // item attributes grouped by their catalog section, preserving order
  const groups: { name: string; items: RegField[] }[] = []
  for (const f of lineFields) { const g = GROUP_LABEL[FIELD_GROUP[f.key]] ?? "Item details"; let e = groups.find((x) => x.name === g); if (!e) { e = { name: g, items: [] }; groups.push(e) } e.items.push(f) }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className={cn("absolute inset-0 bg-ink/25 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside ref={asideRef} tabIndex={-1} className={cn("relative flex max-h-[85vh] w-[460px] max-w-full flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-16px_rgba(21,26,38,0.42)] outline-none transition-all duration-200 ease-out", shown ? "scale-100 opacity-100" : "scale-[.98] opacity-0")}>
        <div className="flex flex-none items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="type-section-title truncate text-ink">{l.description}</h3>
              {attn ? <span className="inline-flex flex-none items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning"><Dot tone="warn" />needs you</span> : <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" strokeWidth={2.6} />coded</span>}
            </div>
            <p className="mt-1 text-[12px] text-muted-ink"><span className="code">HSN {l.hsn}</span> · {l.qty} × <Amt value={l.rate} className="text-muted-ink" /> · <Amt value={l.amount} className="font-medium text-ink" /></p>
          </div>
          <button onClick={onClose} className="flex-none rounded-md p-1 text-faint transition-colors hover:bg-panel hover:text-ink"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-2">
          {/* coding — the editable decisions, mirrored here for full context */}
          <div className="py-1">
            <div className="-mx-5 mb-1 border-b border-line/60 px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Coding</div>
            <CodeRow line={l} dim="ledger" onEdit={onEdit} />
            {l.costCentre.split && !alloc ? <SplitSummaryRow line={l} onEdit={onAllocOpen} /> : !alloc ? <CodeRow line={l} dim="costCentre" onEdit={onEdit} /> : null}
            {alloc && <AllocEditor rows={alloc} lineAmount={l.amount} onChange={onAllocChange} onAdd={onAllocAdd} onRemove={onAllocRemove} onApply={onAllocApply} onCancel={onAllocCancel} onAuto={onAllocAuto} />}
          </div>

          {/* item attributes — system-derived, grouped by catalog section */}
          {groups.map((g) => (
            <div key={g.name} className="py-1">
              <div className="-mx-5 mb-1 border-b border-line/60 px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">{g.name}</div>
              {g.items.map((f) => (
                <div key={f.key} className="flex items-center gap-3 border-b border-line/50 py-2 last:border-b-0">
                  <Dot tone="ok" /><span className="w-[132px] flex-none text-[12px] text-muted-ink">{f.label}</span><span className="text-[12.5px] text-ink">{f.lineValue ? f.lineValue(l) : "—"}</span>
                </div>
              ))}
            </div>
          ))}

          {/* tax — the per-line breakdown */}
          <div className="py-1">
            <div className="-mx-5 mb-1 border-b border-line/60 px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Tax</div>
            <TaxRow label="Taxable value" value={l.amount} />
            <TaxRow label={`CGST @ ${l.cgstPct}%`} value={l.cgst} />
            <TaxRow label={`SGST @ ${l.sgstPct}%`} value={l.sgst} />
            <div className="flex items-center gap-3 py-2"><Dot tone="ok" /><span className="w-[132px] flex-none text-[12px] font-medium text-ink">Total tax</span><Amt value={l.cgst + l.sgst} decimals className="ml-auto text-[12.5px] font-medium text-ink" /></div>
          </div>
        </div>

        <div className="flex flex-none items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-panel">Done</button>
        </div>
      </aside>
    </div>
  )
}

function TaxRow({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center gap-3 border-b border-line/50 py-2"><Dot tone="ok" /><span className="w-[132px] flex-none text-[12px] text-muted-ink">{label}</span><Amt value={value} decimals className="ml-auto text-[12.5px] text-ink" /></div>
}

/* ── Item ⇄ Account mode toggle (Tally's Ctrl+H change-mode) ── */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md border border-line bg-panel/60 p-0.5 text-[12px] font-medium" title="Switch entry mode · ⌃H">
      {(["account", "item"] as Mode[]).map((m) => (
        <button key={m} onClick={() => onChange(m)} className={cn("rounded-sm px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand", mode === m ? "bg-surface text-ink shadow-sm" : "text-muted-ink hover:text-ink")}>
          {m === "account" ? "Account" : "Item"}
        </button>
      ))}
    </div>
  )
}

/* ── Account (Accounting Invoice) body — ledger rows that sum to the taxable
   total, each coded in place, with a › to its detail sheet. ── */
function LedgerBoard({ ledgers, taxable, taxTotal, grand, cursor, editAmt, onOpenSheet, onEdit, onEditAmt, onCommitAmt, onAdd, onRemove }: {
  ledgers: LedgerRow[]; taxable: number; taxTotal: number; grand: number; cursor: number; editAmt: number | null
  onOpenSheet: (id: number) => void; onEdit: (anchor: HTMLElement, id: number, dim: Dim) => void; onEditAmt: (id: number | null) => void; onCommitAmt: (id: number, v: string) => void; onAdd: () => void; onRemove: (id: number) => void
}) {
  const booked = ledgers.reduce((s, r) => s + r.amount, 0)
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {ledgers.map((r, idx) => (
          <LedgerRowCard key={r.id} row={r} focused={cursor === idx} editingAmt={editAmt === r.id} canRemove={ledgers.length > 1}
            onOpenSheet={() => onOpenSheet(r.id)} onEdit={onEdit} onEditAmt={() => onEditAmt(r.id)} onCommitAmt={(v) => onCommitAmt(r.id, v)} onCancelAmt={() => onEditAmt(null)} onRemove={() => onRemove(r.id)} />
        ))}
      </div>
      <button onClick={onAdd} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-brand transition-colors hover:bg-brand-tint"><Plus className="size-3.5" /> Add ledger</button>

      <InvoiceTotals taxable={taxable} taxTotal={taxTotal} grand={grand} booked={booked} />
    </>
  )
}

/** Invoice totals card + reconciliation line — taxable value, tax, and grand
   total, then a balance line comparing `booked` (the amount coded so far, from
   ledger rows or stock lines) against the taxable value. Shared by both entry
   modes; mirrors how Tally posts an invoice. */
function InvoiceTotals({ taxable, taxTotal, grand, booked }: { taxable: number; taxTotal: number; grand: number; booked: number }) {
  const left = Math.round(taxable - booked)
  const balanced = left === 0
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        <div className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5"><span className="flex-none text-[12px] text-muted-ink">Taxable value</span><Amt value={taxable} className="ml-auto text-[12.5px] font-medium text-ink" /></div>
        <div className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5"><Dot tone="ok" /><span className="flex-none text-[12px] text-muted-ink">Tax · CGST + SGST</span><Amt value={taxTotal} decimals className="ml-auto text-[12px] text-muted-ink" /></div>
        <div className="flex items-center gap-3 bg-panel/50 px-4 py-2.5"><span className="flex-none text-[12.5px] font-medium text-ink">Invoice total</span><Amt value={grand} className="ml-auto fig text-[14px] font-semibold text-ink" /></div>
      </div>
      <div className={cn("mt-2 flex items-center gap-2 px-1 text-[11.5px] font-medium", balanced ? "text-success" : "text-warning")}>
        {balanced ? <><Check className="size-3.5" strokeWidth={2.4} /> Allocated in full · ₹{taxable.toLocaleString("en-IN")}</> : left > 0 ? <>₹{left.toLocaleString("en-IN")} of the taxable value still unbooked</> : <>₹{Math.abs(left).toLocaleString("en-IN")} booked over the taxable value</>}
      </div>
    </>
  )
}

function LedgerRowCard({ row: r, focused, editingAmt, canRemove, onOpenSheet, onEdit, onEditAmt, onCommitAmt, onCancelAmt, onRemove }: {
  row: LedgerRow; focused?: boolean; editingAmt?: boolean; canRemove: boolean
  onOpenSheet: () => void; onEdit: (anchor: HTMLElement, id: number, dim: Dim) => void; onEditAmt: () => void; onCommitAmt: (v: string) => void; onCancelAmt: () => void; onRemove: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: "nearest" }) }, [focused])
  const ledgerSet = r.ledger.status !== "pending"
  return (
    <div ref={ref} className={cn("rounded-lg border bg-surface shadow-card transition-colors", focused ? "border-accent-sig/50 ring-1 ring-accent-sig/30" : "border-line")}>
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0 flex-1">
          {ledgerSet ? (
            <button onClick={(e) => onEdit(e.currentTarget, r.id, "ledger")} className="group inline-flex min-w-0 items-center gap-1.5 text-left"><span className="truncate text-[13.5px] font-medium text-ink group-hover:text-brand">{r.ledger.value}</span><ChevronRight className="size-3 flex-none rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
          ) : (
            <button onClick={(e) => onEdit(e.currentTarget, r.id, "ledger")} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12.5px] font-medium text-warning transition-colors hover:bg-warning-bg/70">Pick a ledger<ChevronRight className="size-3 rotate-90" /></button>
          )}
          <div className="mt-1 text-[11px] text-muted-ink">Expense / purchase head</div>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          {editingAmt ? (
            <AmountInput initial={r.amount} onCommit={onCommitAmt} onCancel={onCancelAmt} />
          ) : (
            <button onClick={onEditAmt} className="group inline-flex items-center gap-1 text-right"><Amt value={r.amount} className="fig text-[16px] font-medium text-ink group-hover:text-brand" /><Pencil className="size-3 flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
          )}
          <button onClick={onOpenSheet} title="Ledger details" className="rounded-md p-0.5 text-faint transition-colors hover:text-muted-ink"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line/60 px-4 py-2">
        {r.costCentre.split ? (
          <><span className="mt-[1px]"><Dot tone="resolved" /></span><span className="w-[108px] flex-none text-[12px] text-muted-ink">Cost centre</span><button onClick={onOpenSheet} className="group inline-flex items-center gap-1.5 text-left text-[12.5px] font-medium text-ink-2 hover:text-brand">Split · {r.costCentre.split.length} cost centres<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button></>
        ) : (
          <><Dot tone={DOT_FOR(r.costCentre.status)} /><span className="w-[108px] flex-none text-[12px] text-muted-ink">Cost centre</span>
          {r.costCentre.status === "pending" ? (
            <button onClick={(e) => onEdit(e.currentTarget, r.id, "costCentre")} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">Set cost centre<ChevronRight className="size-3 rotate-90" /></button>
          ) : (
            <button onClick={(e) => onEdit(e.currentTarget, r.id, "costCentre")} className="group inline-flex items-center gap-1.5 text-[12.5px] text-ink transition-colors hover:text-brand">{r.costCentre.value}<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
          )}</>
        )}
        {canRemove && <button onClick={onRemove} title="Remove ledger" className="ml-auto flex-none rounded p-0.5 text-faint transition-colors hover:text-danger"><X className="size-3.5" /></button>}
      </div>
    </div>
  )
}

function AmountInput({ initial, onCommit, onCancel }: { initial: number; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial ? String(initial) : "")
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-faint">₹</span>
      <input autoFocus inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommit(v) } if (e.key === "Escape") { e.preventDefault(); onCancel() } }} onBlur={() => onCommit(v)} className="w-[104px] rounded-sm border border-accent-sig bg-card py-1 pl-5 pr-2 text-right font-mono text-[13px] text-ink outline-none ring-2 ring-accent-sig/20" />
    </div>
  )
}

/* ── the per-ledger detail sheet (Account mode) — tax + cost-centre split ── */
function LedgerSheet({ row: r, taxTotal, taxable, onClose, onEdit, alloc, onAllocOpen, onAllocChange, onAllocAdd, onAllocRemove, onAllocApply, onAllocCancel, onAllocAuto }: {
  row: LedgerRow; taxTotal: number; taxable: number; onClose: () => void; onEdit: (anchor: HTMLElement, id: number, dim: Dim) => void
  alloc: { name: string; amount: number }[] | null; onAllocOpen: () => void; onAllocChange: (i: number, patch: Partial<{ name: string; amount: number }>) => void; onAllocAdd: () => void; onAllocRemove: (i: number) => void; onAllocApply: () => void; onAllocCancel: () => void; onAllocAuto: () => void
}) {
  const [shown, setShown] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  useEffect(() => { const id = requestAnimationFrame(() => { setShown(true); asideRef.current?.focus({ preventScroll: true }) }); return () => cancelAnimationFrame(id) }, [])
  const attn = ledgerPending(r)
  const share = taxable ? Math.round((taxTotal * r.amount) / taxable) : 0 // this row's slice of the tax
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className={cn("absolute inset-0 bg-ink/25 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside ref={asideRef} tabIndex={-1} className={cn("relative flex max-h-[85vh] w-[460px] max-w-full flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-16px_rgba(21,26,38,0.42)] outline-none transition-all duration-200 ease-out", shown ? "scale-100 opacity-100" : "scale-[.98] opacity-0")}>
        <div className="flex flex-none items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="type-section-title truncate text-ink">{r.ledger.status === "pending" ? "Ledger — not set" : r.ledger.value}</h3>
              {attn ? <span className="inline-flex flex-none items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning"><Dot tone="warn" />needs you</span> : <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" strokeWidth={2.6} />coded</span>}
            </div>
            <p className="mt-1 text-[12px] text-muted-ink"><Amt value={r.amount} className="font-medium text-ink" /> booked to this head</p>
          </div>
          <button onClick={onClose} className="flex-none rounded-md p-1 text-faint transition-colors hover:bg-panel hover:text-ink"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-2">
          <div className="py-1">
            <div className="-mx-5 mb-1 border-b border-line/60 px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Coding</div>
            <LedgerDetailRow label="Ledger" onEdit={(el) => onEdit(el, r.id, "ledger")} pending={r.ledger.status === "pending"} value={r.ledger.value} />
            {r.costCentre.split && !alloc ? (
              <div className="flex items-start gap-3 border-b border-line/50 py-2"><span className="mt-[5px]"><Dot tone="resolved" /></span><span className="w-[108px] flex-none pt-0.5 text-[12px] text-muted-ink">Cost centre</span><button onClick={onAllocOpen} className="group min-w-0 flex-1 text-left"><span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 group-hover:text-brand">Split · {r.costCentre.split.length} cost centres<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></span><div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-ink">{r.costCentre.split.map((x) => (<span key={x.name}>{x.name} <span className="font-mono text-faint">₹{x.amount.toLocaleString("en-IN")}</span></span>))}</div></button></div>
            ) : !alloc ? (
              <LedgerDetailRow label="Cost centre" onEdit={(el) => onEdit(el, r.id, "costCentre")} pending={r.costCentre.status === "pending"} value={r.costCentre.value} />
            ) : null}
            {alloc && <AllocEditor rows={alloc} lineAmount={r.amount} onChange={onAllocChange} onAdd={onAllocAdd} onRemove={onAllocRemove} onApply={onAllocApply} onCancel={onAllocCancel} onAuto={onAllocAuto} />}
          </div>
          <div className="py-1">
            <div className="-mx-5 mb-1 border-b border-line/60 px-5 py-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Tax</div>
            <TaxRow label="Amount booked" value={r.amount} />
            <TaxRow label="GST @ 18% (this head)" value={share} />
          </div>
        </div>

        <div className="flex flex-none items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-panel">Done</button>
        </div>
      </aside>
    </div>
  )
}

function LedgerDetailRow({ label, value, pending, onEdit }: { label: string; value: string; pending: boolean; onEdit: (anchor: HTMLElement) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line/50 py-2 last:border-b-0">
      <Dot tone={pending ? "warn" : "resolved"} /><span className="w-[108px] flex-none text-[12px] text-muted-ink">{label}</span>
      {pending ? (
        <button onClick={(e) => onEdit(e.currentTarget)} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">Set {label.toLowerCase()}<ChevronRight className="size-3 rotate-90" /></button>
      ) : (
        <button onClick={(e) => onEdit(e.currentTarget)} className="group inline-flex items-center gap-1.5 text-[12.5px] text-ink transition-colors hover:text-brand">{value}<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
      )}
    </div>
  )
}

function CodeRow({ line: l, dim, onEdit }: { line: CodingLine; dim: Dim; onEdit: (anchor: HTMLElement, lid: number, dim: Dim) => void }) {
  const c = l[dim]
  return (
    <div className="flex items-center gap-3 border-b border-line/50 py-2"><Dot tone={DOT_FOR(c.status)} /><span className="w-[108px] flex-none text-[12px] text-muted-ink">{DIM_LABEL[dim]}</span>
      {c.status === "pending" ? (
        <button onClick={(e) => onEdit(e.currentTarget, l.id, dim)} className="inline-flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning-bg px-2.5 py-1 text-[12px] font-medium text-warning transition-colors hover:bg-warning-bg/70">{dim === "ledger" ? "Pick a ledger" : "Set cost centre"}<ChevronRight className="size-3 rotate-90" /></button>
      ) : (
        <button onClick={(e) => onEdit(e.currentTarget, l.id, dim)} className="group inline-flex items-center gap-1.5 text-[12.5px] text-ink transition-colors hover:text-brand">{c.value}<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></button>
      )}
    </div>
  )
}

/* cost centre once it's split across several centres */
function SplitSummaryRow({ line: l, onEdit }: { line: CodingLine; onEdit: () => void }) {
  const split = l.costCentre.split!
  return (
    <div className="flex items-start gap-3 border-b border-line/50 py-2">
      <span className="mt-[5px]"><Dot tone="resolved" /></span>
      <span className="w-[108px] flex-none pt-0.5 text-[12px] text-muted-ink">Cost centre</span>
      <button onClick={onEdit} className="group min-w-0 flex-1 text-left">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 group-hover:text-brand">Split · {split.length} cost centres<ChevronRight className="size-3 rotate-90 text-faint opacity-0 transition-opacity group-hover:opacity-100" /></span>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-ink">
          {split.map((r) => (<span key={r.name}>{r.name} <span className="font-mono text-faint">₹{r.amount.toLocaleString("en-IN")}</span></span>))}
        </div>
      </button>
    </div>
  )
}

/* the allocation sub-editor — split a line's cost across cost centres */
function AllocEditor({ rows, lineAmount, onChange, onAdd, onRemove, onApply, onCancel, onAuto }: {
  rows: { name: string; amount: number }[]; lineAmount: number
  onChange: (i: number, patch: Partial<{ name: string; amount: number }>) => void; onAdd: () => void; onRemove: (i: number) => void; onApply: () => void; onCancel: () => void; onAuto: () => void
}) {
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const left = Math.round(lineAmount - sum)
  const balanced = left === 0
  return (
    <div className="my-1 rounded-md border border-brand-border bg-brand-tint/40 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow !text-brand">Split cost · line total ₹{lineAmount.toLocaleString("en-IN")}</span>
        <button onClick={onAuto} className="text-[11px] font-medium text-brand hover:underline">Split evenly</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={r.name} onChange={(e) => onChange(i, { name: e.target.value })} className="min-w-0 flex-1 rounded-sm border border-line-2 bg-card px-2 py-1 text-[12px] text-ink focus:border-accent-sig focus:outline-none">
              {COST_CENTRE_OPTIONS.map((o) => (<option key={o.name} value={o.name}>{o.name}</option>))}
            </select>
            <div className="relative flex-none">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-faint">₹</span>
              <input inputMode="numeric" value={r.amount ? String(r.amount) : ""} onChange={(e) => onChange(i, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="w-[92px] rounded-sm border border-line-2 bg-card py-1 pl-5 pr-2 text-right font-mono text-[12px] text-ink focus:border-accent-sig focus:outline-none" />
            </div>
            <span className="w-[36px] flex-none text-right font-mono text-[11px] text-muted-ink">{lineAmount ? Math.round((r.amount / lineAmount) * 100) : 0}%</span>
            <button onClick={() => onRemove(i)} disabled={rows.length <= 1} className="flex-none rounded p-0.5 text-faint transition-colors hover:text-danger disabled:opacity-30"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"><Plus className="size-3.5" /> Add cost centre</button>
      <div className="mt-2.5 flex items-center justify-between border-t border-brand-border/60 pt-2">
        <span className={cn("text-[11.5px] font-medium", balanced ? "text-success" : "text-warning")}>{balanced ? <>Allocated in full · ₹{lineAmount.toLocaleString("en-IN")} ✓</> : left > 0 ? <>₹{left.toLocaleString("en-IN")} left to allocate</> : <>₹{Math.abs(left).toLocaleString("en-IN")} over</>}</span>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="text-[12px] text-muted-ink hover:text-ink">Cancel</button>
          <Button size="sm" disabled={!balanced} onClick={onApply}>Apply split</Button>
        </div>
      </div>
    </div>
  )
}

function RecordedBoard({ meta, lineCount }: { meta: BillMeta; lineCount: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-surface px-6 py-10 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-success-bg text-success"><Check className="size-5" strokeWidth={2.4} /></span>
      <p className="mt-3 text-[13.5px] font-medium text-ink">Recorded to the books</p>
      <p className="mt-1 text-[12.5px] text-muted-ink">{lineCount} line{lineCount === 1 ? "" : "s"} done · voucher {meta.nextVoucher} · pending sync to Tally.</p>
    </div>
  )
}

/* ── Configure — searchable, feature-flagged field catalog ── */
function ConfigDrawer({ featureOn, fieldOn, search, expanded, enabledCount, mode, onClose, onSearch, onToggleGroup, onToggleFeature, onToggleField }: {
  featureOn: Record<string, boolean>; fieldOn: Record<string, boolean>; search: string; expanded: string[]; enabledCount: number; mode: Mode
  onClose: () => void; onSearch: (v: string) => void; onToggleGroup: (id: string) => void; onToggleFeature: (id: string) => void; onToggleField: (key: string) => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", onKey); return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey) } }, [onClose])
  const q = search.trim().toLowerCase()
  // in Account mode there are no stock lines, so per-line fields don't apply
  const inMode = (f: RegField) => mode === "item" || f.placement.at !== "line"
  const match = (g: RegGroup) => g.fields.filter((f) => inMode(f) && (!q || f.label.toLowerCase().includes(q) || f.note?.toLowerCase().includes(q)))
  const groups = FIELD_CATALOG.map((g) => ({ g, fields: match(g) })).filter(({ fields }) => fields.length)
  const fieldEnabled = (k: string) => fieldOn[k] !== false

  return (
    <div className="absolute inset-0 z-[65]">
      <div className={cn("absolute inset-0 bg-ink/15 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside className={cn("absolute right-0 top-0 flex h-full w-[460px] flex-col border-l border-line bg-surface shadow-[-8px_0_40px_-12px_rgba(21,26,38,0.28)] transition-transform duration-200 ease-out", shown ? "translate-x-0" : "translate-x-full")}>
        <div className="flex-none border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="type-section-title text-ink">Configure fields</h3><p className="mt-1 text-[12px] text-muted-ink"><b className="font-medium text-ink">{enabledCount}</b> of {CATALOG_TOTAL} on · changes reflect in the board live</p></div>
            <button onClick={onClose} className="rounded-md p-1 text-faint transition-colors hover:bg-panel hover:text-ink"><X className="size-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-line-2 bg-card px-2.5 py-1.5"><Search className="size-3.5 flex-none text-faint" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search fields…" className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none" />{search && <button onClick={() => onSearch("")} className="text-faint hover:text-ink"><X className="size-3.5" /></button>}</div>
        </div>
        <div className="flex-1 overflow-auto">
          {groups.map(({ g, fields }) => {
            const isOpen = !!q || expanded.includes(g.id)
            const featureActive = !g.feature || featureOn[g.id]
            const onCount = fields.filter((f) => fieldEnabled(f.key)).length
            return (
              <div key={g.id} className="border-b border-line/70">
                <div className="flex items-center gap-2.5 px-4 py-2.5">
                  <button onClick={() => onToggleGroup(g.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronRight className={cn("size-4 flex-none text-faint transition-transform", isOpen && "rotate-90")} />
                    <span className="min-w-0"><span className="flex items-center gap-2"><span className="text-[13px] font-semibold text-ink">{g.label}</span><span className="text-[10.5px] text-faint">{featureActive ? `${onCount} on` : "off"}</span></span><span className="block truncate text-[11px] text-muted-ink">{g.blurb}</span></span>
                  </button>
                  {g.feature ? <Switch on={!!featureOn[g.id]} onClick={() => onToggleFeature(g.id)} /> : <span className="flex-none text-[10px] font-medium uppercase tracking-[0.05em] text-faint">core</span>}
                </div>
                {isOpen && (
                  <div className="px-4 pb-2">
                    {!featureActive ? (
                      <p className="rounded-md bg-panel/50 px-3 py-2 text-[11px] leading-relaxed text-muted-ink">{g.naReason ?? "Turn on this feature to use its fields."}</p>
                    ) : (
                      <div className="rounded-md border border-line/70">
                        {fields.map((f) => (
                          <div key={f.key} className={cn("flex items-center gap-3 border-b border-line/50 px-3 py-2 last:border-b-0", f.naOnBill && "opacity-55")}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2"><span className="truncate text-[12.5px] text-ink">{f.label}</span>{f.naOnBill ? <span className="flex-none rounded-full bg-panel-2 px-1.5 py-0.5 text-[9px] font-medium text-body">not on this bill</span> : f.placement.at === "line" ? <span className="flex-none rounded-full bg-brand-tint px-1.5 py-0.5 text-[9px] font-medium text-brand">per line</span> : null}</div>
                              {f.note && <div className="truncate text-[11px] text-muted-ink">{f.note}</div>}
                            </div>
                            {f.mandatory ? <span className="flex-none text-[9.5px] font-medium uppercase tracking-[0.05em] text-faint">Required</span> : <Switch on={fieldEnabled(f.key)} onClick={() => onToggleField(f.key)} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {q && groups.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-muted-ink">No field matches “{search}”.</p>}
        </div>
      </aside>
    </div>
  )
}

/* ── source document ── */
function SourceDoc({ meta, lines, hover, setHover, onTrace }: { meta: BillMeta; lines: CodingLine[]; hover: number | null; setHover: (n: number | null) => void; onTrace: (id: number) => void }) {
  const s = meta
  const Gstin = ({ value }: { value: string }) => (<span className="font-mono text-[10.5px] text-[#1a1d23]"><b className="font-medium">{value.slice(0, 2)}</b>{value.slice(2)}</span>)
  return (
    <div className="relative w-full max-w-[540px] overflow-hidden rounded-lg border border-[#e6e9ef] bg-white p-[28px] pb-[22px] text-[12px] text-[#2c3039] shadow-[0_2px_4px_rgba(15,18,26,0.04),0_12px_32px_-16px_rgba(15,18,26,0.18)]">
      <div className="absolute right-0 top-0 rounded-bl-md border-b border-l border-[#eceef2] bg-[#f4f6f9] px-[9px] py-1 text-[9px] font-medium uppercase tracking-[0.06em] text-[#9aa1ac]">Tax invoice</div>
      <div className="mb-3.5 flex items-start justify-between"><div><div className="text-[15px] font-medium tracking-[-0.01em] text-[#15171c]">{s.supplier.name}</div><div className="mt-[3px] text-[9px] uppercase tracking-[0.09em] text-[#9aa1ac]">Tax invoice · original for recipient</div></div><div className="pl-1.5 text-right"><div className="text-[8.5px] uppercase tracking-[0.07em] text-[#9aa1ac]">Invoice No.</div><div className="font-mono text-[12px] font-medium tnum text-[#15171c]">{s.invoiceNo}</div></div></div>
      <div className="my-2 grid grid-cols-2 gap-3 border-y border-[#eceef2] py-3">
        <div className="px-1.5"><div className="mb-[3px] text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Supplier</div><div className="text-[12px] font-medium text-[#15171c]">{s.supplier.name}</div><div className="text-[10px] leading-snug text-[#51565f]">{s.supplier.place}, {s.supplier.state}</div><div className="mt-[3px]"><Gstin value={s.supplier.gstin} /></div></div>
        <div className="px-1.5"><div className="mb-[3px] text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Bill to</div><div className="text-[12px] font-medium text-[#15171c]">{s.recipient.name}</div><div className="text-[10px] leading-snug text-[#51565f]">{s.recipient.place}, {s.recipient.state}</div><div className="mt-[3px]"><Gstin value={s.recipient.gstin} /></div></div>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-x-6 gap-y-1 px-1.5 py-1 text-[10px] text-[#51565f]"><span>Invoice date <b className="font-mono font-medium text-[#15171c]">{s.invoiceDate}</b></span><span>Period <b className="font-mono font-medium text-[#15171c]">{s.period}</b></span><span>PO <b className="font-mono font-medium text-[#15171c]">{s.poNo ?? "—"}</b></span></div>
      <table className="mb-2.5 w-full border-collapse text-[10.5px]">
        <thead><tr><th className="border-b border-[#eceef2] px-1.5 py-[5px] text-left text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">Description</th><th className="border-b border-[#eceef2] px-1.5 py-[5px] text-left text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">HSN</th><th className="border-b border-[#eceef2] px-1.5 py-[5px] text-right text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">Qty</th><th className="border-b border-[#eceef2] px-1.5 py-[5px] text-right text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">Amount</th></tr></thead>
        <tbody>{lines.map((l) => (<tr key={l.id} tabIndex={0} aria-label={`Find coding for ${l.description}`} onClick={() => onTrace(l.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTrace(l.id) } }} onFocus={() => setHover(l.id)} onBlur={() => setHover(null)} onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} className={cn("source-trace-row cursor-pointer transition-colors", hover === l.id && "bg-[#eef2fb]")}><td className="border-b border-[#eceef2] px-1.5 py-[7px] align-top text-[#2c3039]">{l.description}</td><td className="border-b border-[#eceef2] px-1.5 py-[7px] align-top font-mono text-[#51565f]">{l.hsn}</td><td className="border-b border-[#eceef2] px-1.5 py-[7px] text-right align-top font-mono tnum text-[#51565f]">{l.qty}</td><td className="border-b border-[#eceef2] px-1.5 py-[7px] text-right align-top font-mono tnum">{l.amount.toLocaleString("en-IN")}</td></tr>))}</tbody>
      </table>
      <div className="ml-auto w-[64%] px-1.5 py-1 text-[11px]"><div className="flex justify-between py-[3px]"><span>Taxable value</span><span className="font-mono tnum">{s.taxableTotal.toLocaleString("en-IN")}.00</span></div><div className="flex justify-between py-[3px]"><span>CGST @ 9%</span><span className="font-mono tnum">{s.cgstTotal.toFixed(2)}</span></div><div className="flex justify-between py-[3px]"><span>SGST @ 9%</span><span className="font-mono tnum">{s.sgstTotal.toFixed(2)}</span></div><div className="mt-1 flex justify-between border-t-[1.5px] border-[#15171c] pt-1.5 text-[12.5px] font-medium text-[#15171c]"><span>Total</span><span className="font-mono tnum">{s.grandTotal.toLocaleString("en-IN")}.00</span></div></div>
      <div className="mt-3.5 flex justify-between border-t border-[#eceef2] pt-2.5 text-[9px] text-[#9aa1ac]"><span>Place of supply: {s.recipient.state} ({s.recipient.stateCode})</span><span>E. &amp; O.E.</span></div>
    </div>
  )
}

function OptionMenu({ title, x, y, options, onChoose, current, createLabel, onCreate, onClose }: { title: string; x: number; y: number; options: { name: string; note: string; rec?: boolean }[]; onChoose: (name: string) => void; current?: string; createLabel?: string; onCreate?: () => void; onClose?: () => void }) {
  const hasCreate = !!(createLabel && onCreate)
  const rows = options.length + (hasCreate ? 1 : 0)
  const [cur, setCur] = useState(() => { const i = options.findIndex((o) => o.name === current); return i >= 0 ? i : 0 })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setCur((c) => (c + 1) % rows) }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setCur((c) => (c - 1 + rows) % rows) }
      else if (e.key === "Enter") { e.preventDefault(); if (cur < options.length) onChoose(options[cur].name); else onCreate?.() }
      else if (e.key === "Escape") { e.preventDefault(); onClose?.() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [cur, rows, options, onChoose, onCreate, onClose])
  return (
    <div className="fixed z-[61] max-h-[320px] min-w-[264px] overflow-auto rounded-lg border border-line-2 bg-surface p-1.5 shadow-card" style={{ left: x, top: y }}>
      <div className="eyebrow px-2.5 py-1.5">{title}</div>
      {options.map((o, i) => (<button key={o.name} onMouseEnter={() => setCur(i)} onClick={() => onChoose(o.name)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors", i === cur ? "bg-panel" : "hover:bg-panel")}><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium text-ink">{o.name}</span>{o.note && <span className="block truncate text-[11px] text-muted-ink">{o.note}</span>}</span>{o.rec && <span className="flex-none rounded-xs bg-panel-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-body">Most used</span>}{current === o.name && <Check className="size-4 flex-none text-brand" strokeWidth={2.4} />}</button>))}
      {hasCreate && (<button onMouseEnter={() => setCur(options.length)} onClick={onCreate} className={cn("mt-0.5 flex w-full items-center gap-2 border-t border-line/60 px-2.5 py-2 text-left text-[12px] font-medium text-brand transition-colors", cur === options.length ? "bg-panel" : "hover:bg-panel")}><Plus className="size-3.5" /> {createLabel}</button>)}
    </div>
  )
}
