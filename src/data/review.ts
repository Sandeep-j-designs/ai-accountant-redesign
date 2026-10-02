/** Bill-first review queue. The bill is the atomic unit; a bill carries all
 *  of its own issues. `batchable` (single deterministic fix) drives whether a
 *  bill is a one-tap fix or needs thought. */

import { BILLS, NEXT_VOUCHER, type BillRow } from "@/data/invoice"
import { approvedBooksRows, classifyIntake, type IntakeBill } from "@/data/patterns"

export type IssueType = "gst" | "ledger" | "voucher"

export interface ReviewIssue {
  type: IssueType
  /** deterministic AI fix available? */
  autoCorrectable: boolean
  /** the imperative one-line fix, for one-click bills */
  proposedFix?: string
  /** extra plain-English detail for an ambiguous issue */
  detail?: string
}

export interface ReviewItem {
  billId: string
  vendor: string
  invoiceNo: string
  amount: number
  issues: ReviewIssue[]
}

/** exactly one, deterministically-fixable issue → a one-tap fix */
export function isBatchable(item: ReviewItem): boolean {
  return item.issues.length === 1 && item.issues[0].autoCorrectable
}
export function needsThought(item: ReviewItem): boolean {
  return !isBatchable(item)
}

/** plain-English word per issue, for the "N things to decide · …" list */
export const ISSUE_WORD: Record<IssueType, string> = {
  gst: "GST head",
  ledger: "ledger",
  voucher: "voucher",
}

const FIX_IGST = "Change GST to IGST"
const FIX_LEDGER = "Set ledger to Carriage Inward"
const FIX_VOUCHER = `Set voucher to ${NEXT_VOUCHER}`
const gst = (auto = true): ReviewIssue => ({ type: "gst", autoCorrectable: auto, proposedFix: auto ? FIX_IGST : undefined })
const ledgerAmb: ReviewIssue = { type: "ledger", autoCorrectable: false, detail: "2 possible accounts" }
const voucherFix: ReviewIssue = { type: "voucher", autoCorrectable: true, proposedFix: FIX_VOUCHER }

/** the review item the cockpit walkthrough decides — posting the Sundar bill
 *  moves this id out of the queue and into All bills (pending sync) */
export const COCKPIT_REVIEW_ID = "r-sundar"
/** the ABCom rental bill — rendered with the line-centric coding cockpit */
export const ABCOM_REVIEW_ID = "r-abcom"

export const REVIEW_ITEMS: ReviewItem[] = [
  // ── line-centric coding bill (ABCom rental invoice) ──
  {
    billId: "r-abcom", vendor: "ABCom Private Limited", invoiceNo: "AB25268643", amount: 7866,
    issues: [
      { type: "ledger", autoCorrectable: false, detail: "line 3 · truncated description" },
      { type: "voucher", autoCorrectable: true, proposedFix: "Set voucher to AP/024/25-26" },
    ],
  },
  // ── needs thought (multi-issue, or a single ambiguous one) ──
  { billId: "r-sundar", vendor: "Sundar Logistics Pvt Ltd", invoiceNo: "SLPL/2526/0489", amount: 184080, issues: [gst(), ledgerAmb, voucherFix] },
  { billId: "r-kethan", vendor: "Kethan & Associates", invoiceNo: "KA/INV/0042", amount: 50000, issues: [ledgerAmb] },
  { billId: "r-bluedart", vendor: "Blue Dart Express", invoiceNo: "BD-5521", amount: 22600, issues: [ledgerAmb, voucherFix] },
  // ── one-click fixes (single deterministic fix) ──
  { billId: "r-aws", vendor: "AWS India Pvt Ltd", invoiceNo: "IN-INV-9920", amount: 112400, issues: [gst()] },
  { billId: "r-reliable", vendor: "Reliable Packaging Co", invoiceNo: "RPC-2026-118", amount: 47200, issues: [gst()] },
  { billId: "r-tata", vendor: "Tata Power Company", invoiceNo: "700456128", amount: 38940, issues: [{ type: "ledger", autoCorrectable: true, proposedFix: FIX_LEDGER }] },
  { billId: "r-crystal", vendor: "Crystal Clean Services", invoiceNo: "CCS-0298", amount: 15000, issues: [gst()] },
  { billId: "r-office", vendor: "Office Mart Supplies", invoiceNo: "OMS/1187", amount: 9310, issues: [gst()] },
]

/* ── bulk ingestion ─────────────────────────────────────────────
   A multi-file drop reads every document in parallel. CLEAN reads
   (all fields high-confidence) skip review entirely and land in All
   bills as pending sync; EXCEPTION reads join the Needs-review
   queue, where batchable ones fold into the grouped decisions. The
   queue's length scales with exceptions, not uploads. */

export interface BulkFile {
  id: string
  file: string
  vendor: string
  invoiceNo: string
  amount: number
  /** simulated read duration */
  ms: number
  outcome: "clean" | "review" | "unreadable"
  issues?: ReviewIssue[]
  /** what a RETRY read resolves to — an unreadable file re-read after a
   *  clearer scan comes through clean with these values */
  retry?: { vendor: string; invoiceNo: string; amount: number }
}

export const BULK_FILES: BulkFile[] = [
  { id: "u1", file: "meridian-transport-0712.pdf", vendor: "Meridian Transport Co", invoiceNo: "MT/2526/0712", amount: 66300, ms: 1300, outcome: "clean" },
  { id: "u2", file: "vertex-stationery-may.pdf", vendor: "Vertex Stationery", invoiceNo: "VS-1189", amount: 8210, ms: 1800, outcome: "clean" },
  { id: "u3", file: "IN-INV-10441-airtel.pdf", vendor: "Airtel Business", invoiceNo: "IN-INV-10441", amount: 24780, ms: 2200, outcome: "clean" },
  { id: "u4", file: "shakti-packers-0455.pdf", vendor: "Shakti Packers", invoiceNo: "SP/0455", amount: 39400, ms: 2600, outcome: "review", issues: [gst()] },
  { id: "u5", file: "gourmet-canteen-jun.pdf", vendor: "Gourmet Canteen Services", invoiceNo: "GCS/2026/288", amount: 18450, ms: 2950, outcome: "clean" },
  { id: "u6", file: "krishna-hardware-118.pdf", vendor: "Krishna Hardware", invoiceNo: "KH-118", amount: 12060, ms: 3300, outcome: "review", issues: [ledgerAmb] },
  { id: "u7", file: "scan-004-blurry.jpg", vendor: "—", invoiceNo: "—", amount: 0, ms: 3550, outcome: "unreadable", retry: { vendor: "Lakshmi Print Works", invoiceNo: "LPW/2026/0071", amount: 9840 } },
  { id: "u8", file: "prime-couriers-8802.pdf", vendor: "Prime Couriers", invoiceNo: "PC-8802", amount: 5320, ms: 3800, outcome: "clean" },
]

/** exception reads from the ingested set, as live review items */
export function bulkReviewItems(ingestedIds: string[]): ReviewItem[] {
  const ing = new Set(ingestedIds)
  return BULK_FILES.filter((b) => ing.has(b.id) && b.outcome === "review").map((b) => ({
    billId: `bulk-${b.id}`,
    vendor: b.vendor,
    invoiceNo: b.invoiceNo,
    amount: b.amount,
    issues: b.issues!,
  }))
}

/* ── the books, derived ─────────────────────────────────────────
   Confirming a review item records it to the books — it LEAVES the
   Needs-review queue and surfaces in All bills as a PENDING-sync row.
   Nothing goes to Tally directly; the sync run pushes pending rows.
   One builder feeds the Bills table AND the sync modal, so their
   counts can never disagree. */

/** review items still awaiting review — fixtures + ingested exceptions,
 *  minus anything already posted to the books */
export function openReviewItems(postedIds: string[], ingestedIds: string[] = []): ReviewItem[] {
  const posted = new Set(postedIds)
  return [...REVIEW_ITEMS, ...bulkReviewItems(ingestedIds)].filter((r) => !posted.has(r.billId))
}

/** the All-bills rows: base fixtures + confirmed review items + clean bulk
 *  reads. A confirmed item that matches an existing books row (same invoice
 *  no) UPDATES that row to pending-sync; new bills (the cockpit's Sundar,
 *  bulk uploads) land as fresh posted rows continuing the voucher series. */
/** applies session field edits (from the Bill Details "Edit" action) on top
 *  of a derived row — so a correction shows up consistently in both the
 *  All-bills list and the detail page itself */
export function applyEdits(row: BillRow, edits?: Record<string, string>): BillRow {
  if (!edits) return row
  const next: BillRow = { ...row }
  if (edits.vendor !== undefined) next.vendor = edits.vendor
  if (edits.number !== undefined) next.number = edits.number
  if (edits.date !== undefined) next.date = edits.date
  if (edits.due !== undefined) next.due = edits.due
  if (edits.voucherNo !== undefined) next.voucherNo = edits.voucherNo
  if (edits.voucherDate !== undefined) next.voucherDate = edits.voucherDate
  if (edits.amount !== undefined) {
    const n = Number(edits.amount.replace(/[^\d.-]/g, ""))
    if (!Number.isNaN(n)) next.amount = n
  }
  if (edits.billingAddress !== undefined) next.billingAddress = edits.billingAddress
  if (edits.gstin !== undefined) next.gstin = edits.gstin
  if (edits.description !== undefined) next.description = edits.description
  if (edits.reverseCharge !== undefined) next.reverseCharge = /^y/i.test(edits.reverseCharge)
  return next
}

export function booksRows(
  postedIds: string[],
  voucher: string | null,
  ingestedIds: string[] = [],
  syncedIds: string[] = [],
  deletedIds: string[] = [],
  /** Bills settled from the upload queue (data/patterns.ts): `bills` are the
   *  ids a human approved, `autoPatterns` are graduated vendor patterns that
   *  post with no keystroke (parked). `open` is the intake those ids index
   *  into. Composed in HERE rather than at the call site, so the sync modal,
   *  the bill detail page and the All-bills table cannot disagree about what
   *  is pending. */
  settled: { bills: string[]; autoPatterns: string[]; open: IntakeBill[] } = {
    bills: [],
    autoPatterns: [],
    open: [],
  },
): BillRow[] {
  const synced = new Set(syncedIds)
  // a pending/failed row the user has pushed to Tally this session reads as
  // synced (failed rows only reach syncedIds via an explicit retry)
  const withSync = (r: BillRow): BillRow =>
    (r.tallySync === "pending" || r.tallySync === "failed") && synced.has(r.id)
      ? { ...r, tallySync: "synced", syncNote: undefined }
      : r
  const byInvoice = new Map(BILLS.map((b) => [b.number, b]))
  const allItems = [...REVIEW_ITEMS, ...bulkReviewItems(ingestedIds)]
  const postedRows: BillRow[] = []
  let seq = 8 // fresh voucher numbers continue past NEXT_VOUCHER (AP/007)
  const nextVoucher = () => `AP/${String(seq++).padStart(3, "0")}/25-26`
  for (const id of postedIds) {
    const item = allItems.find((r) => r.billId === id)
    if (!item) continue
    const match = byInvoice.get(item.invoiceNo)
    if (match && match.status !== "review") {
      // same bill, already in the books — review confirmation re-queues it for sync
      postedRows.push({ ...match, tallySync: "pending", fresh: true })
    } else {
      postedRows.push({
        id: `posted-${id}`,
        vendor: item.vendor,
        number: item.invoiceNo,
        date: match?.date ?? "3 Jun 2026",
        due: match?.due ?? "18 Jul 2026",
        amount: item.amount,
        status: "posted",
        fresh: true,
        voucherNo: match?.status === "review" ? (voucher ?? NEXT_VOUCHER) : nextVoucher(),
        voucherDate: "1 Jul 2026",
        billFile: match?.billFile,
        tallySync: "pending",
        // carry over the Bill Details fixture data (line items, GSTIN, etc.)
        // when this review item has a BILLS counterpart — e.g. the Sundar
        // walkthrough's own fixture, once posted
        billingAddress: match?.billingAddress,
        gstin: match?.gstin,
        description: match?.description,
        reverseCharge: match?.reverseCharge,
        lineItems: match?.lineItems,
      })
    }
  }
  // clean bulk reads — no review needed; straight into the books, pending
  // sync. An unreadable file only reaches ingestedIds once its RETRY read
  // came through clean, so it lands with its retry values.
  for (const id of ingestedIds) {
    const b = BULK_FILES.find((f) => f.id === id)
    if (!b || b.outcome === "review") continue
    const src = b.outcome === "clean" ? b : b.retry
    if (!src) continue
    postedRows.push({
      id: `ing-${b.id}`,
      vendor: src.vendor,
      number: src.invoiceNo,
      date: "1 Jul 2026",
      due: "26 Jul 2026",
      amount: src.amount,
      status: "posted",
      fresh: true,
      voucherNo: nextVoucher(),
      voucherDate: "1 Jul 2026",
      billFile: b.file,
      tallySync: "pending",
    })
  }
  const replaced = new Set(postedRows.map((r) => r.number))
  const deleted = new Set(deletedIds)
  const rows = [
    ...postedRows,
    ...BILLS.filter((b) => b.status !== "review" && !replaced.has(b.number)),
  ]
  // settled bills continue the voucher series past everything above
  const approved =
    settled.bills.length || settledGroups2Auto(settled)
      ? approvedBooksRows(
          new Set(settled.bills),
          rows,
          classifyIntake(settled.open),
          new Set(settled.autoPatterns),
        )
      : []
  return [...approved, ...rows].map(withSync).filter((r) => !deleted.has(r.id))
}

/** the reasoning behind each issue type's suggested fix — shown in the
 *  decision screen's "Why" disclosure */
export const GROUP_WHY: Record<IssueType, string> = {
  gst: "Each is printed as CGST + SGST, but supplier and place of supply are in different states — inter-state supplies charge IGST (Sec 7(1), IGST Act).",
  ledger: "The HSN on each line maps to a single ledger — these vendors' charges always book to Carriage Inward.",
  voucher: "No voucher number on the document — the next numbers in the AP series are free.",
}

const settledGroups2Auto = (s: { autoPatterns: string[] }) => s.autoPatterns.length > 0
