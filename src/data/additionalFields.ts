/** The optional "tail" Tally writes into a voucher's Party Details sub-panels —
 *  modelled as config-driven additional fields, default OFF per voucher type.
 *  Kept in its own namespace so the closed six-fact `FactKey` machinery in
 *  invoice.ts is untouched; the Enter-chain, commit-gate and posting preview
 *  iterate over BOTH core facts and these. */

import { GRAND_TOTAL, STATES } from "./invoice"

/* ── voucher types ──────────────────────────────────────────────── */
export type VoucherType = "purchase" | "sales" | "payment" | "receipt" | "journal"

export const VOUCHER_TYPES: { key: VoucherType; label: string }[] = [
  { key: "purchase", label: "Purchase / AP" },
  { key: "sales", label: "Sales / AR" },
  { key: "payment", label: "Payment" },
  { key: "receipt", label: "Receipt" },
  { key: "journal", label: "Journal" },
]

/* ── Tally's Party Details sub-panels ───────────────────────────────
   The grouping mirrors Tally exactly: Receipt / Order / Import Details,
   plus a statutory & cost catch-all for the fields Tally hangs off the
   voucher rather than a sub-panel. */
export type AdditionalGroup = "receipt" | "order" | "import" | "plus"

export const GROUP_LABEL: Record<AdditionalGroup, string> = {
  receipt: "Receipt Details",
  order: "Order Details",
  import: "Import Details",
  plus: "Statutory & Cost",
}
export const GROUP_ORDER: AdditionalGroup[] = ["receipt", "order", "import", "plus"]

export type AdditionalFieldKey =
  // Receipt Details
  | "receiptNoteNo"
  | "receiptDocNo"
  | "dispatchedThrough"
  | "destination"
  | "carrierName"
  | "billOfLadingLrRrNo"
  | "billOfLadingDate"
  // Order Details
  | "modeTermsOfPayment"
  | "otherReferences"
  | "termsOfDelivery"
  // Import Details
  | "placeOfReceiptByShipper"
  | "vesselFlightNo"
  | "portOfLoading"
  | "portOfDischarge"
  | "countryTo"
  | "billOfEntryNo"
  | "billOfEntryDate"
  | "portCode"
  // Statutory & Cost
  | "costCentre"
  | "eWayBillNo"
  | "eInvoiceIrn"

export interface AdditionalFieldDef {
  key: AdditionalFieldKey
  label: string
  group: AdditionalGroup
  /** an inferable off-document value (vendor history / master / prior bills).
   *  When present the field prefills and is marked `doubt` — a cheap one-key
   *  accept/override. Absent → the field is empty until typed. */
  infer?: { value: string; basis: string }
}

/** Ordered catalog — display order within a group mirrors Tally's sub-panel. */
export const ADDITIONAL_FIELDS: AdditionalFieldDef[] = [
  // ── Receipt Details ──
  { key: "receiptNoteNo", label: "Receipt Note No.", group: "receipt" },
  { key: "receiptDocNo", label: "Receipt Doc No.", group: "receipt" },
  {
    key: "dispatchedThrough",
    label: "Dispatched through",
    group: "receipt",
    infer: { value: "VRL Logistics (road)", basis: "This vendor's last 3 bills all dispatched via VRL Logistics." },
  },
  { key: "destination", label: "Destination", group: "receipt" },
  { key: "carrierName", label: "Carrier name / agent", group: "receipt" },
  { key: "billOfLadingLrRrNo", label: "Bill of Lading / LR-RR No.", group: "receipt" },
  { key: "billOfLadingDate", label: "LR / RR date", group: "receipt" },
  // ── Order Details ──
  {
    key: "modeTermsOfPayment",
    label: "Mode / terms of payment",
    group: "order",
    infer: { value: "30 days net", basis: "Vendor master default payment terms for Sundar Logistics." },
  },
  { key: "otherReferences", label: "Other references", group: "order" },
  { key: "termsOfDelivery", label: "Terms of delivery", group: "order" },
  // ── Import Details ──
  { key: "placeOfReceiptByShipper", label: "Place of receipt by shipper", group: "import" },
  { key: "vesselFlightNo", label: "Vessel / flight no.", group: "import" },
  { key: "portOfLoading", label: "Port of loading", group: "import" },
  { key: "portOfDischarge", label: "Port of discharge", group: "import" },
  { key: "countryTo", label: "Country to", group: "import" },
  { key: "billOfEntryNo", label: "Bill of entry no.", group: "import" },
  { key: "billOfEntryDate", label: "Bill of entry date", group: "import" },
  { key: "portCode", label: "Port code", group: "import" },
  // ── Statutory & Cost ──
  // no prefill — an org that mandates cost allocation must pick one; empty +
  // required → needsInput (blocks), empty + optional → optionalEmpty (quiet)
  { key: "costCentre", label: "Cost centre", group: "plus" },
  { key: "eWayBillNo", label: "e-Way Bill no.", group: "plus" },
  { key: "eInvoiceIrn", label: "e-Invoice IRN", group: "plus" },
]

export const ADDITIONAL_FIELD_MAP: Record<AdditionalFieldKey, AdditionalFieldDef> =
  Object.fromEntries(ADDITIONAL_FIELDS.map((f) => [f.key, f])) as Record<
    AdditionalFieldKey,
    AdditionalFieldDef
  >

export const ALL_ADDITIONAL_KEYS: AdditionalFieldKey[] = ADDITIONAL_FIELDS.map((f) => f.key)

/* ── config: which fields are enabled per voucher type (all OFF by default) ── */
export type VoucherFieldConfig = Record<VoucherType, Partial<Record<AdditionalFieldKey, boolean>>>

/** the Purchase/AP demo seed — a realistic subset ON so the tail shows every
 *  status: a prefilled dispatch + payment terms (cheap doubts), an empty
 *  required cost centre (needsInput — blocks), and an empty optional LR/RR
 *  number (optionalEmpty — "won't write"). */
export const PURCHASE_SEED_ON: AdditionalFieldKey[] = [
  "costCentre",
  "dispatchedThrough",
  "billOfLadingLrRrNo",
  "modeTermsOfPayment",
]

export function seedVoucherFieldConfig(): VoucherFieldConfig {
  const empty = (): Partial<Record<AdditionalFieldKey, boolean>> => ({})
  const cfg: VoucherFieldConfig = {
    purchase: empty(),
    sales: empty(),
    payment: empty(),
    receipt: empty(),
    journal: empty(),
  }
  for (const k of PURCHASE_SEED_ON) cfg.purchase[k] = true
  return cfg
}

/** enabled keys for a voucher type, in catalog order */
export function enabledKeys(cfg: VoucherFieldConfig, vt: VoucherType): AdditionalFieldKey[] {
  return ALL_ADDITIONAL_KEYS.filter((k) => cfg[vt]?.[k])
}

/* ── requiredness: enabled ≠ required ───────────────────────────────
   Requiredness is computed from voucher type + GST config + company flags,
   independently of whether the field is enabled. */
export interface RequiredCtx {
  voucherType: VoucherType
  /** registered-to-registered supply → e-invoice / e-way rules apply */
  b2b: boolean
  amount: number
  /** company flag — cost allocation is mandatory for this org */
  costAllocationMandatory: boolean
  /** place-of-supply rule: supplier and place of supply in different states */
  interState: boolean
  /** an import voucher — bill of entry / port fields become mandatory */
  isImport: boolean
}

/** B2B e-invoice becomes mandatory at/above this invoice value (demo constant). */
export const EINVOICE_THRESHOLD = 50000
/** inter-state movement at/above this value needs an e-way bill (demo constant). */
export const EWAY_THRESHOLD = 50000

export function deriveRequired(key: AdditionalFieldKey, ctx: RequiredCtx): boolean {
  switch (key) {
    case "eInvoiceIrn":
      // B2B and over the e-invoice threshold
      return ctx.b2b && ctx.amount >= EINVOICE_THRESHOLD
    case "costCentre":
      // company flag makes cost allocation mandatory
      return ctx.costAllocationMandatory
    case "eWayBillNo":
      // place-of-supply rule: inter-state movement over the e-way threshold
      return ctx.interState && ctx.amount >= EWAY_THRESHOLD
    case "billOfEntryNo":
    case "billOfEntryDate":
    case "portCode":
      // import voucher — customs fields are mandatory
      return ctx.isImport
    default:
      return false
  }
}

/** the fixed place-of-supply verdict for the Sundar fixture (29 ≠ 27). */
export const FIXTURE_INTER_STATE = (STATES.supplier.code as string) !== STATES.recipient.code

/** the requiredness context for the Sundar walkthrough, given company flags. */
export function fixtureRequiredCtx(costAllocationMandatory: boolean): RequiredCtx {
  return {
    voucherType: "purchase",
    b2b: true, // Sundar is registered → B2B
    amount: GRAND_TOTAL,
    costAllocationMandatory,
    interState: FIXTURE_INTER_STATE,
    isImport: false,
  }
}
