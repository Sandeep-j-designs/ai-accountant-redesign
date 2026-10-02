/** Per-bill audit trail for the read-only Bill Details page (All bills). The
 *  fixture rows don't carry their own history, so this derives a plausible
 *  one from the fields already on the row; session actions (edits, sync
 *  retries) log their own entries via the reducer and get merged in by the
 *  caller. Distinct from the cockpit's own `ActivityEntry`/`ActivityKind`
 *  (state/store.tsx), which is scoped to the single Sundar walkthrough. */

import { CURRENT_USER, type BillRow } from "./invoice"

export type BillAuditKind =
  | "uploaded"
  | "extracted"
  | "corrected"
  | "voucher_assigned"
  | "posted"
  | "synced"
  | "sync_failed"

export interface BillAuditEntry {
  id: string
  at: number
  kind: BillAuditKind
  label: string
  by: string
  detail?: string
}

const AI = "FinOps AI"

/** Synthesized history for a bill already sitting in All bills — oldest
 *  first, spaced so `relTime` reads sensibly. Session edits/retries append
 *  after this (see state.billAuditExtra) and are merged + re-sorted by the
 *  caller. */
export function baseAuditTrail(bill: BillRow): Omit<BillAuditEntry, "at">[] {
  const entries: Omit<BillAuditEntry, "at">[] = []

  entries.push({
    id: `${bill.id}-uploaded`,
    kind: "uploaded",
    by: CURRENT_USER.name,
    label: "Bill uploaded",
    detail: bill.billFile ?? "Entered manually — no source file",
  })
  entries.push({
    id: `${bill.id}-extracted`,
    kind: "extracted",
    by: AI,
    label: "Fields extracted",
    detail: `${bill.vendor} · ${bill.number} · ₹${bill.amount.toLocaleString("en-IN")}`,
  })
  if (bill.voucherNo) {
    entries.push({
      id: `${bill.id}-voucher`,
      kind: "voucher_assigned",
      by: CURRENT_USER.name,
      label: "Voucher assigned",
      detail: bill.voucherNo,
    })
    entries.push({
      id: `${bill.id}-posted`,
      kind: "posted",
      by: CURRENT_USER.name,
      label: "Posted to books",
      detail: bill.voucherDate ? `Voucher dated ${bill.voucherDate}` : undefined,
    })
  }
  if (bill.tallySync === "synced") {
    entries.push({
      id: `${bill.id}-synced`,
      kind: "synced",
      by: CURRENT_USER.name,
      label: "Synced to Tally",
      detail: bill.syncedOn ? `On ${bill.syncedOn}` : undefined,
    })
  } else if (bill.tallySync === "failed") {
    entries.push({
      id: `${bill.id}-syncfailed`,
      kind: "sync_failed",
      by: "Tally sync",
      label: "Sync failed",
      detail: bill.syncNote,
    })
  }
  return entries
}

/** stamps the synthesized trail into the past, oldest → newest, ending a
 *  bit before "now" so any session-logged entries read as the most recent */
export function stampedAuditTrail(bill: BillRow): BillAuditEntry[] {
  const raw = baseAuditTrail(bill)
  const now = Date.now()
  const GAP = 30 * 60 * 60 * 1000 // ~1.25 days apart — distinct "d ago" reads
  const n = raw.length
  return raw.map((r, i) => ({ ...r, at: now - (n - i) * GAP }))
}
