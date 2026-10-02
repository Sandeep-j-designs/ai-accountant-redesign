import { useEffect } from "react"
import { ArrowRight, Check, TriangleAlert, CornerDownLeft, ArrowLeft } from "lucide-react"
import {
  useBill,
  grandTotal,
  enabledAdditionalKeys,
  additionalFieldStatus,
  additionalValue,
  additionalBlockingKeys,
} from "@/state/store"
import { cn } from "@/lib/utils"
import { track } from "@/lib/track"
import { primaryButtonSurface } from "@/components/ui/button"
import { Amt, Kbd } from "./kit"
import { INVOICE, NEXT_VOUCHER, TAX_AMOUNT, TAX_HALF } from "@/data/invoice"
import {
  ADDITIONAL_FIELD_MAP,
  GROUP_LABEL,
  GROUP_ORDER,
  type AdditionalFieldKey,
} from "@/data/additionalFields"

/**
 * The posting checkpoint — the RIGHT pane of the split-view. The source
 * document stays lit on the LEFT (mounted across the transition, so there is no
 * hard cut); here the resolved facts land in their literal Tally positions.
 * The single accountable write ("Post AP/007/25-26 to Tally") lives at the
 * bottom; the pre-post failure modes surface inline, blocking the write.
 */
export function PostingPreview({
  isLast,
  committing,
  onPost,
  onBack,
}: {
  isLast: boolean
  committing: boolean
  onPost: () => void
  onBack: () => void
}) {
  const { state, dispatch } = useBill()
  const voucher = state.voucher || NEXT_VOUCHER
  const err = state.activeError
  const ledgerMissing = err === "ledger"
  // the write is blocked by any surfaced failure, or a still-required tail field
  const blocked = !!err || additionalBlockingKeys(state).length > 0

  // instrumentation: emit once whenever the checkpoint is in a blocked state
  useEffect(() => {
    if (err) track("posting_blocked", { reason: err })
  }, [err])

  const taxLines: [string, number][] =
    state.taxMode === "IGST"
      ? [["IGST Input @ 18%", TAX_AMOUNT]]
      : [
          ["CGST Input @ 9%", TAX_HALF],
          ["SGST Input @ 9%", TAX_HALF],
        ]
  const debits: { label: string; amount: number; missing?: boolean }[] = [
    { label: state.freightLedger, amount: 120000, missing: ledgerMissing },
    { label: state.loadingLedger, amount: 36000 },
    ...taxLines.map(([label, amount]) => ({ label, amount })),
  ]
  const drTotal = debits.reduce((s, d) => s + d.amount, 0)
  const credit = grandTotal()
  const gap = state.forceBalanceError ? 2000 : 0

  const enabled = enabledAdditionalKeys(state)

  return (
    <div className="flex min-h-0 flex-col bg-surface">
      {/* header */}
      <div className="flex-none border-b border-line bg-surface/95 px-12 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="eyebrow">Posting preview</span>
            <span className="inline-flex items-center gap-1 rounded-xs bg-accent-wash px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ai-ink">
              Tally
            </span>
          </span>
          <span className="code text-[11px] text-muted-ink">
            Purchase · {voucher} · {INVOICE.invoiceDate}
          </span>
        </div>
      </div>

      {/* the literal Tally voucher */}
      <div className="flex-1 overflow-auto px-12 py-6">
        <div className="mx-auto max-w-[640px]">
          <p className="enter-up mb-4 max-w-[62ch] text-[12px] leading-relaxed text-muted-ink">
            This is the exact voucher that will be written to Tally. The facts you
            verified are now in their Tally positions — review, then authorize the post.
          </p>

          {/* Party + ledgers + tax + Dr/Cr balance */}
          <div className="enter-up rounded-lg border border-line bg-surface px-6 py-5 shadow-card" style={{ animationDelay: "60ms" }}>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Voucher · Purchase (AP)</span>
              <span className="code text-[11px] text-muted-ink">{voucher}</span>
            </div>

            <div className="mt-3">
              <JournalRow side="Cr" label={INVOICE.supplier.name} amount={credit} party />
              {debits.map((d, i) => (
                <JournalRow key={d.label + i} side="Dr" label={d.label} amount={d.amount} missing={d.missing} />
              ))}

              <div
                className={cn(
                  "mt-1 flex items-baseline justify-between border-t pt-2",
                  gap ? "border-danger/40" : "border-line/70",
                )}
              >
                {gap ? (
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger">
                    <TriangleAlert className="size-3 flex-none" strokeWidth={2} />
                    Dr <Amt value={drTotal} className="text-danger" /> ≠ Cr{" "}
                    <Amt value={credit + gap} className="text-danger" /> · <Amt value={gap} className="text-danger" /> unaccounted
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-ink">
                    <Check className="size-3 flex-none text-ink-2" strokeWidth={2.6} />
                    Dr = Cr · balanced
                  </span>
                )}
                <Amt value={gap ? credit + gap : credit} className={cn("text-[13px]", gap ? "text-danger" : "text-ink")} />
              </div>
            </div>
          </div>

          {/* additional fields, mapped into their Tally sub-panel positions */}
          {enabled.length > 0 && (
            <div className="enter-up mt-5" style={{ animationDelay: "120ms" }}>
              <div className="mb-1.5 px-1 eyebrow">Party details · additional</div>
              <div className="space-y-3">
                {GROUP_ORDER.map((g) => {
                  const inGroup = enabled.filter((k) => ADDITIONAL_FIELD_MAP[k].group === g)
                  if (inGroup.length === 0) return null
                  return (
                    <div key={g} className="rounded-lg border border-line bg-surface px-4 py-3">
                      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                        {GROUP_LABEL[g]}
                      </div>
                      <div>
                        {inGroup.map((k, i) => (
                          <TallyFieldRow key={k} fieldKey={k} state={state} first={i === 0} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* pre-post failure — blocks the write, with an inline fix */}
          {err && (
            <div className="enter-up mt-5 rounded-lg border border-danger/40 bg-danger-bg/60 px-5 py-4 shadow-card">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 size-4 flex-none text-danger" strokeWidth={1.8} />
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium text-danger">{FAILURE[err].title(voucher)}</div>
                  <div className="mt-0.5 text-[12px] text-muted-ink">{FAILURE[err].detail}</div>
                  <button
                    onClick={() => FAILURE[err].fix(dispatch)}
                    className={cn(
                      "mt-3 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-semibold",
                      primaryButtonSurface,
                    )}
                  >
                    {FAILURE[err].action}
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* the single accountable write */}
      <div className="flex-none border-t border-line bg-surface/95 px-12 py-3 shadow-commit-bar backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-ink transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to review <Kbd>Esc</Kbd>
          </button>

          <button
            type="button"
            onClick={onPost}
            disabled={blocked || committing}
            aria-label={blocked ? "Fix the blocking issue before posting" : `Post ${voucher} to Tally`}
            className={cn(
              "inline-flex h-8 flex-none items-center gap-2 rounded-md px-4 text-[13px] font-semibold",
              primaryButtonSurface,
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {committing ? (
              `Posting ${voucher} to Tally…`
            ) : (
              <>
                Post {voucher} to Tally
                {!isLast && <span className="text-white/70">· next bill</span>}
                <Kbd tone="onaccent">
                  <CornerDownLeft className="size-3" strokeWidth={2.4} />
                </Kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function JournalRow({
  side,
  label,
  amount,
  party,
  missing,
}: {
  side: "Dr" | "Cr"
  label: string
  amount: number
  party?: boolean
  missing?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-[5px] text-[12.5px]">
      <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-faint">{side}</span>
      <span className={cn("flex min-w-0 items-center gap-2", missing ? "text-danger" : party ? "text-ink" : "text-body")}>
        <span className="truncate">{label}</span>
        {missing && (
          <span className="inline-flex flex-none items-center rounded-xs border border-danger/40 bg-danger-bg px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.04em] text-danger">
            not in Tally
          </span>
        )}
      </span>
      <Amt value={amount} className={missing ? "text-danger" : "text-ink"} />
    </div>
  )
}

/** one additional field in its Tally sub-panel position, in one of three
 *  states: will populate · left blank (won't write) · must fill (blocks). */
function TallyFieldRow({
  fieldKey,
  state,
  first,
}: {
  fieldKey: AdditionalFieldKey
  state: ReturnType<typeof useBill>["state"]
  first: boolean
}) {
  const def = ADDITIONAL_FIELD_MAP[fieldKey]
  const status = additionalFieldStatus(state, fieldKey)
  const value = additionalValue(state, fieldKey)
  const willWrite = status === "settled" || status === "doubt"
  const mustFill = status === "needsInput"

  return (
    <div className={cn("flex items-center gap-3 py-[7px] text-[12.5px]", !first && "border-t border-line/60")}>
      <span className="w-[168px] flex-none truncate text-body">{def.label}</span>
      {willWrite ? (
        <span className="min-w-0 flex-1 truncate text-ink">{value}</span>
      ) : mustFill ? (
        <span className="min-w-0 flex-1 truncate text-danger">— must fill before posting</span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-faint italic">left blank</span>
      )}
      <span
        className={cn(
          "flex-none text-[10.5px] font-medium",
          willWrite ? "text-success" : mustFill ? "text-danger" : "text-faint",
        )}
      >
        {willWrite ? "will write" : mustFill ? "required" : "won't write"}
      </span>
    </div>
  )
}

/** the pre-post failure surfaces — copy + the inline fix each blocks with */
const FAILURE: Record<
  "dup" | "balance" | "ledger",
  {
    title: (v: string) => string
    detail: string
    action: string
    fix: (dispatch: ReturnType<typeof useBill>["dispatch"]) => void
  }
> = {
  dup: {
    title: () => "Voucher AP/003/25-26 already exists in this branch.",
    detail: "Tally would reject a duplicate number. Assign the next free number before posting.",
    action: `Use ${NEXT_VOUCHER} instead`,
    fix: (dispatch) => dispatch({ type: "USE_VOUCHER", value: NEXT_VOUCHER }),
  },
  balance: {
    title: () => "Debits and credits don't reconcile.",
    detail: "Taxable + tax does not equal the document total — ₹2,000 unaccounted. Tally won't accept an unbalanced voucher.",
    action: "Recompute & balance",
    fix: (dispatch) => dispatch({ type: "SET_ERROR", error: null }),
  },
  ledger: {
    title: () => "Ledger not found in Tally.",
    detail: "The debit ledger this voucher references doesn't exist in the target company. Create it, then post.",
    action: "Create ledger in Tally",
    fix: (dispatch) => dispatch({ type: "SET_ERROR", error: null }),
  },
}
