/** THE unified voucher field registry.
 *
 *  One definition per field, carrying BOTH homes:
 *   • its Configure home — `group` (+ `feature` flag) drives the Configure tree
 *   • its display home — `placement` decides where it renders when enabled:
 *        { at:"header", chip, sub }  → a chip's sub-sheet (grouped by sub-section)
 *        { at:"line" }               → an inline row on every line item
 *
 *  Configure writes the enabled-state (feature + field toggles); every surface
 *  reads it. `naOnBill` = enabled globally but not applicable to THIS bill
 *  (godown on a services bill) → hidden in the main UI, greyed in Configure. */

import { ABCOM_BILL, type CodingLine } from "@/data/abcomBill"

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")

export type ChipId = "voucher" | "party" | "gst" | "eway" | "einvoice"
export type Placement = { at: "header"; chip: ChipId; sub?: string } | { at: "line" }
export type FieldKind = "select" | "text" | "date" | "readonly"

export interface RegField {
  key: string
  label: string
  note?: string
  mandatory?: boolean
  defaultOn?: boolean
  placement: Placement
  kind: FieldKind
  options?: string[]
  mono?: boolean
  hint?: string
  source?: string
  /** enabled in Configure but not applicable to this bill → hidden in UI */
  naOnBill?: boolean
  /** header-field bill data */
  value?: string
  status?: "auto" | "pending" | "resolved"
  /** line-field value, derived per line */
  lineValue?: (l: CodingLine) => string
}

export interface RegGroup {
  id: string
  label: string
  blurb: string
  feature?: boolean
  featureOnByDefault?: boolean
  naReason?: string
  fields: RegField[]
}

/** the header chips, in rail order. Core chips always show; feature chips
 *  appear only when their feature is on. */
export const CHIPS: { id: ChipId; label: string; blurb: string; feature?: string }[] = [
  { id: "voucher", label: "Voucher", blurb: "How this bill is booked" },
  { id: "party", label: "Party", blurb: "Vendor identity & place of supply" },
  { id: "gst", label: "GST", blurb: "Tax summary & classification" },
  { id: "eway", label: "E-Way Bill", blurb: "Transport & movement", feature: "eway" },
  { id: "einvoice", label: "e-Invoice", blurb: "IRN registration", feature: "einvoice" },
]

const IRN = "d8d1234f94bf4d97ca1918f2bf1a4ff1818c0e5176cb77eb9daebe76939d78b8"
const ADDR = "Shiv Shakti Industrial Premises, Lower Parel East, Mumbai — 400011, Maharashtra"
const REGS = ["Maharashtra — 27ABCDE1234F2Z5", "Karnataka — 29ABCDE1234F1Z5"]
const STATES = ["Maharashtra (27)", "Karnataka (29)", "Tamil Nadu (33)", "Gujarat (24)", "Delhi (07)", "Punjab (03)", "Telangana (36)"]

export const FIELD_CATALOG: RegGroup[] = [
  {
    id: "basic", label: "Basic bill details", blurb: "Always on the voucher",
    fields: [
      { key: "commonLedger", label: "Select common ledger", note: "one purchase ledger for all items", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "select", options: ["Yes — single ledger", "No — per-item ledger"], value: "Yes — single ledger", status: "auto" },
      { key: "voucherType", label: "Voucher type", note: "Purchase / Journal…", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "select", options: ["Purchase", "Purchase (Import)", "Journal"], value: "Purchase", status: "auto" },
      { key: "voucherNo", label: "Voucher no.", note: "auto or manual series", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "text", mono: true, hint: "AP/024/25-26", source: "not on document", value: "", status: "pending" },
      { key: "voucherDate", label: "Voucher date", note: "defaults to today", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "date", value: "01 Jul 2026", status: "auto" },
      { key: "billDate", label: "Bill date", note: "≤ voucher date", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "date", value: "06 Jun 2025", status: "auto", source: "invoice date" },
      { key: "dueDate", label: "Due date", note: "credit period", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "date", hint: "06 Jul 2025 · net 30", source: "not on document", value: "", status: "pending" },
      { key: "supplierInvNo", label: "Supplier invoice no.", note: "vendor's bill no.", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "text", mono: true, value: "AB25268643", status: "auto", source: "invoice no." },
      { key: "companyGstReg", label: "Company GST registration", note: "my branch", placement: { at: "header", chip: "voucher" }, kind: "select", options: REGS, value: "Maharashtra — 27ABCDE1234F2Z5", status: "auto" },
      { key: "partyAcName", label: "Party A/c name", note: "from vendor master", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "select", options: ["ABCom Private Limited", "Sundar Logistics Pvt Ltd", "Vertex Stationery", "Kethan & Associates"], value: "ABCom Private Limited", status: "auto", source: "matched on GSTIN" },
      { key: "purchaseLedger", label: "Purchase ledger", note: "per ticket 3811", mandatory: true, placement: { at: "header", chip: "voucher" }, kind: "select", options: ["Purchase — Services 18%", "Purchase — Goods 18%"], value: "Purchase — Services 18%", status: "auto" },
      { key: "narration", label: "Narration", note: "up to 10 lines", defaultOn: false, placement: { at: "header", chip: "voucher" }, kind: "text", value: "", status: "auto" },
      { key: "natureOfPurchase", label: "Nature of purchase", note: "Excise only", defaultOn: false, placement: { at: "header", chip: "voucher" }, kind: "select", options: ["Not Applicable", "Importer", "Manufacturer", "First Stage Dealer"], value: "Not Applicable", status: "auto" },
    ],
  },
  {
    id: "party", label: "Party & consignee", blurb: "Vendor / buyer / ship-to identity",
    fields: [
      { key: "gstin", label: "GSTIN / UIN", note: "15-char fixed format", mandatory: true, placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "text", mono: true, value: "27AANCA1620J1ZQ", status: "auto", source: "supplier GSTIN" },
      { key: "gstRegType", label: "GST registration type", note: "Regular / Composition…", mandatory: true, placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "select", options: ["Regular", "Composition", "Unregistered / URD", "SEZ"], value: "Regular", status: "auto" },
      { key: "placeOfSupply", label: "Place of supply", note: "state list + create", mandatory: true, placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "select", options: STATES, value: "Maharashtra (27)", status: "auto", source: "place of supply" },
      { key: "address", label: "Address", note: "from address master", placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "text", value: ADDR, status: "auto" },
      { key: "state", label: "State", note: "from address", placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "select", options: STATES, value: "Maharashtra (27)", status: "auto", source: "supplier state" },
      { key: "pincode", label: "Pincode", note: "6-digit", defaultOn: false, placement: { at: "header", chip: "party", sub: "Supplier" }, kind: "text", mono: true, value: "400011", status: "auto" },
      { key: "consigneeName", label: "Consignee (ship-to)", note: "own company / vendor list", defaultOn: false, placement: { at: "header", chip: "party", sub: "Consignee" }, kind: "select", options: ["Arcot Media Pvt. Ltd", "ABCom Private Limited"], value: "Arcot Media Pvt. Ltd", status: "auto" },
      { key: "consigneeGstin", label: "Consignee GSTIN", note: "based on My registration", defaultOn: false, placement: { at: "header", chip: "party", sub: "Consignee" }, kind: "text", mono: true, value: "27AARCA9635M1ZT", status: "auto" },
      { key: "consigneeAddress", label: "Consignee address", note: "from master", defaultOn: false, placement: { at: "header", chip: "party", sub: "Consignee" }, kind: "text", value: "Kamala Mills, Lower Parel West, Mumbai — 400013", status: "auto" },
    ],
  },
  {
    id: "gst", label: "GST details", blurb: "Tax summary & per-line classification",
    fields: [
      // bill-level summary → GST chip (read-only)
      { key: "taxableTotal", label: "Taxable value", placement: { at: "header", chip: "gst", sub: "Summary" }, kind: "readonly", mono: true, value: inr(ABCOM_BILL.taxableTotal), status: "auto" },
      { key: "cgstTotal", label: "CGST @ 9%", placement: { at: "header", chip: "gst", sub: "Summary" }, kind: "readonly", mono: true, value: "₹599.94", status: "auto" },
      { key: "sgstTotal", label: "SGST @ 9%", placement: { at: "header", chip: "gst", sub: "Summary" }, kind: "readonly", mono: true, value: "₹599.94", status: "auto" },
      { key: "invoiceTotal", label: "Invoice total", placement: { at: "header", chip: "gst", sub: "Summary" }, kind: "readonly", mono: true, value: inr(ABCOM_BILL.grandTotal), status: "auto" },
      // per-line classification → line rows
      { key: "typeOfSupply", label: "Type of supply", note: "Goods / Services", mandatory: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "Services" },
      { key: "taxability", label: "Taxability", note: "Taxable / Exempt / Nil", mandatory: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "Taxable" },
      { key: "itcEligibility", label: "ITC eligibility", note: "Eligible / Ineligible", mandatory: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "Eligible" },
      { key: "reverseCharge", label: "Reverse charge", note: "Y / N", mandatory: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "No" },
      { key: "natureOfTxn", label: "Nature of transaction", note: "system-inferred", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "Local purchase — taxable" },
      { key: "cessRate", label: "Cess rate", note: "if applicable", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "0%" },
    ],
  },
  {
    id: "item", label: "Item details", blurb: "Item-mode fields", feature: true, featureOnByDefault: true,
    fields: [
      { key: "discount", label: "Discount %", note: "trade discount", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "0%" },
      { key: "ratePer", label: "Rate per", note: "UOM", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "unit" },
      { key: "qtyBilled", label: "Quantity (billed)", note: "billed qty", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: (l) => `${l.qty}` },
      { key: "mrp", label: "MRP", note: "auto from master", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "—" },
      { key: "noOfPackages", label: "No. of packages", note: "40 chars", defaultOn: false, placement: { at: "line" }, kind: "readonly", lineValue: () => "1" },
    ],
  },
  {
    id: "inventory", label: "Godown, batch & tracking", blurb: "Stock allocation", feature: true, featureOnByDefault: false,
    naReason: "All lines are rental services (SAC) — no stock, so godown/batch don't apply.",
    fields: [
      { key: "godown", label: "Godown", note: "Main by default", mandatory: true, naOnBill: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "—" },
      { key: "batchLot", label: "Batch / lot no.", note: "when batched", naOnBill: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "—" },
      { key: "mfgDate", label: "Mfg. date", note: "linked to batch", naOnBill: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "—" },
      { key: "expiryDate", label: "Expiry date", note: "after mfg date", naOnBill: true, placement: { at: "line" }, kind: "readonly", lineValue: () => "—" },
    ],
  },
  {
    id: "eway", label: "E-Way Bill", blurb: "Transport & movement", feature: true, featureOnByDefault: false,
    naReason: "Invoice value ₹7,866 is under the ₹50,000 e-Way Bill threshold — enable to override.",
    fields: [
      { key: "ewayNo", label: "E-Way Bill no.", note: "12 digits", placement: { at: "header", chip: "eway", sub: "Details" }, kind: "text", mono: true, hint: "generate", value: "", status: "pending" },
      { key: "subType", label: "Sub type", note: "Supply / Job work…", mandatory: true, placement: { at: "header", chip: "eway", sub: "Details" }, kind: "select", options: ["Supply", "Job work", "Import", "Sales return"], value: "Supply", status: "auto" },
      { key: "documentType", label: "Document type", note: "Tax Invoice by default", mandatory: true, placement: { at: "header", chip: "eway", sub: "Details" }, kind: "select", options: ["Tax Invoice", "Bill of Supply", "Delivery Challan"], value: "Tax Invoice", status: "auto" },
      { key: "transportMode", label: "Mode", note: "Road / Rail / Air / Ship", mandatory: true, placement: { at: "header", chip: "eway", sub: "Transport" }, kind: "select", options: ["Not Applicable", "1-Road", "2-Rail", "3-Air", "4-Ship"], hint: "1-Road", value: "", status: "pending" },
      { key: "transporterName", label: "Transporter name", note: "list + create", placement: { at: "header", chip: "eway", sub: "Transport" }, kind: "text", value: "", status: "auto" },
      { key: "vehicleNo", label: "Vehicle number", note: "if mode = road", placement: { at: "header", chip: "eway", sub: "Transport" }, kind: "text", mono: true, value: "", status: "auto" },
      { key: "pinToPin", label: "Pin-to-pin distance", note: "≤ 4000 km", placement: { at: "header", chip: "eway", sub: "Transport" }, kind: "text", value: "", status: "auto" },
      { key: "consignorDetails", label: "Consignor details", note: "auto from vendor", defaultOn: false, placement: { at: "header", chip: "eway", sub: "Consignor" }, kind: "readonly", value: "ABCom Private Limited · 27", status: "auto" },
    ],
  },
  {
    id: "einvoice", label: "E-Invoice", blurb: "IRN registration", feature: true, featureOnByDefault: true,
    fields: [
      { key: "irn", label: "IRN", note: "64 chars · read-only", mandatory: true, placement: { at: "header", chip: "einvoice", sub: "IRN" }, kind: "readonly", mono: true, value: IRN, status: "auto", source: "on document" },
      { key: "ackNo", label: "Ack no.", note: "from API", mandatory: true, placement: { at: "header", chip: "einvoice", sub: "IRN" }, kind: "readonly", mono: true, value: "122527045739098", status: "auto" },
      { key: "ackDate", label: "Ack date", note: "from API", mandatory: true, placement: { at: "header", chip: "einvoice", sub: "IRN" }, kind: "readonly", value: "06 Jun 2025", status: "auto" },
      { key: "dispatchName", label: "Dispatch-from name", note: "own company", defaultOn: false, placement: { at: "header", chip: "einvoice", sub: "Dispatch" }, kind: "text", value: "Arcot Media Pvt. Ltd", status: "auto" },
      { key: "dispatchState", label: "Dispatch-from state", note: "state list", defaultOn: false, placement: { at: "header", chip: "einvoice", sub: "Dispatch" }, kind: "select", options: STATES, value: "Maharashtra (27)", status: "auto" },
      { key: "cancelReason", label: "Cancellation reason", note: "within 24h", defaultOn: false, placement: { at: "header", chip: "einvoice", sub: "Cancellation" }, kind: "select", options: ["Not Applicable", "Duplicate", "Order Cancelled", "Data Entry Mistake"], value: "Not Applicable", status: "auto" },
    ],
  },
]

export const ALL_FIELDS: RegField[] = FIELD_CATALOG.flatMap((g) => g.fields)
export const CATALOG_TOTAL = ALL_FIELDS.length
/** map a field key → its Configure group (for feature-gating lookups) */
export const FIELD_GROUP: Record<string, string> = Object.fromEntries(FIELD_CATALOG.flatMap((g) => g.fields.map((f) => [f.key, g.id])))
/** which groups are feature-gated */
export const FEATURE_GROUPS = FIELD_CATALOG.filter((g) => g.feature).map((g) => g.id)

export function defaultFieldState(): Record<string, boolean> {
  const s: Record<string, boolean> = {}
  for (const f of ALL_FIELDS) s[f.key] = !!(f.mandatory || f.defaultOn !== false)
  return s
}
/* ── primary fields shown IN PLACE on the voucher; the rest of each host's
   fields open behind its › (focused sub-screen). `host` is the chip whose
   detail fields the › reveals. */
export const PRIMARY_FIELDS: { key: string; host: ChipId | null }[] = [
  { key: "voucherType", host: null },
  { key: "voucherNo", host: "voucher" },
  { key: "supplierInvNo", host: "einvoice" },
  { key: "partyAcName", host: "party" },
  { key: "purchaseLedger", host: "gst" },
]
export const PRIMARY_KEYS = new Set(PRIMARY_FIELDS.map((p) => p.key))
/** the › label per host chip */
export const HOST_LABEL: Record<string, string> = { voucher: "Voucher details", einvoice: "e-Invoice", party: "Party details", gst: "GST & ledger" }

/** vendor master — picking a party in place refreshes these dependent details */
export const VENDOR_MASTER: Record<string, Record<string, string>> = {
  "ABCom Private Limited": { gstin: "27AANCA1620J1ZQ", gstRegType: "Regular", address: "Shiv Shakti Industrial Premises, Lower Parel East, Mumbai — 400011", placeOfSupply: "Maharashtra (27)", state: "Maharashtra (27)" },
  "Sundar Logistics Pvt Ltd": { gstin: "29ABCDE1234F1Z5", gstRegType: "Regular", address: "#14 Hosur Road, Bengaluru — 560068", placeOfSupply: "Karnataka (29)", state: "Karnataka (29)" },
  "Vertex Stationery": { gstin: "27AABCV1234K1Z0", gstRegType: "Composition", address: "Andheri East, Mumbai — 400069", placeOfSupply: "Maharashtra (27)", state: "Maharashtra (27)" },
  "Kethan & Associates": { gstin: "27AAKCK5521R1Z3", gstRegType: "Regular", address: "Fort, Mumbai — 400001", placeOfSupply: "Maharashtra (27)", state: "Maharashtra (27)" },
}

export function defaultFeatureState(): Record<string, boolean> {
  const s: Record<string, boolean> = {}
  for (const g of FIELD_CATALOG) if (g.feature) s[g.id] = !!g.featureOnByDefault
  return s
}
