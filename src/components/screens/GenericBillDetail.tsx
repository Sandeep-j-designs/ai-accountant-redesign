import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { useBill } from "@/state/store"
import { LEDGER_FACTS } from "@/data/invoice"
import { GROUP_WHY, ISSUE_WORD, type ReviewItem, type ReviewIssue } from "@/data/review"
import { Amt, DecisionCard, Kbd, LiveLabel } from "@/components/cockpit/kit"
import { Diff } from "@/components/cockpit/Diff"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

/** how a single issue is put to the reviewer — either an AI diff to accept or
 *  keep-as-printed, or (an ambiguous ledger) a short pick between two named
 *  accounts. Every issue type funnels into one of these two shapes. */
type Presentation =
  | { kind: "diff"; before: string; after: string; why: string }
  | { kind: "options"; why: string; options: { name: string; note: string; rec?: boolean }[] }

function presentIssue(issue: ReviewIssue): Presentation {
  if (issue.type === "gst") {
    return { kind: "diff", before: "CGST + SGST, as printed", after: "IGST", why: GROUP_WHY.gst }
  }
  if (issue.type === "voucher") {
    return { kind: "diff", before: "No voucher number on document", after: "Next number in the AP series", why: GROUP_WHY.voucher }
  }
  // ledger
  if (issue.autoCorrectable) {
    const after = issue.proposedFix?.split(" to ").pop() ?? "Carriage Inward"
    return { kind: "diff", before: "Unassigned", after, why: GROUP_WHY.ledger }
  }
  return { kind: "options", why: GROUP_WHY.ledger, options: LEDGER_FACTS.loading.options }
}

interface Decision {
  value: string
  how: "accepted" | "overridden"
}

/**
 * The bill detail screen for every bill EXCEPT the Sundar Logistics fixture —
 * same two-pane frame (source document, decision panel), same per-issue
 * decision cards, same explicit-confirm discipline. There's no real page
 * image for these bills, so the left pane is a plain facsimile built from
 * the fields already on file rather than a rendered document.
 */
export function GenericBillDetail({
  bill,
  isLast,
  onAdvance,
}: {
  bill: ReviewItem
  isLast: boolean
  onAdvance: () => void
}) {
  const { state, dispatch } = useBill()
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})
  const [focus, setFocus] = useState<number | "confirm">(0)
  const alreadyPosted = state.postedReviewIds.includes(bill.billId)

  // a fresh bill starts every issue open, cursor on the first
  useEffect(() => {
    setDecisions({})
    setFocus(0)
  }, [bill.billId])

  const ready = bill.issues.every((_, i) => !!decisions[i])
  const openIdx = (from: Record<number, Decision>) =>
    bill.issues.map((_, i) => i).filter((i) => !from[i])

  const resolve = (i: number, value: string, how: Decision["how"]) => {
    const next = { ...decisions, [i]: { value, how } }
    setDecisions(next)
    setFocus(openIdx(next)[0] ?? "confirm")
  }

  const saveAndAdvance = () => {
    if (!ready) return
    dispatch({ type: "POST_REVIEW", ids: [bill.billId] })
    onAdvance()
  }

  const move = (dir: 1 | -1) => {
    const targets: (number | "confirm")[] = [...openIdx(decisions), ...(ready ? (["confirm"] as const) : [])]
    if (!targets.length) return
    const i = targets.indexOf(focus)
    const cur = i === -1 ? 0 : i
    setFocus(targets[(cur + dir + targets.length) % targets.length])
  }

  useEffect(() => {
    if (alreadyPosted) return
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return
      if (e.key === "Enter") {
        e.preventDefault()
        if (focus === "confirm") return saveAndAdvance()
        if (decisions[focus]) return
        const p = presentIssue(bill.issues[focus])
        if (p.kind === "diff") return resolve(focus, p.after, "accepted")
        const rec = p.options.find((o) => o.rec) ?? p.options[0]
        return resolve(focus, rec.name, "accepted")
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        move(1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        move(-1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyPosted, bill, focus, decisions])

  return (
    <div className="relative grid h-full min-h-0 grid-cols-[44%_minmax(0,1fr)] overflow-hidden">
      {/* LEFT — no page image on file for this bill; a plain facsimile built
          from the extracted fields stands in for it. */}
      <aside className="overflow-auto border-r border-line bg-surface">
        <div className="px-10 py-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="eyebrow">Source document</span>
            <span className="code text-[10.5px] text-faint">Extracted fields</span>
          </div>
          <div className="animate-seat">
            <GenericFacsimile bill={bill} />
          </div>
          <p className="mt-4 max-w-[520px] text-[11px] leading-relaxed text-faint">
            No page image on file for this bill — the fields below are what the
            read pass extracted.
          </p>
        </div>
      </aside>

      {/* RIGHT — title block · decision cards · pinned save action */}
      <div className="flex min-h-0 flex-col bg-surface">
        <div className="flex-1 overflow-auto px-12 pb-8 pt-5">
          <div className="mx-auto max-w-[640px]">
            <div className="enter-up flex items-end justify-between gap-4 px-1">
              <div className="min-w-0">
                <span className="code text-[12.5px] text-ink">{bill.invoiceNo}</span>
                <div className="mt-0.5 truncate text-[12.5px] text-muted-ink">{bill.vendor}</div>
              </div>
              <div className="flex flex-col items-end">
                <Amt value={bill.amount} className="text-[30px] font-[680] tracking-[-0.025em] text-ink" />
                <span className="eyebrow mt-1">
                  {alreadyPosted ? "Posted" : "Draft · not yet in books"}
                </span>
              </div>
            </div>

            <Separator className="my-7" />

            {alreadyPosted ? (
              <RecordedState />
            ) : (
              <div className="flex flex-col gap-3">
                {bill.issues.map((issue, i) => (
                  <IssueCard
                    key={i}
                    issue={issue}
                    focused={focus === i}
                    decision={decisions[i]}
                    onFocus={() => setFocus(i)}
                    onResolve={(value, how) => resolve(i, value, how)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {!alreadyPosted && (
          <div className="flex-none border-t border-line bg-surface/95 px-12 py-3 shadow-commit-bar backdrop-blur">
            <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
              <span className="min-w-0 truncate text-[12.5px] text-muted-ink">
                {ready ? (
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <Check className="size-3.5 flex-none text-success" strokeWidth={2.4} />
                    {bill.issues.length === 1 ? "Decision made." : "All decisions made."}
                  </span>
                ) : (
                  <>
                    {Object.keys(decisions).length} of {bill.issues.length} decided ·{" "}
                    <Kbd>↵</Kbd> accept shown value · <Kbd>→</Kbd> next field
                  </>
                )}
              </span>
              <Button onClick={saveAndAdvance} disabled={!ready} className="px-4">
                {isLast ? "Post to books" : "Save & next bill"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RecordedState() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-surface px-6 py-10 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-success-bg text-success">
        <Check className="size-4.5" strokeWidth={2.4} />
      </span>
      <p className="mt-3 text-[13.5px] font-medium text-ink">Recorded to the books</p>
      <p className="mt-1 text-[12.5px] text-muted-ink">Pending sync to Tally.</p>
    </div>
  )
}

/** A plain paper-styled stand-in for bills with no rendered source page —
 *  the same "lit document" chrome as the real facsimile, just built from
 *  the fields already on file instead of a scanned layout. */
function GenericFacsimile({ bill }: { bill: ReviewItem }) {
  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-lg border border-[#e6e9ef] bg-white p-7 text-[#2c3039] shadow-[0_1px_2px_rgba(15,18,26,0.06),0_22px_48px_-22px_rgba(15,18,26,0.4)]">
      <div className="absolute right-0 top-0 rounded-bl-md border-b border-l border-[#eceef2] bg-[#f4f6f9] px-[9px] py-1 text-[9px] font-medium uppercase tracking-[0.06em] text-[#9aa1ac]">
        Tax Invoice
      </div>
      <div className="text-[15px] font-medium tracking-[-0.01em] text-[#15171c]">{bill.vendor}</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.09em] text-[#9aa1ac]">Original for Recipient</div>
      <div className="mt-5 flex items-baseline justify-between border-y border-[#eceef2] py-3">
        <div>
          <div className="text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Invoice no.</div>
          <div className="font-mono text-[12px] font-medium text-[#15171c]">{bill.invoiceNo}</div>
        </div>
        <div className="text-right">
          <div className="text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Amount</div>
          <div className="font-mono text-[13px] font-medium text-[#15171c]">
            ₹{bill.amount.toLocaleString("en-IN")}.00
          </div>
        </div>
      </div>
      <p className="mt-5 text-[10.5px] leading-relaxed text-[#8b909b]">
        {bill.issues.length} {bill.issues.length === 1 ? "item" : "items"} flagged for review — see the
        decision panel.
      </p>
    </div>
  )
}

function IssueCard({
  issue,
  focused,
  decision,
  onFocus,
  onResolve,
}: {
  issue: ReviewIssue
  focused: boolean
  decision?: Decision
  onFocus: () => void
  onResolve: (value: string, how: Decision["how"]) => void
}) {
  const p = presentIssue(issue)
  const word = ISSUE_WORD[issue.type]
  const label = word.charAt(0).toUpperCase() + word.slice(1)

  return (
    <DecisionCard
      focused={focused && !decision}
      onClick={(e) => {
        if (decision || focused) return
        if ((e.target as HTMLElement).closest("button")) return
        onFocus()
      }}
    >
      <LiveLabel>{label}</LiveLabel>

      {decision ? (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[13.5px] text-ink">
          <Check className="size-3.5 flex-none text-success" strokeWidth={2.4} />
          <span className="font-medium">{decision.value}</span>
          <span className="text-faint">{decision.how === "accepted" ? "· accepted" : "· overridden"}</span>
        </p>
      ) : p.kind === "diff" ? (
        <>
          <div className="mt-2.5">
            <Diff before={p.before} after={p.after} why={p.why} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button onClick={() => onResolve(p.after, "accepted")} className="px-4">
              Accept {p.after}
            </Button>
            <Button variant="outline" onClick={() => onResolve(p.before, "overridden")} className="px-4 text-body">
              Keep as printed
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.5] text-body">{p.why}</p>
          <div className="mt-3 space-y-1.5">
            {p.options.map((o) => (
              <button
                key={o.name}
                onClick={() => onResolve(o.name, o.rec ? "accepted" : "overridden")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-panel/60"
              >
                <span className="grid size-[16px] flex-none place-items-center rounded-full border border-line-strong" />
                <span className="flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{o.name}</span>
                  <span className="block text-[11.5px] text-muted-ink">{o.note}</span>
                </span>
                {o.rec && (
                  <span className="inline-flex items-center rounded-xs bg-panel-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-body">
                    Most used
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </DecisionCard>
  )
}
