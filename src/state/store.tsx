import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"
import {
  GRAND_TOTAL,
  NEXT_VOUCHER,
  FACT_PRIORITY,
  FACT_EXCEPTIONS,
  FACTS,
  CURRENT_USER,
  type FactKey,
} from "@/data/invoice"

export type Screen = "bills" | "entry" | "read" | "cockpit"
export type TaxMode = "IGST" | "SPLIT"
export type ActiveError = null | "dup" | "balance"
/** explicit read-pass outcomes — a corrupt file, a faint scan, an unmatched
 *  vendor. Each surfaces its own inline state rather than falling through. */
export type ReadError = null | "unreadable" | "faint" | "vendor"

/** focus cursor for the queue + the commit switch */
export type Focus = FactKey | "commit"

/** a decision routed to a person or queue instead of decided here — the third
 *  path. Flagged decisions leave the open stack but keep commit locked. */
export interface FlagInfo {
  to: string
  by?: string
  note?: string
}
export type Flagged = Partial<Record<FactKey, FlagInfo>>

/** who decided a fact, when, and whether they took the AI call or overrode it */
export interface DecisionRecord {
  by: string
  at: number
  how: "accepted" | "overridden"
  note?: string
}
export type Attribution = Partial<Record<FactKey, DecisionRecord>>

/** the voucher's own history — read, matched, decided, flagged, recorded */
export type ActivityKind =
  | "extracted"
  | "matched"
  | "decided"
  | "flagged"
  | "unflagged"
  | "reopened"
  | "committed"
export interface ActivityEntry {
  id: string
  at: number
  kind: ActivityKind
  label: string
  by?: string
  detail?: string
}

function seedActivity(): ActivityEntry[] {
  const base = Date.now()
  return [
    {
      id: "seed-extract",
      at: base - 185000,
      kind: "extracted",
      by: "FinOps AI",
      label: "Document read",
      detail: "Sundar-Logistics-invoice.pdf · 1 page",
    },
    {
      id: "seed-match",
      at: base - 178000,
      kind: "matched",
      by: "FinOps AI",
      label: "Matched to your books",
      detail: "Vendor master · chart of accounts · AP register",
    },
  ]
}

/** Only entry-edge flows remain modal. Decisions resolve inline. */
export type Dialog =
  | { kind: "readfail" }
  | { kind: "discard" }
  | { kind: "manual"; step: number }
  | null

type Resolved = Record<FactKey, boolean>

export interface State {
  screen: Screen
  // fact values
  vendor: string
  freightLedger: string
  taxMode: TaxMode
  loadingLedger: string
  voucher: string | null
  // fact status
  resolved: Resolved
  /** a fact is "seeded" once it has entered the settled stack (confirmed at
   *  least once, or auto-settled at read). Un-seeded facts live in the top
   *  queue; seeded facts live in the settled list and re-open inline. */
  seeded: Resolved
  /** decisions flagged for review — routed to a person/queue, off the open
   *  stack, but blocking commit until cleared. */
  flagged: Flagged
  /** who decided each fact, and how */
  attribution: Attribution
  /** the voucher's full history, chronological */
  activity: ActivityEntry[]
  activityOpen: boolean
  /** ⌘K command palette */
  paletteOpen: boolean
  /** ? shortcuts cheatsheet */
  helpOpen: boolean
  focus: Focus
  settledOpen: boolean
  // edge state
  voucherDup: boolean
  forceBalanceError: boolean
  readError: ReadError
  activeError: ActiveError
  manual: boolean
  posted: boolean
  moneyFlash: boolean
  dialog: Dialog
}

const ALL_SETTLED: Resolved = {
  supplier: true,
  freight: true,
  tax: true,
  loading: true,
  voucher: true,
  totals: true,
}

export const initialState: State = {
  screen: "bills",
  vendor: "Sundar Logistics Pvt Ltd",
  freightLedger: "Carriage Inward",
  taxMode: "IGST",
  loadingLedger: "Carriage Inward",
  voucher: null,
  resolved: { supplier: true, freight: true, tax: false, loading: false, voucher: false, totals: true },
  seeded: { supplier: true, freight: true, tax: false, loading: false, voucher: false, totals: true },
  flagged: {},
  attribution: {},
  activity: [],
  activityOpen: false,
  paletteOpen: false,
  helpOpen: false,
  focus: "tax",
  settledOpen: false,
  voucherDup: false,
  forceBalanceError: false,
  readError: null,
  activeError: null,
  manual: false,
  posted: false,
  moneyFlash: false,
  dialog: null,
}

export type Action =
  | { type: "SHOW"; screen: Screen }
  | { type: "START_READ" }
  | { type: "ENTER_COCKPIT" }
  | { type: "OPEN_DIALOG"; dialog: Dialog }
  | { type: "CLOSE_DIALOG" }
  | { type: "FOCUS"; key: Focus }
  | { type: "TOGGLE_SETTLED"; open?: boolean }
  | { type: "TOGGLE_ACTIVITY"; open?: boolean }
  | { type: "TOGGLE_PALETTE"; open?: boolean }
  | { type: "TOGGLE_HELP"; open?: boolean }
  | { type: "CONFIRM"; key: FactKey; value?: string; how?: "accepted" | "overridden"; note?: string }
  | { type: "FLAG"; key: FactKey; to: string; note?: string }
  | { type: "UNFLAG"; key: FactKey }
  | { type: "REOPEN"; key: FactKey }
  | { type: "USE_VOUCHER"; value: string }
  | { type: "SET_ERROR"; error: ActiveError }
  | { type: "COMMIT" }
  | { type: "CLEAR_MONEY_FLASH" }
  | { type: "SIM_DUP" }
  | { type: "SIM_BALANCE" }
  | { type: "SIM_READ"; kind: ReadError }
  | { type: "START_MANUAL" }
  | { type: "MANUAL_NEXT" }
  | { type: "FINISH_MANUAL" }
  | { type: "RESET" }

/** decisions still needing a call here — unresolved and not flagged away */
export function openKeys(s: State): FactKey[] {
  return FACT_PRIORITY.filter((k) => !s.resolved[k] && !s.flagged[k])
}
export function openCount(s: State): number {
  return openKeys(s).length
}
/** untouched initial exceptions — render in the top queue */
export function queueKeys(s: State): FactKey[] {
  return FACT_PRIORITY.filter((k) => !s.seeded[k] && !s.flagged[k])
}
/** seeded facts re-opened for editing — render inline in the settled stack */
export function editingKeys(s: State): FactKey[] {
  return FACT_PRIORITY.filter((k) => s.seeded[k] && !s.resolved[k] && !s.flagged[k])
}
/** decisions routed to review, in priority order */
export function flaggedKeys(s: State): FactKey[] {
  return FACT_PRIORITY.filter((k) => !!s.flagged[k])
}
/** progress denominator: the exceptions the AI couldn't decide (the "3") */
export const DECISION_TOTAL = FACT_EXCEPTIONS.length
export function resolvedExceptions(s: State): number {
  return FACT_EXCEPTIONS.filter((k) => s.resolved[k]).length
}
export function flaggedExceptions(s: State): number {
  return FACT_EXCEPTIONS.filter((k) => !!s.flagged[k]).length
}
function advanceFocus(resolved: Resolved, flagged: Flagged): Focus {
  return FACT_PRIORITY.find((k) => !resolved[k] && !flagged[k]) ?? "commit"
}
export function isReady(s: State): boolean {
  return (
    openCount(s) === 0 &&
    flaggedKeys(s).length === 0 &&
    !s.forceBalanceError &&
    !s.activeError
  )
}
export function grandTotal(): number {
  return GRAND_TOTAL
}

function applyValue(s: State, key: FactKey, value?: string): Partial<State> {
  switch (key) {
    case "supplier":
      return value ? { vendor: value } : {}
    case "freight":
      return value ? { freightLedger: value } : {}
    case "tax":
      return { taxMode: (value as TaxMode) ?? s.taxMode, moneyFlash: true }
    case "loading":
      return value ? { loadingLedger: value } : {}
    case "voucher":
      return { voucher: value ?? NEXT_VOUCHER, voucherDup: false, activeError: null }
    default:
      return {}
  }
}

function logged(
  s: State,
  kind: ActivityKind,
  key: FactKey,
  label: string,
  detail?: string,
): ActivityEntry {
  return {
    id: `${s.activity.length}-${kind}-${key}`,
    at: Date.now(),
    kind,
    by: CURRENT_USER.name,
    label,
    detail,
  }
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SHOW":
      return { ...s, screen: a.screen }

    case "START_READ":
      return { ...s, screen: "read", manual: false, readError: null }

    case "ENTER_COCKPIT":
      return {
        ...s,
        screen: "cockpit",
        focus: advanceFocus(s.resolved, s.flagged),
        activity: s.activity.length ? s.activity : seedActivity(),
      }

    case "TOGGLE_ACTIVITY":
      return { ...s, activityOpen: a.open ?? !s.activityOpen }

    case "TOGGLE_PALETTE":
      return { ...s, paletteOpen: a.open ?? !s.paletteOpen }

    case "TOGGLE_HELP":
      return { ...s, helpOpen: a.open ?? !s.helpOpen }

    case "OPEN_DIALOG":
      return { ...s, dialog: a.dialog }

    case "CLOSE_DIALOG":
      return { ...s, dialog: null }

    case "FOCUS":
      return { ...s, focus: a.key }

    case "TOGGLE_SETTLED":
      return { ...s, settledOpen: a.open ?? !s.settledOpen }

    case "CONFIRM": {
      const resolved = { ...s.resolved, [a.key]: true }
      const seeded = { ...s.seeded, [a.key]: true }
      // deciding a fact clears any review flag on it
      const flagged = { ...s.flagged }
      delete flagged[a.key]
      const how = a.how ?? "accepted"
      const rec: DecisionRecord = { by: CURRENT_USER.name, at: Date.now(), how, note: a.note }
      const entry = logged(
        s,
        "decided",
        a.key,
        `${how === "accepted" ? "Accepted" : "Overrode"} — ${FACTS[a.key].label}`,
        a.note,
      )
      return {
        ...s,
        ...applyValue(s, a.key, a.value),
        resolved,
        seeded,
        flagged,
        attribution: { ...s.attribution, [a.key]: rec },
        activity: [...s.activity, entry],
        focus: advanceFocus(resolved, flagged),
      }
    }

    case "FLAG": {
      if (s.posted) return s
      const flagged: Flagged = { ...s.flagged, [a.key]: { to: a.to, by: CURRENT_USER.name, note: a.note } }
      const resolved = { ...s.resolved, [a.key]: false }
      const seeded = { ...s.seeded, [a.key]: true }
      const attribution = { ...s.attribution }
      delete attribution[a.key]
      const entry = logged(
        s,
        "flagged",
        a.key,
        `Flagged for review — ${FACTS[a.key].label}`,
        `Assigned to ${a.to}${a.note ? ` · ${a.note}` : ""}`,
      )
      return {
        ...s,
        flagged,
        resolved,
        seeded,
        attribution,
        activeError: null,
        activity: [...s.activity, entry],
        focus: advanceFocus(resolved, flagged),
      }
    }

    case "UNFLAG": {
      const flagged = { ...s.flagged }
      delete flagged[a.key]
      const entry = logged(s, "unflagged", a.key, `Flag cleared — ${FACTS[a.key].label}`)
      return { ...s, flagged, activity: [...s.activity, entry], focus: a.key }
    }

    case "REOPEN": {
      if (s.posted) return s // post-commit locks, by compliance
      const resolved = { ...s.resolved, [a.key]: false }
      const attribution = { ...s.attribution }
      delete attribution[a.key]
      const entry = logged(s, "reopened", a.key, `Reopened to challenge — ${FACTS[a.key].label}`)
      return {
        ...s,
        resolved,
        attribution,
        activity: [...s.activity, entry],
        focus: a.key,
        activeError: null,
      }
    }

    case "USE_VOUCHER":
      return { ...s, voucher: a.value, voucherDup: false, activeError: null }

    case "SET_ERROR":
      return {
        ...s,
        activeError: a.error,
        forceBalanceError: a.error === "balance" ? s.forceBalanceError : false,
      }

    case "COMMIT": {
      if (openCount(s) > 0) return { ...s, focus: advanceFocus(s.resolved, s.flagged) }
      if (flaggedKeys(s).length > 0) return s // flagged decisions block commit
      if (s.voucherDup) return { ...s, activeError: "dup", focus: "voucher" }
      if (s.forceBalanceError) return { ...s, activeError: "balance" }
      const entry: ActivityEntry = {
        id: `${s.activity.length}-committed`,
        at: Date.now(),
        kind: "committed",
        by: CURRENT_USER.name,
        label: "Recorded to the books",
        detail: `${s.voucher || NEXT_VOUCHER} · Purchase voucher`,
      }
      return { ...s, posted: true, activity: [...s.activity, entry] }
    }

    case "CLEAR_MONEY_FLASH":
      return { ...s, moneyFlash: false }

    case "SIM_DUP":
      return { ...s, resolved: { ...ALL_SETTLED }, seeded: { ...ALL_SETTLED }, flagged: {}, voucher: "AP/003/25-26", voucherDup: true, activeError: "dup", focus: "commit" }

    case "SIM_BALANCE":
      return { ...s, resolved: { ...ALL_SETTLED }, seeded: { ...ALL_SETTLED }, flagged: {}, forceBalanceError: true, activeError: "balance", focus: "commit" }

    case "SIM_READ":
      return { ...initialState, screen: "read", readError: a.kind }

    case "START_MANUAL":
      return { ...initialState, screen: "cockpit", manual: true, dialog: { kind: "manual", step: 0 } }

    case "MANUAL_NEXT": {
      if (s.dialog?.kind !== "manual") return s
      return { ...s, dialog: { kind: "manual", step: s.dialog.step + 1 } }
    }

    case "FINISH_MANUAL":
      return {
        ...s,
        manual: true,
        resolved: { ...ALL_SETTLED },
        seeded: { ...ALL_SETTLED },
        flagged: {},
        voucher: NEXT_VOUCHER,
        taxMode: "IGST",
        loadingLedger: "Carriage Inward",
        focus: "commit",
        settledOpen: false,
        dialog: null,
      }

    case "RESET":
      return { ...initialState }

    default:
      return s
  }
}

/** dev-only: jump to a screen/queue state via URL for screenshots */
function bootState(): State {
  if (typeof window === "undefined") return initialState
  const q = new URLSearchParams(window.location.search)
  const screen = q.get("screen")
  if (screen !== "cockpit" && screen !== "entry" && screen !== "read") return initialState
  const base: State = { ...initialState, screen: screen as Screen, focus: "tax", activity: seedActivity() }
  const settled = (over: Partial<State>): State => ({
    ...base,
    resolved: { ...ALL_SETTLED },
    seeded: { ...ALL_SETTLED },
    voucher: NEXT_VOUCHER,
    taxMode: "IGST",
    loadingLedger: "Carriage Inward",
    focus: "commit",
    ...over,
  })
  switch (q.get("at")) {
    case "loading":
      return { ...base, resolved: { ...base.resolved, tax: true }, seeded: { ...base.seeded, tax: true }, taxMode: "IGST", focus: "loading" }
    case "voucher":
      return { ...base, resolved: { ...base.resolved, tax: true, loading: true }, seeded: { ...base.seeded, tax: true, loading: true }, taxMode: "IGST", loadingLedger: "Carriage Inward", focus: "voucher" }
    case "armed":
      return settled({})
    case "posted":
      return settled({ posted: true })
    case "balance":
      return settled({ forceBalanceError: true, activeError: "balance" })
    case "dup":
      return settled({ voucher: "AP/003/25-26", voucherDup: true, activeError: "dup" })
    case "reopen":
      return settled({ resolved: { ...ALL_SETTLED, freight: false }, focus: "freight" })
    case "settled":
      return settled({ settledOpen: true })
    default:
      return base
  }
}

const StoreContext = createContext<{
  state: State
  dispatch: Dispatch<Action>
} | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as never, bootState)
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBill() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useBill must be used within StoreProvider")
  return ctx
}
