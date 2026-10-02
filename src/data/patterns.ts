/** Precedent, not confidence.
 *
 *  `review.ts` strata-fies on how well the AI READ a document — clean reads
 *  skip review, exception reads queue. That holds at 20 bills and collapses at
 *  200, because a perfectly-read bill from a vendor nobody has seen carries the
 *  same reading confidence as a perfectly-read Tata Power bill and nothing like
 *  the same risk.
 *
 *  This module adds the other axis: do we already KNOW what to do with this?
 *  The unit of trust is not the bill, it is the vendor's established pattern —
 *  ledger + GST treatment + line shape + amount band + cadence. A bill is
 *  routine when it matches a pattern and nothing material moved.
 *
 *  Everything here is additive. No existing export changes shape; the issue
 *  machinery in review.ts still drives the cockpit, and this decides which
 *  bills reach the cockpit at all.
 *
 *  Every classification carries a SENTENCE, never a score — §9.4 of the user
 *  research: "prefer reasons to numbers, always." An accountant can verify
 *  "booked here 11 of the last 12 months". Nobody can verify "94% confident".
 */

import { BILLS, type BillRow } from "@/data/invoice"

/* ── the model ──────────────────────────────────────────────── */

export type Stratum = "routine" | "changed" | "new"

/** What knocks a bill out of routine. Each is a specific, checkable fact —
 *  the list is deliberately closed: anything we cannot name, we cannot
 *  auto-group, and it falls to `new`. */
export type DeviationKind =
  | "amount-band"
  | "value-ceiling"
  | "new-line"
  | "gst-head"
  | "gstin-changed"
  | "duplicate"
  | "possible-duplicate"
  | "cadence-gap"
  | "reverse-charge"
  | "out-of-period"

export interface Deviation {
  kind: DeviationKind
  /** the short chip label on a row — 2–4 words */
  label: string
  /** the full sentence, shown when the row is opened */
  reason: string
}

/** One established shape a vendor bills in. A vendor with two genuinely
 *  different shapes (Airtel: broadband on one ledger, mobile on another) holds
 *  two patterns and splits into two groups — averaging them would produce a
 *  precedent sentence that isn't true. */
export interface VendorPattern {
  id: string
  vendor: string
  /** set only when the vendor bills in more than one shape */
  shape?: string
  gstin: string
  ledger: string
  gst: "intra" | "inter"
  /** line names that have appeared before; anything else is a new line */
  lines: string[]
  /** months this shape was posted unchanged, out of the observed window */
  monthsMatched: number
  monthsObserved: number
  /** historical amount band over the observed window */
  band: { min: number; median: number; max: number }
  /** bills this shape usually contributes in a month */
  perMonth: number
  cadence: "monthly" | "irregular"
  /** months since this shape was last seen — 1 is "last month, as expected" */
  lastSeenMonthsAgo: number
  /** never routine above this, whatever the history says */
  ceiling: number
  /** GST is normally payable by the recipient for this vendor */
  reverseCharge?: boolean
  /** invoice-number series, for generating a plausible month */
  series: { prefix: string; from: number; pad: number }
}

/** A document in this month's intake, as read. */
export interface IntakeBill {
  id: string
  vendor: string
  /** the pattern it matched on read, or null when there is no precedent */
  patternId: string | null
  invoiceNo: string
  date: string
  amount: number
  ledger: string
  gst: "intra" | "inter"
  lines: string[]
  gstin: string
  file: string
  reverseCharge?: boolean
  /** which upload brought it. Bills outlive the run that carried them, but the
   *  run is what the operator remembers ("the pile I dropped after lunch"). */
  runId: string
  /** global arrival order across every upload. Decides which copy of a
   *  duplicate is the duplicate — the one that arrived second, always, even
   *  when the two arrived in different uploads. */
  seq: number
}

export interface Classified {
  bill: IntakeBill
  stratum: Stratum
  pattern?: VendorPattern
  deviations: Deviation[]
  /** why it sits where it sits, in one line */
  reason: string
}

/* ── the posting period ─────────────────────────────────────── */

export const PERIOD = { month: "Jun", year: 2026, label: "June 2026" } as const

/* ── the vendor master ──────────────────────────────────────────
   20 patterns across 19 vendors. Airtel carries two — the divergent-shape
   case the grouping rule exists for. Counts sum to 178 routine documents,
   which is the shape of a real month: a handful of vendors produce most of
   the paper, and every one of them is boring. */

export const VENDOR_PATTERNS: VendorPattern[] = [
  {
    id: "p-krishna", vendor: "Krishna Hardware", gstin: "27AAGCK4411M1Z2",
    ledger: "Purchase — Consumables", gst: "intra",
    lines: ["Hardware & fasteners", "Hand tools", "Fixings and clamps"],
    monthsMatched: 9, monthsObserved: 9, band: { min: 4200, median: 9800, max: 18400 },
    perMonth: 21, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 100000,
    series: { prefix: "KH-", from: 118, pad: 0 },
  },
  {
    id: "p-tata", vendor: "Tata Power Company", gstin: "27AAACT0154H1ZP",
    ledger: "Electricity Charges", gst: "intra",
    lines: ["Energy charges", "Fixed demand charges", "Electricity duty"],
    monthsMatched: 11, monthsObserved: 12, band: { min: 32100, median: 37400, max: 41800 },
    perMonth: 12, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 200000,
    series: { prefix: "7004", from: 56128, pad: 0 },
  },
  {
    id: "p-airtel-bb", vendor: "Airtel Business", shape: "Broadband", gstin: "27AAACB2894G1ZL",
    ledger: "Telephone & Internet", gst: "intra",
    lines: ["Broadband rental", "Static IP charges"],
    monthsMatched: 12, monthsObserved: 12, band: { min: 21400, median: 24600, max: 26900 },
    perMonth: 4, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 100000,
    series: { prefix: "IN-INV-", from: 10441, pad: 0 },
  },
  {
    id: "p-airtel-mob", vendor: "Airtel Business", shape: "Mobile", gstin: "27AAACB2894G1ZL",
    ledger: "Mobile & Data", gst: "intra",
    lines: ["Postpaid plan rental", "Data add-on"],
    monthsMatched: 10, monthsObserved: 12, band: { min: 3100, median: 4800, max: 7200 },
    perMonth: 6, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 50000,
    series: { prefix: "IN-MOB-", from: 7714, pad: 0 },
  },
  {
    id: "p-meridian", vendor: "Meridian Transport Co", gstin: "27AAFCM8821K1Z9",
    ledger: "Carriage Inward", gst: "intra",
    lines: ["Inbound freight", "Detention charges", "Loading & handling"],
    monthsMatched: 8, monthsObserved: 8, band: { min: 8400, median: 41000, max: 200000 },
    perMonth: 18, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 150000,
    series: { prefix: "MT/2526/", from: 712, pad: 0 },
  },
  {
    id: "p-prime", vendor: "Prime Couriers", gstin: "27AAJCP1180B1Z4",
    ledger: "Courier & Postage", gst: "intra",
    lines: ["Docket charges", "Fuel surcharge"],
    monthsMatched: 14, monthsObserved: 14, band: { min: 380, median: 1240, max: 5400 },
    perMonth: 22, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 40000,
    series: { prefix: "PC-", from: 8802, pad: 0 },
  },
  {
    id: "p-gourmet", vendor: "Gourmet Canteen Services", gstin: "27AAECG7723N1ZF",
    ledger: "Staff Welfare", gst: "intra",
    lines: ["Canteen services — monthly", "Beverage supplies"],
    monthsMatched: 7, monthsObserved: 7, band: { min: 16200, median: 18400, max: 21100 },
    perMonth: 4, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 80000,
    series: { prefix: "GCS/2026/", from: 288, pad: 0 },
  },
  {
    id: "p-vertex", vendor: "Vertex Stationery", gstin: "27AACCV5590D1ZQ",
    ledger: "Printing & Stationery", gst: "intra",
    lines: ["Office stationery", "Printer consumables"],
    monthsMatched: 10, monthsObserved: 11, band: { min: 2600, median: 8100, max: 14900 },
    perMonth: 6, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 60000,
    series: { prefix: "VS-", from: 1189, pad: 0 },
  },
  {
    id: "p-shakti", vendor: "Shakti Packers", gstin: "27AAKCS2038R1Z7",
    ledger: "Packing Material", gst: "intra",
    lines: ["Corrugated boxes", "Stretch film", "Strapping rolls"],
    monthsMatched: 9, monthsObserved: 9, band: { min: 9200, median: 26800, max: 48000 },
    perMonth: 14, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 120000,
    series: { prefix: "SP/", from: 455, pad: 0 },
  },
  {
    id: "p-bluedart", vendor: "Blue Dart Express", gstin: "27AAACB0446L1ZG",
    ledger: "Courier & Postage", gst: "intra",
    lines: ["Air express — docket", "Surface express — docket"],
    monthsMatched: 12, monthsObserved: 12, band: { min: 1900, median: 8600, max: 24000 },
    perMonth: 9, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 60000,
    series: { prefix: "BD-", from: 5521, pad: 0 },
  },
  {
    id: "p-aws", vendor: "AWS India Pvt Ltd", gstin: "29AABCA1332L1Z5",
    ledger: "Cloud & Hosting Charges", gst: "inter",
    lines: ["Cloud compute & storage", "Data transfer"],
    monthsMatched: 12, monthsObserved: 12, band: { min: 88000, median: 106000, max: 134000 },
    perMonth: 1, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 300000,
    // series starts past IN-INV-9920, which is already in the books
    series: { prefix: "IN-INV-", from: 9931, pad: 0 },
  },
  {
    id: "p-reliable", vendor: "Reliable Packaging Co", gstin: "27AADCR6612J1Z1",
    ledger: "Packing Material", gst: "intra",
    lines: ["Carton boxes", "Bubble wrap", "Adhesive tape"],
    monthsMatched: 11, monthsObserved: 11, band: { min: 22400, median: 44000, max: 62000 },
    perMonth: 11, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 200000,
    series: { prefix: "RPC-2026-", from: 118, pad: 0 },
  },
  {
    id: "p-office", vendor: "Office Mart Supplies", gstin: "27AAGCO3391P1ZB",
    ledger: "Office Expenses", gst: "intra",
    lines: ["Pantry supplies", "Housekeeping consumables", "Office sundries"],
    monthsMatched: 8, monthsObserved: 9, band: { min: 3400, median: 9310, max: 16800 },
    perMonth: 8, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 60000,
    // starts past OMS/1187 — the bill x-office arrives as a second copy of
    series: { prefix: "OMS/", from: 1191, pad: 0 },
  },
  {
    id: "p-crystal", vendor: "Crystal Clean Services", gstin: "27AAFCC9014T1Z3",
    ledger: "Housekeeping Charges", gst: "intra",
    lines: ["Housekeeping — monthly contract", "Deep clean — quarterly"],
    monthsMatched: 12, monthsObserved: 12, band: { min: 14000, median: 15000, max: 18500 },
    perMonth: 4, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 60000,
    series: { prefix: "CCS-", from: 305, pad: 0 },
  },
  {
    id: "p-lakshmi", vendor: "Lakshmi Print Works", gstin: "27AABCL7745E1ZM",
    ledger: "Printing & Stationery", gst: "intra",
    lines: ["Letterheads & envelopes", "Label printing"],
    monthsMatched: 6, monthsObserved: 7, band: { min: 4100, median: 9840, max: 19200 },
    perMonth: 5, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 60000,
    series: { prefix: "LPW/2026/", from: 71, pad: 0 },
  },
  {
    id: "p-sundar", vendor: "Sundar Logistics Pvt Ltd", gstin: "29ABCDE1234F1Z5",
    ledger: "Carriage Inward", gst: "inter",
    lines: ["Freight for inbound raw material", "Loading & handling charges"],
    monthsMatched: 9, monthsObserved: 9, band: { min: 96000, median: 168000, max: 214000 },
    perMonth: 3, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 400000,
    series: { prefix: "SLPL/2526/", from: 489, pad: 0 },
  },
  {
    id: "p-kethan", vendor: "Kethan & Associates", gstin: "27AAHFK5527C1ZY",
    ledger: "Professional Fees", gst: "intra",
    lines: ["Professional services — retainer"],
    monthsMatched: 6, monthsObserved: 12, band: { min: 40000, median: 50000, max: 60000 },
    // silent since February — a monthly vendor reappearing after four months
    // is not routine, whatever its history says
    perMonth: 1, cadence: "monthly", lastSeenMonthsAgo: 4, ceiling: 150000,
    series: { prefix: "KA/INV/", from: 42, pad: 4 },
  },
  {
    id: "p-abcom", vendor: "ABCom Private Limited", gstin: "27AAECA1180Q1ZK",
    ledger: "Rent — Office Premises", gst: "intra",
    lines: ["Office rent — monthly", "Maintenance charges"],
    monthsMatched: 14, monthsObserved: 14, band: { min: 7600, median: 7866, max: 8200 },
    perMonth: 1, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 50000,
    series: { prefix: "AB", from: 25268643, pad: 0 },
  },
  {
    id: "p-deccan", vendor: "Deccan Fuels", gstin: "27AAJCD6690F1ZW",
    ledger: "Fuel & Lubricants", gst: "intra",
    lines: ["Diesel — bulk", "Lubricants"],
    monthsMatched: 10, monthsObserved: 10, band: { min: 12400, median: 28900, max: 54000 },
    perMonth: 12, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 150000,
    series: { prefix: "DF/2526/", from: 331, pad: 0 },
  },
  {
    id: "p-ganesh", vendor: "Sri Ganesh Enterprises", gstin: "27AAFCS3312L1ZD",
    ledger: "Purchase — Raw Material", gst: "intra",
    lines: ["MS sheets", "Fabricated brackets", "Weld consumables"],
    monthsMatched: 7, monthsObserved: 7, band: { min: 18600, median: 62000, max: 148000 },
    perMonth: 16, cadence: "monthly", lastSeenMonthsAgo: 1, ceiling: 250000,
    series: { prefix: "SGE/", from: 2201, pad: 0 },
  },
]

const PATTERN_BY_ID = new Map(VENDOR_PATTERNS.map((p) => [p.id, p]))
export const patternById = (id: string | null) => (id ? PATTERN_BY_ID.get(id) : undefined)

/* ── precedent, as a sentence ───────────────────────────────── */

export const gstLabel = (g: "intra" | "inter") => (g === "inter" ? "IGST" : "CGST+SGST")

/** "Electricity Charges · CGST+SGST · same as last 11 months" — the whole
 *  claim a group approval rests on, checkable in two seconds. */
export function precedentLine(p: VendorPattern): string {
  const months =
    p.monthsMatched === p.monthsObserved
      ? `same as last ${p.monthsMatched} months`
      : `same in ${p.monthsMatched} of the last ${p.monthsObserved} months`
  return `${p.ledger} · ${gstLabel(p.gst)} · ${months}`
}

/* ── generating the month ───────────────────────────────────────
   The routine bulk is generated, the exceptions are hand-written. That split
   is deliberate: 178 hand-authored routine rows would be unreviewable, and
   the exceptions are the design-critical ones that must be exact.

   Generation is seeded — fixtures that reshuffle between reloads make a
   prototype impossible to demo twice. */

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** Bills of one pattern spread over distinct days of the period, amounts
 *  inside the band AND under the vendor's ceiling — a generated row must be
 *  routine by construction, or the fixture is arguing with the classifier.
 *  Distinct dates also guarantee the weak duplicate rule (vendor + amount +
 *  date) can never fire on generated rows. */
function generate(p: VendorPattern, run = "u1", from = 0, count = p.perMonth): IntakeBill[] {
  const rand = rng(seedOf(p.id + run))
  const step = Math.max(1, Math.floor(27 / Math.max(1, count)))
  const top = Math.min(p.band.max, p.ceiling)
  return Array.from({ length: count }, (_, i) => {
    const day = 1 + ((i * step + Math.floor(rand() * step)) % 27)
    const amount = Math.round((p.band.min + rand() * (top - p.band.min)) / 10) * 10
    const n = p.series.from + from + i
    return {
      id: `${run}-${p.id}-${i}`,
      vendor: p.vendor,
      patternId: p.id,
      invoiceNo: `${p.series.prefix}${p.series.pad ? String(n).padStart(p.series.pad, "0") : n}`,
      date: `${day} ${PERIOD.month} ${PERIOD.year}`,
      amount,
      ledger: p.ledger,
      gst: p.gst,
      lines: [p.lines[0], ...(rand() > 0.6 && p.lines[1] ? [p.lines[1]] : [])],
      gstin: p.gstin,
      file: `${p.id.replace("p-", "")}-${n}.pdf`,
      reverseCharge: p.reverseCharge,
      runId: run,
      seq: 0, // stamped when the pile is assembled
    }
  })
}

/** every routine document this pattern contributes, before mutation */
const GENERATED: IntakeBill[] = VENDOR_PATTERNS.flatMap((p) => generate(p))

/* ── the exceptions ─────────────────────────────────────────────
   Fourteen documents that each break precedent in exactly one nameable way.
   Nothing here is TAGGED as changed — every one of them is plain data, and
   the classifier below has to find it. That is the point of the fixture: if
   a rule is wrong, the demo shows it. */

/** A routine bill of this pattern, overridden — keeps ledger/GSTIN/lines
 *  coherent so only the intended thing deviates.
 *
 *  Two modes, and the difference matters: most exceptions REPLACE the routine
 *  bill they mutate (the vendor sent one bill and it was odd), but a duplicate
 *  is an EXTRA document — replacing would delete the very bill it duplicates
 *  and leave nothing to detect. `replaces` carries which generated row, if
 *  any, this stands in for. */
type Exception = IntakeBill & { replaces?: string }

function mutate(
  patternId: string,
  over: Partial<IntakeBill> & { id: string },
  mode: "replaces" | "adds" = "replaces",
): Exception {
  const p = PATTERN_BY_ID.get(patternId)!
  const base = GENERATED.find((b) => b.patternId === patternId)!
  return {
    ...base,
    ...over,
    vendor: p.vendor,
    patternId,
    ...(mode === "replaces" ? { replaces: base.id } : {}),
  }
}

const EXCEPTIONS: Exception[] = [
  // amount well above the band — the classic "why is this one 3× the usual?"
  mutate("p-reliable", { id: "x-reliable", invoiceNo: "RPC-2026-141", amount: 142000, date: `12 ${PERIOD.month} ${PERIOD.year}` }),
  // a line that has never appeared for this vendor
  mutate("p-bluedart", { id: "x-bluedart", invoiceNo: "BD-5588", amount: 22600, date: `9 ${PERIOD.month} ${PERIOD.year}`, lines: ["Air express — docket", "Fuel surcharge — reweigh"] }),
  // printed CGST+SGST, but nine months of precedent say IGST — the trap the
  // cockpit walkthrough is built around
  mutate("p-sundar", { id: "x-sundar", invoiceNo: "SLPL/2526/0489", amount: 184080, date: `6 ${PERIOD.month} ${PERIOD.year}`, gst: "intra" }),
  // the same broadband bill sent twice — reads flawlessly both times. An
  // ADDITION: the first copy stays routine and posts, this one is caught
  mutate("p-airtel-bb", { id: "x-airtel-dup", invoiceNo: "IN-INV-10441", amount: 24780, date: `3 ${PERIOD.month} ${PERIOD.year}` }, "adds"),
  // above the band, inside the ceiling
  mutate("p-krishna", { id: "x-krishna", invoiceNo: "KH-166", amount: 58400, date: `18 ${PERIOD.month} ${PERIOD.year}` }),
  // vendor re-registered — a GSTIN change is an ITC consequence, never routine
  mutate("p-tata", { id: "x-tata", invoiceNo: "700456999", amount: 38940, date: `1 ${PERIOD.month} ${PERIOD.year}`, gstin: "27AAACT0154H2ZN" }),
  // dated four months before the period it arrived in
  mutate("p-deccan", { id: "x-deccan", invoiceNo: "DF/2526/298", amount: 31200, date: "28 Feb 2026" }),
  // a new line on a raw-material bill — a coding decision, not a read error
  mutate("p-ganesh", { id: "x-ganesh", invoiceNo: "SGE/2244", amount: 88400, date: `21 ${PERIOD.month} ${PERIOD.year}`, lines: ["MS sheets", "Tooling amortisation"] }),
  // inside the band, over the vendor's own value ceiling
  mutate("p-meridian", { id: "x-meridian", invoiceNo: "MT/2526/0790", amount: 172000, date: `24 ${PERIOD.month} ${PERIOD.year}` }),
  // a monthly retainer reappearing after four silent months
  mutate("p-kethan", { id: "x-kethan", invoiceNo: "KA/INV/0061", amount: 50000, date: `16 ${PERIOD.month} ${PERIOD.year}` }),
  // the rent bill carrying a line the landlord has never billed before
  mutate("p-abcom", { id: "x-abcom", invoiceNo: "AB25268643", amount: 7866, date: `1 ${PERIOD.month} ${PERIOD.year}`, lines: ["Office rent — monthly", "Common area electricity — reallocated"] }),
  // reverse charge now applies — the tax treatment moved, not the amount
  mutate("p-prime", { id: "x-prime", invoiceNo: "PC-8899", amount: 4120, date: `11 ${PERIOD.month} ${PERIOD.year}`, reverseCharge: true }),
  // suspiciously small against nine months of precedent
  mutate("p-shakti", { id: "x-shakti", invoiceNo: "SP/0512", amount: 210, date: `7 ${PERIOD.month} ${PERIOD.year}` }),
  // already in the books — the second shape duplicate detection must catch.
  // Also an ADDITION, and it carries the ORIGINAL bill's May date, because a
  // re-sent document does
  mutate("p-office", { id: "x-office", invoiceNo: "OMS/1187", amount: 9310, date: "29 May 2026" }, "adds"),
]

/* ── vendors with no precedent ──────────────────────────────────
   37 documents from 14 vendors nobody has posted before. These are the ones
   that genuinely need the cockpit — and the only ones that should. */

const NEW_VENDORS: { vendor: string; gstin: string; count: number; prefix: string; from: number; band: [number, number] }[] = [
  { vendor: "Nandi Steel Traders", gstin: "27AAGCN1102H1Z6", count: 4, prefix: "NST/26/", from: 88, band: [46000, 210000] },
  { vendor: "Vishwa Electricals", gstin: "27AACCV8830K1ZR", count: 3, prefix: "VE-", from: 3401, band: [3200, 28000] },
  { vendor: "Coastal Freight Movers", gstin: "27AAECC2217B1ZT", count: 5, prefix: "CFM/2526/", from: 140, band: [12000, 96000] },
  { vendor: "Anupam Chemicals", gstin: "27AAFCA5563J1Z8", count: 2, prefix: "AC-", from: 771, band: [24000, 71000] },
  { vendor: "Sagar Plastics", gstin: "27AAKCS9048M1ZC", count: 4, prefix: "SGP/", from: 512, band: [8600, 44000] },
  { vendor: "Rajdhani Caterers", gstin: "27AAHFR3320N1ZE", count: 2, prefix: "RC/26/", from: 61, band: [6400, 19000] },
  { vendor: "Bharat Tools & Dies", gstin: "27AABCB7719P1ZA", count: 3, prefix: "BTD-", from: 1204, band: [15000, 88000] },
  { vendor: "Ecoline Waste Management", gstin: "27AAJCE4408G1ZV", count: 1, prefix: "EWM/", from: 219, band: [11000, 11000] },
  { vendor: "Pinnacle Safety Equipments", gstin: "27AADCP6672D1ZH", count: 2, prefix: "PSE-", from: 940, band: [7200, 34000] },
  { vendor: "Suraj Auto Works", gstin: "27AAGCS1194R1ZL", count: 3, prefix: "SAW/26/", from: 77, band: [2800, 26000] },
  { vendor: "Tejas Infotech Solutions", gstin: "29AAFCT8801E1Z2", count: 1, prefix: "TIS-", from: 460, band: [64000, 64000] },
  { vendor: "Gokul Dairy Supplies", gstin: "27AAECG5541F1ZQ", count: 4, prefix: "GDS/", from: 1180, band: [1900, 12400] },
  { vendor: "Hind Rubber Works", gstin: "27AABCH2276T1ZJ", count: 2, prefix: "HRW-", from: 338, band: [9400, 52000] },
  { vendor: "Sunrise Security Services", gstin: "27AAJCS7013W1ZY", count: 1, prefix: "SSS/26/", from: 44, band: [38000, 38000] },
]

const NEW_BILLS: IntakeBill[] = NEW_VENDORS.flatMap((v) => {
  const rand = rng(seedOf(v.vendor))
  const step = Math.max(1, Math.floor(27 / v.count))
  return Array.from({ length: v.count }, (_, i) => ({
    id: `n-${v.prefix}${i}`,
    vendor: v.vendor,
    patternId: null,
    invoiceNo: `${v.prefix}${v.from + i}`,
    date: `${1 + ((i * step + Math.floor(rand() * step)) % 27)} ${PERIOD.month} ${PERIOD.year}`,
    amount: Math.round((v.band[0] + rand() * (v.band[1] - v.band[0])) / 10) * 10,
    ledger: "—",
    gst: "intra" as const,
    lines: ["—"],
    gstin: v.gstin,
    file: `${v.prefix.toLowerCase().replace(/[^a-z]/g, "")}-${v.from + i}.pdf`,
    runId: "u1",
    seq: 0,
  }))
})

/** The month as it arrives: 217 documents — the volume P1's critical scenario
 *  is written against. 178 generated, 12 of them replaced by an exception, 2
 *  duplicate documents added on top, 37 from vendors with no precedent. */
export const INTAKE: IntakeBill[] = (() => {
  const replaced = new Set(EXCEPTIONS.map((e) => e.replaces).filter(Boolean))
  const strip = ({ replaces: _r, ...b }: Exception): IntakeBill => b
  return [
    ...GENERATED.filter((b) => !replaced.has(b.id)),
    ...EXCEPTIONS.map(strip),
    ...NEW_BILLS,
  ].map((b, i) => ({ ...b, seq: i }))
})()

/* ── the second pile ────────────────────────────────────────────
   A month rarely arrives in one drop. The client sends half on the 12th and
   the rest on the 19th; a new client sends everything at once, late. So a
   second upload landing BEFORE the first has been approved is the normal
   rhythm of crush week, not an edge case — and the interesting problems only
   exist across two piles:

     · the same vendor appears in both, so "approve Tata Power" has to mean
       the twelve bills the human was shown, not the vendor forever;
     · a bill in the second pile duplicates one still sitting unapproved in
       the first, which only a classifier reading BOTH piles can catch.

   Deliberately smaller and lopsided — a follow-up pile is a remainder, not
   another month. */

const PILE2_COUNTS: { pattern: string; count: number }[] = [
  { pattern: "p-krishna", count: 9 },
  { pattern: "p-tata", count: 5 },
  { pattern: "p-prime", count: 11 },
  { pattern: "p-meridian", count: 7 },
  { pattern: "p-shakti", count: 6 },
  { pattern: "p-deccan", count: 4 },
  { pattern: "p-bluedart", count: 5 },
  { pattern: "p-vertex", count: 3 },
  { pattern: "p-ganesh", count: 8 },
  { pattern: "p-office", count: 4 },
]

const PILE2_NEW: { vendor: string; gstin: string; count: number; prefix: string; from: number; band: [number, number] }[] = [
  { vendor: "Trimurti Engineering", gstin: "27AAGCT7781K1Z4", count: 4, prefix: "TE/26/", from: 210, band: [22000, 118000] },
  { vendor: "Konark Packaging", gstin: "27AABCK3390M1ZB", count: 3, prefix: "KP-", from: 664, band: [6400, 38000] },
  { vendor: "Silverline Housekeeping", gstin: "27AAECS5528R1ZP", count: 2, prefix: "SH/26/", from: 31, band: [14000, 22000] },
  { vendor: "Dhanraj Transport", gstin: "27AAFCD9142J1ZG", count: 5, prefix: "DT/2526/", from: 88, band: [9800, 74000] },
]

const INTAKE_2_RAW: IntakeBill[] = (() => {
  const routine = PILE2_COUNTS.flatMap(({ pattern, count }) => {
    const p = PATTERN_BY_ID.get(pattern)!
    // continue each series past whatever the first pile used
    return generate(p, "u2", p.perMonth + 40, count)
  })

  const fresh = PILE2_NEW.flatMap((v) => {
    const rand = rng(seedOf(v.vendor + "u2"))
    const step = Math.max(1, Math.floor(27 / v.count))
    return Array.from({ length: v.count }, (_, i) => ({
      id: `u2-n-${v.prefix}${i}`,
      vendor: v.vendor,
      patternId: null,
      invoiceNo: `${v.prefix}${v.from + i}`,
      date: `${1 + ((i * step + Math.floor(rand() * step)) % 27)} ${PERIOD.month} ${PERIOD.year}`,
      amount: Math.round((v.band[0] + rand() * (v.band[1] - v.band[0])) / 10) * 10,
      ledger: "—",
      gst: "intra" as const,
      lines: ["—"],
      gstin: v.gstin,
      file: `${v.prefix.toLowerCase().replace(/[^a-z]/g, "")}-${v.from + i}.pdf`,
      runId: "u2",
      seq: 0,
    }))
  })

  // the case that only exists across piles: the client re-sends a bill that
  // is already sitting in the first upload, unapproved. Same vendor, same
  // number, arrived later — and only a classifier reading both piles sees it
  const original = INTAKE.find((b) => b.patternId === "p-krishna")!
  const resent: IntakeBill = {
    ...original,
    id: "u2-resend-krishna",
    runId: "u2",
    file: original.file.replace(".pdf", "-copy.pdf"),
  }

  return [...routine, resent, ...fresh]
})()

/** The second upload, numbered on from the first so arrival order is global */
export const INTAKE_2: IntakeBill[] = INTAKE_2_RAW.map((b, i) => ({
  ...b,
  seq: INTAKE.length + i,
}))

export interface Pile {
  id: string
  label: string
  bills: IntakeBill[]
}

/** Every upload the fixture can serve, in order. A run consumes the next
 *  unread one. */
export const PILES: Pile[] = [
  { id: "u1", label: "First upload", bills: INTAKE },
  { id: "u2", label: "Second upload", bills: INTAKE_2 },
]

export const pileById = (id: string) => PILES.find((p) => p.id === id)

/** Everything read so far, as ONE set.
 *
 *  Classification has to span every open upload rather than run per pile:
 *  duplicate detection compares a bill against its neighbours, and a bill
 *  duplicating one in an earlier pile is exactly the case a per-pile pass
 *  cannot see. */
export function openIntake(readPiles: string[]): IntakeBill[] {
  return PILES.filter((p) => readPiles.includes(p.id))
    .flatMap((p) => p.bills)
    .sort((a, b) => a.seq - b.seq)
}

/* ── the classifier ─────────────────────────────────────────────
   Pure, and the only place a bill's stratum is decided. Every deviation it
   can name is a hard gate: a bill carrying one is never routine and can
   never be auto-posted, whatever the vendor's history says. */

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`
/** invoice numbers arrive punctuated inconsistently across scans */
const normalise = (s: string) => s.replace(/[\s/\-_.]/g, "").toUpperCase()

/** Bills already IN THE BOOKS, for the duplicate check. A bill still sitting
 *  in review is not booked — the Sundar fixture is the same document the
 *  cockpit is about to post, and calling it a duplicate of itself would be
 *  wrong. */
const BOOKED = new Map(
  BILLS.filter((b) => b.status !== "review").map((b) => [`${b.vendor}|${normalise(b.number)}`, b]),
)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Months between a bill's date and the posting period. Negative is earlier.
 *  Bills lag by design — the month's paper arrives through the following
 *  month — so one month back is normal and only a wider gap is worth a look. */
function monthsFromPeriod(date: string): number {
  const [, mon, yr] = date.split(" ")
  const m = MONTHS.indexOf(mon)
  if (m < 0) return 0
  return (Number(yr) - PERIOD.year) * 12 + (m - MONTHS.indexOf(PERIOD.month))
}

function deviationsFor(bill: IntakeBill, p: VendorPattern, intake: IntakeBill[]): Deviation[] {
  const out: Deviation[] = []

  // ── amount ──
  if (bill.amount > p.ceiling) {
    out.push({
      kind: "value-ceiling",
      label: "over value limit",
      reason: `${inr(bill.amount)} is above the ${inr(p.ceiling)} limit set for this vendor. Bills above the limit are never approved as a group.`,
    })
  } else if (bill.amount > p.band.max) {
    const x = (bill.amount / p.band.median).toFixed(1)
    out.push({
      kind: "amount-band",
      label: `${x}× usual amount`,
      reason: `${inr(bill.amount)} against a usual ${inr(p.band.min)}–${inr(p.band.max)} over ${p.monthsObserved} months — ${x}× the median.`,
    })
  } else if (bill.amount < p.band.min) {
    out.push({
      kind: "amount-band",
      label: "below usual amount",
      reason: `${inr(bill.amount)} is well below this vendor's usual ${inr(p.band.min)}–${inr(p.band.max)}.`,
    })
  }

  // ── coding ──
  const unseen = bill.lines.filter((l) => !p.lines.includes(l))
  if (unseen.length) {
    out.push({
      kind: "new-line",
      label: "new line item",
      reason: `"${unseen[0]}" has not appeared on this vendor's bills before — it needs a ledger.`,
    })
  }
  if (bill.gst !== p.gst) {
    out.push({
      kind: "gst-head",
      label: `GST → ${gstLabel(bill.gst)}`,
      reason: `Printed as ${gstLabel(bill.gst)}; the last ${p.monthsMatched} months were ${gstLabel(p.gst)}. Place of supply decides this, and getting it wrong is an ITC problem.`,
    })
  }
  if (!!bill.reverseCharge !== !!p.reverseCharge) {
    out.push({
      kind: "reverse-charge",
      label: "reverse charge",
      reason: bill.reverseCharge
        ? "Marked reverse charge; this vendor's bills have not been before. GST becomes payable by us."
        : "Not marked reverse charge, though this vendor's bills usually are.",
    })
  }

  // ── identity ──
  if (bill.gstin !== p.gstin) {
    out.push({
      kind: "gstin-changed",
      label: "GSTIN changed",
      reason: `GSTIN ${bill.gstin} differs from the ${p.gstin} we have posted against. Verify before claiming credit.`,
    })
  }

  // ── the same bill, twice ──
  const key = `${bill.vendor}|${normalise(bill.invoiceNo)}`
  const booked = BOOKED.get(key)
  if (booked) {
    out.push({
      kind: "duplicate",
      label: "already in the books",
      reason: `${bill.invoiceNo} is already recorded${booked.voucherNo ? ` as ${booked.voucherNo}` : ""}. Posting it again doubles the expense and the credit.`,
    })
  } else if (
    // ARRIVAL order decides which copy is the duplicate, never id order — the
    // first copy keeps its place in the queue and the one that turned up
    // afterwards is the one that stops, whether it came in the same upload or
    // a later one
    intake.some(
      (o) => o.id !== bill.id && `${o.vendor}|${normalise(o.invoiceNo)}` === key && o.seq < bill.seq,
    )
  ) {
    const earlier = intake.find(
      (o) => o.id !== bill.id && `${o.vendor}|${normalise(o.invoiceNo)}` === key && o.seq < bill.seq,
    )
    const sameUpload = earlier?.runId === bill.runId
    out.push({
      kind: "duplicate",
      label: sameUpload ? "duplicate in this upload" : "already in an earlier upload",
      reason: sameUpload
        ? `${bill.invoiceNo} appears twice in this upload — the same document was sent more than once.`
        : `${bill.invoiceNo} already came in on an earlier upload and is still waiting in the queue. Posting both would double the expense and the credit.`,
    })
  } else if (
    intake.some(
      (o) =>
        o.id !== bill.id &&
        o.vendor === bill.vendor &&
        o.amount === bill.amount &&
        o.date === bill.date &&
        o.seq < bill.seq,
    )
  ) {
    out.push({
      kind: "possible-duplicate",
      label: "possible duplicate",
      reason: `Another ${bill.vendor} bill for ${inr(bill.amount)} carries the same date under a different number.`,
    })
  }

  // ── cadence ──
  if (p.cadence === "monthly" && p.lastSeenMonthsAgo > 1) {
    out.push({
      kind: "cadence-gap",
      label: `back after ${p.lastSeenMonthsAgo} months`,
      reason: `This vendor billed monthly, then went quiet for ${p.lastSeenMonthsAgo} months. The first bill back is worth reading.`,
    })
  }

  // ── period ──
  const drift = monthsFromPeriod(bill.date)
  if (drift > 0 || drift < -1) {
    out.push({
      kind: "out-of-period",
      label: "outside the period",
      reason: `Dated ${bill.date}, ${drift > 0 ? "after" : `${Math.abs(drift)} months before`} ${PERIOD.label}. Check which period it belongs to before posting.`,
    })
  }

  return out
}

export function classify(bill: IntakeBill, intake: IntakeBill[]): Classified {
  const pattern = patternById(bill.patternId)
  if (!pattern) {
    return {
      bill,
      stratum: "new",
      deviations: [],
      reason: "No bill from this vendor has been posted before — there is no precedent to apply.",
    }
  }
  const deviations = deviationsFor(bill, pattern, intake)
  if (deviations.length) {
    return { bill, stratum: "changed", pattern, deviations, reason: deviations[0].reason }
  }
  return { bill, stratum: "routine", pattern, deviations, reason: precedentLine(pattern) }
}

/** Classify a set of documents against each other. Callers pass the OPEN set
 *  (see `openIntake`) rather than one pile — cross-upload duplicates are only
 *  visible to a pass that sees both. */
export function classifyIntake(intake: IntakeBill[]): Classified[] {
  return intake.map((b) => classify(b, intake))
}

/* ── grouping ───────────────────────────────────────────────────
   By vendor, splitting only where a vendor's patterns genuinely diverge.
   Grouping by pattern id does that on its own: one row per shape, and the
   label carries the shape name only when the vendor has more than one. */

export interface RoutineGroup {
  key: string
  vendor: string
  shape?: string
  /** "Airtel Business · Broadband" when split, plain vendor when not */
  label: string
  pattern: VendorPattern
  bills: IntakeBill[]
  total: number
  precedent: string
}

export function routineGroups(items: Classified[]): RoutineGroup[] {
  const by = new Map<string, Classified[]>()
  for (const c of items) {
    if (c.stratum !== "routine" || !c.pattern) continue
    const list = by.get(c.pattern.id)
    if (list) list.push(c)
    else by.set(c.pattern.id, [c])
  }
  const vendorShapes = new Map<string, number>()
  for (const id of by.keys()) {
    const v = PATTERN_BY_ID.get(id)!.vendor
    vendorShapes.set(v, (vendorShapes.get(v) ?? 0) + 1)
  }
  return [...by.entries()]
    .map(([id, cs]) => {
      const pattern = PATTERN_BY_ID.get(id)!
      const split = (vendorShapes.get(pattern.vendor) ?? 1) > 1
      return {
        key: id,
        vendor: pattern.vendor,
        shape: pattern.shape,
        label: split && pattern.shape ? `${pattern.vendor} · ${pattern.shape}` : pattern.vendor,
        pattern,
        bills: cs.map((c) => c.bill),
        total: cs.reduce((s, c) => s + c.bill.amount, 0),
        precedent: precedentLine(pattern),
      }
    })
    .sort((a, b) => b.bills.length - a.bills.length)
}

/* ── graduation ─────────────────────────────────────────────────
   §9.5: trust is granted in widening circles. Users stop checking their top
   vendors, then stop checking a category — privately, as habit. The product's
   job is to make that graduation EXPLICIT and reversible instead, so what a
   firm no longer reads is a decision on record rather than a drift nobody
   can point to.

   Graduation is offered, never assumed. It is opt-in per vendor, by a named
   human, and every gate still applies underneath it: a deviating bill is not
   routine, so an auto-posting vendor's odd bill still stops and waits. */

/** A pattern qualifies once its record is long AND unbroken. Tata Power's
 *  11-of-12 does not qualify: the whole claim is "nothing about this vendor
 *  surprises us", and one unexplained month is a surprise. */
export const AUTO_POST_MIN_MONTHS = 6

export function isAutomatable(p: VendorPattern): boolean {
  return p.monthsMatched >= AUTO_POST_MIN_MONTHS && p.monthsMatched === p.monthsObserved
}

/** the evidence line under the offer — history, not a score */
export function graduationEvidence(p: VendorPattern): string {
  return `Approved unchanged ${p.monthsMatched} months running · ${p.perMonth} bills a month`
}

/** Auto-posting with nobody looking is exactly how a pod rubber-stamps
 *  rubbish for a quarter before a client notices (P5's stated critical pain).
 *  One bill in SAMPLE_RATE is pulled back out for a human to attest.
 *  Deterministic per bill id, so the sample does not reshuffle on re-render
 *  and the same month always samples the same bills. */
export const SAMPLE_RATE = 12

export function isSampled(bill: IntakeBill): boolean {
  return seedOf(bill.id) % SAMPLE_RATE === 0
}

/** What the operator handled by hand last month — the baseline the shrink
 *  stat reads against. A fixture: the prototype has one month of intake. */
export const LAST_MONTH_HAND_APPROVED = 217

/** every routine bill belonging to an auto-posting pattern */
export function autoPostedBills(autoKeys: Set<string>, items: Classified[]) {
  return items
    .filter((c) => c.stratum === "routine" && c.pattern && autoKeys.has(c.pattern.id))
    .map((c) => c.bill)
}

/* ── approved bills, as books rows ──────────────────────────────
   Approving a group RECORDS its bills to the books; it does not send them
   anywhere. They land in All bills as pending sync, exactly like a confirmed
   review item, and the sync run is still a separate, explicit act. That gap
   is what makes the batch undoable — §9.3: users forgive a mistake in our
   staging area and never forgive one written into their Tally file. */

/** the next free number in the AP voucher series, given what is already booked */
export function nextVoucherSeq(existing: { voucherNo?: string }[]): number {
  let max = 0
  for (const r of existing) {
    const m = /^AP\/(\d+)\//.exec(r.voucherNo ?? "")
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

export function approvedBooksRows(
  /** the BILL ids a human approved — not pattern keys. Approving twelve Tata
   *  Power bills settles twelve documents, and three more arriving on a later
   *  upload are a new decision, not a consequence of the old one. */
  billIds: Set<string>,
  existing: BillRow[],
  items: Classified[],
  /** of those, the ones that got there without a keystroke — tagged in All
   *  bills so "what did nobody look at?" is answerable at a glance */
  autoKeys: Set<string> = new Set(),
): BillRow[] {
  if (!billIds.size && !autoKeys.size) return []
  let seq = nextVoucherSeq(existing)
  return items
    .filter(
      (c) =>
        c.stratum === "routine" &&
        c.pattern &&
        (billIds.has(c.bill.id) || autoKeys.has(c.pattern.id)),
    )
    .map((c) => {
      const b = c.bill
      return {
        id: `apr-${b.id}`,
        vendor: b.vendor,
        number: b.invoiceNo,
        date: b.date,
        // routine bills carry their vendor's usual terms; the prototype books
        // them a month out, which is what the existing fixtures do
        due: b.date.replace(PERIOD.month, "Jul"),
        amount: b.amount,
        status: "posted" as const,
        fresh: true,
        voucherNo: `AP/${String(seq++).padStart(3, "0")}/25-26`,
        voucherDate: `1 Jul ${PERIOD.year}`,
        billFile: b.file,
        tallySync: "pending" as const,
        gstin: b.gstin,
        description: `${c.pattern!.ledger} — ${PERIOD.label}`,
        reverseCharge: !!b.reverseCharge,
        autoPosted: autoKeys.has(c.pattern!.id),
      }
    })
}

/* ── the month at a glance ──────────────────────────────────── */

export interface IntakeSummary {
  total: number
  routine: { bills: number; groups: number; vendors: number; value: number }
  changed: { bills: number; value: number }
  new: { bills: number; vendors: number; value: number }
}

export function intakeSummary(items: Classified[]): IntakeSummary {
  const of = (s: Stratum) => items.filter((c) => c.stratum === s)
  const value = (cs: Classified[]) => cs.reduce((n, c) => n + c.bill.amount, 0)
  const routine = of("routine")
  const changed = of("changed")
  const fresh = of("new")
  const groups = routineGroups(items)
  return {
    total: items.length,
    routine: {
      bills: routine.length,
      groups: groups.length,
      vendors: new Set(groups.map((g) => g.vendor)).size,
      value: value(routine),
    },
    changed: { bills: changed.length, value: value(changed) },
    new: {
      bills: fresh.length,
      vendors: new Set(fresh.map((c) => c.bill.vendor)).size,
      value: value(fresh),
    },
  }
}
