import { ChevronRight, Undo2, Lock } from "lucide-react"
import { useBill } from "@/state/store"
import { cn } from "@/lib/utils"
import type { DocRegion } from "@/components/InvoiceDocument"
import { DecisionCard, Kbd } from "./kit"
import { FactEditor } from "./FactEditor"
import { FlagButton } from "./FlagButton"
import { Attribution } from "./Attribution"
import { Confidence } from "./evidence"
import { factText } from "./SettledRegion"
import { FACTS, FACT_PRIORITY, SETTLED_ORDER, FACT_CONFIDENCE, type FactKey } from "@/data/invoice"

/** the terse prompt shown on a collapsed row that still needs a decision */
const NEEDS: Record<FactKey, string> = {
  tax: "Printed CGST + SGST · place of supply implies IGST",
  loading: "HSN 996799 fits two ledgers",
  voucher: "No number on the document",
  supplier: "Re-match against the vendor master",
  freight: "Confirm the freight ledger",
  totals: "Re-check the reconciliation",
}

/**
 * One dense, scannable list of every core fact — verified and needs-confirm in
 * a single stack (replaces the stacked decision cards + the settled region).
 * Needs-confirm rows sort first, hero-first; verified rows follow. The FOCUSED
 * needs-confirm row expands inline into its full editor, so the GST hero card
 * still gets its full treatment when it's the one you're on.
 */
export function FieldInspector({
  flash,
  onHover,
}: {
  flash: { key: FactKey; tone: "success" | "warning" } | null
  onHover?: (r: DocRegion | null) => void
}) {
  const { state, dispatch } = useBill()
  const doubts = FACT_PRIORITY.filter((k) => !state.resolved[k] && !state.flagged[k])
  const flagged = SETTLED_ORDER.filter((k) => state.flagged[k])
  const settled = SETTLED_ORDER.filter((k) => state.resolved[k] && !state.flagged[k])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* needs-confirm — hero-first; the focused one expands to its editor */}
      {doubts.map((k, i) => {
        const focused = state.focus === k
        if (focused) {
          return (
            <div key={k} className="animate-expand border-b border-line p-2 last:border-b-0">
              <DecisionCard focused flashing={flash?.key === k} flashTone={flash?.tone}>
                <FactEditor factKey={k} />
              </DecisionCard>
            </div>
          )
        }
        return (
          <DoubtRow key={k} k={k} first={i === 0} onFocus={() => dispatch({ type: "FOCUS", key: k })} />
        )
      })}

      {flagged.length > 0 && (
        <>
          <GroupLabel tone="warning">Flagged · routed off your desk</GroupLabel>
          {flagged.map((k) => (
            <FlaggedRow key={k} k={k} />
          ))}
        </>
      )}

      {settled.length > 0 && (
        <>
          <GroupLabel>Verified · {settled.length}</GroupLabel>
          {settled.map((k) => (
            <SettledRow key={k} k={k} onHover={onHover} />
          ))}
        </>
      )}
    </div>
  )
}

function GroupLabel({ children, tone }: { children: React.ReactNode; tone?: "warning" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-t border-line bg-panel/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.06em]",
        tone === "warning" ? "text-warning" : "text-faint",
      )}
    >
      {children}
    </div>
  )
}

/** shared row shell — fixed label column keeps values aligned for scanning */
function Row({
  dot,
  label,
  children,
  className,
  ...rest
}: {
  dot: React.ReactNode
  label: string
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-line/60 px-3 py-2.5 outline-none last:border-b-0",
        className,
      )}
      {...rest}
    >
      {dot}
      <span className="w-[140px] flex-none truncate text-[12.5px] font-medium text-ink">{label}</span>
      {children}
    </div>
  )
}

function Dot({ tone }: { tone: "settled" | "doubt" }) {
  return (
    <span
      className={cn(
        "size-[7px] flex-none rounded-full",
        tone === "settled" ? "bg-success" : "bg-warning",
      )}
    />
  )
}

function DoubtRow({ k, first, onFocus }: { k: FactKey; first: boolean; onFocus: () => void }) {
  return (
    <Row
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onFocus()
        }
      }}
      dot={<Dot tone="doubt" />}
      label={FACTS[k].label}
      className={cn("group cursor-pointer transition-colors hover:bg-panel/50", first && "rounded-t-lg")}
    >
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted-ink">{NEEDS[k]}</span>
      <Confidence field={FACT_CONFIDENCE[k]} />
      <span className="flex-none text-[11px] font-medium text-warning">needs you</span>
      <ChevronRight className="size-3.5 flex-none text-faint transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </Row>
  )
}

function SettledRow({ k, onHover }: { k: FactKey; onHover?: (r: DocRegion | null) => void }) {
  const { state, dispatch } = useBill()
  const r = factText(k, state)
  const record = state.attribution[k]
  return (
    <Row
      tabIndex={state.posted ? undefined : 0}
      onMouseEnter={() => onHover?.(FACTS[k].region)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(FACTS[k].region)}
      onBlur={() => onHover?.(null)}
      onKeyDown={(e) => {
        if (state.posted) return
        if (e.key === "r" || e.key === "R") {
          e.preventDefault()
          dispatch({ type: "REOPEN", key: k })
        }
      }}
      dot={<Dot tone="settled" />}
      label={FACTS[k].label}
      className={cn(
        "group",
        !state.posted && "hover:bg-panel/40 focus-visible:bg-panel focus-visible:ring-1 focus-visible:ring-accent-sig/30",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[12px] text-body">{r.primary}</span>
      {record && (
        <span className="hidden flex-none lg:block">
          <Attribution record={record} />
        </span>
      )}
      {state.posted ? (
        <Lock className="size-3.5 flex-none text-faint/60" strokeWidth={1.8} />
      ) : (
        <span className="flex flex-none items-center gap-1.5">
          <span className="hidden items-center gap-1 text-[10.5px] text-faint group-focus-within:flex">
            <Kbd>R</Kbd>
          </span>
          <button
            onClick={() => dispatch({ type: "REOPEN", key: k })}
            aria-label={`Challenge ${FACTS[k].label} — reopen to re-decide`}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-ink opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
          >
            <Undo2 className="size-3" strokeWidth={2} />
            Challenge
          </button>
        </span>
      )}
    </Row>
  )
}

function FlaggedRow({ k }: { k: FactKey }) {
  const { state, dispatch } = useBill()
  const info = state.flagged[k]!
  return (
    <Row dot={<span className="size-[7px] flex-none rounded-full bg-warning-dot" />} label={FACTS[k].label} className="bg-warning-bg/40">
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-warning">
        {info.by ?? "you"} → {info.to}
        {info.note ? ` · ${info.note}` : ""}
      </span>
      {!state.posted && (
        <span className="flex flex-none items-center gap-1">
          <FlagButton
            onPick={(to) => dispatch({ type: "FLAG", key: k, to })}
            trigger={
              <button className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-warning transition-colors hover:text-ink">
                Reassign
              </button>
            }
          />
          <button
            onClick={() => dispatch({ type: "UNFLAG", key: k })}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-ink transition-colors hover:text-ink"
          >
            <Undo2 className="size-3" strokeWidth={2} />
            Take back
          </button>
        </span>
      )}
    </Row>
  )
}
