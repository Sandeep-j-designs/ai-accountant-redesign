/** A thin analytics shim — no SDK, no network. Typed product events are logged
 *  to the console and kept in a small in-memory ring buffer, surfaced in a
 *  dev-only panel (see components/InstrumentationPanel). Nothing is persisted:
 *  the buffer lives for the tab's lifetime and no storage is touched. */

/** the events the cockpit emits — kept as a closed union so props stay typed */
export type TrackEvent =
  | { event: "additional_field_overridden"; props: { fieldKey: string; from: string; to: string } }
  | { event: "additional_field_left_blank"; props: { fieldKey: string; voucherType: string } }
  | { event: "posting_blocked"; props: { reason: string } }

export interface TrackRecord {
  id: number
  at: number
  event: TrackEvent["event"]
  props: Record<string, unknown>
}

const RING_MAX = 100
const buffer: TrackRecord[] = []
const listeners = new Set<() => void>()
let seq = 0
// a stable newest-first view, rebuilt only when the buffer changes — so
// useSyncExternalStore's getSnapshot returns a cached reference between emits
// (returning a fresh array every call would spin an infinite render loop)
let snapshot: TrackRecord[] = []

/** emit a typed event → console + ring buffer, then notify any dev-panel subscribers */
export function track<E extends TrackEvent>(event: E["event"], props: E["props"]): void {
  const rec: TrackRecord = { id: seq++, at: Date.now(), event, props }
  buffer.push(rec)
  if (buffer.length > RING_MAX) buffer.shift()
  snapshot = [...buffer].reverse()
  // eslint-disable-next-line no-console
  console.info(`%c[track] ${event}`, "color:#6b7280", props)
  listeners.forEach((l) => l())
}

/** newest-first snapshot of the ring buffer (stable reference between emits) */
export function getTrackEvents(): TrackRecord[] {
  return snapshot
}

/** subscribe to buffer changes; returns an unsubscribe */
export function subscribeTrack(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
