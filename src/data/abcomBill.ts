/** Fixture for the line-centric coding cockpit — the ABCom Private Limited
 *  laptop-rental invoice (AB25268643, 06 Jun 2025). Both supplier and
 *  recipient are in Maharashtra (state 27), so the printed CGST + SGST split
 *  is CORRECT — there is no IGST exception on this bill. What actually needs a
 *  human here is the *coding*: which ledger each line books to, the cost
 *  centre it lands in, and a voucher number the document doesn't carry.
 *
 *  Every attribute of a line lives on the line (data/abcomBill.CodingLine) —
 *  the grid never scatters one item's ledger, tax and cost centre into
 *  separate "by-nature" groups. */

export type CellStatus = "auto" | "pending" | "resolved" | "na"

export interface CodingCell {
  value: string
  status: CellStatus
  /** a line's cost can be split across cost centres — each row sums to the
   *  line amount (Tally's Cost Centre Allocation sub-screen) */
  split?: { name: string; amount: number }[]
}

export interface CodingLine {
  id: number
  /** as printed on the invoice */
  description: string
  hsn: string
  /** per-unit rate (₹) */
  rate: number
  qty: number
  /** pre-tax extended value = rate × qty */
  taxable: number
  cgstPct: number
  sgstPct: number
  cgst: number
  sgst: number
  /** line total incl. tax, as printed */
  amount: number
  /** the three coding decisions — each carries its own confidence state */
  ledger: CodingCell
  costCentre: CodingCell
  godown: CodingCell
}

export interface CodingBill {
  supplier: { name: string; place: string; state: string; stateCode: string; gstin: string }
  recipient: { name: string; place: string; state: string; stateCode: string; gstin: string }
  invoiceNo: string
  invoiceDate: string
  period: string
  poNo: string | null
  taxableTotal: number
  cgstTotal: number
  sgstTotal: number
  grandTotal: number
  amountInWords: string
  lines: CodingLine[]
  /** the next free number in the AP voucher series — the doc carries none */
  nextVoucher: string
}

const auto = (value: string): CodingCell => ({ value, status: "auto" })
const pending = (): CodingCell => ({ value: "—", status: "pending" })
const na = (): CodingCell => ({ value: "—", status: "na" })

/** Ledger this vendor's rental lines map to. HSN 997315 = "leasing / rental of
 *  computers". Four lines read cleanly to the rental head; line 3's printed
 *  description is truncated ("… / Display /") so its mapping is ambiguous. */
const RENTAL = "Rental — Computers & IT"

export const LEDGER_OPTIONS: { name: string; note: string; rec?: boolean }[] = [
  { name: RENTAL, note: "HSN 997315 · every ABCom rental bill", rec: true },
  { name: "Equipment Hire Charges", note: "generic hire / lease head" },
  { name: "Office Equipment", note: "capitalise instead of expense" },
  { name: "Repairs & Maintenance — IT", note: "if this were a service call" },
]

export const COST_CENTRE_OPTIONS: { name: string; note: string; rec?: boolean }[] = [
  { name: "IT Infrastructure", note: "where device costs sit · 9 of last 10 bills", rec: true },
  { name: "Administration", note: "shared overhead" },
  { name: "Operations", note: "delivery teams" },
  { name: "Finance", note: "back office" },
]

export const GODOWN_OPTIONS: { name: string; note: string; rec?: boolean }[] = [
  { name: "Head Office — Lower Parel", note: "where the devices are deployed" },
  { name: "Andheri Branch", note: "secondary location" },
  { name: "__split__", note: "Split across locations…" },
]

/* ── voucher & party header ─────────────────────────────────────────────
   Every field a purchase voucher carries, as a VERIFY row rather than a
   form input: extracted value + confidence, editable in place. Most read
   cleanly (auto); the two the document doesn't carry are pending. */

export type HeaderKind = "select" | "text" | "date"
export interface HeaderField {
  key: string
  label: string
  value: string
  /** proposed value when the field is pending (one-click accept) */
  hint?: string
  kind: HeaderKind
  status: CellStatus // auto | pending | resolved
  /** span both columns (long values like the address) */
  full?: boolean
  /** choices for a select field */
  options?: string[]
  /** where on the source document it was read from — for the evidence trace */
  source?: string
  /** derived / display-only figure — not editable (e.g. tax amounts) */
  readOnly?: boolean
  /** render the value in the mono `.code` face (IDs, GSTIN, IRN) */
  mono?: boolean
}

export const GST_REGISTRATIONS = ["Maharashtra — 27ABCDE1234F2Z5", "Karnataka — 29ABCDE1234F1Z5"]
export const VOUCHER_TYPES = ["Purchase", "Purchase (Import)", "Journal", "Payment"]
export const GST_TREATMENTS = ["Regular", "Composition", "Unregistered / URD", "SEZ", "Overseas"]
export const STATE_OPTIONS = [
  "Maharashtra (27)", "Karnataka (29)", "Tamil Nadu (33)", "Gujarat (24)",
  "Delhi (07)", "Punjab (03)", "Telangana (36)", "West Bengal (19)",
]
export const VENDOR_OPTIONS = ["ABCom Private Limited", "ABCom Pvt Ltd (old master)"]

/* ── the sub-screens, modelled as data ──────────────────────────────────
   Each section is a Tally-style sub-screen. The primary board shows only a
   status chip per section; opening a chip reveals its fields (edit-in-place).
   `relevant` implements Tally's conditional disclosure — a section that
   doesn't apply to THIS bill (godown for a service, e-Way under threshold)
   never appears. `optional` sections can be toggled in Configure (the F12
   equivalent). */

export type SectionId = "voucher" | "party" | "gst" | "einvoice" | "godown" | "eway"

export interface VoucherSection {
  id: SectionId
  label: string
  /** one-line description shown in the sub-sheet header */
  blurb: string
  fields: HeaderField[]
  /** does this section apply to THIS bill at all? (conditional relevance) */
  relevant: boolean
  /** why it's not relevant — shown in Configure */
  naReason?: string
  /** user can switch it off in Configure (F12) */
  optional?: boolean
  /** create-on-the-fly affordance (Alt+C) label for the section's master */
  createLabel?: string
}

const IRN = "d8d1234f94bf4d97ca1918f2bf1a4ff1818c0e5176cb77eb9daebe76939d78b8"

export const ABCOM_SECTIONS: VoucherSection[] = [
  {
    id: "voucher", label: "Voucher", blurb: "How this bill is booked", relevant: true,
    fields: [
      { key: "gstReg", label: "GST registration (my branch)", value: "Maharashtra — 27ABCDE1234F2Z5", kind: "select", status: "auto", options: GST_REGISTRATIONS },
      { key: "voucherType", label: "Voucher type", value: "Purchase", kind: "select", status: "auto", options: VOUCHER_TYPES },
      { key: "voucherNo", label: "Voucher no.", value: "", hint: "AP/024/25-26", kind: "text", status: "pending", source: "not on document", mono: true },
      { key: "voucherDate", label: "Voucher date", value: "01 Jul 2026", kind: "date", status: "auto" },
      { key: "billDate", label: "Bill date", value: "06 Jun 2025", kind: "date", status: "auto", source: "invoice date" },
      { key: "dueDate", label: "Due date", value: "", hint: "06 Jul 2025 · net 30", kind: "date", status: "pending", source: "not on document" },
      { key: "supplierInvNo", label: "Supplier invoice no.", value: "AB25268643", kind: "text", status: "auto", source: "invoice no.", mono: true },
    ],
  },
  {
    id: "party", label: "Party", blurb: "Vendor identity & place of supply", relevant: true, createLabel: "New vendor",
    fields: [
      { key: "vendorName", label: "Vendor", value: "ABCom Private Limited", kind: "select", status: "auto", options: VENDOR_OPTIONS, source: "matched on GSTIN" },
      { key: "gstTreatment", label: "GST treatment", value: "Regular", kind: "select", status: "auto", options: GST_TREATMENTS },
      { key: "gstin", label: "GSTIN", value: "27AANCA1620J1ZQ", kind: "text", status: "auto", source: "supplier GSTIN", mono: true },
      { key: "billingAddress", label: "Billing address", value: "Shiv Shakti Industrial Premises, Lower Parel East, Mumbai — 400011, Maharashtra", kind: "text", status: "auto", full: true },
      { key: "sourceOfSupply", label: "Source of supply", value: "Maharashtra (27)", kind: "select", status: "auto", options: STATE_OPTIONS, source: "supplier state" },
      { key: "destOfSupply", label: "Destination of supply", value: "Maharashtra (27)", kind: "select", status: "auto", options: STATE_OPTIONS, source: "place of supply" },
    ],
  },
  {
    id: "gst", label: "GST", blurb: "Tax summary as printed", relevant: true,
    fields: [
      { key: "taxable", label: "Taxable value", value: "₹6,666", kind: "text", status: "auto", readOnly: true, mono: true, source: "invoice" },
      { key: "cgstAmt", label: "CGST @ 9%", value: "₹599.94", kind: "text", status: "auto", readOnly: true, mono: true },
      { key: "sgstAmt", label: "SGST @ 9%", value: "₹599.94", kind: "text", status: "auto", readOnly: true, mono: true },
      { key: "totalAmt", label: "Invoice total", value: "₹7,866", kind: "text", status: "auto", readOnly: true, mono: true },
      { key: "supplyType", label: "Supply type (derived)", value: "Intra-state — CGST + SGST", kind: "text", status: "auto", readOnly: true, full: true },
    ],
  },
  {
    id: "einvoice", label: "e-Invoice", blurb: "IRN registered with the IRP", relevant: true,
    fields: [
      { key: "irn", label: "IRN", value: IRN, kind: "text", status: "auto", readOnly: true, mono: true, full: true, source: "on document" },
      { key: "ackNo", label: "Ack no.", value: "122527045739098", kind: "text", status: "auto", readOnly: true, mono: true },
      { key: "ackDate", label: "Ack date", value: "06 Jun 2025", kind: "date", status: "auto", readOnly: true },
    ],
  },
  // ── conditionally NOT relevant to this bill (Tally's conditional disclosure) ──
  {
    id: "godown", label: "Godown", blurb: "Stock location allocation", relevant: false, optional: true,
    naReason: "All 5 lines are rental services (SAC 997315) — no goods, so no godown.",
    fields: [],
  },
  {
    id: "eway", label: "e-Way Bill", blurb: "Transport & e-Way details", relevant: false, optional: true,
    naReason: "Invoice value ₹7,866 is under the ₹50,000 e-Way Bill threshold.",
    fields: [],
  },
]

export const ABCOM_BILL: CodingBill = {
  supplier: {
    name: "ABCom Private Limited",
    place: "Lower Parel East, Mumbai — 400011",
    state: "Maharashtra",
    stateCode: "27",
    gstin: "27AANCA1620J1ZQ",
  },
  recipient: {
    name: "Arcot Media Pvt. Ltd",
    place: "Kamala Mills, Lower Parel West, Mumbai — 400013",
    state: "Maharashtra",
    stateCode: "27",
    gstin: "27AARCA9635M1ZT",
  },
  invoiceNo: "AB25268643",
  invoiceDate: "06 Jun 2025",
  period: "02 May – 31 May 2025",
  poNo: null,
  taxableTotal: 6666,
  cgstTotal: 599.94,
  sgstTotal: 599.94,
  grandTotal: 7866,
  amountInWords: "Seven Thousand Eight Hundred Sixty-six",
  nextVoucher: "AP/024/25-26",
  lines: [
    {
      id: 1, description: "i3 / 8 GB / 256 GB SSD / Win 11 Pro", hsn: "997315",
      rate: 1258, qty: 1, taxable: 1258, cgstPct: 9, sgstPct: 9, cgst: 113.22, sgst: 113.22, amount: 1484,
      ledger: auto(RENTAL), costCentre: pending(), godown: na(),
    },
    {
      id: 2, description: "i3 / 8 GB / 256 GB SSD / Win 11 Pro", hsn: "997315",
      rate: 377, qty: 1, taxable: 377, cgstPct: 9, sgstPct: 9, cgst: 33.93, sgst: 33.93, amount: 445,
      ledger: auto(RENTAL), costCentre: pending(), godown: na(),
    },
    {
      id: 3, description: "Processor / RAM / Hard Drive / OS / Display /", hsn: "997315",
      rate: 545, qty: 1, taxable: 545, cgstPct: 9, sgstPct: 9, cgst: 49.05, sgst: 49.05, amount: 643,
      // truncated description on the document → ledger mapping is ambiguous
      ledger: pending(), costCentre: pending(), godown: na(),
    },
    {
      id: 4, description: "i3 / 8 GB / 256 GB SSD / Win 11 Pro", hsn: "997315",
      rate: 1090, qty: 1, taxable: 1090, cgstPct: 9, sgstPct: 9, cgst: 98.10, sgst: 98.10, amount: 1286,
      ledger: auto(RENTAL), costCentre: pending(), godown: na(),
    },
    {
      id: 5, description: "i3 / 8 GB / 256 GB SSD / Win 11 Pro", hsn: "997315",
      rate: 1132, qty: 3, taxable: 3396, cgstPct: 9, sgstPct: 9, cgst: 305.64, sgst: 305.64, amount: 4007,
      ledger: auto(RENTAL), costCentre: pending(), godown: na(),
    },
  ],
}
