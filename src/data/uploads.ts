/** Upload history — one record per RUN, not per document.
 *
 *  This follows the decision already taken for sync history (Decisions,
 *  2026-08-11, "Sync history lists rows by sync run, not by item"): the run is
 *  the unit of the user's action, flattening to items reintroduces a row-count
 *  problem at scale (a 217-document upload becomes 217 rows for one drop), and
 *  run-level state has no per-item equivalent — "partially read" describes the
 *  job, not any single bill.
 *
 *  Per-document status therefore lives where that decision put it:
 *    1. in the module's own table — Needs review and All bills already carry
 *       each bill's state in context;
 *    2. inside a run's detail view, reached by drilling into a history row.
 */

import { CURRENT_USER } from "@/data/invoice"
import type { Stratum } from "@/data/patterns"

export interface UploadRun {
  id: string
  /** epoch ms the run started */
  at: number
  by: string
  /** which fixture pile this run carried, when it was made this session.
   *  Absent on seeded history — those runs predate the session. */
  pileId?: string
  docs: number
  bytes: number
  recurring: number
  changed: number
  new: number
  /** files that dropped the connection and had to be retried */
  retried: number
  /** files no re-scan has fixed yet — the one genuinely unfinished outcome */
  unreadable: number
  value: number
}

/** Earlier months, so the tab opens with a history rather than a lecture about
 *  how one will accumulate. Dated inside the prototype's own world (its books
 *  run to June 2026), newest last. */
export const SEEDED_RUNS: UploadRun[] = [
  {
    id: "run-may",
    at: new Date("2026-05-04T11:05:00+05:30").getTime(),
    by: "Arjun Mehta",
    docs: 181,
    bytes: 27_400_000,
    recurring: 128,
    changed: 19,
    new: 34,
    retried: 3,
    unreadable: 0,
    value: 4_118_600,
  },
  {
    id: "run-jun",
    at: new Date("2026-06-03T09:48:00+05:30").getTime(),
    by: CURRENT_USER.name,
    docs: 176,
    bytes: 25_900_000,
    recurring: 139,
    changed: 11,
    new: 26,
    retried: 1,
    unreadable: 2,
    value: 4_402_900,
  },
  {
    id: "run-jul",
    at: new Date("2026-07-02T10:12:00+05:30").getTime(),
    by: CURRENT_USER.name,
    docs: 198,
    bytes: 30_200_000,
    recurring: 152,
    changed: 13,
    new: 33,
    retried: 2,
    unreadable: 0,
    value: 4_871_450,
  },
]

/** The run's sheet, as a portrait of what it turned out to be.
 *
 *  Cells are shuffled deterministically so the picture reads as a mixed pile
 *  rather than three sorted blocks. For a historical run each cell stands for
 *  one document of that run and nothing more — the identities are not claimed,
 *  only the proportions, which is exactly what the record holds. */
export function runCells(r: UploadRun): Stratum[] {
  const cells: Stratum[] = [
    ...Array<Stratum>(r.recurring).fill("routine"),
    ...Array<Stratum>(r.changed).fill("changed"),
    ...Array<Stratum>(r.new).fill("new"),
  ]
  let s = (r.docs * 2654435761) >>> 0
  for (let i = cells.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return cells
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "17 Aug 2026, 3:42 pm" — matching the fixtures' date voice, IST throughout */
export function runStamp(at: number, now = Date.now()): string {
  if (now - at < 60_000) return "Just now"
  const d = new Date(at)
  const h = d.getHours()
  const hh = h % 12 === 0 ? 12 : h % 12
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} ${h < 12 ? "am" : "pm"}`
}

/** "3:42 pm" — how the operator refers to a pile she dropped ("the one after
 *  lunch"). Two uploads minutes apart need distinguishing by clock time, which
 *  is why this exists separately from runStamp: that one collapses anything
 *  recent to "Just now", and "Just now upload" twice over names nothing. */
export function runTime(at: number): string {
  const d = new Date(at)
  const h = d.getHours()
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}

export const runSize = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`
