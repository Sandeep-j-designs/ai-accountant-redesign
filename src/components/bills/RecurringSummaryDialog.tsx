/** The recurring summary — the one decision a 200-bill month should need.
 *
 *  It opens itself when extraction finishes and is reachable again from the
 *  card on the Needs-review page, because "do it later" has to lead somewhere.
 *
 *  Counts, not a list. The claim is about SAMENESS — these bills look exactly
 *  like last month's — and listing 166 rows to prove it works against the
 *  point. Every bill is still on the page underneath; this is a shortcut past
 *  them, not a substitute for them.
 *
 *  ── two uploads ────────────────────────────────────────────────
 *  A second pile landing before the first is approved is the normal rhythm of
 *  crush week, not an edge case. When more than one upload is waiting the
 *  modal breaks the count down by upload and each gets its own approve, so a
 *  cautious operator can take the morning's pile and leave the new client's.
 *  With one upload waiting that row would just restate the figure above it,
 *  so it isn't there.
 *
 *  ── the design ────────────────────────────────────────────────
 *  Borrowed from the register this product writes into: one hero figure in the
 *  display cut with tabular numerals, a ruled breakdown with right-aligned
 *  counts, hairlines instead of filled panels. The split rule under the header
 *  is the only graphic — it divides AND shows the proportion, so the modal
 *  makes its point before a word is read.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Money } from "@/components/bills/Money"
import { cn } from "@/lib/utils"
import { approvedBillIds, useBill, type State } from "@/state/store"
import { useToast } from "@/components/common/toast"
import { PERIOD, classifyIntake, openIntake, routineGroups } from "@/data/patterns"
import { runTime } from "@/data/uploads"

/** one upload's share of what is still waiting */
export interface PendingUpload {
  runId: string
  /** what the operator calls it — the time she dropped it */
  label: string
  billIds: string[]
  value: number
}

export function RecurringSummaryDialog({
  open,
  onOpenChange,
  recurring,
  recurringValue,
  vendors,
  changed,
  fresh,
  uploads,
  onApprove,
  onApproveUpload,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  recurring: number
  recurringValue: number
  vendors: number
  changed: number
  fresh: number
  /** more than one only when a second pile landed before the first was approved */
  uploads: PendingUpload[]
  onApprove: () => void
  onApproveUpload: (u: PendingUpload) => void
}) {
  const total = recurring + changed + fresh
  const rest = changed + fresh
  const pct = (n: number) => (total ? (n / total) * 100 : 0)
  const split = uploads.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[560px]">
        {/* header carries no rule of its own — the split bar below is the
            divider, so the eye meets the figure before any furniture */}
        <DialogHeader className="border-b-0 px-7 pb-0 pt-7">
          <p className="eyebrow">{PERIOD.label} intake</p>
          <DialogTitle className="mt-3 flex items-baseline gap-3 text-left">
            <span className="type-display fig text-ink">{recurring}</span>
            <span className="type-h3 font-normal text-body">
              of your {total} bills are recurring
            </span>
          </DialogTitle>
          <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-faint">
            <Money
              value={recurringValue}
              decimals={false}
              className="fig font-medium text-body"
            />{" "}
            ready to record — from {vendors} vendors you bill with every month
            {split && <> across {uploads.length} uploads</>}, on the same ledgers, at the same GST
            head, for amounts in their usual range.
          </p>

          {/* the proportion, doing double duty as the header rule */}
          <div className="-mx-7 mt-5 flex h-1" aria-hidden>
            <span className="bg-success-dot" style={{ width: `${pct(recurring)}%` }} />
            <span className="bg-warning-dot" style={{ width: `${pct(changed)}%` }} />
            <span className="bg-brand-vivid" style={{ width: `${pct(fresh)}%` }} />
          </div>
        </DialogHeader>

        <DialogBody className="px-7 py-1">
          <Row dot="bg-success-dot" label="Seen before, nothing changed" n={recurring} strong />
          <Row dot="bg-warning-dot" label="Known vendor, something changed" n={changed} />
          <Row dot="bg-brand-vivid" label="New vendors, no precedent" n={fresh} />

          {split && (
            <div className="pb-1 pt-4">
              <p className="eyebrow">Waiting from</p>
              {uploads.map((u) => (
                <div
                  key={u.runId}
                  className="flex items-center gap-3 py-2.5 shadow-[inset_0_-1px_0_var(--line)] last:shadow-none"
                >
                  <span className="fig w-9 flex-none text-right text-[15px] font-semibold text-ink">
                    {u.billIds.length}
                  </span>
                  <span className="flex-1 truncate text-[13px] text-body">{u.label}</span>
                  <Money
                    value={u.value}
                    decimals={false}
                    className="fig flex-none text-[13px] text-faint"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-none"
                    onClick={() => onApproveUpload(u)}
                  >
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogBody>

        <div className="max-w-[58ch] space-y-1.5 px-7 pb-5 pt-4 text-[12px] leading-relaxed text-faint">
          <p>
            Approving records these to your books as pending sync. Nothing reaches Tally until you
            run the sync, and the batch can be undone until then.
          </p>
          <p>
            The other {rest} stay in Needs review — as do these {recurring}, listed individually,
            if you would rather go through them one at a time.
          </p>
        </div>

        <DialogFooter className="px-7">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button onClick={onApprove}>
            {split ? `Approve all ${recurring}` : `Approve ${recurring} bills`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One ledger line. The dot repeats the split bar's colour, but the label
 *  carries the meaning — colour is never the only signal here. */
function Row({
  dot,
  label,
  n,
  strong,
}: {
  dot: string
  label: string
  n: number
  strong?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-3 py-3 shadow-[inset_0_-1px_0_var(--line)]")}>
      <span className={cn("size-2 flex-none rounded-full", dot)} />
      <span className={cn("flex-1 text-[13px]", strong ? "text-ink" : "text-body")}>{label}</span>
      <span
        className={cn(
          "fig flex-none tabular-nums",
          strong ? "text-[17px] font-semibold text-ink" : "text-[15px] text-body",
        )}
      >
        {n}
      </span>
    </div>
  )
}

/* ── what is waiting, sliced by the upload that brought it ────── */

export interface Pending {
  uploads: PendingUpload[]
  changed: number
  fresh: number
  vendors: number
}

export function pendingUploads(state: State): Pending {
  const items = classifyIntake(openIntake(state.readPiles))
  const settled = approvedBillIds(state)

  const byRun = new Map<string, PendingUpload>()
  const vendors = new Set<string>()
  for (const g of routineGroups(items)) {
    for (const b of g.bills) {
      if (settled.has(b.id)) continue
      vendors.add(g.vendor)
      const run = state.uploadRuns.find((r) => r.pileId === b.runId)
      const cur = byRun.get(b.runId) ?? {
        runId: b.runId,
        label: run ? `${runTime(run.at)} upload` : "Earlier upload",
        billIds: [],
        value: 0,
      }
      cur.billIds.push(b.id)
      cur.value += b.amount
      byRun.set(b.runId, cur)
    }
  }

  // two piles dropped inside the same minute would otherwise both read
  // "5:49 pm upload", which names neither of them
  const uploads = [...byRun.values()].sort((a, b) => a.runId.localeCompare(b.runId))
  const seen = new Map<string, number>()
  for (const u of uploads) {
    const n = (seen.get(u.label) ?? 0) + 1
    seen.set(u.label, n)
  }
  const used = new Map<string, number>()
  for (const u of uploads) {
    if ((seen.get(u.label) ?? 0) < 2) continue
    const n = (used.get(u.label) ?? 0) + 1
    used.set(u.label, n)
    u.label = `${u.label} (${n === 1 ? "first" : "second"})`
  }

  return {
    // oldest first — that pile has been waiting longest
    uploads,
    changed: items.filter((c) => c.stratum === "changed" && !settled.has(c.bill.id)).length,
    fresh: items.filter((c) => c.stratum === "new" && !settled.has(c.bill.id)).length,
    vendors: vendors.size,
  }
}

/** Mounted once on the Bills screen, on BOTH tabs.
 *
 *  It used to live inside the review queue, which meant a run finishing while
 *  the operator was on All bills — exactly what "continue in the background"
 *  invites her to do — completed silently with no summary at all. A dialog
 *  that only exists on the screen you happen to be looking at is not a
 *  notification, so this owns its own data and dispatch and needs no host. */
export function RecurringSummary() {
  const { state, dispatch } = useBill()
  const toast = useToast()

  const live = useMemo(() => pendingUploads(state), [state])

  /** Frozen at open.
   *
   *  A second upload can finish while this is on screen, and the count must
   *  not move under the cursor mid-decision — what you approve has to be what
   *  you were shown. Reopening picks up whatever has arrived since. */
  const [snap, setSnap] = useState<Pending | null>(null)
  useEffect(() => {
    setSnap(state.recurringModal ? pendingUploads(state) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recurringModal])

  const shown = snap ?? live
  const bills = shown.uploads.reduce((n, u) => n + u.billIds.length, 0)
  const value = shown.uploads.reduce((n, u) => n + u.value, 0)
  const liveBills = live.uploads.reduce((n, u) => n + u.billIds.length, 0)

  const settle = (billIds: string[], label: string, val: number) => {
    if (!billIds.length) return
    const id = `batch-${state.batchSeq + 1}`
    dispatch({ type: "APPROVE_GROUPS", billIds, label, value: val })
    toast({
      kind: "success",
      message: (
        <>
          Approved <b className="font-medium">{billIds.length} recurring bills</b> · pending sync in
          All bills
        </>
      ),
      undo: () => dispatch({ type: "UNDO_BATCH", id }),
    })
  }

  if (!state.readPiles.length || bills === 0) return null

  return (
    <RecurringSummaryDialog
      open={state.recurringModal}
      onOpenChange={(o) => dispatch({ type: "SET_RECURRING_MODAL", open: o })}
      recurring={bills}
      recurringValue={value}
      vendors={shown.vendors}
      changed={shown.changed}
      fresh={shown.fresh}
      uploads={shown.uploads}
      onApprove={() => {
        settle(shown.uploads.flatMap((u) => u.billIds), `${bills} recurring bills`, value)
        dispatch({ type: "SET_RECURRING_MODAL", open: false })
      }}
      onApproveUpload={(u) => {
        settle(u.billIds, `${u.billIds.length} recurring · ${u.label}`, u.value)
        // anything still waiting keeps the modal open, on what is left
        if (liveBills - u.billIds.length <= 0) {
          dispatch({ type: "SET_RECURRING_MODAL", open: false })
        } else {
          setSnap(null)
        }
      }}
    />
  )
}
