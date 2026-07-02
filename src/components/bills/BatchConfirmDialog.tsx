import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Currency } from "@/components/cockpit/Currency"
import type { ReviewItem } from "@/data/review"

const NEXT_VOUCHER_BASE = 4 // AP/004, 005, … assigned in sequence

/** Mandatory confirmation: shows the exact journal lines that will post for
 *  every selected bill. Batch commit only proceeds from here. */
export function BatchConfirmDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  items: ReviewItem[]
  onConfirm: () => void
}) {
  const total = items.reduce((s, b) => s + b.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[600px]">
        <DialogHeader>
          <DialogTitle>Review journal lines</DialogTitle>
          <p className="mt-1 text-[12.5px] text-body">
            {items.length} voucher{items.length === 1 ? "" : "s"} will post to Tally —{" "}
            <Currency value={total} className="font-medium text-ink" /> total. Confirm before committing.
          </p>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {items.map((b, i) => {
            const taxable = Math.round(b.amount / 1.18)
            const tax = b.amount - taxable
            const voucher = `AP/00${NEXT_VOUCHER_BASE + i}/25-26`
            return (
              <div key={b.billId} className="rounded-lg border border-line bg-surface px-4 py-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[12.5px] font-medium text-ink">{b.vendor}</span>
                  <span className="code text-[11px] text-faint">
                    {b.invoiceNo} · {voucher}
                  </span>
                </div>
                <JournalRow side="Dr" label="Expenses (input)" value={taxable} />
                <JournalRow side="Dr" label="IGST Input @ 18%" value={tax} />
                <JournalRow side="Cr" label={b.vendor} value={b.amount} cr />
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-line/70 pt-2 text-[11px] text-muted-ink">
                  <span className="size-[5px] rounded-full bg-lilac" />
                  {b.issues[0].proposedFix} · balanced
                </div>
              </div>
            )
          })}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="gap-1.5">
            Apply fixes &amp; commit {items.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function JournalRow({ side, label, value, cr }: { side: "Dr" | "Cr"; label: string; value: number; cr?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-[3px] text-[12px]">
      <span className="font-mono text-[10px] text-faint">{side}</span>
      <span className={cr ? "truncate text-ink" : "truncate text-body"}>{label}</span>
      <Currency value={value} className="text-ink" />
    </div>
  )
}
