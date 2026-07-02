import { useBill, queueKeys, type Focus } from "@/state/store"
import { type FactKey } from "@/data/invoice"
import { FactEditor } from "./FactEditor"
import { DecisionCard } from "./kit"

export function DecisionQueue({
  ghost,
  flash,
  onFocusKey,
}: {
  ghost: { label: string } | null
  flash: { key: FactKey; tone: "success" | "warning" } | null
  onFocusKey: (k: Focus) => void
}) {
  const { state } = useBill()
  const qk = queueKeys(state)

  if (qk.length === 0 && !ghost) return null

  return (
    <div className="flex flex-col gap-3">
      {ghost && (
        <div className="animate-collapse-up flex items-center gap-2 py-1 text-[12px] text-muted-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="draw-check size-3.5 text-success">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span>
            <b className="font-medium text-ink">{ghost.label}</b> settled
          </span>
        </div>
      )}

      {/* every open decision is an equally-weighted card. the focused one keeps
          a visible cursor (rail + ring) so the keyboard flow stays legible. */}
      {qk.map((k) => {
        const focused = state.focus === k
        const flashing = flash?.key === k
        return (
          <DecisionCard
            key={k}
            focused={focused}
            flashing={flashing}
            flashTone={flash?.tone}
            onClick={(e) => {
              // focus the card from its body, but let inner controls act alone
              if (focused) return
              if ((e.target as HTMLElement).closest("button,input,[cmdk-root]")) return
              onFocusKey(k as FactKey)
            }}
          >
            <FactEditor factKey={k} />
          </DecisionCard>
        )
      })}
    </div>
  )
}
