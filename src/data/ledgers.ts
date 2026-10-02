/* ── Chart of Accounts — the ledger master ─────────────────────
   Mirrors Tally's group tree: four natures, primary groups under each,
   ledgers under a group. Balances are signed — Dr positive, Cr negative —
   so a group subtotal is a plain sum and the Dr/Cr suffix is derived.

   The creditor ledgers are the same vendors the Bills register books
   against, and the expense ledgers are the ones its line items post to,
   so a bill and the ledger it hit always agree.
   ───────────────────────────────────────────────────────────── */

import { BILLS } from "@/data/invoice"

export type Nature = "assets" | "liabilities" | "income" | "expenses"
export type MasterSync = "synced" | "pending" | "failed"

export const NATURE_LABEL: Record<Nature, string> = {
  assets: "Assets",
  liabilities: "Liabilities",
  income: "Income",
  expenses: "Expenses",
}

export interface LedgerGroup {
  id: string
  name: string
  nature: Nature
}

/** primary groups, in balance-sheet-then-P&L order */
export const LEDGER_GROUPS: LedgerGroup[] = [
  { id: "capital", name: "Capital Account", nature: "liabilities" },
  { id: "loans", name: "Loans (Liability)", nature: "liabilities" },
  { id: "creditors", name: "Sundry Creditors", nature: "liabilities" },
  { id: "duties", name: "Duties & Taxes", nature: "liabilities" },
  { id: "provisions", name: "Provisions", nature: "liabilities" },
  { id: "fixed", name: "Fixed Assets", nature: "assets" },
  { id: "bank", name: "Bank Accounts", nature: "assets" },
  { id: "cash", name: "Cash-in-Hand", nature: "assets" },
  { id: "debtors", name: "Sundry Debtors", nature: "assets" },
  { id: "advances", name: "Loans & Advances (Asset)", nature: "assets" },
  { id: "sales", name: "Sales Accounts", nature: "income" },
  { id: "indirect-income", name: "Indirect Incomes", nature: "income" },
  { id: "purchase", name: "Purchase Accounts", nature: "expenses" },
  { id: "direct-exp", name: "Direct Expenses", nature: "expenses" },
  { id: "indirect-exp", name: "Indirect Expenses", nature: "expenses" },
]

export const groupById = (id: string) => LEDGER_GROUPS.find((g) => g.id === id)!

export interface Ledger {
  id: string
  name: string
  group: string
  /** signed: Dr positive, Cr negative */
  opening: number
  closing: number
  /** vouchers posted to this ledger in the current financial year */
  vouchers: number
  lastUsed?: string
  gstin?: string
  pan?: string
  state?: string
  /** GST rate the ledger applies by default, for expense/purchase heads */
  gstRate?: number
  sync: MasterSync
  syncNote?: string
  /** where the master came from — imported from Tally, made by hand, or made by the AI off a bill */
  source: "tally" | "user" | "ai"
  /** the bill the AI created it from, when source === "ai" */
  sourceBill?: string
}

const L = (l: Omit<Ledger, "sync" | "source"> & Partial<Pick<Ledger, "sync" | "source">>): Ledger => ({
  sync: "synced",
  source: "tally",
  ...l,
})

export const LEDGERS: Ledger[] = [
  // ── liabilities ──
  L({ id: "l-capital", name: "Partners' Capital Account", group: "capital", opening: -2500000, closing: -2500000, vouchers: 0 }),
  L({ id: "l-hdfc-loan", name: "HDFC Term Loan A/c", group: "loans", opening: -1200000, closing: -1085000, vouchers: 3, lastUsed: "5 Jun 2026" }),
  L({ id: "l-sundar", name: "Sundar Logistics Pvt Ltd", group: "creditors", opening: -96000, closing: -184080, vouchers: 4, lastUsed: "6 Jun 2026", gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", state: "Karnataka" }),
  L({ id: "l-aws", name: "AWS India Pvt Ltd", group: "creditors", opening: -98200, closing: -112400, vouchers: 3, lastUsed: "31 May 2026", gstin: "27AAACA1234M1ZV", pan: "AAACA1234M", state: "Maharashtra" }),
  L({ id: "l-reliable", name: "Reliable Packaging Co", group: "creditors", opening: -21500, closing: -47200, vouchers: 5, lastUsed: "2 Jun 2026", gstin: "29AAGFR5521K1Z8", pan: "AAGFR5521K", state: "Karnataka" }),
  L({ id: "l-tata", name: "Tata Power Company", group: "creditors", opening: 0, closing: -38940, vouchers: 3, lastUsed: "1 Jun 2026", gstin: "27AAACT0054A1ZL", pan: "AAACT0054A", state: "Maharashtra", sync: "pending" }),
  L({ id: "l-kethan", name: "Kethan & Associates", group: "creditors", opening: -25000, closing: -50000, vouchers: 2, lastUsed: "20 May 2026", gstin: "29AAKFK3310Q1ZD", pan: "AAKFK3310Q", state: "Karnataka" }),
  L({ id: "l-officemart", name: "Office Mart Supplies", group: "creditors", opening: 0, closing: -9310, vouchers: 2, lastUsed: "29 May 2026", gstin: "29AAEFO7781H1Z2", pan: "AAEFO7781H", state: "Karnataka" }),
  L({ id: "l-crystal", name: "Crystal Clean Services", group: "creditors", opening: -15000, closing: -15000, vouchers: 3, lastUsed: "25 May 2026", gstin: "29AAQFC2204E1ZP", pan: "AAQFC2204E", state: "Karnataka" }),
  L({ id: "l-bluedart", name: "Blue Dart Express Ltd", group: "creditors", opening: -8400, closing: 0, vouchers: 1, lastUsed: "12 Apr 2026", gstin: "27AAACB0446L1ZS", pan: "AAACB0446L", state: "Karnataka", sync: "failed", syncNote: "GSTIN state code doesn't match the ledger's state" }),
  L({ id: "l-cgst", name: "Input CGST", group: "duties", opening: 0, closing: 41870, vouchers: 18, lastUsed: "6 Jun 2026" }),
  L({ id: "l-sgst", name: "Input SGST", group: "duties", opening: 0, closing: 41870, vouchers: 18, lastUsed: "6 Jun 2026" }),
  L({ id: "l-igst", name: "Input IGST", group: "duties", opening: 0, closing: 45230, vouchers: 6, lastUsed: "31 May 2026" }),
  L({ id: "l-ocgst", name: "Output CGST", group: "duties", opening: -12400, closing: -68210, vouchers: 22, lastUsed: "28 Jun 2026" }),
  L({ id: "l-osgst", name: "Output SGST", group: "duties", opening: -12400, closing: -68210, vouchers: 22, lastUsed: "28 Jun 2026" }),
  L({ id: "l-tds194j", name: "TDS Payable — 194J", group: "duties", opening: -2500, closing: -5000, vouchers: 2, lastUsed: "20 May 2026" }),
  L({ id: "l-tds194c", name: "TDS Payable — 194C", group: "duties", opening: -1920, closing: -3840, vouchers: 4, lastUsed: "6 Jun 2026", sync: "pending" }),
  L({ id: "l-salary-pay", name: "Salaries Payable", group: "provisions", opening: -410000, closing: -432000, vouchers: 3, lastUsed: "30 Jun 2026" }),
  L({ id: "l-audit-prov", name: "Provision for Audit Fees", group: "provisions", opening: -60000, closing: -60000, vouchers: 0 }),

  // ── assets ──
  L({ id: "l-furniture", name: "Furniture & Fixtures", group: "fixed", opening: 340000, closing: 340000, vouchers: 0 }),
  L({ id: "l-computers", name: "Computers & Peripherals", group: "fixed", opening: 520000, closing: 586400, vouchers: 1, lastUsed: "18 Apr 2026" }),
  L({ id: "l-vehicles", name: "Motor Vehicles", group: "fixed", opening: 1150000, closing: 1150000, vouchers: 0 }),
  L({ id: "l-hdfc", name: "HDFC Bank — 50200012345678", group: "bank", opening: 1842000, closing: 1268450, vouchers: 64, lastUsed: "30 Jun 2026" }),
  L({ id: "l-icici", name: "ICICI Bank — 004105001234", group: "bank", opening: 312000, closing: 498720, vouchers: 21, lastUsed: "27 Jun 2026" }),
  L({ id: "l-cash", name: "Cash", group: "cash", opening: 24500, closing: 18230, vouchers: 37, lastUsed: "29 Jun 2026" }),
  L({ id: "l-petty", name: "Petty Cash — Bengaluru", group: "cash", opening: 5000, closing: 3120, vouchers: 14, lastUsed: "26 Jun 2026" }),
  L({ id: "l-nova", name: "Nova Retail Pvt Ltd", group: "debtors", opening: 284000, closing: 412600, vouchers: 9, lastUsed: "28 Jun 2026", gstin: "29AAFCN8812R1ZT", pan: "AAFCN8812R", state: "Karnataka" }),
  L({ id: "l-greenleaf", name: "Greenleaf Foods LLP", group: "debtors", opening: 118000, closing: 96500, vouchers: 6, lastUsed: "21 Jun 2026", gstin: "33AAKFG4410C1ZJ", pan: "AAKFG4410C", state: "Tamil Nadu" }),
  L({ id: "l-zenith", name: "Zenith Hardware Stores", group: "debtors", opening: 42000, closing: 0, vouchers: 2, lastUsed: "3 May 2026", gstin: "29AAEFZ1190B1ZW", pan: "AAEFZ1190B", state: "Karnataka" }),
  L({ id: "l-deposit", name: "Rent Deposit — Koramangala", group: "advances", opening: 300000, closing: 300000, vouchers: 0 }),
  L({ id: "l-tds-recv", name: "TDS Receivable", group: "advances", opening: 18400, closing: 26150, vouchers: 5, lastUsed: "28 Jun 2026" }),

  // ── income ──
  L({ id: "l-sales-local", name: "Sales — Local @18%", group: "sales", opening: 0, closing: -757900, vouchers: 22, lastUsed: "28 Jun 2026", gstRate: 18 }),
  L({ id: "l-sales-inter", name: "Sales — Interstate @18%", group: "sales", opening: 0, closing: -281400, vouchers: 7, lastUsed: "21 Jun 2026", gstRate: 18 }),
  L({ id: "l-interest", name: "Interest Received", group: "indirect-income", opening: 0, closing: -6240, vouchers: 3, lastUsed: "30 Jun 2026" }),
  L({ id: "l-discount-recv", name: "Discount Received", group: "indirect-income", opening: 0, closing: -1840, vouchers: 2, lastUsed: "29 May 2026" }),

  // ── expenses ──
  L({ id: "l-purchase-rm", name: "Purchase (Raw Material)", group: "purchase", opening: 0, closing: 486200, vouchers: 11, lastUsed: "2 Jun 2026", gstRate: 18 }),
  L({ id: "l-purchase-trade", name: "Purchase — Traded Goods", group: "purchase", opening: 0, closing: 214500, vouchers: 4, lastUsed: "14 Jun 2026", gstRate: 18 }),
  L({ id: "l-carriage", name: "Carriage Inward", group: "direct-exp", opening: 0, closing: 276000, vouchers: 4, lastUsed: "6 Jun 2026", gstRate: 18 }),
  L({ id: "l-loading", name: "Loading & Unloading Exp.", group: "direct-exp", opening: 0, closing: 42500, vouchers: 3, lastUsed: "6 Jun 2026" }),
  L({ id: "l-packing", name: "Packing Material Expenses", group: "direct-exp", opening: 0, closing: 118000, vouchers: 5, lastUsed: "2 Jun 2026", gstRate: 18 }),
  L({ id: "l-cloud", name: "Cloud & Hosting Charges", group: "indirect-exp", opening: 0, closing: 285762, vouchers: 3, lastUsed: "31 May 2026", gstRate: 18 }),
  L({ id: "l-electricity", name: "Electricity Expenses", group: "indirect-exp", opening: 0, closing: 116820, vouchers: 3, lastUsed: "1 Jun 2026" }),
  L({ id: "l-professional", name: "Professional Fees", group: "indirect-exp", opening: 0, closing: 84746, vouchers: 2, lastUsed: "20 May 2026", gstRate: 18 }),
  L({ id: "l-office", name: "Office Supplies Expenses", group: "indirect-exp", opening: 0, closing: 15780, vouchers: 2, lastUsed: "29 May 2026", gstRate: 18 }),
  L({ id: "l-housekeeping", name: "Housekeeping Expenses", group: "indirect-exp", opening: 0, closing: 38136, vouchers: 3, lastUsed: "25 May 2026", gstRate: 18 }),
  L({ id: "l-rent", name: "Office Rent", group: "indirect-exp", opening: 0, closing: 270000, vouchers: 3, lastUsed: "1 Jun 2026", gstRate: 18 }),
  L({ id: "l-salaries", name: "Salaries & Wages", group: "indirect-exp", opening: 0, closing: 1296000, vouchers: 3, lastUsed: "30 Jun 2026" }),
  L({ id: "l-bank-charges", name: "Bank Charges", group: "indirect-exp", opening: 0, closing: 2360, vouchers: 6, lastUsed: "30 Jun 2026" }),
  L({ id: "l-travel", name: "Travelling Expenses", group: "indirect-exp", opening: 0, closing: 0, vouchers: 0 }),
  L({ id: "l-advert", name: "Advertisement & Publicity", group: "indirect-exp", opening: 0, closing: 0, vouchers: 0 }),
  L({ id: "l-courier", name: "Courier Charges", group: "indirect-exp", opening: 0, closing: 4120, vouchers: 4, lastUsed: "17 Jun 2026", gstRate: 18, source: "ai", sourceBill: "BD/26/11873", sync: "pending" }),
]

/* ── Needs review — masters the AI wants a human to settle ─────
   Four reasons a master lands here, each with exactly one proposed fix:
   • new       — created off a bill, not in Tally yet: confirm to create
   • duplicate — looks like an existing ledger: merge into it
   • regroup   — sits under a group that misstates the books: move it
   • detail    — a field the GST return needs is missing: fill it
   ───────────────────────────────────────────────────────────── */

export type LedgerReviewKind = "new" | "duplicate" | "regroup" | "detail"

export const LEDGER_REVIEW_LABEL: Record<LedgerReviewKind, string> = {
  new: "New ledgers",
  duplicate: "Possible duplicates",
  regroup: "Wrong group",
  detail: "Missing details",
}

export interface LedgerReview {
  id: string
  kind: LedgerReviewKind
  ledger: string
  group: string
  /** the sentence — why the AI stopped */
  reason: string
  /** short chip label */
  chip: string
  /** the button that applies the proposed fix */
  action: string
  /** bill (or bills) that surfaced it */
  source: string
  amount: number
  /** for duplicates — the ledger it should merge into */
  mergeInto?: string
  /** for regroup — where it should move */
  moveTo?: string
  /** the ledger it becomes once accepted, for "new" items */
  creates?: Ledger
}

export const LEDGER_REVIEWS: LedgerReview[] = [
  {
    id: "lr-abcom",
    kind: "new",
    ledger: "ABCom Technologies Pvt Ltd",
    group: "creditors",
    reason: "First bill from this supplier. GSTIN 29AAHCA7710N1ZQ is active on the GST portal.",
    chip: "New supplier",
    action: "Create ledger",
    source: "ABC/26-27/0142",
    amount: 236000,
    creates: L({ id: "l-abcom", name: "ABCom Technologies Pvt Ltd", group: "creditors", opening: 0, closing: -236000, vouchers: 1, lastUsed: "24 Jun 2026", gstin: "29AAHCA7710N1ZQ", pan: "AAHCA7710N", state: "Karnataka", source: "ai", sourceBill: "ABC/26-27/0142", sync: "pending" }),
  },
  {
    id: "lr-software",
    kind: "new",
    ledger: "Software Subscriptions",
    group: "indirect-exp",
    reason: "Three bills for SaaS seats were coded to Cloud & Hosting. A separate head keeps hosting costs readable.",
    chip: "New expense head",
    action: "Create ledger",
    source: "3 bills",
    amount: 58410,
    creates: L({ id: "l-software", name: "Software Subscriptions", group: "indirect-exp", opening: 0, closing: 58410, vouchers: 3, lastUsed: "22 Jun 2026", gstRate: 18, source: "ai", sourceBill: "3 bills", sync: "pending" }),
  },
  {
    id: "lr-rcm",
    kind: "new",
    ledger: "GST Payable on RCM",
    group: "duties",
    reason: "Kethan & Associates billed under reverse charge. You need a ledger to carry the tax you owe on it.",
    chip: "New tax ledger",
    action: "Create ledger",
    source: "KA/2026/031",
    amount: 9000,
    creates: L({ id: "l-rcm", name: "GST Payable on RCM", group: "duties", opening: 0, closing: -9000, vouchers: 1, lastUsed: "20 May 2026", source: "ai", sourceBill: "KA/2026/031", sync: "pending" }),
  },
  {
    id: "lr-amazon",
    kind: "duplicate",
    ledger: "Amazon Web Services",
    group: "creditors",
    reason: "Same PAN as AWS India Pvt Ltd (AAACA1234M). Two ledgers split one supplier's balance in two.",
    chip: "Same PAN",
    action: "Merge",
    source: "AWS/IN/26/88213",
    amount: 18640,
    mergeInto: "l-aws",
  },
  {
    id: "lr-tata-power",
    kind: "duplicate",
    ledger: "Tata Power Co. Ltd.",
    group: "creditors",
    reason: "Name and GSTIN match Tata Power Company. Only the punctuation differs.",
    chip: "Same GSTIN",
    action: "Merge",
    source: "TPC/JUN/26/4471",
    amount: 38940,
    mergeInto: "l-tata",
  },
  {
    id: "lr-rent",
    kind: "regroup",
    ledger: "Office Rent",
    group: "direct-exp",
    reason: "Rent is an overhead, not a cost of production. Under Direct Expenses it overstates COGS by ₹2.7L.",
    chip: "Move to Indirect",
    action: "Move",
    source: "Group check",
    amount: 270000,
    moveTo: "indirect-exp",
  },
  {
    id: "lr-crystal",
    kind: "detail",
    ledger: "Crystal Clean Services",
    group: "creditors",
    reason: "No registration type set. GSTR-2B can't match its three bills until it's marked Regular.",
    chip: "Registration type",
    action: "Set Regular",
    source: "GSTR-2B match",
    amount: 15000,
  },
]

/* ── ledger activity — the voucher trail behind a balance ─────── */

export interface LedgerVoucher {
  date: string
  voucherNo: string
  type: "Purchase" | "Payment" | "Receipt" | "Sales" | "Journal" | "Contra"
  particulars: string
  debit: number
  credit: number
}

/** deterministic small PRNG so a ledger's trail is stable across renders */
function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const DAYS = ["30 Jun 2026", "27 Jun 2026", "21 Jun 2026", "14 Jun 2026", "6 Jun 2026", "2 Jun 2026", "29 May 2026", "20 May 2026", "12 May 2026", "3 May 2026", "24 Apr 2026", "12 Apr 2026"]

/** recent vouchers for a ledger. A creditor's purchases are its real bills
 *  from the register; everything else is a stable synthetic trail sized to
 *  the ledger's voucher count. */
export function ledgerVouchers(l: Ledger): LedgerVoucher[] {
  if (l.vouchers === 0) return []
  const g = groupById(l.group)
  const rnd = seeded(l.id)
  if (l.group === "creditors") {
    const bills = BILLS.filter((b) => b.vendor === l.name)
    const out: LedgerVoucher[] = bills.map((b) => ({
      date: b.voucherDate ?? b.date,
      voucherNo: b.voucherNo ?? b.number,
      type: "Purchase",
      particulars: b.description ?? "Purchase bill",
      debit: 0,
      credit: b.amount,
    }))
    // payments make up the rest, sized so the trail actually reconciles:
    // opening + purchases − payments = closing (all on the credit side)
    const slots = l.vouchers - out.length
    const billed = out.reduce((n, v) => n + v.credit, 0)
    let owed = Math.max(0, -l.opening + billed - -l.closing)
    for (let i = 0; i < slots; i++) {
      const amt = i === slots - 1 ? owed : Math.round(owed * (0.35 + rnd() * 0.3))
      owed -= amt
      if (amt > 0) out.push({ date: DAYS[(i * 3 + 4) % DAYS.length], voucherNo: `PMT/${String(40 + i).padStart(3, "0")}/26-27`, type: "Payment", particulars: "HDFC Bank — NEFT", debit: amt, credit: 0 })
    }
    return out.slice(0, 6)
  }
  const n = Math.min(l.vouchers, 6)
  const per = Math.abs(l.closing - l.opening) / Math.max(1, l.vouchers)
  const debitSide = l.closing - l.opening >= 0
  const type: LedgerVoucher["type"] =
    g.id === "sales" ? "Sales" : g.id === "purchase" || g.id === "direct-exp" ? "Purchase" : g.id === "bank" || g.id === "cash" ? "Payment" : "Journal"
  const counter =
    g.nature === "expenses" ? ["Sundar Logistics Pvt Ltd", "HDFC Bank — 50200012345678", "Reliable Packaging Co", "Cash"] : g.nature === "income" ? ["Nova Retail Pvt Ltd", "Greenleaf Foods LLP", "HDFC Bank — 50200012345678"] : ["Sales — Local @18%", "Salaries & Wages", "Office Rent", "Nova Retail Pvt Ltd"]
  return Array.from({ length: n }, (_, i) => {
    const amt = Math.round(per * (0.6 + rnd() * 0.8))
    const flip = (g.id === "bank" || g.id === "cash") && i % 3 === 1
    const dr = flip ? !debitSide : debitSide
    return {
      date: DAYS[i * 2 % DAYS.length],
      voucherNo: `${type === "Sales" ? "SI" : type === "Purchase" ? "PI" : type === "Payment" ? (dr ? "RCT" : "PMT") : "JV"}/${String(120 - i * 7).padStart(3, "0")}/26-27`,
      type: flip ? "Receipt" : type,
      particulars: counter[i % counter.length],
      debit: dr ? amt : 0,
      credit: dr ? 0 : amt,
    }
  })
}

/** "₹ x Dr" / "₹ x Cr" — the suffix a signed balance reads with */
export const drCr = (n: number) => (n === 0 ? "" : n > 0 ? "Dr" : "Cr")

/** the ledger master as it stands after this session's review decisions —
 *  accepted suggestions land as PENDING sync, exactly like a reviewed bill */
export function effectiveLedgers(resolved: Record<string, "accepted" | "dismissed">): Ledger[] {
  const accepted = LEDGER_REVIEWS.filter((r) => resolved[r.id] === "accepted")
  let out = LEDGERS.map((l) => ({ ...l }))
  for (const r of accepted) {
    if (r.kind === "new" && r.creates) out.push({ ...r.creates })
    if (r.kind === "duplicate" && r.mergeInto)
      out = out.map((l) => (l.id === r.mergeInto ? { ...l, closing: l.closing - r.amount, vouchers: l.vouchers + 1, sync: "pending" } : l))
    if (r.kind === "regroup" && r.moveTo)
      out = out.map((l) => (l.name === r.ledger ? { ...l, group: r.moveTo!, sync: "pending" } : l))
    if (r.kind === "detail") out = out.map((l) => (l.name === r.ledger ? { ...l, sync: "pending" } : l))
  }
  return out
}
