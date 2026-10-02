import { useEffect, useRef } from "react"
import { ChevronRight, Check, Undo2, ArrowRight } from "lucide-react"
import {
  useBill,
  enabledAdditionalKeys,
  additionalFieldStatus,
  additionalValue,
  type State,
} from "@/state/store"
import { cn } from "@/lib/utils"
import { track } from "@/lib/track"
import { Kbd } from "./kit"
import { Attribution } from "./Attribution"
import {
  ADDITIONAL_FIELD_MAP,
  GROUP_LABEL,
  GROUP_ORDER,
  type AdditionalFieldKey,
  type AdditionalGroup,
} from "@/data/additionalFields"
import type { FieldStatus } from "@/data/invoice"

/** the calm status vocabulary, one row per state — green settled, amber doubt,
 *  red blocking (needsInput), quiet grey (optionalEmpty). */
const STATUS_META: Record<
  FieldStatus,
  { dot: string; word: string; wordClass: string }
> = {
  settled: { dot: "bg-success", word: "Verified", wordClass: "text-success" },
  doubt: { dot: "bg-warning", word: "Prefilled · review", wordClass: "text-warning" },
  needsInput: { dot: "bg-danger", word: "Required · needs input", wordClass: "text-danger" },
  optionalEmpty: { dot: "bg-line-strong", word: "Optional · won't write", wordClass: "text-faint" },
}

/**
 * The optional Tally tail — a collapsed "Additional details" zone, sub-grouped
 * exactly as Tally groups them (Receipt / Order / Import / Statutory & Cost).
 * Only fields enabled for the current voucher type render. The Enter-chain
 * stops only on doubt + needsInput rows; optionalEmpty ones are skipped (but
 * still manually focusable if the user wants to fill one). One keystroke (A)
 * or a header click expands/collapses.
 */
export function AdditionalDetails() {
  const { state, dispatch } = useBill()
  const keys = enabledAdditionalKeys(state)
  if (keys.length === 0) return null

  const open = state.additionalOpen
  const counts = summarize(state, keys)

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => dispatch({ type: "TOGGLE_ADDITIONAL" })}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-panel/50"
      >
        <ChevronRight
          className={cn("size-4 flex-none text-faint transition-transform duration-150", open && "rotate-90")}
          strokeWidth={2}
        />
        <span className="eyebrow">Additional details</span>
        <span className="text-[10.5px] tabular-nums text-faint">{keys.length}</span>

        {/* compact status summary — always visible even when collapsed */}
        <span className="ml-auto flex items-center gap-3 text-[11px]">
          {counts.needsInput > 0 && (
            <Pill dot="bg-danger" className="text-danger">
              {counts.needsInput} needs input
            </Pill>
          )}
          {counts.doubt > 0 && (
            <Pill dot="bg-warning" className="text-warning">
              {counts.doubt} to review
            </Pill>
          )}
          {counts.optionalEmpty > 0 && (
            <Pill dot="bg-line-strong" className="text-faint">
              {counts.optionalEmpty} won't write
            </Pill>
          )}
          {counts.settled > 0 && (
            <Pill dot="bg-success" className="text-success">
              {counts.settled} set
            </Pill>
          )}
          <Kbd>A</Kbd>
        </span>
      </button>

      {open && (
        <div className="animate-expand border-t border-line px-4 pb-4 pt-1">
          {GROUP_ORDER.map((g) => {
            const inGroup = keys.filter((k) => ADDITIONAL_FIELD_MAP[k].group === g)
            if (inGroup.length === 0) return null
            return <SubPanel key={g} group={g} keys={inGroup} state={state} />
          })}
          <p className="mt-3 max-w-[62ch] text-[11px] leading-relaxed text-faint">
            These map into Tally's Party Details sub-panels. Optional empties are
            skipped in the review chain — only required-unfilled and prefilled
            fields stop for a decision.
          </p>
        </div>
      )}
    </div>
  )
}

function SubPanel({
  group,
  keys,
  state,
}: {
  group: AdditionalGroup
  keys: AdditionalFieldKey[]
  state: State
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 px-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
        {GROUP_LABEL[group]}
      </div>
      <div className="overflow-hidden rounded-md border border-line/70">
        {keys.map((k, i) => (
          <FieldRow key={k} fieldKey={k} state={state} first={i === 0} />
        ))}
      </div>
    </div>
  )
}

function FieldRow({
  fieldKey,
  state,
  first,
}: {
  fieldKey: AdditionalFieldKey
  state: State
  first: boolean
}) {
  const { dispatch } = useBill()
  const def = ADDITIONAL_FIELD_MAP[fieldKey]
  const status = additionalFieldStatus(state, fieldKey)
  const value = additionalValue(state, fieldKey)
  const meta = STATUS_META[status]
  const focused = state.focus === fieldKey
  const record = state.additionalAttribution[fieldKey]

  // the focused chain row is an inline editor — accept the prefill or type a value
  if (focused && status !== "settled") {
    return <FocusedRow fieldKey={fieldKey} value={value} status={status} first={first} />
  }

  const rowBase = cn(
    "flex items-center gap-3 px-3 py-2 text-left transition-colors",
    !first && "border-t border-line/60",
    status === "needsInput" && "bg-danger-bg/40",
  )

  // settled rows are Tab-focusable and carry a one-keystroke challenge (R)
  if (status === "settled") {
    return (
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "r" || e.key === "R") {
            e.preventDefault()
            dispatch({ type: "REOPEN_ADDITIONAL", key: fieldKey })
          }
        }}
        className={cn(rowBase, "group outline-none focus-visible:bg-panel focus-visible:ring-1 focus-visible:ring-accent-sig/30")}
      >
        <span className={cn("size-[7px] flex-none rounded-full", meta.dot)} />
        <span className="w-[168px] flex-none truncate text-[12.5px] text-body">{def.label}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{value || "—"}</span>
        {record && (
          <span className="hidden flex-none sm:block">
            <Attribution record={record} />
          </span>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: "REOPEN_ADDITIONAL", key: fieldKey })}
          className="inline-flex flex-none items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-ink opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        >
          <Undo2 className="size-3" strokeWidth={2} />
          Challenge <Kbd>R</Kbd>
        </button>
      </div>
    )
  }

  // an open decision that isn't focused — click to route the chain to it
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "FOCUS", key: fieldKey })}
      className={cn(rowBase, "w-full hover:bg-panel/60")}
    >
      <span className={cn("size-[7px] flex-none rounded-full", meta.dot)} />
      <span className="w-[168px] flex-none truncate text-[12.5px] text-body">{def.label}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]">
        {value ? <span className="text-body">{value}</span> : <span className="text-faint">—</span>}
      </span>
      <span className={cn("flex flex-none items-center gap-1.5 text-[11px]", meta.wordClass)}>
        {meta.word}
      </span>
    </button>
  )
}

/** the active editor for the focused additional field — an input prefilled with
 *  the effective value; Enter (global) accepts, Esc steps back. */
function FocusedRow({
  fieldKey,
  value,
  status,
  first,
}: {
  fieldKey: AdditionalFieldKey
  value: string
  status: FieldStatus
  first: boolean
}) {
  const { dispatch } = useBill()
  const def = ADDITIONAL_FIELD_MAP[fieldKey]
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    inputRef.current?.scrollIntoView({ block: "nearest" })
  }, [])

  const inferred = def.infer?.value
  const accept = () => {
    const v = value.trim()
    if (!v) return
    const how: "accepted" | "overridden" = inferred && v !== inferred ? "overridden" : "accepted"
    if (how === "overridden") {
      // the "OCR/model prefilled-but-edited" quality signal
      track("additional_field_overridden", { fieldKey, from: inferred ?? "", to: v })
    }
    dispatch({ type: "CONFIRM_ADDITIONAL", key: fieldKey, value: v, how })
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-panel/60 px-3 py-2.5 ring-1 ring-inset ring-accent-sig/30",
        !first && "border-t border-line/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-[7px] flex-none rounded-full", status === "needsInput" ? "bg-danger" : "bg-warning")} />
        <span className="text-[12.5px] font-medium text-ink">{def.label}</span>
        <span className={cn("text-[11px]", status === "needsInput" ? "text-danger" : "text-warning")}>
          {status === "needsInput" ? "Required — enter a value" : "Prefilled — accept or edit"}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-[15px]">
        <input
          ref={inputRef}
          value={value}
          placeholder={inferred ? undefined : def.label}
          onChange={(e) => dispatch({ type: "SET_ADDITIONAL_VALUE", key: fieldKey, value: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-line-2 bg-card px-2.5 py-1.5 text-[13px] text-ink focus:border-accent-sig focus:outline-none focus:ring-2 focus:ring-accent-sig/20"
        />
        <button
          type="button"
          onClick={accept}
          disabled={!value.trim()}
          className="inline-flex flex-none items-center gap-1.5 rounded-md border border-accent-sig/40 bg-accent-wash px-3 py-1.5 text-[12.5px] font-medium text-accent-sig-ink transition-colors hover:border-accent-sig disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-3.5" strokeWidth={2.2} />
          {inferred && value.trim() === inferred ? "Accept" : "Confirm"}
          <Kbd>↵</Kbd>
        </button>
      </div>
      {def.infer && (
        <p className="flex items-start gap-1.5 pl-[15px] text-[11px] leading-relaxed text-muted-ink">
          <ArrowRight className="mt-0.5 size-3 flex-none text-faint" strokeWidth={2} />
          {def.infer.basis}
        </p>
      )}
    </div>
  )
}

function Pill({ dot, className, children }: { dot: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("size-[6px] rounded-full", dot)} />
      {children}
    </span>
  )
}

function summarize(state: State, keys: AdditionalFieldKey[]) {
  const c = { settled: 0, doubt: 0, needsInput: 0, optionalEmpty: 0 }
  for (const k of keys) c[additionalFieldStatus(state, k)]++
  return c
}
