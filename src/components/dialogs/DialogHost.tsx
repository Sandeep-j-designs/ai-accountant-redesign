import { useBill, type Dialog as DialogState } from "@/state/store"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ReadFailDialog, DiscardDialog, RestartDialog, ManualDialog } from "./MiscDialogs"
import { DeleteBillDialog } from "./BillDialogs"

/**
 * Only entry-edge flows remain modal — they happen before a document is on
 * screen, so there is nothing to keep lit. The three verification decisions
 * resolve inline in the cockpit rail; they never take a modal.
 */
const WIDTH: Record<string, string> = {
  readfail: "w-[440px]",
  discard: "w-[420px]",
  restart: "w-[420px]",
  manual: "w-[480px]",
  deleteBill: "w-[440px]",
}

function renderInner(d: DialogState) {
  if (!d) return null
  switch (d.kind) {
    case "readfail":
      return <ReadFailDialog />
    case "discard":
      return <DiscardDialog />
    case "restart":
      return <RestartDialog />
    case "manual":
      return <ManualDialog key={d.step} step={d.step} />
    case "deleteBill":
      return <DeleteBillDialog billId={d.billId} />
    default:
      return null
  }
}

export function DialogHost() {
  const { state, dispatch } = useBill()
  const d = state.dialog

  return (
    <Dialog
      open={!!d}
      onOpenChange={(o) => {
        if (!o) dispatch({ type: "CLOSE_DIALOG" })
      }}
    >
      {d && <DialogContent className={cn(WIDTH[d.kind])}>{renderInner(d)}</DialogContent>}
    </Dialog>
  )
}
