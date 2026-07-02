import { useCallback, useEffect, useRef, useState } from "react"
import {
  useBill,
  isReady,
  openKeys,
  type Focus,
  type TaxMode,
} from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { stampNow } from "@/lib/format"
import { InvoiceDocument, type DocRegion } from "@/components/InvoiceDocument"
import { Separator } from "@/components/ui/separator"
import { SettledRegion } from "@/components/cockpit/SettledRegion"
import { DecisionQueue } from "@/components/cockpit/DecisionQueue"
import { DecisionProgress } from "@/components/cockpit/DecisionProgress"
import { ActionDock } from "@/components/cockpit/ActionDock"
import { CommitZone } from "@/components/cockpit/CommitZone"
import { Receipt } from "@/components/cockpit/Receipt"
import { EditorProvider, type PickKey } from "@/components/cockpit/FactEditor"
import { EvidenceProvider, Evidence, Confidence } from "@/components/cockpit/evidence"
import { ActivityDrawer } from "@/components/cockpit/ActivityDrawer"
import { Amt } from "@/components/cockpit/kit"
import {
  FACTS,
  LEDGER_FACTS,
  NEXT_VOUCHER,
  INVOICE,
  GRAND_TOTAL,
  REGION_FACT,
  VENDORS,
  type FactKey,
} from "@/data/invoice"

export function CockpitScreen() {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()

  const [overrideKey, setOverrideKey] = useState<FactKey | null>(null)
  const [flagOpen, setFlagOpen] = useState(false)
  const [picks, setPicks] = useState<Record<PickKey, string>>({
    supplier: state.vendor,
    freight: state.freightLedger,
    loading: state.loadingLedger,
    voucher: state.voucher ?? NEXT_VOUCHER,
  })
  const [ghost, setGhost] = useState<{ label: string } | null>(null)
  const [committing, setCommitting] = useState(false)
  const [hoverRegion, setHoverRegion] = useState<DocRegion | null>(null)
  const [flash, setFlash] = useState<{ key: FactKey; tone: "success" | "warning" } | null>(null)
  const [stamp] = useState(() => stampNow())
  const rootRef = useRef<HTMLDivElement>(null)
  const docScrollRef = useRef<HTMLDivElement>(null)

  const ready = isReady(state)
  const focus = state.focus

  // moving the cursor closes any open override / flag menu and re-seeds the
  // pick from the fact's current value
  useEffect(() => {
    setOverrideKey(null)
    setFlagOpen(false)
    setPicks((p) => ({
      ...p,
      supplier: state.vendor,
      freight: state.freightLedger,
      loading: state.loadingLedger,
      voucher: state.voucher ?? NEXT_VOUCHER,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  useEffect(() => {
    if (state.activeError) setCommitting(false)
  }, [state.activeError])

  const liveRegion: DocRegion | null =
    !state.posted && focus !== "commit" ? FACTS[focus as FactKey].region : null

  const land = useCallback(
    (key: FactKey, value?: string, how: "accepted" | "overridden" = "accepted") => {
      const resolve = () => {
        if (!reduced) {
          setGhost({ label: FACTS[key].label })
          setTimeout(() => setGhost(null), 280)
        }
        dispatch({ type: "CONFIRM", key, value, how })
      }
      if (reduced) return resolve()
      // flash the card border (success/warning), then collapse to its summary
      setFlash({ key, tone: how === "accepted" ? "success" : "warning" })
      setTimeout(() => {
        setFlash(null)
        resolve()
      }, 150)
    },
    [dispatch, reduced],
  )

  const confirm = useCallback(
    (key: FactKey) => {
      if (key === "tax") return land("tax", "IGST", "accepted")
      if (key === "freight" || key === "loading") {
        const rec = LEDGER_FACTS[key].options.find((o) => o.rec)?.name
        return land(key, picks[key], picks[key] === rec ? "accepted" : "overridden")
      }
      if (key === "supplier") {
        return land("supplier", picks.supplier, picks.supplier === VENDORS[0].name ? "accepted" : "overridden")
      }
      if (key === "voucher") {
        const custom = overrideKey === "voucher" && picks.voucher.trim()
        const v = custom ? picks.voucher.trim() : NEXT_VOUCHER
        return land("voucher", v, v === NEXT_VOUCHER ? "accepted" : "overridden")
      }
      return land(key)
    },
    [land, picks, overrideKey],
  )

  const throwSwitch = useCallback(() => {
    if (!ready) return
    if (reduced) return dispatch({ type: "COMMIT" })
    // a brief forcing-function pause — the confirm summary in CommitZone
    // holds on screen for a beat before the entry actually records
    setCommitting(true)
    setTimeout(() => dispatch({ type: "COMMIT" }), 2400)
  }, [ready, reduced, dispatch])

  const accept = useCallback(() => {
    if (focus === "commit") return throwSwitch()
    confirm(focus as FactKey)
  }, [focus, throwSwitch, confirm])

  // override behaves per-decision: tax "override" means keep-as-printed (SPLIT);
  // the rest toggle an inline override panel scoped to the focused key.
  const toggleOverride = useCallback(() => {
    if (focus === "commit") return
    if (focus === "tax") return land("tax", "SPLIT", "overridden")
    setOverrideKey((k) => (k === focus ? null : (focus as FactKey)))
  }, [focus, land])

  const flagFocused = useCallback(
    (to: string) => {
      if (focus === "commit") return
      dispatch({ type: "FLAG", key: focus as FactKey, to })
      setFlagOpen(false)
    },
    [focus, dispatch],
  )

  const move = useCallback(
    (dir: 1 | -1) => {
      const targets: Focus[] = [...openKeys(state), ...(ready ? (["commit"] as const) : [])]
      if (!targets.length) return
      const i = targets.indexOf(focus)
      dispatch({ type: "FOCUS", key: targets[(i + dir + targets.length) % targets.length] })
    },
    [state, ready, focus, dispatch],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.posted || state.dialog) return
      const el = e.target as HTMLElement
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA"
      const inCommand = !!el?.closest?.("[cmdk-root]")

      if (e.key === "Escape") {
        if (flagOpen) setFlagOpen(false)
        else if (overrideKey) setOverrideKey(null)
        return
      }
      if (inCommand) return // cmdk owns arrows + enter inside its search

      if (e.key === "Enter") {
        e.preventDefault()
        if ((e.metaKey || e.ctrlKey) && ready) return throwSwitch()
        return accept()
      }
      if (typing) return // voucher field: let the cursor work

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        move(1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        move(-1)
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault()
        toggleOverride()
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        if (focus !== "commit") setFlagOpen(true)
      } else if ((e.key === "1" || e.key === "2") && (focus === "freight" || focus === "loading")) {
        const opt = LEDGER_FACTS[focus].options[e.key === "1" ? 0 : 1]
        if (opt) setPicks((p) => ({ ...p, [focus]: opt.name }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.posted, state.dialog, focus, ready, overrideKey, flagOpen, accept, move, throwSwitch, toggleOverride])

  // dev-only: ?autorun steps the queue so motion can be captured in frames
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!new URLSearchParams(window.location.search).has("autorun")) return
    const id = window.setInterval(() => accept(), 850)
    return () => window.clearInterval(id)
  }, [accept])

  const onShowBalance = () => {
    setHoverRegion("tax")
    setTimeout(() => {
      dispatch({ type: "SET_ERROR", error: null })
      setHoverRegion(null)
    }, 1500)
  }

  // clicking a region on the source jumps to its decision — or reopens it to
  // challenge if it's already settled
  const onRegionClick = useCallback(
    (r: DocRegion) => {
      if (state.posted) return
      const k = REGION_FACT[r]
      if (!k) return
      if (openKeys(state).includes(k)) dispatch({ type: "FOCUS", key: k })
      else if (state.resolved[k] && !state.flagged[k]) dispatch({ type: "REOPEN", key: k })
      else dispatch({ type: "FOCUS", key: k })
    },
    [state, dispatch],
  )

  const editorValue = {
    picks,
    setPick: (k: PickKey, v: string) => setPicks((p) => ({ ...p, [k]: v })),
    overrideKey,
    setOverride: (key: FactKey, on?: boolean) =>
      setOverrideKey((cur) => (on === undefined ? (cur === key ? null : key) : on ? key : null)),
    onConfirm: confirm,
    onTax: (m: TaxMode) => land("tax", m, m === "IGST" ? "accepted" : "overridden"),
    onFlag: (key: FactKey, to: string) => dispatch({ type: "FLAG", key, to }),
  }

  return (
    <EvidenceProvider onRegion={(r) => setHoverRegion(r)} active={hoverRegion}>
    <div ref={rootRef} className="relative grid h-full min-h-0 grid-cols-[44%_1fr] overflow-hidden">
      {/* LEFT — the source document, always lit */}
      <aside ref={docScrollRef} className="overflow-auto border-r border-line bg-surface">
        <div className="px-10 py-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="eyebrow">Source document</span>
            <span className="code text-[10.5px] text-faint">PDF · 1 / 1</span>
          </div>
          <div className="animate-seat">
            <InvoiceDocument live={liveRegion} highlight={hoverRegion} onRegionClick={onRegionClick} onRegionHover={setHoverRegion} />
          </div>
          <p className="mt-4 max-w-[520px] text-[11px] leading-relaxed text-faint">
            Stays lit while you decide. Hover a field to trace it to the source;
            click the source to open its decision.
          </p>
        </div>
      </aside>

      {/* RIGHT — sticky progress header · scroll · pinned action dock */}
      <div className="flex min-h-0 flex-col bg-surface">
        {!state.posted && <DecisionProgress />}

        <div className="flex-1 overflow-auto px-12 pb-8 pt-5">
          <div className="mx-auto max-w-[640px]">
            <div className="enter-up flex items-end justify-between gap-4 px-1">
              <div className="min-w-0">
                <Evidence region="voucher" className="inline-flex items-center gap-1.5">
                  <span className="code text-[12.5px] text-ink">{INVOICE.number}</span>
                  <Confidence field="invoiceNumber" />
                </Evidence>
                <div className="mt-0.5 truncate text-[12.5px] text-muted-ink">
                  {INVOICE.supplier.name}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <Evidence region="tax" className="inline-flex items-center gap-1.5">
                  <Amt value={GRAND_TOTAL} className="text-[26px] text-ink" />
                  <Confidence field="total" />
                </Evidence>
                <span className="eyebrow mt-1">
                  {state.posted ? "Posted" : "Draft · not yet in books"}
                </span>
              </div>
            </div>

            <Separator className="my-7" />

            <EditorProvider value={editorValue}>
              {state.posted ? (
                <Receipt stamp={stamp} />
              ) : (
                <>
                  <DecisionQueue ghost={ghost} flash={flash} onFocusKey={(k) => dispatch({ type: "FOCUS", key: k })} />

                  <div className="enter-up mt-5" style={{ animationDelay: "120ms" }}>
                    <CommitZone committing={committing} onShowBalance={onShowBalance} />
                  </div>
                </>
              )}

              <Separator className="my-6" />
              <div className="enter-up" style={{ animationDelay: "180ms" }}>
                <SettledRegion onHover={(r) => setHoverRegion(r)} />
              </div>
            </EditorProvider>
          </div>
        </div>

        {!state.posted && (
          <ActionDock
            committing={committing}
            onAccept={accept}
            onOverride={toggleOverride}
            onThrow={throwSwitch}
            onFlagPick={flagFocused}
            flagOpen={flagOpen}
            setFlagOpen={setFlagOpen}
          />
        )}
      </div>
    </div>
    <ActivityDrawer />
    </EvidenceProvider>
  )
}
