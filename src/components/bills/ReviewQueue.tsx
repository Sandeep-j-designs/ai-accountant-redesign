/** Needs review — one flat queue, plus a shortcut past the repetitive part.
 *
 *  Every bill in the month is a row here: the recurring ones, the ones where
 *  something changed, and the ones from vendors nobody has billed with before.
 *  Nothing is collapsed away, so an operator who wants to go bill by bill
 *  still can, and an auditor asking "where is bill 141?" gets an answer.
 *
 *  The card at the top is the shortcut: it reopens the recurring summary, and
 *  approving there settles all of them at once. Two routes to the same place —
 *  the fast one and the thorough one — rather than two different products.
 */

import { useMemo, useState } from "react"
import { RotateCw, Check, Undo2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { approvedBillIds, useBill } from "@/state/store"
import { Money } from "@/components/bills/Money"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/components/common/toast"
import { LIST_SHELL, COL_HEAD, Tag } from "@/components/bills/NeedsReview"
import { TablePagination } from "@/components/screens/BillsScreen"
import { classifyIntake, openIntake, type Classified } from "@/data/patterns"
import { pendingUploads } from "@/components/bills/RecurringSummaryDialog"
import {
  ABCOM_REVIEW_ID,
  COCKPIT_REVIEW_ID,
  ISSUE_WORD,
  REVIEW_ITEMS,
  type ReviewItem,
} from "@/data/review"

/* File-less grid: vendor+ref · why it's here · state · amount */
const COLS = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_164px_128px] items-center gap-4"

type RowKind = "recurring" | "changed" | "new"

interface QueueRow {
  key: string
  vendor: string
  invoiceNo: string
  amount: number
  kind: RowKind
  /** the sentence — precedent for a recurring bill, the deviation otherwise */
  reason: string
  /** short chip label */
  chip: string
  cockpitId?: string
}

/** only the two bills the cockpit is genuinely built for */
const WIRED = new Map(
  REVIEW_ITEMS.filter((r) => r.billId === COCKPIT_REVIEW_ID || r.billId === ABCOM_REVIEW_ID).map(
    (r) => [r.invoiceNo, r.billId],
  ),
)

function toRow(c: Classified): QueueRow {
  const b = c.bill
  const kind: RowKind =
    c.stratum === "routine" ? "recurring" : c.stratum === "changed" ? "changed" : "new"
  return {
    key: b.id,
    vendor: b.vendor,
    invoiceNo: b.invoiceNo,
    amount: b.amount,
    kind,
    reason: c.reason,
    chip:
      kind === "recurring"
        ? "Recurring"
        : kind === "changed"
          ? (c.deviations[0]?.label ?? "Changed")
          : "New vendor",
    cockpitId: WIRED.get(b.invoiceNo),
  }
}

function legacyRow(l: ReviewItem): QueueRow {
  return {
    key: l.billId,
    vendor: l.vendor,
    invoiceNo: l.invoiceNo,
    amount: l.amount,
    kind: "changed",
    reason:
      l.issues.length === 1
        ? (l.issues[0].detail ?? l.issues[0].proposedFix ?? "Needs a choice.")
        : `${l.issues.length} things to decide · ${l.issues.map((i) => ISSUE_WORD[i.type]).join(", ")}`,
    chip: `${ISSUE_WORD[l.issues[0].type]} unclear`,
    cockpitId: l.billId,
  }
}

export function ReviewQueue({
  legacy,
  onReview,
}: {
  legacy: ReviewItem[]
  onReview: (billId: string) => void
}) {
  const { state, dispatch } = useBill()
  const [kindFilter, setKindFilter] = useState<RowKind | "all">("all")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // The month's intake does not exist until the user has uploaded it. Before
  // that the queue holds only what was already sitting there, and no recurring
  // card is offered — offering one for bills nobody uploaded is a lie.
  //
  // Classified across ALL open uploads at once, never per pile: a bill can
  // duplicate one still waiting in an earlier upload, and only a pass that
  // sees both catches it.
  const items = useMemo(() => classifyIntake(openIntake(state.readPiles)), [state.readPiles])
  const approved = useMemo(() => approvedBillIds(state), [state])
  const posted = useMemo(() => new Set(state.postedReviewIds), [state.postedReviewIds])

  /** what is still waiting, and which upload each bill came in on */
  const pending = useMemo(() => pendingUploads(state), [state])
  const recurringBills = pending.uploads.reduce((n, u) => n + u.billIds.length, 0)
  const recurringValue = pending.uploads.reduce((n, u) => n + u.value, 0)

  const rows = useMemo(() => {
    const out: QueueRow[] = []
    for (const c of items) {
      // an approved bill has left the queue for All bills. Scoped to the BILL,
      // never the pattern — approving twelve Tata Power bills is consent to
      // twelve documents, not to the vendor forever
      if (approved.has(c.bill.id)) continue
      // a wired bill posted through the cockpit has left too
      const wired = WIRED.get(c.bill.invoiceNo)
      if (wired && posted.has(wired)) continue
      out.push(toRow(c))
    }
    // once the intake is in, only the freshly UPLOADED legacy exceptions fold
    // in alongside it; before that, the original queue is all there is
    for (const l of state.readPiles.length
      ? legacy.filter((r) => r.billId.startsWith("bulk-"))
      : legacy)
      out.push(legacyRow(l))
    // the ones wanting a decision first; recurring bills are the tail, since
    // the card above is the intended way through them
    const rank: Record<RowKind, number> = { changed: 0, new: 1, recurring: 2 }
    return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.amount - a.amount)
  }, [items, approved, posted, legacy, state.readPiles])

  const changed = rows.filter((r) => r.kind === "changed").length
  const fresh = rows.filter((r) => r.kind === "new").length

  const viewRows = kindFilter === "all" ? rows : rows.filter(r => r.kind === kindFilter)
  const maxPage = Math.max(0, Math.ceil(viewRows.length / pageSize) - 1)
  const safePage = Math.min(page, maxPage)
  const paged = viewRows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const setModal = (open: boolean) => dispatch({ type: "SET_RECURRING_MODAL", open })

  const batches = state.approvalBatches

  if (rows.length === 0 && batches.length === 0) {
    return (
      <EmptyState
        illustration="caughtup"
        title="You're all caught up"
        description="No bills need your review right now. New uploads will land here."
      />
    )
  }

  return (
    <div className="review-queue-workspace flex flex-col gap-4">
      {rows.length > 0 && <div className="review-queue-intro"><div className="queue-paper-icon" aria-hidden="true"><i/><i/><span>✓</span></div><div><span className="workspace-eyebrow">READY FOR YOUR JUDGMENT</span><h2>{rows.length} bills to review</h2><p>Resolve exceptions, confirm suggestions, then record.</p></div>{rows.find(r => r.cockpitId) && <Button onClick={() => onReview(rows.find(r => r.cockpitId)!.cockpitId!)}>Start review <ChevronRight size={15}/></Button>}</div>}
      <div className="review-kind-filters" aria-label="Filter review queue">{([{ key: "all", label: "All decisions", count: rows.length }, { key: "changed", label: "Changed details", count: changed }, { key: "new", label: "New vendors", count: fresh }, { key: "recurring", label: "Recurring", count: rows.filter(r => r.kind === "recurring").length }] as const).map(f => <button key={f.key} aria-pressed={kindFilter === f.key} onClick={() => { setKindFilter(f.key); setPage(0) }}><span className={`kind-dot kind-${f.key}`}/>{f.label}<b>{f.count}</b></button>)}</div>

      {/* the shortcut — reopens the summary */}
      {recurringBills > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <RotateCw className="size-4 flex-none text-accent-sig" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-body">
              <b className="font-medium text-ink">{recurringBills} recurring bills</b> from{" "}
              {pending.vendors} vendors
              {pending.uploads.length > 1 && <> across {pending.uploads.length} uploads</>} ·{" "}
              <Money value={recurringValue} decimals={false} className="text-body" />
            </div>
            <div className="mt-0.5 text-[12px] text-faint">
              Billed the same way every month. Approve them together instead of one at a time.
            </div>
          </div>
          <Button variant="default" size="default" onClick={() => setModal(true)}>
            Review {recurringBills}
          </Button>
        </div>
      )}

      {batches.length > 0 && <ApprovedStrip />}

      {/* one flat list — every bill, nothing collapsed away */}
      {rows.length > 0 && (
        <section>
          <div className={cn(LIST_SHELL, "review-queue-table")}>
            <div className="min-w-[760px]">
              <div className={cn(COLS, "min-h-12 border-b border-line bg-[var(--head-bg)] px-4 py-3 rounded-t-lg")}>
                <span className={COL_HEAD}>Vendor</span>
                <span className={COL_HEAD}>Why it's here</span>
                <span className={COL_HEAD}>State</span>
                <span className={cn(COL_HEAD, "justify-self-end")}>Amount</span>
              </div>

              {paged.map((r, i) => (
                <Row
                  key={r.key}
                  row={r}
                  tinted={i % 2 === 1}
                  onOpen={r.cockpitId ? () => onReview(r.cockpitId!) : undefined}
                />
              ))}

              {viewRows.length === 0 && <div className="p-8 text-center text-[14px] text-faint">No bills in this view. Choose another category above.</div>}
              {viewRows.length > pageSize && (
                <div className="flex justify-end px-4 pb-5 pt-4">
                  <TablePagination
                    page={safePage}
                    pageSize={pageSize}
                    total={viewRows.length}
                    onPage={setPage}
                    onPageSize={(s) => {
                      setPageSize(s)
                      setPage(0)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <p className="px-1 pt-3 text-[12px] text-ink-3">
            {rows.length} bills · {changed} changed · {fresh} new · {recurringBills} recurring
          </p>
        </section>
      )}
    </div>
  )
}

function Row({
  row,
  tinted,
  onOpen,
}: {
  row: QueueRow
  tinted: boolean
  onOpen?: () => void
}) {
  const toast = useToast()
  const open =
    onOpen ??
    (() =>
      toast({
        message: (
          <>
            Opening <b className="font-medium">{row.vendor}</b> · {row.invoiceNo}
          </>
        ),
      }))
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Review ${row.vendor} ${row.invoiceNo}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      className={cn(
        COLS,
        "min-h-16 cursor-pointer p-[var(--pad-cell)] shadow-[inset_0_-1px_0_var(--line)] last:shadow-none last:rounded-b-lg outline-none transition-colors hover:bg-row-hover",
        tinted && "bg-[var(--row-stripe)]",
        "focus-visible:bg-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold leading-tight text-ink">{row.vendor}</div>
        <div className="mt-0.5 truncate text-[13px] font-normal leading-tight text-faint">
          {row.invoiceNo}
        </div>
      </div>
      <span className="truncate text-[13px] text-body" title={row.reason}>
        {row.reason}
      </span>
      <span className="whitespace-nowrap [&>span]:h-7 [&>span]:text-[12px]">
        <Tag tone={row.kind === "changed" ? "amber" : row.kind === "new" ? "accent" : "green"}>
          {row.chip}
        </Tag>
      </span>
      <Money
        value={row.amount}
        decimals={false}
        symbolClassName="text-[14px]"
        className="justify-self-end text-[14px] font-semibold text-ink"
      />
    </div>
  )
}

/* ── what has been approved, and how to take it back ────────────
   The toast's Undo lasts four seconds; "can I reverse that?" lasts longer.
   Batches stay on screen, each individually reversible, until the sync run. */

function ApprovedStrip() {
  const { state, dispatch } = useBill()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const batches = state.approvalBatches
  const bills = batches.reduce((n, b) => n + b.bills, 0)
  const value = batches.reduce((n, b) => n + b.value, 0)

  return (
    <div className="rounded-lg border border-line bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50"
      >
        <Check className="size-4 flex-none text-success" strokeWidth={2.4} />
        <span className="text-[13px] text-body">
          <b className="font-medium text-ink">{bills} bills</b> approved this session ·{" "}
          <Money value={value} decimals={false} className="text-body" /> · pending sync in All bills
        </span>
        <span className="ml-auto flex flex-none items-center gap-1 text-[12px] text-faint">
          {batches.length} {batches.length === 1 ? "batch" : "batches"}
          <ChevronRight
            className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
            strokeWidth={2}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-line">
          {batches.map((b) => (
            <div
              key={b.id}
              className="grid grid-cols-[minmax(0,1fr)_64px_128px_96px] items-center gap-3 px-4 py-2 shadow-[inset_0_-1px_0_var(--line)] last:shadow-none"
            >
              <span className="truncate text-[13px] text-ink">{b.label}</span>
              <span className="justify-self-end text-[13px] tabular-nums text-body">{b.bills}</span>
              <Money
                value={b.value}
                decimals={false}
                className="justify-self-end text-[13px] tabular-nums text-body"
              />
              <span className="justify-self-end">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Undo2 strokeWidth={2} />}
                  onClick={() => {
                    dispatch({ type: "UNDO_BATCH", id: b.id })
                    toast({ message: <>Returned {b.bills} bills to the queue</> })
                  }}
                >
                  Undo
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
