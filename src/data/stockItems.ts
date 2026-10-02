/* ── Inventory — the stock-item master ─────────────────────────
   Tally's shape: stock groups → stock items, each item held in one or
   more godowns, valued at weighted-average cost. Quantities are in the
   item's base unit; a bill billed in another unit needs a conversion,
   which is one of the things the AI stops to ask about.

   The packaging items are what Reliable Packaging Co bills for, so the
   purchase that sits in the Bills register is the same stock that
   shows up here.
   ───────────────────────────────────────────────────────────── */

import type { MasterSync } from "@/data/ledgers"

export const STOCK_GROUPS = [
  { id: "raw", name: "Raw Materials" },
  { id: "packaging", name: "Packaging Materials" },
  { id: "finished", name: "Finished Goods" },
  { id: "consumables", name: "Consumables" },
  { id: "it", name: "IT Equipment" },
] as const
export type StockGroupId = (typeof STOCK_GROUPS)[number]["id"]
export const stockGroupName = (id: string) => STOCK_GROUPS.find((g) => g.id === id)?.name ?? id

export const GODOWNS = ["Main Location", "Bhiwandi Warehouse", "Chennai Depot"] as const
export type Godown = (typeof GODOWNS)[number]

export interface StockItem {
  id: string
  name: string
  sku: string
  group: StockGroupId
  unit: string
  hsn: string
  gstRate: number
  /** weighted-average cost per unit */
  rate: number
  /** quantity held, per godown */
  holdings: Partial<Record<Godown, number>>
  /** reorder level, in base units — 0 means not tracked */
  reorder: number
  lastMovement?: string
  sync: MasterSync
  syncNote?: string
  source: "tally" | "user" | "ai"
  sourceBill?: string
}

const S = (s: Omit<StockItem, "sync" | "source"> & Partial<Pick<StockItem, "sync" | "source">>): StockItem => ({
  sync: "synced",
  source: "tally",
  ...s,
})

export const STOCK_ITEMS: StockItem[] = [
  // raw materials
  S({ id: "s-pp-granules", name: "PP Granules — Natural", sku: "RM-PP-001", group: "raw", unit: "Kg", hsn: "3902", gstRate: 18, rate: 118.5, holdings: { "Main Location": 1850, "Bhiwandi Warehouse": 2400 }, reorder: 2000, lastMovement: "27 Jun 2026" }),
  S({ id: "s-hdpe", name: "HDPE Granules — Black", sku: "RM-HD-004", group: "raw", unit: "Kg", hsn: "3901", gstRate: 18, rate: 104.2, holdings: { "Main Location": 620 }, reorder: 1000, lastMovement: "21 Jun 2026" }),
  S({ id: "s-masterbatch", name: "Colour Masterbatch — Blue", sku: "RM-MB-012", group: "raw", unit: "Kg", hsn: "3206", gstRate: 18, rate: 342, holdings: { "Main Location": 85 }, reorder: 60, lastMovement: "14 Jun 2026" }),
  S({ id: "s-ss-sheet", name: "SS 304 Sheet 1.2mm", sku: "RM-SS-120", group: "raw", unit: "Kg", hsn: "7219", gstRate: 18, rate: 238, holdings: { "Chennai Depot": 410 }, reorder: 300, lastMovement: "2 Jun 2026", sync: "pending" }),
  S({ id: "s-adhesive", name: "Hot-melt Adhesive", sku: "RM-AD-003", group: "raw", unit: "Kg", hsn: "3506", gstRate: 18, rate: 186, holdings: { "Main Location": 0 }, reorder: 50, lastMovement: "29 May 2026" }),

  // packaging — what Reliable Packaging Co bills for
  S({ id: "s-box-3ply", name: "Corrugated Box 3-ply 12×10×8", sku: "PK-CB-3P", group: "packaging", unit: "Nos", hsn: "4819", gstRate: 18, rate: 18.4, holdings: { "Main Location": 1200, "Bhiwandi Warehouse": 800 }, reorder: 1500, lastMovement: "2 Jun 2026" }),
  S({ id: "s-box-5ply", name: "Corrugated Box 5-ply 18×12×10", sku: "PK-CB-5P", group: "packaging", unit: "Nos", hsn: "4819", gstRate: 18, rate: 31.2, holdings: { "Main Location": 140 }, reorder: 500, lastMovement: "2 Jun 2026" }),
  S({ id: "s-bopp", name: "BOPP Tape 48mm × 65m", sku: "PK-TP-48", group: "packaging", unit: "Roll", hsn: "3919", gstRate: 18, rate: 42, holdings: { "Main Location": 360, "Chennai Depot": 96 }, reorder: 200, lastMovement: "14 Jun 2026" }),
  S({ id: "s-stretch", name: "Stretch Film 23 micron", sku: "PK-SF-23", group: "packaging", unit: "Roll", hsn: "3920", gstRate: 18, rate: 465, holdings: { "Bhiwandi Warehouse": 18 }, reorder: 25, lastMovement: "6 Jun 2026" }),
  S({ id: "s-bubble", name: "Bubble Wrap Roll 1m", sku: "PK-BW-1M", group: "packaging", unit: "Roll", hsn: "3920", gstRate: 18, rate: 610, holdings: { "Main Location": 24 }, reorder: 10, lastMovement: "21 May 2026" }),
  S({ id: "s-label", name: "Thermal Labels 100×150", sku: "PK-LB-100", group: "packaging", unit: "Roll", hsn: "4821", gstRate: 12, rate: 248, holdings: { "Main Location": 52, "Bhiwandi Warehouse": 30 }, reorder: 40, lastMovement: "27 Jun 2026" }),

  // finished goods
  S({ id: "s-fg-crate", name: "Storage Crate 40L — Blue", sku: "FG-CR-40B", group: "finished", unit: "Nos", hsn: "3923", gstRate: 18, rate: 286, holdings: { "Main Location": 640, "Bhiwandi Warehouse": 1120, "Chennai Depot": 380 }, reorder: 800, lastMovement: "28 Jun 2026" }),
  S({ id: "s-fg-crate-g", name: "Storage Crate 40L — Grey", sku: "FG-CR-40G", group: "finished", unit: "Nos", hsn: "3923", gstRate: 18, rate: 286, holdings: { "Bhiwandi Warehouse": 410 }, reorder: 500, lastMovement: "21 Jun 2026" }),
  S({ id: "s-fg-bin", name: "Dustbin 60L with Pedal", sku: "FG-DB-60", group: "finished", unit: "Nos", hsn: "3924", gstRate: 18, rate: 742, holdings: { "Main Location": 215, "Chennai Depot": 96 }, reorder: 150, lastMovement: "27 Jun 2026" }),
  S({ id: "s-fg-tray", name: "Industrial Tray 600×400", sku: "FG-TR-64", group: "finished", unit: "Nos", hsn: "3926", gstRate: 18, rate: 512, holdings: { "Bhiwandi Warehouse": 1320 }, reorder: 400, lastMovement: "12 Jun 2026", sync: "failed", syncNote: "HSN 3926 needs 8 digits for this turnover" }),
  S({ id: "s-fg-stool", name: "Moulded Stool — Red", sku: "FG-ST-R", group: "finished", unit: "Nos", hsn: "9403", gstRate: 18, rate: 198, holdings: { "Main Location": 0 }, reorder: 0, lastMovement: "3 Apr 2026" }),

  // consumables
  S({ id: "s-gloves", name: "Nitrile Gloves (box of 100)", sku: "CN-GL-100", group: "consumables", unit: "Box", hsn: "4015", gstRate: 12, rate: 365, holdings: { "Main Location": 22 }, reorder: 15, lastMovement: "6 Jun 2026" }),
  S({ id: "s-lube", name: "Mould Release Spray", sku: "CN-MR-500", group: "consumables", unit: "Nos", hsn: "3403", gstRate: 18, rate: 289, holdings: { "Main Location": 9 }, reorder: 20, lastMovement: "14 Jun 2026" }),
  S({ id: "s-a4", name: "A4 Copier Paper 75gsm", sku: "CN-PP-A4", group: "consumables", unit: "Ream", hsn: "4802", gstRate: 12, rate: 268, holdings: { "Main Location": 34 }, reorder: 20, lastMovement: "29 May 2026" }),

  // IT equipment
  S({ id: "s-laptop", name: "Dell Latitude 5440", sku: "IT-LT-5440", group: "it", unit: "Nos", hsn: "8471", gstRate: 18, rate: 68400, holdings: { "Main Location": 3 }, reorder: 0, lastMovement: "18 Apr 2026" }),
  S({ id: "s-monitor", name: "LG 24\" IPS Monitor", sku: "IT-MN-24", group: "it", unit: "Nos", hsn: "8528", gstRate: 18, rate: 9850, holdings: { "Main Location": 5 }, reorder: 0, lastMovement: "18 Apr 2026" }),
  S({ id: "s-scanner", name: "Zebra Barcode Scanner DS2208", sku: "IT-SC-2208", group: "it", unit: "Nos", hsn: "8471", gstRate: 18, rate: 7420, holdings: { "Bhiwandi Warehouse": 2 }, reorder: 0, lastMovement: "24 Apr 2026", source: "ai", sourceBill: "ZB/IN/26/0711", sync: "pending" }),
]

export const qtyOf = (s: StockItem) => Object.values(s.holdings).reduce((n, q) => n + (q ?? 0), 0)
export const valueOf = (s: StockItem) => qtyOf(s) * s.rate
export const isLow = (s: StockItem) => s.reorder > 0 && qtyOf(s) < s.reorder

/* ── Needs review — lines read off bills the AI couldn't place ──
   • new    — no stock item looks like it: create one
   • match  — one item probably is it: confirm the mapping
   • unit   — billed in a different unit than it's stocked in: set a conversion
   • hsn    — the bill's HSN disagrees with the master's
   ───────────────────────────────────────────────────────────── */

export type StockReviewKind = "new" | "match" | "unit" | "hsn"

export const STOCK_REVIEW_LABEL: Record<StockReviewKind, string> = {
  new: "New items",
  match: "Probable matches",
  unit: "Unit mismatch",
  hsn: "HSN mismatch",
}

export interface StockReview {
  id: string
  kind: StockReviewKind
  /** the line exactly as it reads on the bill */
  billLine: string
  vendor: string
  billNo: string
  qty: string
  amount: number
  reason: string
  chip: string
  action: string
  /** the existing item it maps to, for match / unit / hsn */
  itemId?: string
  /** the item it becomes once accepted, for "new" */
  creates?: StockItem
}

export const STOCK_REVIEWS: StockReview[] = [
  {
    id: "sr-pallet",
    kind: "new",
    billLine: "HDPE Pallet 1200×1000 4-way",
    vendor: "Reliable Packaging Co",
    billNo: "RPC/0626/118",
    qty: "40 Nos",
    amount: 98400,
    reason: "Nothing in the stock master looks like a pallet. Suggested group: Packaging Materials.",
    chip: "New item",
    action: "Create item",
    creates: S({ id: "s-pallet", name: "HDPE Pallet 1200×1000", sku: "PK-PL-1210", group: "packaging", unit: "Nos", hsn: "3923", gstRate: 18, rate: 2460, holdings: { "Bhiwandi Warehouse": 40 }, reorder: 0, lastMovement: "24 Jun 2026", source: "ai", sourceBill: "RPC/0626/118", sync: "pending" }),
  },
  {
    id: "sr-ink",
    kind: "new",
    billLine: "Inkjet coding ink — black 500ml",
    vendor: "Office Mart Supplies",
    billNo: "OMS/26/2291",
    qty: "6 Nos",
    amount: 7260,
    reason: "Printer ink for the batch coder. Booked as office supplies until now, but the line consumes it.",
    chip: "New item",
    action: "Create item",
    creates: S({ id: "s-ink", name: "Coding Ink Black 500ml", sku: "CN-IK-500", group: "consumables", unit: "Nos", hsn: "3215", gstRate: 18, rate: 1210, holdings: { "Main Location": 6 }, reorder: 4, lastMovement: "22 Jun 2026", source: "ai", sourceBill: "OMS/26/2291", sync: "pending" }),
  },
  {
    id: "sr-tape",
    kind: "match",
    billLine: "Brown tape 2in x 65mtr",
    vendor: "Reliable Packaging Co",
    billNo: "RPC/0626/118",
    qty: "120 Roll",
    amount: 5040,
    reason: "2 in ≈ 48 mm, same length and rate as last month. Almost certainly BOPP Tape 48mm × 65m.",
    chip: "96% match",
    action: "Map to item",
    itemId: "s-bopp",
  },
  {
    id: "sr-granules",
    kind: "match",
    billLine: "Polypropylene homopolymer H110MA",
    vendor: "Sundar Logistics Pvt Ltd",
    billNo: "SLPL/2526/0502",
    qty: "1,000 Kg",
    amount: 118500,
    reason: "H110MA is a natural PP grade, and the rate matches PP Granules — Natural.",
    chip: "88% match",
    action: "Map to item",
    itemId: "s-pp-granules",
  },
  {
    id: "sr-box-unit",
    kind: "unit",
    billLine: "5 ply box 18x12x10 (bundle of 25)",
    vendor: "Reliable Packaging Co",
    billNo: "RPC/0626/118",
    qty: "20 Bundle",
    amount: 15600,
    reason: "Billed in bundles, stocked in Nos. Set 1 Bundle = 25 Nos so 20 bundles become 500 boxes.",
    chip: "Bundle → Nos",
    action: "Set 1 = 25",
    itemId: "s-box-5ply",
  },
  {
    id: "sr-tray-hsn",
    kind: "hsn",
    billLine: "Industrial tray 600x400",
    vendor: "Nova Retail Pvt Ltd",
    billNo: "NR/RET/0193",
    qty: "60 Nos",
    amount: 30720,
    reason: "The bill says HSN 39269099 but the master has 3926. The 8-digit code is also why this item's sync is failing.",
    chip: "39269099",
    action: "Update HSN",
    itemId: "s-fg-tray",
  },
]

/* ── stock movements — the trail behind a quantity ───────────── */

export interface StockMovement {
  date: string
  voucherNo: string
  type: "Purchase" | "Sales" | "Stock Journal" | "Delivery Note" | "Receipt Note"
  party: string
  godown: Godown
  inQty: number
  outQty: number
}

const MOVE_DAYS = ["28 Jun 2026", "24 Jun 2026", "21 Jun 2026", "14 Jun 2026", "6 Jun 2026", "2 Jun 2026", "29 May 2026", "20 May 2026"]

/** recent movements, newest first — stable per item, and consistent with the
 *  item's group (raw and packaging come in on purchases and leave on stock
 *  journals; finished goods come in from production and leave on sales) */
export function stockMovements(s: StockItem): StockMovement[] {
  if (!s.lastMovement) return []
  let h = 0
  for (const c of s.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296)
  const godowns = (Object.keys(s.holdings) as Godown[]).filter(Boolean)
  const base = Math.max(1, Math.round((qtyOf(s) || s.reorder || 10) / 3))
  const start = Math.max(0, MOVE_DAYS.indexOf(s.lastMovement))
  const fg = s.group === "finished"
  const parties = fg
    ? ["Nova Retail Pvt Ltd", "Greenleaf Foods LLP", "Zenith Hardware Stores"]
    : s.group === "packaging"
      ? ["Reliable Packaging Co"]
      : s.group === "it"
        ? ["Dell India — Direct"]
        : ["Sundar Logistics Pvt Ltd", "Polymer Traders"]
  const n = s.group === "it" ? 1 : 5
  return Array.from({ length: n }, (_, i) => {
    const inward = fg ? i % 3 === 2 : i % 2 === 0
    const q = Math.max(1, Math.round(base * (0.5 + rnd())))
    return {
      date: MOVE_DAYS[Math.min(MOVE_DAYS.length - 1, start + i)],
      voucherNo: inward
        ? fg ? `SJ/${String(60 - i * 3).padStart(3, "0")}/26-27` : `PI/${String(118 - i * 6).padStart(3, "0")}/26-27`
        : fg ? `SI/${String(240 - i * 9).padStart(3, "0")}/26-27` : `SJ/${String(60 - i * 3).padStart(3, "0")}/26-27`,
      type: inward ? (fg ? "Stock Journal" : "Purchase") : fg ? "Sales" : "Stock Journal",
      party: inward ? (fg ? "Production — Line 2" : parties[i % parties.length]) : fg ? parties[i % parties.length] : "Consumed — Line 2",
      godown: godowns[i % godowns.length] ?? "Main Location",
      inQty: inward ? q : 0,
      outQty: inward ? 0 : q,
    }
  })
}

/** the stock master as it stands after this session's review decisions */
export function effectiveStock(resolved: Record<string, "accepted" | "dismissed">): StockItem[] {
  let out = STOCK_ITEMS.map((s) => ({ ...s, holdings: { ...s.holdings } }))
  const bump = (id: string, qty: number, patch: Partial<StockItem> = {}) =>
    (out = out.map((s) => {
      if (s.id !== id) return s
      const g = (Object.keys(s.holdings)[0] as Godown | undefined) ?? "Main Location"
      return { ...s, ...patch, holdings: { ...s.holdings, [g]: (s.holdings[g] ?? 0) + qty }, lastMovement: "28 Jun 2026" }
    }))
  for (const r of STOCK_REVIEWS.filter((x) => resolved[x.id] === "accepted")) {
    const qty = Number(r.qty.replace(/[^\d.]/g, "")) || 0
    if (r.kind === "new" && r.creates) out.push({ ...r.creates, holdings: { ...r.creates.holdings } })
    if (r.kind === "match" && r.itemId) bump(r.itemId, qty)
    if (r.kind === "unit" && r.itemId) bump(r.itemId, qty * 25)
    if (r.kind === "hsn" && r.itemId)
      out = out.map((s) => (s.id === r.itemId ? { ...s, hsn: r.chip, sync: "pending", syncNote: undefined } : s))
  }
  return out
}
