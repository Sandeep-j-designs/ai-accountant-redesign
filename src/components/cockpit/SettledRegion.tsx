import { useEffect, useRef, useState, type ReactNode } from "react"
import { Lock, Undo2, RotateCcw, Check } from "lucide-react"
import { useBill } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { cn } from "@/lib/utils"
import { Amt, DecisionCard } from "./kit"
import { FactEditor } from "./FactEditor"
import { FlagButton } from "./FlagButton"
import { Attribution } from "./Attribution"
import type { DocRegion } from "@/components/InvoiceDocument"
import {
  SETTLED_ORDER,
  FACTS,
  TAXABLE,
  TAX_AMOUNT,
  GRAND_TOTAL,
  type FactKey,
} from "@/data/invoice"

export function SettledRegion({ onHover }: { onHover?: (r: DocRegion | null) => void }) {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()

  const flaggedKeysList = SETTLED_ORDER.filter((k) => state.flagged[k])
  const keys = SETTLED_ORDER.filter((k) => state.seeded[k] && !state.flagged[k])
  const resolvedKeys = keys.filter((k) => state.resolved[k])
  const count = resolvedKeys.length
  const sig = resolvedKeys.join(",")

  // counter tick + a warm wash on the row that just landed
  const prevCount = useRef(count)
  const prevKeys = useRef<FactKey[]>(resolvedKeys)
  const [tick, setTick] = useState(false)
  const [landed, setLanded] = useState<FactKey | null>(null)
  useEffect(() => {
    const now = sig ? (sig.split(",") as FactKey[]) : []
    const added = now.filter((k) => !prevKeys.current.includes(k))
    prevKeys.current = now
    if (count > prevCount.current && !reduced) {
      setTick(true)
      if (added[0]) setLanded(added[0])
      const t = setTimeout(() => {
        setTick(false)
        setLanded(null)
      }, 700)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    prevCount.current = count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, reduced])

  if (keys.length === 0 && flaggedKeysList.length === 0) return null

  return (
    <div className="flex flex-col gap-5">
      {flaggedKeysList.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2 px-3">
            <span className="eyebrow text-warning">Flagged for review</span>
            <span className="fig text-[10.5px] text-warning/80">{flaggedKeysList.length}</span>
            <span className="ml-auto text-[10.5px] text-faint">routed — off your desk</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-warning/30 bg-warning-bg">
            {flaggedKeysList.map((k, i) => {
              const info = state.flagged[k]!
              return (
                <div
                  key={k}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    i > 0 && "border-t border-warning/15",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{FACTS[k].label}</div>
                    <div className="truncate text-[11px] text-warning">
                      Flagged by {info.by ?? "you"} → {info.to}
                      {info.note ? ` · ${info.note}` : ""}
                    </div>
                  </div>
                  {!state.posted && (
                    <div className="flex flex-none items-center gap-1.5">
                      <FlagButton
                        onPick={(to) => dispatch({ type: "FLAG", key: k, to })}
                        trigger={
                          <button className="rounded-sm px-2 py-1 text-[11.5px] font-medium text-warning transition-colors hover:text-ink">
                            Reassign
                          </button>
                        }
                      />
                      <button
                        onClick={() => dispatch({ type: "UNFLAG", key: k })}
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11.5px] font-medium text-muted-ink transition-colors hover:text-ink"
                      >
                        <Undo2 className="size-3" strokeWidth={2} />
                        Take back
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {keys.length > 0 && (
      <div>
      <div className="mb-1.5 flex items-center gap-2 px-3">
        <span className="eyebrow">Settled · in the books</span>
        <span className={cn("font-mono text-[10.5px] tnum text-faint transition-colors", tick && "text-accent-sig-ink")}>
          {count}
        </span>
        {state.posted ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-[10.5px] text-faint">
            <Lock className="size-3" strokeWidth={1.8} />
            Recorded · locked
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-bg px-2 py-0.5 text-[10.5px] font-medium text-success">
            <Check className="size-3" strokeWidth={2.6} />
            Verified
          </span>
        )}
      </div>

      <div>
        {keys.map((k, i) => {
          const editing = !state.resolved[k]
          if (editing) {
            return (
              <div key={k} className="animate-expand py-2">
                <DecisionCard>
                  <FactEditor factKey={k} />
                </DecisionCard>
              </div>
            )
          }
          const r = factText(k, state)
          return (
            <div
              key={k}
              onMouseEnter={() => onHover?.(FACTS[k].region)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                "group relative flex items-center gap-3 rounded-md py-2.5 px-3 transition-colors duration-150",
                i > 0 && "border-t border-line/60",
                !state.posted && "hover:bg-panel/60",
                landed === k && "animate-[settle-land_0.7s_ease-out]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] leading-snug text-body">{r.primary}</div>
                <div className="truncate text-[11px] text-faint">{r.meta}</div>
                {state.attribution[k] && (
                  <div className="mt-1">
                    <Attribution record={state.attribution[k]!} />
                  </div>
                )}
              </div>
              {state.posted ? (
                <Lock className="size-3.5 flex-none text-faint/60" strokeWidth={1.8} />
              ) : (
                <button
                  onClick={() => dispatch({ type: "REOPEN", key: k })}
                  aria-label={`Reopen ${FACTS[k].label}`}
                  className="inline-flex flex-none items-center gap-1.5 self-start rounded-md border border-line-2 px-2 py-1 text-[11.5px] font-medium text-muted-ink transition-colors hover:border-line-strong hover:text-ink focus-visible:border-line-strong"
                >
                  <RotateCcw className="size-3" strokeWidth={2} />
                  Reopen
                </button>
              )}
            </div>
          )
        })}
      </div>
      </div>
      )}
    </div>
  )
}

function factText(
  key: FactKey,
  s: ReturnType<typeof useBill>["state"],
): { primary: ReactNode; meta: ReactNode } {
  switch (key) {
    case "supplier":
      return {
        primary: <>{s.vendor} → Acme Industries</>,
        meta: "Matched on GSTIN 29ABCDE1234F1Z5 · inv SLPL/2526/0489",
      }
    case "freight":
      return {
        primary: (
          <>
            Freight <Amt value={120000} className="text-body" /> · {s.freightLedger}
          </>
        ),
        meta: "HSN 996511",
      }
    case "tax":
      return {
        primary: (
          <>
            {s.taxMode === "IGST" ? "IGST @ 18%" : "CGST + SGST"}{" "}
            <Amt value={TAX_AMOUNT} className="text-body" />
          </>
        ),
        meta:
          s.taxMode === "IGST"
            ? "Corrected from printed CGST+SGST · inter-state (29 ≠ 27)"
            : "Kept as printed — review at filing",
      }
    case "loading":
      return {
        primary: (
          <>
            Loading &amp; handling <Amt value={36000} className="text-body" /> · {s.loadingLedger}
          </>
        ),
        meta: "HSN 996799",
      }
    case "voucher":
      return {
        primary: <span className="font-mono text-ink">{s.voucher}</span>,
        meta: "Next in this branch's AP series",
      }
    case "totals":
      return {
        primary: (
          <>
            <Amt value={TAXABLE} className="text-body" /> +{" "}
            <Amt value={TAX_AMOUNT} className="text-body" /> ={" "}
            <Amt value={GRAND_TOTAL} className="font-medium text-ink" />
          </>
        ),
        meta: "Line items reconcile to the document total",
      }
  }
}
