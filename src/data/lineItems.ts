/** Line items + GST breakup for the Bill Details table. Most static fixture
 *  bills carry their own `lineItems`; rows without one (bulk-ingested files,
 *  review items with no counterpart in BILLS) get a single synthesized line
 *  so the table never has nothing to render. */

import { type BillLineItem, type BillRow } from "./invoice"

export function lineItemsFor(bill: BillRow): BillLineItem[] {
  if (bill.lineItems) return bill.lineItems
  // reverse-engineer a plausible pre-tax line from the bill's grand total,
  // assuming a flat 18% intra-state rate
  const subTotal = Math.round(bill.amount / 1.18)
  return [
    {
      itemName: bill.description ?? "Services rendered",
      hsn: "—",
      ledger: "Suspense — unclassified",
      taxRate: 18,
      gstTreatment: "intra",
      qty: 1,
      unitRate: subTotal,
      discount: 0,
      amount: subTotal,
    },
  ]
}

export interface TaxSummary {
  subTotal: number
  cgst: number
  sgst: number
  igst: number
  /** any line taxed inter-state — the breakup shows IGST instead of SGST */
  interState: boolean
  grandTotal: number
}

export function taxSummaryFor(bill: BillRow): TaxSummary {
  const items = lineItemsFor(bill)
  const subTotal = items.reduce((s, i) => s + i.amount, 0)
  const taxTotal = Math.max(0, bill.amount - subTotal)
  const interState = items.some((i) => i.gstTreatment === "inter")
  const cgst = interState ? 0 : Math.round(taxTotal / 2)
  const sgst = interState ? 0 : taxTotal - cgst
  const igst = interState ? taxTotal : 0
  return { subTotal, cgst, sgst, igst, interState, grandTotal: bill.amount }
}

export function taxLabelFor(item: BillLineItem): string {
  if (item.taxRate === 0) return "Exempt"
  return item.gstTreatment === "inter" ? `${item.taxRate}% IGST` : `${item.taxRate}% CGST+SGST`
}
