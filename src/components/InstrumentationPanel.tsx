import { useState, useSyncExternalStore } from "react"
import { Activity, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTrackEvents, subscribeTrack, type TrackRecord } from "@/lib/track"
import { relTime } from "@/lib/format"

/** Dev-only readout of the in-memory track() ring buffer. Hidden in production;
 *  enable with ?demo in the URL (mirrors SimControls). No storage, no network. */
export function InstrumentationPanel() {
  const events = useSyncExternalStore(subscribeTrack, getTrackEvents, getTrackEvents)
  const [open, setOpen] = useState(true)
  const demoEnabled =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo")
  if (!demoEnabled) return null

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-card text-xs shadow-lift">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Activity className="size-3.5 text-faint" strokeWidth={2} />
        <b className="font-medium text-body">Instrumentation</b>
        <span className="tabular-nums text-faint">{events.length}</span>
        <ChevronDown
          className={cn("ml-auto size-3.5 text-faint transition-transform", !open && "-rotate-90")}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="max-h-[240px] overflow-auto border-t border-line">
          {events.length === 0 ? (
            <div className="px-3 py-3 text-faint">
              No events yet. Override a prefilled field, leave an optional field blank at
              posting, or trigger a blocked post.
            </div>
          ) : (
            events.map((e) => <Row key={e.id} rec={e} />)
          )}
        </div>
      )}
    </div>
  )
}

const TONE: Record<TrackRecord["event"], string> = {
  additional_field_overridden: "text-warning",
  additional_field_left_blank: "text-faint",
  posting_blocked: "text-danger",
}

function Row({ rec }: { rec: TrackRecord }) {
  return (
    <div className="border-t border-line/60 px-3 py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-mono text-[11px] font-medium", TONE[rec.event])}>{rec.event}</span>
        <span className="flex-none tabular-nums text-faint">{relTime(rec.at)}</span>
      </div>
      <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-ink">
        {Object.entries(rec.props)
          .map(([k, v]) => `${k}: ${String(v) || "∅"}`)
          .join(" · ")}
      </div>
    </div>
  )
}
