/** The canonical fixture: Sundar Logistics — the inter-state IGST trap. */

export const TAXABLE = 156000
export const TAX_AMOUNT = 28080 // 18% of taxable; same total whether IGST or split
export const TAX_HALF = 14040 // CGST / SGST leg as printed
export const GRAND_TOTAL = TAXABLE + TAX_AMOUNT // 1,84,080 — unchanged either way

/** Place-of-supply codes — the two digits that decide IGST vs CGST+SGST. */
export const STATES = {
  supplier: { name: "Karnataka", code: "29" },
  recipient: { name: "Maharashtra", code: "27" },
} as const

export const INVOICE = {
  tag: "Tax Invoice",
  supplier: {
    name: "Sundar Logistics Pvt Ltd",
    address: ["#14 Hosur Road, Bengaluru 560068", "Karnataka"],
    gstin: "29ABCDE1234F1Z5",
    state: "Karnataka (29)",
  },
  recipient: {
    name: "Acme Industries Pvt Ltd",
    address: ["Maharashtra"],
    gstin: "27ABCDE1234F1Z5",
    state: "Maharashtra (27)",
  },
  number: "SLPL/2526/0489",
  invoiceDate: "06 Jun 2026",
  dueDate: "06 Jul 2026",
  placeOfSupply: "Karnataka (29)",
  lines: [
    { key: "line1", desc: "Freight — inbound raw material", hsn: "996511", amount: 120000 },
    { key: "line2", desc: "Loading & handling charges", hsn: "996799", amount: 36000 },
  ],
  printedTax: [
    { label: "CGST @ 9%", amount: 14040 },
    { label: "SGST @ 9%", amount: 14040 },
  ],
} as const

export const NEXT_VOUCHER = "AP/004/25-26"
export const LAST_VOUCHER = "AP/003/25-26"

export const LEDGERS = [
  "Carriage Inward",
  "Loading & Unloading Exp.",
  "Purchase — Raw Material",
  "Freight & Forwarding",
  "Clearing & Forwarding Charges",
]

/** The signed-in user — the actor stamped on every decision. */
export const CURRENT_USER = { name: "Sandeep Balaji", role: "Accounts · Admin" }

/** Reviewers a decision can be flagged/assigned to — teammates + a shared queue. */
export const REVIEWERS: { id: string; name: string; role: string }[] = [
  { id: "sandeep", name: "Sandeep Balaji", role: "Accounts · Admin" },
  { id: "arjun", name: "Arjun Mehta", role: "Senior Accountant" },
  { id: "queue", name: "GST review queue", role: "Shared · whoever's free" },
]

/** Vendor master — for re-opening the supplier match. */
export const VENDORS = [
  { name: "Sundar Logistics Pvt Ltd", gstin: "29ABCDE1234F1Z5", note: "matched on GSTIN" },
  { name: "Sundar Logistics (Chennai)", gstin: "33ABCDE1234F2Z3", note: "different GSTIN" },
  { name: "Sundaram Freight Carriers", gstin: "29ZZSDE9911A1Z0", note: "similar name" },
]

/* ── the verification facts ───────────────────────────────────
   Every fact is the same kind of object: it is either settled
   (collapsed, cheap to verify) or live (an editable decision in
   the queue). The three the machine couldn't fully decide start
   live; the rest start settled but are one click from re-opening.
   ───────────────────────────────────────────────────────────── */
export type FactKey = "supplier" | "freight" | "tax" | "loading" | "voucher" | "totals"

export type DocRegion =
  | "supplier"
  | "buyer"
  | "states"
  | "dates"
  | "line1"
  | "line2"
  | "tax"
  | "voucher"

/** which facts begin as exceptions (live) vs auto-settled */
export const FACT_EXCEPTIONS: FactKey[] = ["tax", "loading", "voucher"]

/** focus order for unresolved facts — consequence first */
export const FACT_PRIORITY: FactKey[] = [
  "tax",
  "loading",
  "voucher",
  "supplier",
  "freight",
  "totals",
]

/** display order in the settled stack — document/logical order */
export const SETTLED_ORDER: FactKey[] = [
  "supplier",
  "freight",
  "tax",
  "loading",
  "voucher",
  "totals",
]

/** clicking a region on the document opens/challenges this decision */
export const REGION_FACT: Partial<Record<DocRegion, FactKey>> = {
  supplier: "supplier",
  buyer: "supplier",
  states: "tax",
  tax: "tax",
  line1: "freight",
  line2: "loading",
  voucher: "voucher",
}

/** AI confidence per extracted field — a calm dot + the reason behind it.
 *  high = green (matched/clean); medium = amber (a genuine ambiguity). */
export type ConfLevel = "high" | "medium"
export const FIELD_CONFIDENCE: Record<string, { level: ConfLevel; basis: string }> = {
  supplierGstin: { level: "high", basis: "GSTIN matched exactly to a vendor in your master." },
  states: { level: "high", basis: "Both state codes read cleanly from the two GSTINs." },
  tax: { level: "medium", basis: "Printed as CGST + SGST, but the place-of-supply codes imply IGST." },
  invoiceNumber: { level: "high", basis: "Invoice number read cleanly from the document header." },
  freight: { level: "high", basis: "HSN 996511 maps to a single ledger for this vendor." },
  loading: { level: "medium", basis: "HSN 996799 maps to two ledgers in your chart of accounts." },
  total: { level: "high", basis: "Line items reconcile to the printed document total." },
}

export interface FactMeta {
  label: string
  region: DocRegion
  /** the hero gets the most room; everything else is restrained */
  weight: "hero" | "minor"
}

export const FACTS: Record<FactKey, FactMeta> = {
  supplier: { label: "Supplier", region: "supplier", weight: "minor" },
  freight: { label: "Freight ledger", region: "line1", weight: "minor" },
  tax: { label: "GST treatment", region: "states", weight: "hero" },
  loading: { label: "Loading & handling ledger", region: "line2", weight: "minor" },
  voucher: { label: "Voucher number", region: "voucher", weight: "minor" },
  totals: { label: "Totals", region: "tax", weight: "minor" },
}

/** ledger-pick editors (freight + loading share one component) */
export interface LedgerConfig {
  line: string
  amount: number
  hsn: string
  why: string
  options: { name: string; note: string; rec?: boolean }[]
}

export const LEDGER_FACTS: Record<"freight" | "loading", LedgerConfig> = {
  freight: {
    line: "Freight — inbound raw material",
    amount: 120000,
    hsn: "996511",
    why: "HSN 996511 maps to Carriage Inward; this vendor's freight always books here.",
    options: [
      { name: "Carriage Inward", note: "every freight bill from this vendor", rec: true },
      { name: "Freight & Forwarding", note: "alternative freight head" },
    ],
  },
  loading: {
    line: "Loading & handling charges",
    amount: 36000,
    hsn: "996799",
    why: "HSN 996799 maps to two ledgers in your chart of accounts.",
    options: [
      { name: "Carriage Inward", note: "this vendor ×2 of last 3 bills", rec: true },
      { name: "Loading & Unloading Exp.", note: "used once · Apr 2026" },
    ],
  },
}

/** Accounts-payable inbox shown on the Bills list page. */
export type BillStatus =
  | "review"
  | "reading"
  | "approved"
  | "scheduled"
  | "posted"
  | "paid"
  | "overdue"

export interface BillRow {
  id: string
  vendor: string
  number: string
  date: string
  due: string
  amount: number
  status: BillStatus
  open?: number
  flag?: string
  posted?: string
  demo?: boolean
  /** touched in the last 24h — gets a freshness marker that fades after view */
  fresh?: boolean
  /** accounting voucher reference once the bill is in the books */
  voucherNo?: string
  /** date the voucher was recorded (distinct from the supplier's billing date) */
  voucherDate?: string
  /** attached source document filename, if the upload carried one */
  billFile?: string
}

export const BILLS: BillRow[] = [
  {
    id: "b1",
    vendor: "Sundar Logistics Pvt Ltd",
    number: "SLPL/2526/0489",
    date: "6 Jun 2026",
    due: "6 Jul 2026",
    amount: 184080,
    status: "review",
    open: 3,
    flag: "Inter-state supply charged as CGST + SGST",
    demo: true,
  },
  { id: "b2", vendor: "AWS India Pvt Ltd", number: "IN-INV-9920", date: "31 May 2026", due: "30 Jun 2026", amount: 112400, status: "approved", fresh: true, voucherNo: "AP/004/25-26", voucherDate: "26 May 2026", billFile: "aws-invoice-may.pdf" },
  { id: "b3", vendor: "Reliable Packaging Co", number: "RPC-2026-118", date: "2 Jun 2026", due: "17 Jun 2026", amount: 47200, status: "scheduled", fresh: true, voucherNo: "AP/005/25-26", voucherDate: "26 May 2026" },
  { id: "b4", vendor: "Tata Power Company", number: "700456128", date: "1 Jun 2026", due: "15 Jun 2026", amount: 38940, status: "posted", posted: "AP/003/25-26", voucherNo: "AP/003/25-26", voucherDate: "1 Jun 2026", billFile: "tata-power-jun26.pdf" },
  { id: "b5", vendor: "Kethan & Associates", number: "KA/INV/0042", date: "20 May 2026", due: "19 Jun 2026", amount: 50000, status: "overdue", voucherNo: "AP/006/25-26", voucherDate: "26 May 2026" },
  { id: "b6", vendor: "Office Mart Supplies", number: "OMS/1187", date: "29 May 2026", due: "28 Jun 2026", amount: 9310, status: "paid", posted: "AP/002/25-26", voucherNo: "AP/002/25-26", voucherDate: "29 May 2026", billFile: "office-mart-1187.pdf" },
  { id: "b7", vendor: "Crystal Clean Services", number: "CCS-0298", date: "25 May 2026", due: "9 Jun 2026", amount: 15000, status: "paid", posted: "AP/001/25-26", voucherNo: "AP/001/25-26", voucherDate: "25 May 2026" },
]

/** Fields lifted off the document during the Read pass — terse, factual. */
export const READ_CHIPS: { mk: "ok" | "q"; html: string }[] = [
  { mk: "ok", html: '<span class="text-faint">Supplier</span> <b class="font-semibold text-ink">Sundar Logistics Pvt Ltd</b> <span class="text-faint">— matched, vendor master</span>' },
  { mk: "ok", html: '<span class="text-faint">Invoice</span> <b class="font-semibold text-ink font-mono">SLPL/2526/0489</b> <span class="text-faint">· 6 Jun 2026</span>' },
  { mk: "ok", html: '<span class="text-faint">Line items reconcile</span> <b class="font-semibold text-ink font-mono">₹1,56,000</b> <span class="text-faint">taxable</span>' },
  { mk: "ok", html: '<span class="text-faint">Freight ₹1,20,000 →</span> <b class="font-semibold text-ink">Carriage Inward</b> <span class="text-faint">· HSN 996511</span>' },
  { mk: "q", html: '<span class="text-faint">Tax head —</span> <b class="font-semibold text-ink">CGST+SGST printed, GSTINs 29 ≠ 27</b>' },
  { mk: "q", html: '<span class="text-faint">Loading ₹36,000 —</span> <b class="font-semibold text-ink">HSN 996799 fits two ledgers</b>' },
  { mk: "q", html: '<span class="text-faint">Voucher number —</span> <b class="font-semibold text-ink">none on document</b>' },
]

export const READ_STEPS: [string, string][] = [
  ["Reading document", "Sundar-Logistics-invoice.pdf · 1 page"],
  ["Locating fields", "Supplier, line items, tax, totals."],
  ["Matching to books", "Vendor master, chart of accounts, AP register."],
  ["Checking maths & GST", "Totals reconciled · place-of-supply rule applied."],
]
