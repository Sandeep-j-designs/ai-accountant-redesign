import { useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronDown,
  Pencil,
  Trash2,
  Download,
  MoreHorizontal,
  Copy,
  Archive,
  RefreshCw,
  AlertTriangle,
  Check,
  FileText,
  Link2,
  Lock,
  Hash,
} from "lucide-react"
import { activeSync, approvedBillIds, useBill } from "@/state/store"
import { openIntake } from "@/data/patterns"
import { booksRows, applyEdits } from "@/data/review"
import { type BillRow } from "@/data/invoice"
import { lineItemsFor, taxSummaryFor, taxLabelFor } from "@/data/lineItems"
import { stampedAuditTrail, type BillAuditEntry, type BillAuditKind } from "@/data/audit"
import { cn } from "@/lib/utils"
import { relTime, stampNow, dueInDays } from "@/lib/format"
import { useToast } from "@/components/common/toast"
import { EmptyState } from "@/components/common/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Money } from "@/components/bills/Money"
import { SyncPill, StatusPill } from "@/components/bills/status"
import { LIST_SHELL, TABLE_HEAD_ROW, TABLE_ROW } from "@/components/bills/NeedsReview"
import { Amt, MiniRow } from "@/components/cockpit/kit"

/** bold, uppercase, letter-spaced — the app's one micro-label token
 *  (index.css `.eyebrow`), used here for the line-items column heads so
 *  they read like every other table header in the app. */
const TABLE_COL_HEAD = "text-[11px] font-semibold uppercase tracking-[0.06em] text-faint"

/**
 * The read-only Bill Details page for a row already in All bills (synced,
 * pending, or failed) — distinct from the Needs-review decision flow. One
 * info card (vendor + billing facts, GST facts), a line-items table with its
 * own tax breakup, and the audit trail tucked into a collapsible section.
 */
export function BillDetailScreen() {
  const { state, dispatch } = useBill()
  return (
    <BillDetailView
      billId={state.viewingBillId}
      onBack={() => dispatch({ type: "SHOW", screen: "bills" })}
    />
  )
}

/** The bill-details content itself. Rendered full-page (with a Back button)
 *  for the `billDetail` route, and embedded in the All-bills master-detail
 *  split (no Back — the list sits right beside it). */
export function BillDetailView({
  billId,
  onBack,
}: {
  billId: string | null
  onBack?: () => void
}) {
  const { state, dispatch } = useBill()
  const toast = useToast()
  const [activeEditField, setActiveEditField] = useState<string | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)

  const rows = useMemo(
    () =>
      booksRows(
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
      ).map((b) => applyEdits(b, state.billFieldEdits[b.id])),
    [state],
  )
  const bill = rows.find((r) => r.id === billId)

  // the trail's synthesized base must reflect what actually happened, not
  // the live (session-mutated) sync status — otherwise retrying a failed
  // sync would retroactively read as having always synced cleanly. Building
  // it from the pre-retry row (syncedIds excluded) keeps "sync failed" in
  // history; the retry itself logs its own "Synced to Tally" entry.
  const historyRows = useMemo(
    () =>
      booksRows(
        state.postedReviewIds,
        state.voucher,
        state.ingestedIds,
        [],
        state.deletedBillIds,
        {
          bills: [...approvedBillIds(state)],
          autoPatterns: state.autoPostPatterns,
          open: openIntake(state.readPiles),
        },
      ).map((b) => applyEdits(b, state.billFieldEdits[b.id])),
    [state],
  )
  const originalBill = historyRows.find((r) => r.id === billId)

  const trail = useMemo(
    () => (originalBill && bill ? mergeTrail(originalBill, state.billAuditExtra[bill.id]) : []),
    [originalBill, bill, state.billAuditExtra],
  )

  if (!bill) {
    const noneSelected = billId == null
    return (
      <div className="bill-detail-workspace flex h-full min-h-0 flex-col">
        <DetailHeader onBack={onBack} />
        <div className="flex-1 overflow-auto bg-page">
          <EmptyState
            illustration="search"
            title={noneSelected ? "No bill selected" : "Bill not found"}
            description={
              noneSelected
                ? "Pick a bill from the list to see its full details here."
                : "This bill may have been deleted, or the link is stale."
            }
            cta={onBack ? { label: "Back to bills", onClick: onBack } : undefined}
          />
        </div>
      </div>
    )
  }

  const editField = (field: string, label: string, from: string, to: string) => {
    if (to === from) return
    dispatch({ type: "EDIT_BILL_FIELD", billId: bill.id, field, label, from, to })
  }

  const retrySync = () => {
    dispatch({ type: "RETRY_BILL_SYNC", billId: bill.id })
    toast({
      kind: "success",
      message: (
        <>
          Retrying sync for <b className="font-medium">{bill.voucherNo ?? bill.number}</b>
        </>
      ),
    })
  }

  return (
    <div className="bill-detail-workspace flex h-full min-h-0 flex-col">
      <DetailHeader
        bill={bill}
        onBack={onBack}
        onEdit={() => setActiveEditField("vendor")}
        onDelete={() => dispatch({ type: "OPEN_DIALOG", dialog: { kind: "deleteBill", billId: bill.id } })}
        onDownload={() =>
          toast({
            message: bill.billFile ? (
              <>
                Downloading <b className="font-medium">{bill.billFile}</b>
              </>
            ) : (
              "No source file on record for this bill"
            ),
          })
        }
        onDuplicate={() =>
          toast({ kind: "success", message: <>Duplicated <b className="font-medium">{bill.number}</b></> })
        }
        onArchive={() =>
          toast({ message: <>Archived <b className="font-medium">{bill.vendor}</b></>, undo: () => {} })
        }
      />

      <div className="flex-1 overflow-auto bg-page">
        <div className="bill-detail-content mx-auto max-w-[980px] px-8 py-7">
          <SummaryHero bill={bill} trail={trail} onRetry={retrySync} />

          <div className="mt-6">
            <InfoCard
              bill={bill}
              activeField={activeEditField}
              onActivate={setActiveEditField}
              onEditField={editField}
            />
          </div>

          <LineItemsTable bill={bill} />

          <AuditTrailSection trail={trail} open={auditOpen} onToggle={() => setAuditOpen((v) => !v)} />
        </div>
      </div>
    </div>
  )
}

/** merges the synthesized base trail with any session-logged entries
 *  (edits, sync retries), oldest first */
function mergeTrail(bill: BillRow, extra?: BillAuditEntry[]): BillAuditEntry[] {
  return [...stampedAuditTrail(bill), ...(extra ?? [])].sort((a, b) => a.at - b.at)
}

function DetailHeader({
  bill,
  onBack,
  onEdit,
  onDelete,
  onDownload,
  onDuplicate,
  onArchive,
}: {
  bill?: BillRow
  onBack?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDownload?: () => void
  onDuplicate?: () => void
  onArchive?: () => void
}) {
  return (
    <div className="flex flex-none items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex flex-none items-center gap-1 text-[13px] font-medium text-muted-ink outline-none transition-colors hover:text-ink focus-visible:text-ink"
          >
            <ChevronLeft className="size-4" strokeWidth={2.2} />
            Back
          </button>
        )}

        {bill && (
          <div className="flex min-w-0 items-center gap-2">
            {onBack && <span className="h-4 w-px flex-none bg-line" />}
            <VendorAvatar name={bill.vendor} />
            <span className="truncate text-[13.5px] font-semibold text-ink">{bill.vendor}</span>
            <span className="code flex-none text-[13px] text-faint">{bill.voucherNo ?? bill.number}</span>
            <SyncPill status={bill.tallySync ?? "synced"} note={bill.syncNote} className="flex-none" />
          </div>
        )}
      </div>

      {bill && (
        <div className="flex flex-none items-center gap-0.5">
          <HeaderIconButton label="Edit" onClick={onEdit}>
            <Pencil className="size-4" strokeWidth={2} />
          </HeaderIconButton>
          <HeaderIconButton label="Delete" onClick={onDelete}>
            <Trash2 className="size-4" strokeWidth={2} />
          </HeaderIconButton>
          <MoreMenu onDownload={onDownload} onDuplicate={onDuplicate} onArchive={onArchive} />
        </div>
      )}
    </div>
  )
}

/** small circular initials avatar — the vendor equivalent of the profile
 *  avatar in TopBar, sized down to sit inline in the detail header */
function VendorAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden
      className="grid size-6 flex-none place-items-center rounded-full bg-panel-2 text-[10.5px] font-semibold text-muted-ink"
    >
      {initials}
    </span>
  )
}

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-faint outline-none transition-colors hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-vivid/40"
    >
      {children}
    </button>
  )
}

function MoreMenu({
  onDownload,
  onDuplicate,
  onArchive,
}: {
  onDownload?: () => void
  onDuplicate?: () => void
  onArchive?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <HeaderIconButton label="More actions" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </HeaderIconButton>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-[38px] z-40 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-2"
          >
            <MenuItem icon={Download} label="Download" onClick={() => { setOpen(false); onDownload?.() }} />
            <MenuItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); onDuplicate?.() }} />
            <MenuItem icon={Archive} label="Archive" onClick={() => { setOpen(false); onArchive?.() }} />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
    >
      <Icon className="size-3.5 flex-none text-faint" strokeWidth={1.9} />
      {label}
    </button>
  )
}

/** A section heading with a short brand accent bar — the one heading token
 *  the detail pane reuses (info groups, line items) so the eye reads a clear
 *  hierarchy: section → field label → value. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="h-3.5 w-[3px] flex-none rounded-full bg-brand/70" />
      <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-body">{children}</span>
    </div>
  )
}

/** The detail hero — the bill's money at a glance. Outstanding (or paid)
 *  amount leads; the lifecycle status + total sit beneath it; the sync state
 *  (with its retry) is walled off to the right. An overdue bill grows a red
 *  footer strip so the pressure is impossible to miss. */
function SummaryHero({
  bill,
  trail,
  onRetry,
}: {
  bill: BillRow
  trail: BillAuditEntry[]
  onRetry: () => void
}) {
  const paid = bill.status === "paid"
  const outstanding = paid ? 0 : bill.amount
  const overdueDays = bill.status === "overdue" ? Math.max(0, -dueInDays(bill.due)) : 0
  const lastSynced = [...trail].reverse().find((e) => e.kind === "synced")
  const syncedOn = lastSynced ? stampNow(new Date(lastSynced.at)) : bill.syncedOn ?? bill.voucherDate ?? "—"

  return (
    <section className="bill-summary-hero overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex flex-col gap-3">
          <span className="eyebrow">{paid ? "Amount paid" : "Outstanding amount"}</span>
          <Amt
            value={paid ? bill.amount : outstanding}
            className={cn(
              "text-[36px] font-[680] leading-none tracking-[-0.03em]",
              overdueDays > 0 ? "text-danger" : "text-ink",
            )}
          />
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px]">
            <StatusPill status={bill.status} />
            <span className="text-faint">·</span>
            <span className="text-body">
              Bill total{" "}
              <Money value={bill.amount} decimals className="font-semibold text-ink" symbolClassName="text-[11px]" decimalClassName="text-[10px]" />
            </span>
          </div>
        </div>

        <div className="sm:min-w-[220px] sm:border-l sm:border-line sm:pl-6">
          <span className="eyebrow">Sync status</span>
          <div className="mt-2">
            <SyncStatusInline bill={bill} syncedOn={syncedOn} onRetry={onRetry} />
          </div>
        </div>
      </div>

      {overdueDays > 0 && (
        <div className="flex items-center gap-2 border-t border-danger/20 bg-danger-bg/50 px-6 py-2.5 text-[12.5px] font-medium text-danger">
          <AlertTriangle className="size-3.5 flex-none" strokeWidth={2} />
          Overdue by {overdueDays} {overdueDays === 1 ? "day" : "days"} — past the due date of {bill.due}.
        </div>
      )}
    </section>
  )
}

/** The editable facts, in two labelled groups: who the bill is from (Vendor
 *  details) and what it says (Bill information). Every plain fact carries a
 *  hover pencil. Money/sync facts live in the hero above, not here. */
function InfoCard({
  bill,
  activeField,
  onActivate,
  onEditField,
}: {
  bill: BillRow
  activeField: string | null
  onActivate: (field: string | null) => void
  onEditField: (field: string, label: string, from: string, to: string) => void
}) {
  const edit = (field: string, label: string, from: string) => (to: string) => onEditField(field, label, from, to)

  return (
    <div className="rounded-lg border border-line bg-surface p-7 shadow-card">
      <div className="grid grid-cols-2 gap-x-12">
        <div>
          <SectionHeading>Vendor details</SectionHeading>
          <div className="mt-5 flex flex-col gap-5">
            <FieldRow
              field="vendor"
              label="Vendor name"
              value={bill.vendor}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("vendor", "Vendor name", bill.vendor)}
            />
            <FieldRow
              field="gstin"
              label="GSTIN"
              value={bill.gstin ?? "—"}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("gstin", "GSTIN", bill.gstin ?? "—")}
            />
            <FieldRow
              field="billingAddress"
              label="Billing address"
              value={bill.billingAddress ?? "—"}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("billingAddress", "Billing address", bill.billingAddress ?? "—")}
            />
            <FieldRow
              field="reverseCharge"
              label="Reverse charge"
              value={bill.reverseCharge ? "Yes" : "No"}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("reverseCharge", "Reverse charge", bill.reverseCharge ? "Yes" : "No")}
            />
          </div>
        </div>

        <div className="border-l border-line pl-12">
          <SectionHeading>Bill information</SectionHeading>
          <div className="mt-5 flex flex-col gap-5">
            <FieldRow
              field="number"
              label="Bill number"
              value={bill.number}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("number", "Bill number", bill.number)}
            />
            <FieldRow
              field="date"
              label="Billing date"
              value={bill.date}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("date", "Billing date", bill.date)}
            />
            <FieldRow
              field="due"
              label="Due date"
              value={bill.due}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("due", "Due date", bill.due)}
            />
            <FieldRow
              field="description"
              label="Description"
              value={bill.description ?? "—"}
              activeField={activeField}
              onActivate={onActivate}
              onSave={edit("description", "Description", bill.description ?? "—")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** A settled fact, read-only until its pencil is used. */
function FieldRow({
  field,
  label,
  value,
  activeField,
  onActivate,
  onSave,
}: {
  field: string
  label: string
  value: string
  activeField: string | null
  onActivate: (field: string | null) => void
  onSave: (next: string) => void
}) {
  const editing = activeField === field
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (editing) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const save = () => {
    const next = draft.trim()
    if (next) onSave(next)
    onActivate(null)
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {!editing && (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={() => onActivate(field)}
            className="grid size-5 flex-none place-items-center rounded text-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="size-3" strokeWidth={2} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save()
              if (e.key === "Escape") onActivate(null)
            }}
            className="h-8 flex-1 text-[13.5px]"
          />
          <Button size="sm" onClick={save} className="px-3">
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => onActivate(null)} className="px-3">
            Cancel
          </Button>
        </div>
      ) : (
        <p className="mt-1.5 truncate text-[13.5px] font-medium text-ink">{value}</p>
      )}
    </div>
  )
}

/** dot + text share one colour per status — orange/green/red, the same
 *  semantics as the Bills-list sync pill, just louder (this field is the
 *  one place that state needs to read at a glance, retry button and all). */
const SYNC_STATUS_META = {
  synced: { dot: "bg-success-dot", text: "text-success" },
  pending: { dot: "bg-warning-dot", text: "text-warning" },
  failed: { dot: "bg-danger-dot", text: "text-danger" },
} as const

function SyncStatusInline({
  bill,
  syncedOn,
  onRetry,
}: {
  bill: BillRow
  syncedOn: string
  onRetry: () => void
}) {
  const status = bill.tallySync ?? "synced"
  const meta = SYNC_STATUS_META[status]
  const label =
    status === "synced" ? `Synced on ${syncedOn}` : status === "pending" ? "Waiting for sync" : bill.syncNote ?? "Sync failed"

  return (
    <div className="flex flex-col items-start gap-2">
      <p className={cn("inline-flex items-center gap-2 text-[13.5px] font-medium", meta.text)}>
        <span className={cn("size-1.5 flex-none rounded-full", meta.dot)} />
        {label}
      </p>
      {status !== "synced" && (
        <Button size="sm" variant="outline" onClick={onRetry} icon={<RefreshCw />}>
          {status === "failed" ? "Retry sync" : "Retry"}
        </Button>
      )}
    </div>
  )
}

const ITEM_COLS =
  "grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_110px_60px_110px_100px_120px] items-center gap-3"

function LineItemsTable({ bill }: { bill: BillRow }) {
  const items = useMemo(() => lineItemsFor(bill), [bill])
  const summary = useMemo(() => taxSummaryFor(bill), [bill])

  return (
    <div className="mt-8">
      <SectionHeading>Line items</SectionHeading>
      <div className={cn("mt-4", LIST_SHELL)}>
        <div className={cn(ITEM_COLS, TABLE_HEAD_ROW)}>
          <span className={TABLE_COL_HEAD}>Item</span>
          <span className={TABLE_COL_HEAD}>Ledger</span>
          <span className={cn(TABLE_COL_HEAD, "justify-self-end")}>Tax</span>
          <span className={cn(TABLE_COL_HEAD, "justify-self-end")}>Qty</span>
          <span className={cn(TABLE_COL_HEAD, "justify-self-end")}>Unit rate</span>
          <span className={cn(TABLE_COL_HEAD, "justify-self-end")}>Discount</span>
          <span className={cn(TABLE_COL_HEAD, "justify-self-end")}>Amount</span>
        </div>

        {items.map((it, i) => (
          <div key={i} className={cn(ITEM_COLS, TABLE_ROW, "cursor-default", i % 2 === 1 && "bg-[#F6F7FB] dark:bg-white/[0.02]")}>
            <div className="min-w-0 pr-2">
              <div className="truncate text-[13.5px] font-medium text-ink">{it.itemName}</div>
              {it.hsn !== "—" && (
                <span className="mt-1 inline-flex items-center rounded-xs bg-panel-2 px-1.5 py-0.5 text-[10.5px] font-medium text-muted-ink">
                  HSN {it.hsn}
                </span>
              )}
            </div>
            <span className="truncate text-[13px] text-body">{it.ledger}</span>
            <span className="justify-self-end whitespace-nowrap text-right text-[12px] text-body">
              {taxLabelFor(it)}
            </span>
            <span className="justify-self-end text-right text-[13px] tabular-nums text-body">{it.qty}</span>
            <Money value={it.unitRate} decimals className="justify-self-end text-right text-[13px] text-body" />
            <Money value={it.discount} decimals className="justify-self-end text-right text-[13px] text-body" />
            <Money
              value={it.amount}
              decimals
              className="justify-self-end text-right text-[13.5px] font-semibold text-ink"
            />
          </div>
        ))}

        <div className="flex justify-end border-t border-line px-4 py-5">
          <div className="w-[260px]">
            <MiniRow label="Sub total">
              <Money value={summary.subTotal} decimals />
            </MiniRow>
            <MiniRow label="CGST">
              <Money value={summary.cgst} decimals />
            </MiniRow>
            <MiniRow label={summary.interState ? "IGST" : "SGST"}>
              <Money value={summary.interState ? summary.igst : summary.sgst} decimals />
            </MiniRow>
            <Separator className="my-2" />
            <div className="flex items-baseline justify-between py-[5px]">
              <span className="text-[13px] font-medium text-ink">Grand total</span>
              <Money value={summary.grandTotal} decimals className="text-[15px] font-semibold text-ink" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuditTrailSection({
  trail,
  open,
  onToggle,
}: {
  trail: BillAuditEntry[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="my-8">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-5 py-3.5 text-left outline-none transition-colors hover:bg-panel/40 focus-visible:ring-2 focus-visible:ring-brand-vivid/40"
      >
        <span className="text-[13px] font-medium text-ink">Audit trail</span>
        <ChevronDown className={cn("size-4 flex-none text-faint transition-transform duration-150", open && "rotate-180")} strokeWidth={2} />
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <AuditTrail entries={trail} />
        </div>
      )}
    </div>
  )
}

const AUDIT_ICON: Record<BillAuditKind, typeof Check> = {
  uploaded: FileText,
  extracted: Link2,
  corrected: Pencil,
  voucher_assigned: Hash,
  posted: Lock,
  synced: Check,
  sync_failed: AlertTriangle,
}

function toneFor(kind: BillAuditKind): string {
  if (kind === "sync_failed") return "text-danger"
  if (kind === "corrected") return "text-warning"
  if (kind === "synced" || kind === "posted") return "text-success"
  return "text-muted-ink"
}

/** Chronological history of every action on this bill — uploaded, extracted,
 *  corrected, voucher assigned, posted, synced/failed — each with actor and
 *  timestamp. Same list grammar as the cockpit's ActivityDrawer. */
function AuditTrail({ entries }: { entries: BillAuditEntry[] }) {
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const Icon = AUDIT_ICON[e.kind]
        const last = i === entries.length - 1
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-line" />}
            <span
              className={cn(
                "z-10 grid size-[23px] flex-none place-items-center rounded-full border border-line bg-card",
                toneFor(e.kind),
              )}
            >
              <Icon className="size-3" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className={cn("text-[12.5px] font-medium", toneFor(e.kind))}>{e.label}</div>
              {e.detail && <div className="mt-0.5 text-[11.5px] text-body">{e.detail}</div>}
              <div className="mt-0.5 text-[11px] text-faint">
                {e.by} · {relTime(e.at)}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
