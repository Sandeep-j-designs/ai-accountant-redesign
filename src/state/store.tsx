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
  FIELD_CONFIDENCE,
  FACT_CONFIDENCE,
  CURRENT_USER,
  type FactKey,
  type FieldStatus,
} from "@/data/invoice"
import { COCKPIT_REVIEW_ID } from "@/data/review"
import { COMPANIES, DEFAULT_COMPANY_ID } from "@/data/companies"
import { SEEDED_RUNS, type UploadRun } from "@/data/uploads"
import type { BillAuditEntry } from "@/data/audit"
import {
  seedVoucherFieldConfig,
  enabledKeys,
  deriveRequired,
  fixtureRequiredCtx,
  ADDITIONAL_FIELD_MAP,
  type VoucherType,
  type VoucherFieldConfig,
  type AdditionalFieldKey,
} from "@/data/additionalFields"

export type Screen = "bills" | "entry" | "read" | "cockpit" | "billDetail" | "settings" | "coa" | "inventory"
/** destinations that are registers, not mid-document flows — they keep the
 *  full chrome and survive a company switch */
export const REGISTER_SCREENS: Screen[] = ["bills", "settings", "coa", "inventory"]
export type BillsTab = "books" | "review" | "uploads"
export type TaxMode = "IGST" | "SPLIT"
/** pre-post failure modes surfaced INSIDE the posting checkpoint (§4): a
 *  duplicate voucher, a Dr/Cr imbalance, or a ledger missing in Tally. */
export type ActiveError = null | "dup" | "balance" | "ledger"
/** explicit read-pass outcomes — a corrupt file, a faint scan, an unmatched
 *  vendor. Each surfaces its own inline state rather than falling through. */
export type ReadError = null | "unreadable" | "faint" | "vendor"

/** focus cursor for the queue + the commit switch. Spans BOTH core facts and
 *  config-driven additional fields — they share one Enter-chain (§3). */
export type Focus = FactKey | AdditionalFieldKey | "commit"

/** is this focus target one of the config-driven additional fields? */
export function isAdditionalKey(f: Focus): f is AdditionalFieldKey {
  return f !== "commit" && f in ADDITIONAL_FIELD_MAP
}
/** is this focus target one of the six core facts? */
export function isFactKey(f: Focus): f is FactKey {
  return f !== "commit" && !isAdditionalKey(f)
}

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
  | { kind: "restart" }
  | { kind: "manual"; step: number }
  | { kind: "deleteBill"; billId: string }
  | null

type Resolved = Record<FactKey, boolean>

/** One approval action — a single vendor group, or a whole approve-all sweep.
 *  Carries its own totals so the undo affordance can name exactly what it is
 *  about to reverse without recomputing the classification. */
export interface ApprovalBatch {
  id: string
  /** The BILL IDS this approval settled, captured at the click.
   *
   *  Not pattern keys. Approving "12 Tata Power bills" is consent to twelve
   *  documents the human was shown counted — not to Tata Power forever. With
   *  pattern-scoped approval, three more Tata bills arriving on a later upload
   *  would have posted with nobody approving them, which is a silent
   *  auto-post: exactly what the graduation gate, the sampling and the batch
   *  record exist to prevent. Ids also make the trail reconstructible — you
   *  can say precisely which documents a given click put in the books. */
  billIds: string[]
  /** what the operator sees: "Tata Power Company" or "18 vendor patterns" */
  label: string
  bills: number
  value: number
}

/** Every bill settled so far, across all live batches. Undoing a batch removes
 *  its ids here, which is what puts those bills back in the queue. */
// eslint-disable-next-line react-refresh/only-export-components
export function approvedBillIds(s: { approvalBatches: ApprovalBatch[] }): Set<string> {
  return new Set(s.approvalBatches.flatMap((b) => b.billIds))
}

/* ── sync state, per company ────────────────────────────────────
   A sync run lives in the STORE, not in the SyncModal, for the same reason an
   upload run does (see State.run): a run that only survives while you watch it
   is not a background run. Holding it here is what lets a push to Acme keep
   going while the operator switches to Northwind and pushes that too — and
   what lets the settings page report both at once.

   Progress is NOT stored. It derives from startedAt + durationMs, so a dropped
   tick can never strand the bar half-full; the same model RunStrip uses.
   ───────────────────────────────────────────────────────────── */

/** a per-reason failure tally, grouped from the real rows' syncNote */
export interface FailGroup {
  n: number
  label: string
}

export type SyncPhase = "idle" | "syncing" | "synced" | "failed"

export interface CompanySync {
  phase: SyncPhase
  /** ids this run marks synced when it lands — frozen at click time, so the
   *  result reports exactly what this run did even if the books move under it */
  inFlightIds: string[]
  /** snapshot of the run in flight / just finished */
  run: { total: number; ok: number; scoped: boolean; failed: FailGroup[] }
  /** books-row ids that are in Tally for THIS company */
  syncedIds: string[]
  lastSync: string
  /** wall-clock start of the live run; null when nothing is running */
  startedAt: number | null
  /** how long this run should take. Scales with voucher count — forty vouchers
   *  visibly taking longer than three is the honest read, and it is what makes
   *  a run still be running when you land on another company. */
  durationMs: number
}

const IDLE_RUN = { total: 0, ok: 0, scoped: false, failed: [] as FailGroup[] }

function seedSync(): Record<string, CompanySync> {
  return Object.fromEntries(
    COMPANIES.map((c) => [
      c.id,
      {
        phase: "idle" as SyncPhase,
        inFlightIds: [],
        run: { ...IDLE_RUN },
        syncedIds: [],
        lastSync: c.lastSync,
        startedAt: null,
        durationMs: 0,
      },
    ]),
  )
}

/** the sync record for a company — never undefined, so callers can read it flat */
export function companySync(s: State, id: string): CompanySync {
  return s.sync[id] ?? s.sync[DEFAULT_COMPANY_ID]
}
/** the sync record for the company currently being worked in */
export function activeSync(s: State): CompanySync {
  return companySync(s, s.activeCompanyId)
}
/** 0-100 for a live run, derived from elapsed time. 0 when nothing is running. */
export function syncProgress(cs: CompanySync): number {
  if (cs.phase !== "syncing" || cs.startedAt === null || cs.durationMs <= 0) return 0
  return Math.min(100, ((Date.now() - cs.startedAt) / cs.durationMs) * 100)
}
/** has this run served its time? the engine's landing test */
export function syncElapsed(cs: CompanySync): boolean {
  return cs.phase === "syncing" && cs.startedAt !== null && Date.now() - cs.startedAt >= cs.durationMs
}
/** every company with a run in flight — what makes the settings page a monitor
 *  rather than a form */
export function syncingCompanyIds(s: State): string[] {
  return COMPANIES.filter((c) => companySync(s, c.id).phase === "syncing").map((c) => c.id)
}

/** the display stamp a landed run writes, e.g. "28 Jun, 9:32 PM" */
function stampNow(): string {
  const d = new Date()
  const mon = d.toLocaleString("en-US", { month: "short" })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, "0")
  const ap = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${d.getDate()} ${mon}, ${h}:${m} ${ap}`
}

export interface State {
  /** which company's books are being worked in. Scopes the sync — and only the
   *  sync; the document fixtures are shared (see data/companies.ts). */
  activeCompanyId: string
  /** every company's sync state, live runs included, keyed by company id */
  sync: Record<string, CompanySync>
  screen: Screen
  /** which Bills-list tab is showing — All bills is home; other surfaces
   *  (the sync modal) can route straight to the review queue */
  billsTab: BillsTab
  /** bills checked in the All-bills list — scopes bulk actions AND the
   *  TopBar sync (selection syncs only itself; empty = sync everything) */
  selectedBills: string[]
  /** Needs-review decisions on masters (ledgers + stock items), keyed by the
   *  review item id. "accepted" applied the AI's proposed fix; "dismissed"
   *  kept things as they were. Either way the item leaves the queue. */
  masterResolved: Record<string, "accepted" | "dismissed">
  /** which bill the detail screen (ENTER_COCKPIT) is showing — Prev/Next
   *  walks this across the Needs-review list in place, without leaving the
   *  screen. null defaults to the cockpit walkthrough's own bill. */
  reviewBillId: string | null
  /** review items confirmed into the books this session. They leave the
   *  Needs-review queue and surface in All bills as PENDING sync — recording
   *  a bill never sends it to Tally directly; the sync run does that. */
  postedReviewIds: string[]
  /** which All-bills row the read-only Bill Details page is showing */
  viewingBillId: string | null
  /** bills removed from All bills this session (the Delete action) — the
   *  local record only; a Synced bill stays posted in Tally regardless */
  deletedBillIds: string[]
  /** per-bill field corrections made from the Bill Details "Edit" action,
   *  keyed by BillRow field name — applied on top of the derived row */
  billFieldEdits: Record<string, Record<string, string>>
  /** per-bill audit entries logged this session (edits, sync retries) —
   *  merged with the synthesized base trail (data/audit.ts) for display */
  billAuditExtra: Record<string, BillAuditEntry[]>
  /** bulk-uploaded files ingested this session. Clean reads skip review and
   *  land straight in All bills (pending sync); exception reads join the
   *  Needs-review queue — batchable ones fold into the grouped decisions. */
  ingestedIds: string[]
  /** Approvals of routine vendor-pattern groups this session (data/patterns.ts).
   *  One approval settles every bill in a group at once — the whole point of
   *  the stratum. Kept as BATCHES rather than a flat list of groups because
   *  undo works on the batch: the batch is what the human actually decided,
   *  and "undo the sweep I just did" is the request, not "un-approve bill 41". */
  approvalBatches: ApprovalBatch[]
  /** monotonic — batch ids must stay unique across undos */
  batchSeq: number
  /** vendor patterns the user has graduated to posting automatically. Opt-in
   *  per vendor, reversible at any time; the gates still apply underneath, so
   *  a deviating bill from one of these vendors still stops and waits. */
  autoPostPatterns: string[]
  /** auto-posted bills a human has spot-checked — the sampling that keeps
   *  automation from becoming an unwatched pipe.
   *  PARKED: graduation is built but not currently rendered (components/bills/
   *  graduation.tsx). Kept so the flow stays one approval path. */
  attestedBills: string[]
  /** An in-flight upload+read, stamped when it started. It lives in the store
   *  so leaving the page does not cancel it — a 217-document run is minutes,
   *  and holding the tab hostage for it is indefensible. null = nothing running. */
  run: { startedAt: number; pileId: string } | null
  /** Every upload run on record, oldest first. One entry per RUN — see
   *  data/uploads.ts for why that is the unit and not the document. */
  uploadRuns: UploadRun[]
  /** Uploads read this session, in order. The month's intake does not exist
   *  until the user uploads it — before that the queue holds only what was
   *  already there. A second pile can land before the first is approved, which
   *  is the normal rhythm of crush week, so this is a list and not a flag. */
  readPiles: string[]
  /** the recurring-bills summary. Opens itself when an extraction run finishes,
   *  and is reachable again from the card on the Needs-review page — "do it
   *  later" has to lead somewhere. */
  recurringModal: boolean
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
  // ── config-driven additional (optional tail) fields ──
  /** the voucher type being posted — scopes which additional fields are enabled */
  voucherType: VoucherType
  /** per-voucher-type field enablement (all OFF by default; Purchase seeded) */
  voucherFieldConfig: VoucherFieldConfig
  /** company-level flags feeding deriveRequired (e.g. cost allocation) */
  companyFlags: { costAllocationMandatory: boolean }
  /** user-entered / overridden values on top of the inferred prefill */
  additionalValues: Partial<Record<AdditionalFieldKey, string>>
  /** additional fields the user has accepted/entered (→ settled) */
  additionalResolved: Partial<Record<AdditionalFieldKey, boolean>>
  /** who decided each additional field, and how */
  additionalAttribution: Partial<Record<AdditionalFieldKey, DecisionRecord>>
  /** the collapsed "Additional details" zone open state */
  additionalOpen: boolean
  // edge state
  /** in the posting checkpoint — the split-view preview before the write (§4) */
  posting: boolean
  voucherDup: boolean
  forceBalanceError: boolean
  /** a debit ledger the write would reference doesn't exist in Tally yet */
  forceLedgerError: boolean
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

/** the enabled additional tail, fully settled — so "armed"/posting fixtures and
 *  SIM_* shortcuts satisfy the stricter isReady (which gates on the tail too) */
const ADD_SETTLED: Partial<Record<AdditionalFieldKey, boolean>> = {
  costCentre: true,
  dispatchedThrough: true,
  modeTermsOfPayment: true,
}
const ADD_VALUES: Partial<Record<AdditionalFieldKey, string>> = {
  costCentre: "Inbound Logistics",
}

export const initialState: State = {
  activeCompanyId: DEFAULT_COMPANY_ID,
  sync: seedSync(),
  screen: "bills",
  billsTab: "books",
  selectedBills: [],
  masterResolved: {},
  reviewBillId: null,
  postedReviewIds: [],
  viewingBillId: null,
  deletedBillIds: [],
  billFieldEdits: {},
  billAuditExtra: {},
  ingestedIds: [],
  approvalBatches: [],
  batchSeq: 0,
  autoPostPatterns: [],
  attestedBills: [],
  uploadRuns: SEEDED_RUNS,
  run: null,
  readPiles: [],
  recurringModal: false,
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
  voucherType: "purchase",
  voucherFieldConfig: seedVoucherFieldConfig(),
  companyFlags: { costAllocationMandatory: true },
  additionalValues: {},
  additionalResolved: {},
  additionalAttribution: {},
  additionalOpen: false,
  posting: false,
  voucherDup: false,
  forceBalanceError: false,
  forceLedgerError: false,
  readError: null,
  activeError: null,
  manual: false,
  posted: false,
  moneyFlash: false,
  dialog: null,
}

export type Action =
  | { type: "SHOW"; screen: Screen }
  | { type: "SET_BILLS_TAB"; tab: BillsTab }
  | { type: "SET_BILL_SELECTION"; ids: string[] }
  | { type: "RESOLVE_MASTER"; ids: string[]; how: "accepted" | "dismissed" }
  | { type: "UNRESOLVE_MASTER"; ids: string[] }
  | { type: "POST_REVIEW"; ids: string[] }
  | { type: "UNPOST_REVIEW"; ids: string[] }
  | { type: "VIEW_BILL"; billId: string }
  | { type: "DELETE_BILL"; billId: string }
  | { type: "EDIT_BILL_FIELD"; billId: string; field: string; label: string; from: string; to: string }
  | { type: "RETRY_BILL_SYNC"; billId: string }
  | { type: "INGEST_BILLS"; ids: string[] }
  | { type: "APPROVE_GROUPS"; billIds: string[]; label: string; value: number }
  | { type: "UNDO_BATCH"; id: string }
  | { type: "SET_AUTO_POST"; key: string; on: boolean }
  | { type: "ATTEST_BILLS"; ids: string[] }
  | { type: "SET_RECURRING_MODAL"; open: boolean }
  | { type: "START_RUN"; pileId: string }
  | { type: "EXTRACTION_DONE"; record: Omit<UploadRun, "id" | "at" | "by"> }
  | { type: "SET_COMPANY"; companyId: string }
  /** arm a run for a company. The caller passes the rows it resolved at click
   *  time — the reducer never re-derives them, so what lands is what was shown. */
  | {
      type: "SYNC_START"
      companyId: string
      okIds: string[]
      failed: FailGroup[]
      scoped: boolean
      durationMs: number
    }
  /** the run served its time — commit it. Fired by SyncEngine, not the modal. */
  | { type: "SYNC_LAND"; companyId: string }
  | { type: "SYNC_CANCEL"; companyId: string }
  | { type: "START_READ" }
  | { type: "ENTER_COCKPIT"; billId?: string }
  | { type: "SET_REVIEW_BILL"; billId: string }
  | { type: "OPEN_DIALOG"; dialog: Dialog }
  | { type: "CLOSE_DIALOG" }
  | { type: "FOCUS"; key: Focus }
  | { type: "TOGGLE_SETTLED"; open?: boolean }
  | { type: "TOGGLE_ADDITIONAL"; open?: boolean }
  | { type: "SET_FIELD_CONFIG"; voucherType: VoucherType; key: AdditionalFieldKey; enabled: boolean }
  | { type: "SET_COMPANY_FLAG"; flag: "costAllocationMandatory"; value: boolean }
  | { type: "SET_ADDITIONAL_VALUE"; key: AdditionalFieldKey; value: string }
  | { type: "CONFIRM_ADDITIONAL"; key: AdditionalFieldKey; value?: string; how?: "accepted" | "overridden" }
  | { type: "REOPEN_ADDITIONAL"; key: AdditionalFieldKey }
  | { type: "TOGGLE_ACTIVITY"; open?: boolean }
  | { type: "TOGGLE_PALETTE"; open?: boolean }
  | { type: "TOGGLE_HELP"; open?: boolean }
  | { type: "CONFIRM"; key: FactKey; value?: string; how?: "accepted" | "overridden"; note?: string }
  | { type: "FLAG"; key: FactKey; to: string; note?: string }
  | { type: "UNFLAG"; key: FactKey }
  | { type: "REOPEN"; key: FactKey }
  | { type: "USE_VOUCHER"; value: string }
  | { type: "SET_ERROR"; error: ActiveError }
  | { type: "ENTER_POSTING" }
  | { type: "EXIT_POSTING" }
  | { type: "COMMIT" }
  | { type: "CLEAR_MONEY_FLASH" }
  | { type: "SIM_DUP" }
  | { type: "SIM_BALANCE" }
  | { type: "SIM_LEDGER" }
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
/** the unified Enter-chain: unresolved core doubts (hero-first, FACT_PRIORITY
 *  order) then additional doubt/needsInput fields (Tally sub-panel order).
 *  settled + optionalEmpty are skipped. A clean board → []. */
function advanceFocus(s: State): Focus {
  return enterChain(s)[0] ?? "commit"
}

/* ── field-state model ──────────────────────────────────────────
   The confidence-routed FieldStatus for a core fact, derived from the
   existing resolved/seeded truth + its confidence level. A resolved fact is
   settled; an unresolved one is a doubt (every core exception carries an
   inferable value/proposal — the IGST correction, a recommended ledger, the
   next voucher number — so none of them are needsInput). `resolved` stays the
   backward-compatible boolean, now expressible as a function of status. */
export function fieldStatus(s: State, key: FactKey): FieldStatus {
  if (s.resolved[key]) return "settled"
  return "doubt"
}
/** the confidence entry (level + basis) behind a core fact, for its card */
export function factConfidence(key: FactKey): { level: "high" | "medium"; basis: string } {
  return FIELD_CONFIDENCE[FACT_CONFIDENCE[key]]
}
/** commit-gating truth over a status — doubt + needsInput block; settled +
 *  optionalEmpty do not. For core facts this equals `resolved`; additional
 *  fields (§2) reuse it so optionalEmpty never gates. */
export function statusBlocksCommit(status: FieldStatus): boolean {
  return status === "doubt" || status === "needsInput"
}
/** the inverse — a status that counts as resolved for commit-gating */
export function statusResolved(status: FieldStatus): boolean {
  return !statusBlocksCommit(status)
}
/** whether a status routes into the Enter-chain — only doubt + needsInput do */
export function statusInChain(status: FieldStatus): boolean {
  return statusBlocksCommit(status)
}

/* ── additional (config-driven) field state ─────────────────────
   Same FieldStatus model, derived for the optional tail. An enabled field is:
   settled once accepted; doubt while it carries a value (inferred prefill or
   typed) not yet accepted; needsInput when required + empty + not inferable;
   optionalEmpty when optional + empty. */
export function enabledAdditionalKeys(s: State): AdditionalFieldKey[] {
  return enabledKeys(s.voucherFieldConfig, s.voucherType)
}
/** the effective value of an additional field — user override, else prefill */
export function additionalValue(s: State, key: AdditionalFieldKey): string {
  return s.additionalValues[key] ?? ADDITIONAL_FIELD_MAP[key].infer?.value ?? ""
}
export function additionalRequired(s: State, key: AdditionalFieldKey): boolean {
  return deriveRequired(key, fixtureRequiredCtx(s.companyFlags.costAllocationMandatory))
}
export function additionalFieldStatus(s: State, key: AdditionalFieldKey): FieldStatus {
  if (s.additionalResolved[key]) return "settled"
  if (additionalValue(s, key).trim() !== "") return "doubt"
  return additionalRequired(s, key) ? "needsInput" : "optionalEmpty"
}
/** enabled additional fields whose status routes into the Enter-chain, in
 *  catalog (Tally sub-panel) order — the doubts and required-empties */
export function additionalChainKeys(s: State): AdditionalFieldKey[] {
  return enabledAdditionalKeys(s).filter((k) => statusInChain(additionalFieldStatus(s, k)))
}
/** enabled additional fields that block commit (doubt + needsInput) */
export function additionalBlockingKeys(s: State): AdditionalFieldKey[] {
  return additionalChainKeys(s)
}

/** the unified Enter-chain across core + additional, hero-first then doc order */
export function enterChain(s: State): Focus[] {
  const core: Focus[] = FACT_PRIORITY.filter((k) => !s.resolved[k] && !s.flagged[k])
  return [...core, ...additionalChainKeys(s)]
}

/* ── decision accounting (core + additional, for the progress header) ──
   The denominator is every field that is or was a real decision: the three
   core exceptions plus any enabled additional field that isn't a quiet
   optionalEmpty. optionalEmpty fields never count — they aren't decisions. */
export function additionalDecisionKeys(s: State): AdditionalFieldKey[] {
  return enabledAdditionalKeys(s).filter((k) => additionalFieldStatus(s, k) !== "optionalEmpty")
}
export function decisionTotal(s: State): number {
  return FACT_EXCEPTIONS.length + additionalDecisionKeys(s).length
}
export function decisionDone(s: State): number {
  const core = FACT_EXCEPTIONS.filter((k) => s.resolved[k]).length
  const add = additionalDecisionKeys(s).filter((k) => s.additionalResolved[k]).length
  return core + add
}

export function isReady(s: State): boolean {
  return (
    openCount(s) === 0 &&
    flaggedKeys(s).length === 0 &&
    additionalBlockingKeys(s).length === 0 &&
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

    case "SET_BILLS_TAB":
      return { ...s, billsTab: a.tab }

    case "SET_BILL_SELECTION":
      return { ...s, selectedBills: a.ids }

    case "RESOLVE_MASTER": {
      const next = { ...s.masterResolved }
      for (const id of a.ids) next[id] = a.how
      return { ...s, masterResolved: next }
    }

    case "UNRESOLVE_MASTER": {
      const next = { ...s.masterResolved }
      for (const id of a.ids) delete next[id]
      return { ...s, masterResolved: next }
    }

    // review items confirmed into the books — off the queue, into All bills
    // as pending-sync rows (Tally only sees them on the next sync run)
    case "POST_REVIEW":
      return { ...s, postedReviewIds: [...new Set([...s.postedReviewIds, ...a.ids])] }

    case "UNPOST_REVIEW":
      return { ...s, postedReviewIds: s.postedReviewIds.filter((id) => !a.ids.includes(id)) }

    // opens the read-only Bill Details page for an All-bills row
    case "VIEW_BILL":
      return { ...s, screen: "billDetail", viewingBillId: a.billId }

    // local-only removal — a Synced bill stays posted in Tally regardless
    case "DELETE_BILL":
      return {
        ...s,
        deletedBillIds: [...new Set([...s.deletedBillIds, a.billId])],
        screen: "bills",
        viewingBillId: null,
      }

    case "EDIT_BILL_FIELD": {
      const prior = s.billAuditExtra[a.billId] ?? []
      const entry: BillAuditEntry = {
        id: `${a.billId}-edit-${prior.length}`,
        at: Date.now(),
        kind: "corrected",
        by: CURRENT_USER.name,
        label: `${a.label} corrected`,
        detail: `${a.from} → ${a.to}`,
      }
      return {
        ...s,
        billFieldEdits: {
          ...s.billFieldEdits,
          [a.billId]: { ...s.billFieldEdits[a.billId], [a.field]: a.to },
        },
        billAuditExtra: { ...s.billAuditExtra, [a.billId]: [...prior, entry] },
      }
    }

    case "RETRY_BILL_SYNC": {
      const prior = s.billAuditExtra[a.billId] ?? []
      const entry: BillAuditEntry = {
        id: `${a.billId}-retry-${prior.length}`,
        at: Date.now(),
        kind: "synced",
        by: CURRENT_USER.name,
        label: "Synced to Tally",
        detail: "Manual retry",
      }
      // a retry pushes to the book the operator is standing in
      const cs = activeSync(s)
      return {
        ...s,
        sync: {
          ...s.sync,
          [s.activeCompanyId]: { ...cs, syncedIds: [...new Set([...cs.syncedIds, a.billId])] },
        },
        billAuditExtra: { ...s.billAuditExtra, [a.billId]: [...prior, entry] },
      }
    }

    // a bulk-read file lands: clean → All bills (pending sync); exception →
    // the Needs-review queue. Idempotent so re-runs never duplicate.
    case "INGEST_BILLS":
      return { ...s, ingestedIds: [...new Set([...s.ingestedIds, ...a.ids])] }

    case "APPROVE_GROUPS": {
      // a bill already settled cannot be settled twice — approving one upload
      // and then "approve all" must not re-claim what the first click took
      const held = approvedBillIds(s)
      const billIds = a.billIds.filter((id) => !held.has(id))
      if (!billIds.length) return s
      const seq = s.batchSeq + 1
      return {
        ...s,
        batchSeq: seq,
        approvalBatches: [
          ...s.approvalBatches,
          {
            id: `batch-${seq}`,
            billIds,
            label: a.label,
            bills: billIds.length,
            value: a.value,
          },
        ],
      }
    }

    // the undo behind an approval — every group in the batch returns to the
    // queue intact, and its rows leave All bills. Available until the sync run
    case "UNDO_BATCH":
      return { ...s, approvalBatches: s.approvalBatches.filter((b) => b.id !== a.id) }

    // graduating a vendor, and ungraduating it. Turning it OFF must also drop
    // any attestations for its bills — they are back in the queue, unposted,
    // and an attestation of a bill nobody posted would be a false record
    case "SET_AUTO_POST":
      return {
        ...s,
        autoPostPatterns: a.on
          ? [...new Set([...s.autoPostPatterns, a.key])]
          : s.autoPostPatterns.filter((k) => k !== a.key),
        // intake bill ids are `<patternId>-<n>` (data/patterns.ts)
        attestedBills: a.on
          ? s.attestedBills
          : s.attestedBills.filter((id) => !id.startsWith(`${a.key}-`)),
      }

    case "ATTEST_BILLS":
      return { ...s, attestedBills: [...new Set([...s.attestedBills, ...a.ids])] }

    case "SET_RECURRING_MODAL":
      return { ...s, recurringModal: a.open }

    case "START_RUN":
      return { ...s, run: { startedAt: Date.now(), pileId: a.pileId } }

    // the run ends wherever the operator happens to be standing, and files
    // itself as it goes — history is a by-product of finishing, never a
    // separate thing someone has to remember to write
    case "EXTRACTION_DONE": {
      const pile = s.run?.pileId
      if (!pile || s.readPiles.includes(pile)) return { ...s, run: null }
      return {
        ...s,
        run: null,
        readPiles: [...s.readPiles, pile],
        uploadRuns: [
          ...s.uploadRuns,
          {
            id: `run-${s.uploadRuns.length + 1}`,
            at: s.run?.startedAt ?? Date.now(),
            by: CURRENT_USER.name,
            pileId: pile,
            ...a.record,
          },
        ],
      }
    }

    // Switching books. The sync state of the company being left is untouched —
    // a run in flight there keeps running (SyncEngine drives every company, not
    // just the active one), which is the whole reason it lives in the store.
    // A row selection does NOT travel: rows checked in Acme must never scope a
    // push to Northwind. Flow screens are showing the outgoing company's
    // document, so they step back to the list rather than lying about it.
    case "SET_COMPANY": {
      if (a.companyId === s.activeCompanyId) return s
      const inFlow = !REGISTER_SCREENS.includes(s.screen)
      return {
        ...s,
        activeCompanyId: a.companyId,
        selectedBills: [],
        screen: inFlow ? "bills" : s.screen,
        viewingBillId: inFlow ? null : s.viewingBillId,
      }
    }

    // arm a run. Nothing is committed here — the ids are held in flight until
    // SyncEngine lands them, so closing the modal or leaving the company cannot
    // half-apply a push.
    case "SYNC_START": {
      const cs = companySync(s, a.companyId)
      if (cs.phase === "syncing") return s // one run per company at a time
      const attempt = a.okIds.length + a.failed.reduce((n, f) => n + f.n, 0)
      if (attempt === 0) return s
      return {
        ...s,
        // an armed scope is spent at the click, not at the landing — otherwise
        // the checkboxes sit there implying they still gate something
        selectedBills: a.companyId === s.activeCompanyId && a.scoped ? [] : s.selectedBills,
        sync: {
          ...s.sync,
          [a.companyId]: {
            ...cs,
            phase: "syncing",
            inFlightIds: a.okIds,
            run: { total: attempt, ok: a.okIds.length, scoped: a.scoped, failed: a.failed },
            startedAt: Date.now(),
            durationMs: a.durationMs,
          },
        },
      }
    }

    // the run's rows are in Tally now — flip them to "synced" in All bills for
    // THIS company only. Idempotent; genuinely-rejected rows never land here.
    // Also logs a "Synced to Tally" audit entry per bill, same as a Bill
    // Details retry, so a row's history always shows how it got there.
    case "SYNC_LAND": {
      const cs = companySync(s, a.companyId)
      if (cs.phase !== "syncing") return s
      const newlySynced = cs.inFlightIds.filter((id) => !cs.syncedIds.includes(id))
      const billAuditExtra = { ...s.billAuditExtra }
      for (const id of newlySynced) {
        const prior = billAuditExtra[id] ?? []
        const entry: BillAuditEntry = {
          id: `${id}-synced-${prior.length}`,
          at: Date.now(),
          kind: "synced",
          by: CURRENT_USER.name,
          label: "Synced to Tally",
        }
        billAuditExtra[id] = [...prior, entry]
      }
      return {
        ...s,
        billAuditExtra,
        sync: {
          ...s.sync,
          [a.companyId]: {
            ...cs,
            phase: cs.run.failed.length ? "failed" : "synced",
            syncedIds: [...new Set([...cs.syncedIds, ...cs.inFlightIds])],
            inFlightIds: [],
            lastSync: stampNow(),
            startedAt: null,
          },
        },
      }
    }

    // cancelled mid-flight — nothing is committed, so the rows stay pending
    case "SYNC_CANCEL": {
      const cs = companySync(s, a.companyId)
      if (cs.phase !== "syncing") return s
      return {
        ...s,
        sync: {
          ...s.sync,
          [a.companyId]: { ...cs, phase: "idle", inFlightIds: [], run: { ...IDLE_RUN }, startedAt: null },
        },
      }
    }

    case "START_READ":
      return { ...s, screen: "read", manual: false, readError: null }

    case "ENTER_COCKPIT":
      return {
        ...s,
        screen: "cockpit",
        reviewBillId: a.billId ?? s.reviewBillId ?? COCKPIT_REVIEW_ID,
        focus: advanceFocus(s),
        activity: s.activity.length ? s.activity : seedActivity(),
      }

    // Prev/Next in the detail screen — swaps which bill is showing without
    // leaving "cockpit" or touching any other bill's decision state.
    case "SET_REVIEW_BILL":
      return { ...s, reviewBillId: a.billId }

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

    case "TOGGLE_ADDITIONAL":
      return { ...s, additionalOpen: a.open ?? !s.additionalOpen }

    case "SET_FIELD_CONFIG":
      return {
        ...s,
        voucherFieldConfig: {
          ...s.voucherFieldConfig,
          [a.voucherType]: { ...s.voucherFieldConfig[a.voucherType], [a.key]: a.enabled },
        },
      }

    case "SET_COMPANY_FLAG":
      return { ...s, companyFlags: { ...s.companyFlags, [a.flag]: a.value } }

    case "SET_ADDITIONAL_VALUE":
      return { ...s, additionalValues: { ...s.additionalValues, [a.key]: a.value } }

    case "CONFIRM_ADDITIONAL": {
      if (s.posted) return s
      const def = ADDITIONAL_FIELD_MAP[a.key]
      const value = a.value ?? (s.additionalValues[a.key] ?? def.infer?.value ?? "")
      const how = a.how ?? "accepted"
      const rec: DecisionRecord = { by: CURRENT_USER.name, at: Date.now(), how }
      const entry: ActivityEntry = {
        id: `${s.activity.length}-decided-${a.key}`,
        at: Date.now(),
        kind: "decided",
        by: CURRENT_USER.name,
        label: `${how === "accepted" ? "Accepted" : "Overrode"}: ${def.label}`,
        detail: value || undefined,
      }
      const additionalValues = { ...s.additionalValues, [a.key]: value }
      const additionalResolved = { ...s.additionalResolved, [a.key]: true }
      return {
        ...s,
        additionalValues,
        additionalResolved,
        additionalAttribution: { ...s.additionalAttribution, [a.key]: rec },
        activity: [...s.activity, entry],
        focus: advanceFocus({ ...s, additionalValues, additionalResolved }),
      }
    }

    case "REOPEN_ADDITIONAL": {
      if (s.posted) return s
      const additionalResolved = { ...s.additionalResolved }
      delete additionalResolved[a.key]
      const additionalAttribution = { ...s.additionalAttribution }
      delete additionalAttribution[a.key]
      const entry: ActivityEntry = {
        id: `${s.activity.length}-reopened-${a.key}`,
        at: Date.now(),
        kind: "reopened",
        by: CURRENT_USER.name,
        label: `Reopened to challenge: ${ADDITIONAL_FIELD_MAP[a.key].label}`,
      }
      return {
        ...s,
        additionalResolved,
        additionalAttribution,
        additionalOpen: true,
        activity: [...s.activity, entry],
        focus: a.key,
      }
    }

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
        `${how === "accepted" ? "Accepted" : "Overrode"}: ${FACTS[a.key].label}`,
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
        focus: advanceFocus({ ...s, ...applyValue(s, a.key, a.value), resolved, seeded, flagged }),
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
        `Flagged for review: ${FACTS[a.key].label}`,
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
        focus: advanceFocus({ ...s, resolved, seeded, flagged }),
      }
    }

    case "UNFLAG": {
      const flagged = { ...s.flagged }
      delete flagged[a.key]
      const entry = logged(s, "unflagged", a.key, `Flag cleared: ${FACTS[a.key].label}`)
      return { ...s, flagged, activity: [...s.activity, entry], focus: a.key }
    }

    case "REOPEN": {
      if (s.posted) return s // post-commit locks, by compliance
      const resolved = { ...s.resolved, [a.key]: false }
      const attribution = { ...s.attribution }
      delete attribution[a.key]
      const entry = logged(s, "reopened", a.key, `Reopened to challenge: ${FACTS[a.key].label}`)
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
        forceLedgerError: a.error === "ledger" ? s.forceLedgerError : false,
      }

    // ready board → the split-view posting checkpoint (§4). Only a gated,
    // clean board can enter; otherwise route to the next open decision.
    case "ENTER_POSTING":
      if (!isReady(s)) return { ...s, focus: advanceFocus(s) }
      return { ...s, posting: true }

    // Esc from the preview steps back to the board, clearing any surfaced error
    case "EXIT_POSTING":
      return { ...s, posting: false, activeError: null }

    case "COMMIT": {
      if (openCount(s) > 0) return { ...s, posting: false, focus: advanceFocus(s) }
      if (additionalBlockingKeys(s).length > 0) return { ...s, posting: false, focus: advanceFocus(s) }
      if (flaggedKeys(s).length > 0) return { ...s, posting: false } // flagged blocks
      // pre-post failure modes — surfaced inline in the preview, before the write
      if (s.voucherDup) return { ...s, activeError: "dup" }
      if (s.forceBalanceError) return { ...s, activeError: "balance" }
      if (s.forceLedgerError) return { ...s, activeError: "ledger" }
      const entry: ActivityEntry = {
        id: `${s.activity.length}-committed`,
        at: Date.now(),
        kind: "committed",
        by: CURRENT_USER.name,
        label: "Posted to Tally",
        detail: `${s.voucher || NEXT_VOUCHER} · Purchase voucher`,
      }
      return {
        ...s,
        posted: true,
        posting: false,
        activity: [...s.activity, entry],
        // recording moves the bill to All bills as PENDING sync — Tally only
        // receives it on the next sync run
        postedReviewIds: [...new Set([...s.postedReviewIds, COCKPIT_REVIEW_ID])],
      }
    }

    case "CLEAR_MONEY_FLASH":
      return { ...s, moneyFlash: false }

    // the failure modes now fire INSIDE the posting preview, before the write —
    // each lands the user in the checkpoint with the block already surfaced
    case "SIM_DUP":
      return { ...s, resolved: { ...ALL_SETTLED }, seeded: { ...ALL_SETTLED }, flagged: {}, additionalValues: { ...s.additionalValues, ...ADD_VALUES }, additionalResolved: { ...s.additionalResolved, ...ADD_SETTLED }, voucher: "AP/003/25-26", voucherDup: true, activeError: "dup", posting: true, focus: "commit" }

    case "SIM_BALANCE":
      return { ...s, resolved: { ...ALL_SETTLED }, seeded: { ...ALL_SETTLED }, flagged: {}, additionalValues: { ...s.additionalValues, ...ADD_VALUES }, additionalResolved: { ...s.additionalResolved, ...ADD_SETTLED }, forceBalanceError: true, activeError: "balance", posting: true, focus: "commit" }

    case "SIM_LEDGER":
      return { ...s, resolved: { ...ALL_SETTLED }, seeded: { ...ALL_SETTLED }, flagged: {}, additionalValues: { ...s.additionalValues, ...ADD_VALUES }, additionalResolved: { ...s.additionalResolved, ...ADD_SETTLED }, forceLedgerError: true, activeError: "ledger", posting: true, focus: "commit" }

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
  // ?tab=review deep-links the Bills list straight to the review queue
  const start: State = { ...initialState, billsTab: q.get("tab") === "review" ? "review" : "books" }
  const screen = q.get("screen")
  // ?screen=coa / ?screen=inventory open the master registers
  if (screen === "coa" || screen === "inventory") return { ...start, screen }
  // ?screen=coding deep-links straight into the ABCom review bill's cockpit
  if (screen === "coding") return { ...start, screen: "cockpit", billsTab: "review", reviewBillId: "r-abcom", activity: seedActivity() }
  if (screen !== "cockpit" && screen !== "entry" && screen !== "read") return start
  const base: State = { ...start, screen: screen as Screen, focus: "tax", activity: seedActivity() }
  const settled = (over: Partial<State>): State => ({
    ...base,
    resolved: { ...ALL_SETTLED },
    seeded: { ...ALL_SETTLED },
    voucher: NEXT_VOUCHER,
    taxMode: "IGST",
    loadingLedger: "Carriage Inward",
    // settle the enabled additional tail too, so the stricter isReady (which
    // now gates on additional needsInput/doubt) still arms these deep links
    additionalValues: { ...ADD_VALUES },
    additionalResolved: { ...ADD_SETTLED },
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
    case "posting":
      return settled({ posting: true })
    case "posted":
      return settled({ posted: true })
    case "balance":
      return settled({ forceBalanceError: true, activeError: "balance", posting: true })
    case "dup":
      return settled({ voucher: "AP/003/25-26", voucherDup: true, activeError: "dup", posting: true })
    case "ledger":
      return settled({ forceLedgerError: true, activeError: "ledger", posting: true })
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
