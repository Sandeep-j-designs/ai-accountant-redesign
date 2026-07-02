import { TriangleAlert, ArrowRight } from "lucide-react"
import { useBill, isReady, grandTotal } from "@/state/store"
import { cn } from "@/lib/utils"
import { Amt } from "./kit"
import { INVOICE, NEXT_VOUCHER, TAX_AMOUNT, TAX_HALF } from "@/data/invoice"

export function CommitZone({
  committing,
  onShowBalance,
}: {
  committing: boolean
  onShowBalance: () => void
}) {
  const { state, dispatch } = useBill()
  const ready = isReady(state)

  // the lock/flag/open states are surfaced in the sticky header + dock now;
  // this zone only renders the reviewable entry (armed) or an active error.
  if (!ready && !state.activeError) return null

  if (state.activeError) {
    const dup = state.activeError === "dup"
    return (
      <div className="shadow-card rounded-lg border border-line bg-surface p-5">
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 flex-none text-danger" strokeWidth={1.8} />
          <div className="flex-1">
            <div className="text-[13.5px] text-danger">
              {dup
                ? "Voucher AP/003/25-26 already exists in this branch."
                : "Does not reconcile — ₹2,000 unaccounted."}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-ink">
              {dup
                ? "Assign a different number before this can record."
                : "Taxable + tax does not equal the document total."}
            </div>
            <button
              onClick={() =>
                dup ? dispatch({ type: "USE_VOUCHER", value: NEXT_VOUCHER }) : onShowBalance()
              }
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {dup ? "Use next — AP/004/25-26" : "Show the gap"}
              {!dup && <ArrowRight className="size-3.5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // armed — borderless: the exact entry, a hairline, then the switch
  const voucher = state.voucher || NEXT_VOUCHER
  const taxLines: [string, number][] =
    state.taxMode === "IGST"
      ? [["IGST Input @ 18%", TAX_AMOUNT]]
      : [
          ["CGST Input @ 9%", TAX_HALF],
          ["SGST Input @ 9%", TAX_HALF],
        ]
  const debits: [string, number][] = [
    [state.freightLedger, 120000],
    [state.loadingLedger, 36000],
    ...taxLines,
  ]
  const credit = grandTotal()

  return (
    <div
      className={cn(
        "rounded-xl border px-6 py-5 shadow-card transition-colors duration-200",
        committing ? "border-accent-sig/40 bg-accent-wash" : "border-line bg-surface",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Enters the books — Purchase</span>
        <span className="code text-[11px] text-muted-ink">
          {voucher} · {INVOICE.invoiceDate}
        </span>
      </div>

      <div className="mt-3">
        {debits.map(([label, amt], i) => (
          <JournalRow key={label + i} side="Dr" label={label} amount={amt} />
        ))}
        <JournalRow side="Cr" label={INVOICE.supplier.name} amount={credit} cr />
        <div className="mt-1 flex items-baseline justify-between border-t border-line/70 pt-2">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="draw-check size-3 text-ink-2">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Dr = Cr · balanced
          </span>
          <Amt value={credit} className="text-[13px] text-ink" />
        </div>
      </div>

      {/* the forcing-function confirm summary — holds for a beat while
          "Post to books" (in the dock below) actually records */}
      <div className="mt-3 flex items-center gap-2.5 border-t border-line/70 pt-3">
        <span
          className={cn(
            "size-[7px] flex-none rounded-full",
            committing ? "animate-pulse bg-accent-sig" : "bg-line-strong",
          )}
        />
        <span className={cn("text-[12px]", committing ? "font-medium text-accent-sig-ink" : "text-muted-ink")}>
          {committing
            ? `Posting ${voucher} · ${INVOICE.supplier.name} — recording to the books…`
            : "Reviewed above — use Post to books below to record."}
        </span>
      </div>
    </div>
  )
}

function JournalRow({
  side,
  label,
  amount,
  cr,
}: {
  side: "Dr" | "Cr"
  label: string
  amount: number
  cr?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-[5px] text-[12.5px]">
      <span className="font-mono text-[10px] text-faint">{side}</span>
      <span className={cn("truncate", cr ? "text-ink" : "text-body")}>{label}</span>
      <Amt value={amount} className="text-ink" />
    </div>
  )
}
