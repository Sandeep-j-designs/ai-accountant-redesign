import { useCallback, useEffect, useRef, useState } from "react"
import {
  useBill,
  isReady,
  openKeys,
  enterChain,
  isAdditionalKey,
  isFactKey,
  additionalValue,
  additionalFieldStatus,
  additionalBlockingKeys,
  enabledAdditionalKeys,
  type Focus,
  type TaxMode,
} from "@/state/store"
import { ADDITIONAL_FIELD_MAP, type AdditionalFieldKey } from "@/data/additionalFields"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { track } from "@/lib/track"
import { stampNow } from "@/lib/format"
import { InvoiceDocument, type DocRegion } from "@/components/InvoiceDocument"
import { Separator } from "@/components/ui/separator"
import { FieldInspector } from "@/components/cockpit/FieldInspector"
import { DecisionProgress } from "@/components/cockpit/DecisionProgress"
import { ActionDock } from "@/components/cockpit/ActionDock"
import { CommitZone } from "@/components/cockpit/CommitZone"
import { AdditionalDetails } from "@/components/cockpit/AdditionalDetails"
import { PostingPreview } from "@/components/cockpit/PostingPreview"
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

/**
 * The Sundar Logistics walkthrough — the one bill with a full fixture (source
 * document, live fact editor, balance-check theater). Its own decision
 * choreography (Accept changes → Post to books → Receipt) is untouched; the
 * only concession to the Needs-review Prev/Next nav is what happens the
 * instant it commits — it hands off to `onAdvance` instead of lingering on
 * its own, and the terminal button reads "Save & next bill" unless this is
 * genuinely the last bill left to review.
 */
export function SundarBillDetail({
  isLast,
  onAdvance,
}: {
  isLast: boolean
  onAdvance: () => void
}) {
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

  // only the six core facts trace to a document region; additional fields don't
  const liveRegion: DocRegion | null =
    !state.posted && isFactKey(focus) ? FACTS[focus].region : null

  // when the chain reaches an additional field, open the tail so its row shows
  useEffect(() => {
    if (isAdditionalKey(focus)) dispatch({ type: "TOGGLE_ADDITIONAL", open: true })
  }, [focus, dispatch])

  const land = useCallback(
    (key: FactKey, value?: string, how: "accepted" | "overridden" = "accepted") => {
      const resolve = () => dispatch({ type: "CONFIRM", key, value, how })
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

  // ready board → the split-view posting checkpoint (§4). The board's single
  // affirmative; the accountable write happens in the preview, not here.
  const enterPosting = useCallback(() => {
    if (ready) dispatch({ type: "ENTER_POSTING" })
  }, [ready, dispatch])
  const exitPosting = useCallback(() => dispatch({ type: "EXIT_POSTING" }), [dispatch])

  // the accountable Tally write, from inside the preview. Blocked by any
  // surfaced failure; otherwise a beat of "Posting…" then commit + advance.
  const post = useCallback(() => {
    if (state.activeError || additionalBlockingKeys(state).length > 0) return
    // instrumentation: each enabled-but-empty optional field that won't be written
    for (const k of enabledAdditionalKeys(state)) {
      if (additionalFieldStatus(state, k) === "optionalEmpty") {
        track("additional_field_left_blank", { fieldKey: k, voucherType: state.voucherType })
      }
    }
    const finish = () => {
      dispatch({ type: "COMMIT" })
      onAdvance()
    }
    if (reduced) return finish()
    setCommitting(true)
    setTimeout(finish, 1800)
  }, [state, reduced, dispatch, onAdvance])

  // resolve a focused additional field: accept its prefill, or confirm the
  // typed value. A required-empty field can't be confirmed blank.
  const acceptAdditional = useCallback(
    (key: AdditionalFieldKey) => {
      const val = additionalValue(state, key).trim()
      if (!val) return // required-empty / optional-empty: nothing to confirm yet
      const inferred = ADDITIONAL_FIELD_MAP[key].infer?.value
      const how: "accepted" | "overridden" = inferred && val !== inferred ? "overridden" : "accepted"
      if (how === "overridden") {
        track("additional_field_overridden", { fieldKey: key, from: inferred ?? "", to: val })
      }
      dispatch({ type: "CONFIRM_ADDITIONAL", key, value: val, how })
    },
    [state, dispatch],
  )

  const accept = useCallback(() => {
    if (focus === "commit") {
      // a clean board is one Enter from the posting preview (§6, acceptance #1)
      return enterPosting()
    }
    if (isAdditionalKey(focus)) return acceptAdditional(focus)
    confirm(focus)
  }, [focus, enterPosting, confirm, acceptAdditional])

  // override behaves per-decision: tax "override" means keep-as-printed (SPLIT);
  // the rest toggle an inline override panel scoped to the focused key. For an
  // additional field, the focused row is already an editable input.
  const toggleOverride = useCallback(() => {
    if (focus === "commit" || isAdditionalKey(focus)) return
    if (focus === "tax") return land("tax", "SPLIT", "overridden")
    setOverrideKey((k) => (k === focus ? null : focus))
  }, [focus, land])

  const flagFocused = useCallback(
    (to: string) => {
      if (!isFactKey(focus)) return // only core facts route to a reviewer
      dispatch({ type: "FLAG", key: focus, to })
      setFlagOpen(false)
    },
    [focus, dispatch],
  )

  const move = useCallback(
    (dir: 1 | -1) => {
      const targets: Focus[] = [...enterChain(state), ...(ready ? (["commit"] as const) : [])]
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

      // inside the posting checkpoint: Enter posts, Esc steps back to the board
      if (state.posting) {
        if (inCommand) return
        if (e.key === "Enter") {
          e.preventDefault()
          return post()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          return exitPosting()
        }
        return
      }

      if (e.key === "Escape") {
        if (flagOpen) setFlagOpen(false)
        else if (overrideKey) setOverrideKey(null)
        return
      }
      if (inCommand) return // cmdk owns arrows + enter inside its search

      if (e.key === "Enter") {
        e.preventDefault()
        // ⌘⏎ from a ready board jumps straight into the posting preview
        if ((e.metaKey || e.ctrlKey) && ready) return enterPosting()
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
        if (isFactKey(focus)) setFlagOpen(true)
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        dispatch({ type: "TOGGLE_ADDITIONAL" })
      } else if ((e.key === "1" || e.key === "2") && (focus === "freight" || focus === "loading")) {
        const opt = LEDGER_FACTS[focus].options[e.key === "1" ? 0 : 1]
        if (opt) setPicks((p) => ({ ...p, [focus]: opt.name }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.posted, state.dialog, state.posting, focus, ready, overrideKey, flagOpen, accept, move, post, enterPosting, exitPosting, toggleOverride, dispatch])

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
    <div ref={rootRef} className="relative grid h-full min-h-0 grid-cols-[44%_minmax(0,1fr)] overflow-hidden">
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

      {/* RIGHT — verify board, or the posting checkpoint. The LEFT document
          stays mounted across the swap, so the transition has no hard cut. */}
      <div className="flex min-h-0 flex-col bg-surface">
        {state.posting ? (
          <PostingPreview isLast={isLast} committing={committing} onPost={post} onBack={exitPosting} />
        ) : (
        <>
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
                  <Amt value={GRAND_TOTAL} className="text-[30px] font-[680] tracking-[-0.025em] text-ink" />
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
                <>
                  <Receipt stamp={stamp} />
                  <Separator className="my-6" />
                  {/* the locked, verified field list stays visible on the record */}
                  <FieldInspector flash={null} onHover={(r) => setHoverRegion(r)} />
                </>
              ) : (
                <>
                  <FieldInspector flash={flash} onHover={(r) => setHoverRegion(r)} />

                  <div className="enter-up mt-5" style={{ animationDelay: "120ms" }}>
                    <CommitZone committing={committing} onShowBalance={onShowBalance} />
                  </div>

                  <div className="enter-up mt-5" style={{ animationDelay: "150ms" }}>
                    <AdditionalDetails />
                  </div>
                </>
              )}
            </EditorProvider>
          </div>
        </div>

        {!state.posted && (
          <ActionDock
            onReview={enterPosting}
            onOverride={toggleOverride}
            onFlagPick={flagFocused}
            flagOpen={flagOpen}
            setFlagOpen={setFlagOpen}
          />
        )}
        </>
        )}
      </div>
    </div>
    <ActivityDrawer />
    </EvidenceProvider>
  )
}
