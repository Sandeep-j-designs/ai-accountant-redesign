/** PARKED — graduation (auto-post), sampling and the shrink stat.
 *
 *  Built in phase 3 and deliberately not rendered: the current flow has ONE
 *  approval path (extract → recurring summary → approve), and a second route
 *  to "these bills don't need me" works against that. Kept whole so it can be
 *  switched back on without rebuilding it.
 *
 *  To revive: render <Headline>, <AutomateOffer> and <SpotCheck> from the
 *  Needs-review page, and filter auto-posting patterns out of the queue the
 *  way approved ones already are. The store still carries autoPostPatterns
 *  and attestedBills, data/patterns.ts still exports isAutomatable /
 *  isSampled / graduationEvidence, and booksRows already tags auto-posted
 *  rows — nothing else has to change.
 */

import { useState, type ReactNode } from "react"
import { ChevronRight, Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Money } from "@/components/bills/Money"
import { Button } from "@/components/ui/button"
import { LIST_SHELL } from "@/components/bills/NeedsReview"
import {
  graduationEvidence,
  LAST_MONTH_HAND_APPROVED,
  SAMPLE_RATE,
  type IntakeBill,
  type RoutineGroup,
} from "@/data/patterns"

const BILL_COLS = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_100px_136px] items-center gap-3"

/* ── the shrink stat ────────────────────────────────────────────
   The only honest form of "get rid of 75% of your accounting tasks": not a
   claim, a count, measured against what this same operator did last month.
   It only appears once something is actually automated — a product that
   boasts before it has earned anything is what P3 is scanning for. */

export function Headline({ needsHuman, automated }: { needsHuman: number; automated: number }) {
  if (!automated) return null
  const saved = Math.round((automated / LAST_MONTH_HAND_APPROVED) * 100)
  return (
    <p className="text-[13px] text-body">
      <b className="font-medium text-ink">{needsHuman} bills</b> need you this month. {automated}{" "}
      posted on patterns you already approved — last month {LAST_MONTH_HAND_APPROVED} needed you.
      <span className="ml-1.5 rounded-full bg-success-bg px-2 py-0.5 text-[12px] font-medium text-success">
        {saved}% fewer
      </span>
    </p>
  )
}

/* ── graduation ─────────────────────────────────────────────────
   Framed as the user's own history handed back to them, and always
   reversible. Never "we'll handle it from here" — P3 reads that as
   "we'll handle you". */

export function AutomateOffer({
  offers,
  onGraduate,
}: {
  offers: RoutineGroup[]
  onGraduate: (g: RoutineGroup) => void
}) {
  const [open, setOpen] = useState(false)
  const bills = offers.reduce((n, g) => n + g.bills.length, 0)
  return (
    <div className="rounded-lg border border-line bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-vivid/50"
      >
        <Sparkles className="size-4 flex-none text-accent-sig" strokeWidth={2} />
        <span className="text-[13px] text-body">
          <b className="font-medium text-ink">{offers.length} vendors</b> have gone unchanged long
          enough to post themselves — {bills} bills a month
        </span>
        <span className="ml-auto flex flex-none items-center gap-1 text-[12px] text-faint">
          {open ? "Hide" : "Review"}
          <ChevronRight
            className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
            strokeWidth={2}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-line">
          <p className="px-4 py-2.5 text-[12px] leading-relaxed text-faint">
            You stay the authority: you approve the pattern once and we apply it. A bill that
            deviates from it — amount out of range, new line, GST head, possible duplicate — still
            stops and waits for you, and 1 in {SAMPLE_RATE} is pulled back for a spot check. Turn
            any of these off whenever you like.
          </p>
          {offers.map((g) => (
            <div
              key={g.key}
              className="grid grid-cols-[minmax(0,1fr)_64px_128px_120px] items-center gap-3 px-4 py-2 shadow-[inset_0_-1px_0_var(--line)] last:shadow-none"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{g.label}</div>
                <div className="truncate text-[12px] text-faint">{graduationEvidence(g.pattern)}</div>
              </div>
              <span className="justify-self-end text-[13px] tabular-nums text-body">
                {g.bills.length}
              </span>
              <Money
                value={g.total}
                decimals={false}
                className="justify-self-end text-[13px] tabular-nums text-body"
              />
              <span className="justify-self-end">
                <Button variant="secondary" size="sm" onClick={() => onGraduate(g)}>
                  Auto-post
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── sampling ───────────────────────────────────────────────────
   The answer to "what did nobody look at?" — the question a partner asks,
   and the failure mode an ops lead sees across 45 books. A fixed share of
   everything auto-posted comes back for a human to attest. */

export function SpotCheck({
  bills,
  sampledFrom,
  onAttest,
}: {
  bills: IntakeBill[]
  sampledFrom: number
  onAttest: (ids: string[], label: ReactNode) => void
}) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-semibold text-ink">Spot check</h2>
            <span className="text-[13px] tabular-nums text-body">
              {bills.length} of {sampledFrom} auto-posted
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-faint">
            A sample of what posted without you. Already in the books — this is attestation, not
            approval.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAttest(bills.map((b) => b.id), `all ${bills.length}`)}
        >
          Attest all {bills.length}
        </Button>
      </div>
      <div className={LIST_SHELL}>
        <div className="min-w-[760px]">
          {bills.map((b, i) => (
            <div
              key={b.id}
              className={cn(
                BILL_COLS,
                "p-[var(--pad-cell)] shadow-[inset_0_-1px_0_var(--line)] last:shadow-none",
                i % 2 === 1 && "bg-[#F6F7FB] dark:bg-white/[0.02]",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-tight text-ink">
                  {b.vendor}
                </div>
                <div className="mt-0.5 truncate text-[13px] leading-tight text-faint">
                  {b.invoiceNo}
                </div>
              </div>
              <span className="truncate text-[13px] text-body">{b.lines.join(" · ")}</span>
              <span className="justify-self-end">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Check strokeWidth={2.2} />}
                  onClick={() => onAttest([b.id], b.vendor)}
                >
                  Looks right
                </Button>
              </span>
              <Money
                value={b.amount}
                decimals={false}
                symbolClassName="text-[14px]"
                className="justify-self-end text-[14px] font-semibold text-ink"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
