import { ArrowUpRight, Check } from "lucide-react"
import { useBill, grandTotal } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Amt, MiniRow } from "./kit"
import { INVOICE, NEXT_VOUCHER, TAXABLE, TAX_AMOUNT, TAX_HALF } from "@/data/invoice"

/** Posted to the books — an honest, borderless record. No celebration. */
export function Receipt({ stamp }: { stamp: string }) {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()
  const voucher = state.voucher || NEXT_VOUCHER
  const heads =
    state.taxMode === "IGST"
      ? [["IGST Input @ 18%", TAX_AMOUNT] as const]
      : [
          ["CGST Input @ 9%", TAX_HALF] as const,
          ["SGST Input @ 9%", TAX_HALF] as const,
        ]

  return (
    <div className={cn("shadow-card rounded-lg border border-line bg-surface px-6 py-5", !reduced && "animate-stamp")}>
      <div className="flex items-center gap-2">
        <Check className="size-3.5 text-ink-2" strokeWidth={2.2} />
        <span className="eyebrow">Recorded to the books</span>
        <span className="code ml-auto text-[11px] text-faint">{stamp}</span>
      </div>

      <div className="mt-3 code text-[32px] font-normal leading-none text-ink">{voucher}</div>
      <div className="mt-2 text-[13px] text-body">
        Purchase voucher · {INVOICE.supplier.name}
      </div>

      <div className="my-5 h-px bg-line" />

      <div>
        <MiniRow label="Against invoice">
          <span className="code">{INVOICE.number}</span>
        </MiniRow>
        <MiniRow label="Taxable">
          <Amt value={TAXABLE} className="text-ink" />
        </MiniRow>
        {heads.map(([l, v]) => (
          <MiniRow key={l} label={l}>
            <Amt value={v} className="text-ink" />
          </MiniRow>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between border-t border-line/70 pt-3">
          <span className="eyebrow">Total recorded</span>
          <Amt value={grandTotal()} className="text-[20px] text-ink" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12px] text-muted-ink">
          <span className="size-1.5 animate-pulse rounded-full bg-muted-ink" />
          Queued to Tally, will appear as {voucher}
        </span>
        <button className="flex flex-none items-center gap-0.5 text-[12px] text-ink hover:underline">
          Track <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2.5">
        <Button onClick={() => dispatch({ type: "RESET" })}>Back to Bills</Button>
        <Button variant="outline" onClick={() => dispatch({ type: "SHOW", screen: "entry" })}>
          Next bill
        </Button>
      </div>
    </div>
  )
}
