/** Indian digit grouping for an integer string: "184080" → "1,84,080". */
export function groupIndianInt(intPart: string): string {
  let last3 = intPart.slice(-3)
  let rest = intPart.slice(0, -3)
  if (rest) {
    last3 = "," + last3
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  }
  return rest + last3
}

/** Format a number as Indian-grouped rupees, e.g. 184080 → ₹1,84,080.00 */
export function fmtINR(n: number): string {
  const neg = n < 0
  const abs = Math.abs(n)
  const [intPart, decPart] = abs.toFixed(2).split(".")
  return `${neg ? "-" : ""}₹${groupIndianInt(intPart)}.${decPart}`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Fixed "today" for the prototype so relative dates stay deterministic. */
export const TODAY = new Date(2026, 6, 1)

/** Parse a "6 Jun 2026" bill date into a Date. */
export function parseBillDate(s: string): Date {
  const [d, mon, y] = s.split(" ")
  return new Date(Number(y), Math.max(0, MONTHS.indexOf(mon)), Number(d))
}

/** Whole days from TODAY to a bill's due date (negative = overdue). */
export function dueInDays(due: string): number {
  return Math.round((parseBillDate(due).getTime() - TODAY.getTime()) / 86400000)
}

/** Relative time from a past epoch-ms to now: "just now", "3 min ago", "2 h ago". */
export function relTime(at: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 20) return "just now"
  if (s < 60) return `${s} sec ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** Format a Date as "4 Feb 2026, 9:32 PM" (FinOps timestamp style). */
export function stampNow(d: Date = new Date()): string {
  const mon = d.toLocaleString("en-US", { month: "short" })
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, "0")
  const ap = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${d.getDate()} ${mon} ${d.getFullYear()}, ${h}:${m} ${ap}`
}
