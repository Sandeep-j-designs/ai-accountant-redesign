/** The companies (Tally books) this login can act on.
 *
 *  Switching companies changes which set of books the sync pushes to. Each
 *  company carries its OWN sync state — see CompanySync in state/store — so a
 *  run started in one keeps running while the operator works in another. That
 *  is the whole point: a 200-voucher push to Acme should not be hostage to
 *  staying on Acme's screen.
 *
 *  The DOCUMENT fixtures are deliberately shared: every company lists the same
 *  bills. Only the sync state is per-company. Splitting the documents too would
 *  mean per-company copies of invoice.ts / review.ts / patterns.ts, and the
 *  cockpit walkthrough is scripted against the single Acme set. */
export interface Company {
  id: string
  name: string
  /** monogram shown in the switcher and the settings list */
  short: string
  gstin: string
  place: string
  /** seeded "last synced" stamp — a fresh session should not read as
   *  never-synced, which would be its own (false) signal */
  lastSync: string
}

export const COMPANIES: Company[] = [
  {
    id: "acme",
    name: "Acme Industries",
    short: "A",
    gstin: "27ABCDE1234F1Z5",
    place: "Maharashtra",
    lastSync: "28 Jun, 9:32 PM",
  },
  {
    id: "northwind",
    name: "Northwind Traders",
    short: "N",
    gstin: "29AACCN1234M1Z8",
    place: "Karnataka",
    lastSync: "27 Jun, 6:04 PM",
  },
  {
    id: "vertex",
    name: "Vertex Logistics",
    short: "V",
    gstin: "33AABCV5678K1Z2",
    place: "Tamil Nadu",
    lastSync: "26 Jun, 11:18 AM",
  },
]

export const DEFAULT_COMPANY_ID = "acme"

/** never returns undefined — an unknown id falls back to the first book rather
 *  than blanking the switcher */
export function companyById(id: string): Company {
  return COMPANIES.find((c) => c.id === id) ?? COMPANIES[0]
}
