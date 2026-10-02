/** Per-bill coding model for the line-centric cockpit.
 *
 *  The registry (fieldCatalog) defines the field STRUCTURE (labels, placement,
 *  kind, options). This builds the bill-specific DATA that fills it: the line
 *  items and the header field values/statuses. ABCom keeps its rich, hand-
 *  authored fixture; every other needs-review bill is synthesized from its
 *  lightweight ReviewItem (vendor · invoice · amount · issues), mapping its
 *  issues to the cockpit's real decisions (ledger / voucher / place-of-supply)
 *  and always surfacing the cost-centre coding work. Deterministic — no
 *  randomness — so a bill looks identical every time it's opened. */

import { ABCOM_BILL, type CodingLine, type CellStatus } from "@/data/abcomBill"
import type { ReviewItem } from "@/data/review"

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")
/** auto = extracted & confident · pending = empty/needs input · review = read
 *  but low-confidence (confirm) · resolved = user set */
type HStatus = "auto" | "pending" | "resolved" | "review"
const H = (value: string, status: HStatus): { value: string; status: HStatus } => ({ value, status })

export interface BillMeta {
  supplier: { name: string; place: string; state: string; stateCode: string; gstin: string }
  recipient: { name: string; place: string; state: string; stateCode: string; gstin: string }
  invoiceNo: string; invoiceDate: string; period: string; poNo: string | null; nextVoucher: string
  taxableTotal: number; cgstTotal: number; sgstTotal: number; grandTotal: number
}

export interface CodingModel {
  meta: BillMeta
  lines: CodingLine[]
  /** overrides for header field values; keys not present fall back to the
   *  registry default (used for generic fields like voucher type) */
  header: Record<string, { value: string; status: HStatus }>
  featureOn: Record<string, boolean>
  /** which entry mode the bill opens in — Tally's Item Invoice (track stock
   *  lines) vs Accounting Invoice (book straight to ledgers, for services). */
  defaultMode: "item" | "account"
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const SERVICE_ITEMS = ["Professional services", "Consulting retainer", "Support & maintenance", "Monthly subscription", "Managed services", "Logistics & handling", "Annual licence", "Freight — inbound"]
const LEDGERS = ["Professional Charges", "Consultancy", "Repairs & Maintenance", "Subscriptions", "Freight & Forwarding", "Rent & Hire"]
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

function synthGstin(seed: number, code: string) {
  const L = (n: number) => LETTERS[n % LETTERS.length]
  const pan = `${L(seed)}${L(seed >> 2)}${L(seed >> 4)}C${L(seed >> 6)}${String(1000 + (seed % 8999)).slice(0, 4)}${L(seed >> 8)}`
  return `${code}${pan}1Z${seed % 9}`
}

/** ABCom — the flagship fixture, unchanged. Header values come from the
 *  registry defaults, so `header` stays empty. */
function abcomModel(): CodingModel {
  const b = ABCOM_BILL
  return {
    meta: {
      supplier: b.supplier, recipient: b.recipient,
      invoiceNo: b.invoiceNo, invoiceDate: b.invoiceDate, period: b.period, poNo: b.poNo, nextVoucher: b.nextVoucher,
      taxableTotal: b.taxableTotal, cgstTotal: b.cgstTotal, sgstTotal: b.sgstTotal, grandTotal: b.grandTotal,
    },
    lines: b.lines.map((l) => ({ ...l })),
    header: {
      // demo the extraction-failure states:
      gstin: H("27AANCA1620J1ZQ", "review"), // read, but low confidence — please confirm
      address: H("", "pending"), // extraction failed — nothing to propose
    },
    featureOn: { item: true, inventory: false, eway: false, einvoice: true },
    // ABCom stays in Item mode by default — its five rate-lines demo the
    // line-centric cockpit; flip to Account with Ctrl+H to see the collapse.
    defaultMode: "item",
  }
}

/** Sundar Logistics — a rich fixture from its real invoice: inter-state
 *  (supplier 29 Karnataka → place of supply 27 Maharashtra), freight + the
 *  ambiguous 996799 loading line, voucher & place-of-supply still to confirm. */
function sundarModel(): CodingModel {
  const mkLine = (id: number, description: string, hsn: string, taxable: number, ledgerVal: string, ledgerStatus: CellStatus): CodingLine => {
    const c = Math.round(taxable * 9) / 100
    return { id, description, hsn, rate: taxable, qty: 1, taxable, cgstPct: 9, sgstPct: 9, cgst: c, sgst: c, amount: Math.round(taxable * 1.18), ledger: { value: ledgerVal, status: ledgerStatus }, costCentre: { value: "—", status: "pending" }, godown: { value: "—", status: "na" } }
  }
  const meta: BillMeta = {
    supplier: { name: "Sundar Logistics Pvt Ltd", place: "#14 Hosur Road, Bengaluru 560068", state: "Karnataka", stateCode: "29", gstin: "29ABCDE1234F1Z5" },
    recipient: { name: "Acme Industries Pvt Ltd", place: "Maharashtra", state: "Maharashtra", stateCode: "27", gstin: "27ABCDE1234F1Z5" },
    invoiceNo: "SLPL/2526/0489", invoiceDate: "06 Jun 2026", period: "—", poNo: null, nextVoucher: "AP/007/25-26",
    taxableTotal: 156000, cgstTotal: 14040, sgstTotal: 14040, grandTotal: 184080,
  }
  return {
    meta,
    lines: [
      mkLine(1, "Freight for inbound raw material", "996511", 120000, "Carriage Inward", "auto"),
      mkLine(2, "Loading & handling charges", "996799", 36000, "—", "pending"), // 996799 maps to two ledgers
    ],
    header: {
      supplierInvNo: H("SLPL/2526/0489", "auto"), partyAcName: H("Sundar Logistics Pvt Ltd", "auto"),
      gstin: H("29ABCDE1234F1Z5", "auto"), gstRegType: H("Regular", "auto"),
      state: H("Karnataka (29)", "auto"), address: H("#14 Hosur Road, Bengaluru 560068, Karnataka", "auto"),
      billDate: H("06 Jun 2026", "auto"), voucherDate: H("01 Jul 2026", "auto"),
      voucherNo: H("", "pending"), dueDate: H("", "pending"),
      placeOfSupply: H("Maharashtra (27)", "pending"), // 29 ≠ 27 → confirm the inter-state place of supply
      taxableTotal: H(inr(156000), "auto"), cgstTotal: H(inr(14040), "auto"), sgstTotal: H(inr(14040), "auto"), invoiceTotal: H(inr(184080), "auto"),
    },
    featureOn: { item: true, inventory: false, eway: false, einvoice: false },
    // freight & handling are services (SAC 9965xx) — Accounting Invoice is the
    // honest mode: two ledger lines, no stock. Demos the mode live.
    defaultMode: "account",
  }
}

export function buildCodingModel(item: ReviewItem): CodingModel {
  if (item.billId === "r-abcom") return abcomModel()
  if (item.billId === "r-sundar") return sundarModel()

  const h = hash(item.billId)
  const nLines = (h % 3) + 1
  const grand = Math.max(item.amount, 1)
  const taxable = Math.round(grand / 1.18)
  const taxTotal = grand - taxable
  const cgstTotal = Math.round((taxTotal / 2) * 100) / 100
  const hasLedger = item.issues.some((i) => i.type === "ledger")
  const hasGst = item.issues.some((i) => i.type === "gst")

  const per = Math.floor(taxable / nLines)
  const lines: CodingLine[] = Array.from({ length: nLines }, (_, i) => {
    const t = i === nLines - 1 ? taxable - per * (nLines - 1) : per
    const c = Math.round(t * 9) / 100
    return {
      id: i + 1,
      description: SERVICE_ITEMS[(h + i) % SERVICE_ITEMS.length],
      hsn: "9983" + (10 + ((h + i * 7) % 89)),
      rate: t, qty: 1, taxable: t, cgstPct: 9, sgstPct: 9, cgst: c, sgst: c, amount: Math.round(t * 1.18),
      // an ambiguous-ledger read leaves the first line's ledger for the user
      ledger: hasLedger && i === 0 ? { value: "—", status: "pending" as CellStatus } : { value: LEDGERS[(h + i) % LEDGERS.length], status: "auto" as CellStatus },
      costCentre: { value: "—", status: "pending" as CellStatus }, // cost coding is always the reviewer's call
      godown: { value: "—", status: "na" as CellStatus },
    }
  })

  const code = "27"
  const gstin = synthGstin(h, code)
  const day = (h % 27) + 1
  const invDate = `${day} ${MONTHS[h % 12]} 2026`
  const seq = 24 + (h % 60)
  const meta: BillMeta = {
    supplier: { name: item.vendor, place: "Mumbai", state: "Maharashtra", stateCode: code, gstin },
    recipient: { name: "Arcot Media Pvt. Ltd", place: "Mumbai", state: "Maharashtra", stateCode: "27", gstin: "27AARCA9635M1ZT" },
    invoiceNo: item.invoiceNo, invoiceDate: invDate, period: "—", poNo: null, nextVoucher: `AP/${String(seq).padStart(3, "0")}/25-26`,
    taxableTotal: taxable, cgstTotal, sgstTotal: cgstTotal, grandTotal: grand,
  }

  const header: Record<string, { value: string; status: HStatus }> = {
    supplierInvNo: H(item.invoiceNo, "auto"),
    partyAcName: H(item.vendor, "auto"),
    gstin: H(gstin, "auto"),
    state: H("Maharashtra (27)", "auto"),
    address: H("Mumbai, Maharashtra", "auto"),
    billDate: H(invDate, "auto"),
    voucherDate: H("01 Jul 2026", "auto"),
    voucherNo: H("", "pending"), // book-side number, never on the document
    dueDate: H("", "pending"),
    placeOfSupply: hasGst ? H("—", "pending") : H("Maharashtra (27)", "auto"),
    taxableTotal: H(inr(taxable), "auto"),
    cgstTotal: H(inr(cgstTotal), "auto"),
    sgstTotal: H(inr(cgstTotal), "auto"),
    invoiceTotal: H(inr(grand), "auto"),
  }

  // synthesized bills carry no e-invoice / stock; only the item feature is on.
  // Their line items are services (SERVICE_ITEMS) but we keep them in Item mode
  // by default to preserve the variety of line demos — Ctrl+H flips any of them.
  return { meta, lines, header, featureOn: { item: true, inventory: false, eway: false, einvoice: false }, defaultMode: "item" }
}
