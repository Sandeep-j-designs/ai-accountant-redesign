/** The upload+read run, as a pure function of elapsed time.
 *
 *  It lives outside the component because the run has to survive the operator
 *  walking away from it. A 217-document read is minutes of real time, and
 *  holding a tab hostage for it is a product decision nobody would defend —
 *  so the run is state, three surfaces read it (the run screen, the strip on
 *  the Bills page, the watcher that ends it), and all three agree because
 *  they are asking the same function the same question.
 *
 *  Two phases, because they are two different things:
 *
 *    UPLOAD   network-bound. Bytes over a tier-2 office line. Fails, retries,
 *             fluctuates, and is where the time actually goes.
 *    READING  compute-bound. Per document, and the only phase whose output
 *             anyone is waiting on — the recurring / changed / new sort.
 *
 *  Timings are compressed for a prototype (~22s; ?speed=n divides). Every
 *  number shown on screen stays internally consistent at whatever speed it
 *  plays: bytes, file counts, throughput and ETA are all derived from one
 *  model rather than animated independently.
 */

import { classifyIntake, pileById, type IntakeBill } from "@/data/patterns"


export const UPLOAD_MS = 9000
export const READ_MS = 11000

/** the two files that drop the connection and retry, as a fraction through */
export const STALLS = [
  { at: 0.36, ms: 1100 },
  { at: 0.71, ms: 1400 },
]
export const STALL_MS = STALLS.reduce((n, s) => n + s.ms, 0)
export const UPLOAD_TOTAL_MS = UPLOAD_MS + STALL_MS
export const TOTAL_MS = UPLOAD_TOTAL_MS + READ_MS

/** demo compression — one place, so every surface plays at the same speed */
export function runSpeed(): number {
  if (typeof window === "undefined") return 1
  const n = Number(new URLSearchParams(window.location.search).get("speed"))
  return Number.isFinite(n) && n > 0 ? n : 1
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Per-pile tables, built once each.
 *
 *  A run carries ONE upload, and a second upload can land before the first is
 *  approved — so arrival order, file sizes and byte offsets all belong to the
 *  pile rather than to the module. Cached because they are pure and the run
 *  screen asks for them sixty times a second. */
export interface PileRun {
  bills: IntakeBill[]
  /** indices into the pile, in the order documents actually arrive */
  order: number[]
  sizes: number[]
  offsets: number[]
  totalBytes: number
}

const CACHE = new Map<string, PileRun>()

export function pileRun(pileId: string): PileRun {
  const hit = CACHE.get(pileId)
  if (hit) return hit

  const bills = pileById(pileId)?.bills ?? []

  // INTAKE is grouped by vendor, so reading it in order showed runs of five
  // consecutive bills from one vendor and a sort that sat at "0 changed, 0
  // new" for the first third. A real drop is a month of mixed paper. Shuffled
  // once, deterministically — a demo that reshuffles between runs is not a demo.
  const order = bills.map((_, i) => i)
  const shuffle = rng(31 + pileId.length)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  // a compressed bill scan is ~150 KB — sized so the displayed MB/s stays
  // plausible for an office line AND consistent with the clock, rather than
  // realistic-looking numbers laid over a fake one
  const sz = rng(97)
  const sizes = order.map(() => Math.round(40_000 + sz() * 220_000))
  const offsets: number[] = []
  let acc = 0
  for (const v of sizes) {
    offsets.push(acc)
    acc += v
  }

  const built: PileRun = { bills, order, sizes, offsets, totalBytes: acc }
  CACHE.set(pileId, built)
  return built
}

/** Wobbled progress. The derivative stays positive (0.025 × 9 < 1), so the
 *  bar breathes without ever going backwards — a bar that retreats reads as a
 *  bug, one that glides reads as fake. The amplitude is deliberately small:
 *  an earlier pass swung throughput 2–22 MB/s between samples, which is not
 *  what a congested line does, it is what a random number generator does. */
const WOBBLE_A = 0.025
const WOBBLE_F = 9
const wobble = (p: number) => Math.min(1, Math.max(0, p + WOBBLE_A * Math.sin(p * WOBBLE_F)))

export type RunPhase = "upload" | "read" | "done"

export interface RunState {
  phase: RunPhase
  /** 0–1 through the upload */
  up: number
  /** 0–1 through the read */
  readP: number
  /** index of the retry currently stalling the transfer, or null */
  stalled: number | null
  bytesDone: number
  /** the pile's total, so callers never recompute it */
  totalBytes: number
  totalDocs: number
  sizes: number[]
  /** documents fully uploaded */
  uploaded: number
  /** documents fully read */
  read: number
  rateBytesPerSec: number
  etaSeconds: number
}

/** elapsed → upload progress, pausing for each retry in turn */
function uploadAt(elapsed: number): { p: number; stalled: number | null } {
  let v = elapsed
  for (let i = 0; i < STALLS.length; i++) {
    const start = STALLS[i].at * UPLOAD_MS
    if (v < start) break
    if (v < start + STALLS[i].ms) return { p: STALLS[i].at, stalled: i }
    v -= STALLS[i].ms
  }
  return { p: Math.min(1, v / UPLOAD_MS), stalled: null }
}

export function runAt(elapsed: number, pileId: string): RunState {
  const phase: RunPhase =
    elapsed < UPLOAD_TOTAL_MS ? "upload" : elapsed < TOTAL_MS ? "read" : "done"

  const { offsets, sizes, totalBytes, bills } = pileRun(pileId)
  const totalDocs = bills.length

  const { p: rawP, stalled } = uploadAt(Math.min(elapsed, UPLOAD_TOTAL_MS))
  const up = phase === "upload" ? wobble(rawP) : 1
  const bytesDone = up * totalBytes
  const uploaded = offsets.filter((o) => o < bytesDone).length

  // throughput off the wobble's own slope, so the readout and the bar are the
  // same number rather than two independent guesses
  const slope = 1 + WOBBLE_A * WOBBLE_F * Math.cos(rawP * WOBBLE_F)
  const avgRate = totalBytes / (UPLOAD_MS / 1000)

  const readP = phase === "upload" ? 0 : Math.min(1, (elapsed - UPLOAD_TOTAL_MS) / READ_MS)

  return {
    phase,
    up,
    readP,
    stalled,
    bytesDone,
    totalBytes,
    totalDocs,
    sizes,
    uploaded,
    read: Math.round(totalDocs * readP),
    rateBytesPerSec: stalled !== null ? 0 : avgRate * slope,
    // an ETA off INSTANTANEOUS throughput bounces and nobody trusts it; real
    // clients average, and so does this one
    etaSeconds:
      phase === "upload"
        ? Math.max(1, Math.ceil((totalBytes - bytesDone) / avgRate))
        : Math.max(1, Math.ceil(((1 - readP) * READ_MS) / 1000)),
  }
}

export const fileSize = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`

/** What the run turned out to be, for the history record. Computed here so the
 *  run screen and the background watcher file identical numbers — two callers
 *  each doing their own sum is how a history quietly disagrees with itself. */
export function runRecord(pileId: string, open: IntakeBill[]) {
  const { bills, totalBytes } = pileRun(pileId)
  const mine = new Set(bills.map((b) => b.id))
  // classify against EVERYTHING open, then keep this pile's share — a bill's
  // outcome can depend on a bill in another pile (a duplicate of one still
  // waiting), so classifying the pile alone would file the wrong numbers
  const items = classifyIntake(open).filter((c) => mine.has(c.bill.id))
  const by = (st: string) => items.filter((c) => c.stratum === st)
  return {
    docs: bills.length,
    bytes: totalBytes,
    recurring: by("routine").length,
    changed: by("changed").length,
    new: by("new").length,
    retried: STALLS.length,
    unreadable: 0,
    value: items.reduce((n, c) => n + c.bill.amount, 0),
  }
}
