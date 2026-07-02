/** Bill-first review queue. The bill is the atomic unit; a bill carries all
 *  of its own issues. `batchable` (single deterministic fix) drives whether a
 *  bill is a one-tap fix or needs thought. */

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
const FIX_VOUCHER = "Set voucher to AP/004/25-26"
const gst = (auto = true): ReviewIssue => ({ type: "gst", autoCorrectable: auto, proposedFix: auto ? FIX_IGST : undefined })
const ledgerAmb: ReviewIssue = { type: "ledger", autoCorrectable: false, detail: "2 possible accounts" }
const voucherFix: ReviewIssue = { type: "voucher", autoCorrectable: true, proposedFix: FIX_VOUCHER }

export const REVIEW_ITEMS: ReviewItem[] = [
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

/** the largest set of one-click bills sharing the identical fix (≥2), for
 *  the optional "fix all" convenience. */
export function largestIdenticalFix(items: ReviewItem[]): { fix: string; ids: string[] } | null {
  const groups = new Map<string, string[]>()
  for (const it of items) {
    if (!isBatchable(it)) continue
    const fix = it.issues[0].proposedFix!
    groups.set(fix, [...(groups.get(fix) ?? []), it.billId])
  }
  let best: { fix: string; ids: string[] } | null = null
  for (const [fix, ids] of groups) {
    if (ids.length >= 2 && (!best || ids.length > best.ids.length)) best = { fix, ids }
  }
  return best
}
