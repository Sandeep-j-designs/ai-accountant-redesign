import { useMemo } from "react"
import { activeSync, approvedBillIds, useBill } from "@/state/store"
import { openIntake } from "@/data/patterns"
import { booksRows, applyEdits } from "@/data/review"
import { DialogHeader, DialogBody, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/common/toast"
import { InfoTag } from "./parts"

/** Delete confirmation for a Bill Details row (All bills). A Synced bill
 *  gets an extra warning — this only removes the local record, it never
 *  reaches into Tally. */
export function DeleteBillDialog({ billId }: { billId: string }) {
  const { state, dispatch } = useBill()
  const toast = useToast()

  const bill = useMemo(() => {
    const rows = booksRows(
      state.postedReviewIds,
      state.voucher,
      state.ingestedIds,
      activeSync(state).syncedIds,
      state.deletedBillIds,
      {
          bills: [...approvedBillIds(state)],
          autoPatterns: state.autoPostPatterns,
          open: openIntake(state.readPiles),
        },
    ).map((b) => applyEdits(b, state.billFieldEdits[b.id]))
    return rows.find((r) => r.id === billId)
  }, [billId, state])

  if (!bill) return null
  const synced = bill.tallySync === "synced"

  return (
    <>
      <DialogHeader>
        <InfoTag tone="danger">Delete bill</InfoTag>
        <DialogTitle className="mt-2.5 text-xl">Delete {bill.vendor}?</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm leading-relaxed text-body">
          This removes {bill.number} from the register. This cannot be undone.
        </p>
        {synced && (
          <p className="mt-3 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger">
            This bill is posted in Tally. Deleting here won't remove it there.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => dispatch({ type: "CLOSE_DIALOG" })}>
          Keep
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            dispatch({ type: "DELETE_BILL", billId: bill.id })
            dispatch({ type: "CLOSE_DIALOG" })
            toast({ message: <>Deleted <b className="font-medium">{bill.vendor}</b></> })
          }}
        >
          Delete
        </Button>
      </DialogFooter>
    </>
  )
}
