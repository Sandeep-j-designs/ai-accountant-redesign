/** Settings → Sync.
 *
 *  The cross-company monitor. Its whole job is to answer a question no other
 *  surface can: what is happening in the books I am NOT looking at? Start a
 *  push in Acme, switch to Northwind, and Acme's run is still here, still
 *  counting — because the run lives in the store and SyncEngine drives every
 *  company, not just the active one.
 *
 *  Read-only by design. Sync is armed from the TopBar modal, against the books
 *  the operator is actually standing in; arming someone else's books from a
 *  list you are only monitoring is how you push forty vouchers into the wrong
 *  company. Switching here is one click away and makes the target explicit. */

import { useEffect, useState } from "react"
import { RefreshCw, Check, AlertCircle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useBill,
  companySync,
  syncProgress,
  approvedBillIds,
  syncingCompanyIds,
  type CompanySync,
} from "@/state/store"
import { COMPANIES, type Company } from "@/data/companies"
import { booksRows } from "@/data/review"
import { openIntake } from "@/data/patterns"
import { useReducedMotion } from "@/hooks/useReducedMotion"

export function SettingsScreen() {
  const { state } = useBill()
  const reduced = useReducedMotion()
  const live = syncingCompanyIds(state).length > 0

  // re-render while any company is mid-push, so every bar on the page moves —
  // progress itself is derived from the store, never held here
  const [, force] = useState(0)
  useEffect(() => {
    if (!live || reduced) return
    const id = setInterval(() => force((n) => n + 1), 120)
    return () => clearInterval(id)
  }, [live, reduced])

  return (
    <div className="sync-settings-workspace mx-auto w-full max-w-[980px] px-8 py-8">
      <header className="sync-settings-hero">
        <div className="connection-diagram" aria-hidden="true"><span>AiA</span><i/><span className={live ? "connection-live" : ""}>⇄</span><i/><span>Tally</span></div>
        <span className="workspace-eyebrow">CONNECTED BOOKS</span>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Your books, in sync.
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-ink">
          Monitor each company’s connection and voucher sync. Active runs continue when you switch workspaces.
        </p>
      </header>

      <ul className="mt-6 flex flex-col gap-3">
        {COMPANIES.map((c) => (
          <CompanyCard key={c.id} company={c} />
        ))}
      </ul>
    </div>
  )
}

function CompanyCard({ company }: { company: Company }) {
  const { state, dispatch } = useBill()
  const cs = companySync(state, company.id)
  const isActive = company.id === state.activeCompanyId

  // what a push from this company would carry right now. Same booksRows builder
  // the All-bills table and the sync modal use, keyed to THIS company's synced
  // ids — so the three surfaces can never disagree about the count.
  const rows = booksRows(
    state.postedReviewIds,
    state.voucher,
    state.ingestedIds,
    cs.syncedIds,
    state.deletedBillIds,
    {
      bills: [...approvedBillIds(state)],
      autoPatterns: state.autoPostPatterns,
      open: openIntake(state.readPiles),
    },
  )
  const pending = rows.filter((r) => (r.tallySync ?? "synced") === "pending").length
  const failed = rows.filter((r) => (r.tallySync ?? "synced") === "failed").length

  return (
    <li
      className={cn(
        "rounded-xl border bg-surface p-4 transition-colors",
        isActive ? "border-line-strong" : "border-line",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-lg bg-gradient-to-br from-[#3146B0] to-[#6478D2] text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          {company.short}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14.5px] font-semibold text-ink">{company.name}</h2>
            {isActive && (
              <span className="flex-none rounded-md bg-accent-subtle px-1.5 py-px text-[11px] font-semibold text-accent-sig-ink">
                Current
              </span>
            )}
          </div>
          <p className="truncate font-mono text-[11.5px] text-faint">
            {company.gstin} · {company.place}
          </p>
        </div>

        {!isActive && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_COMPANY", companyId: company.id })}
            className="group/sw flex flex-none items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-body transition-colors hover:border-line-strong hover:text-ink"
          >
            Switch
            <ArrowRight className="size-3.5 transition-transform group-hover/sw:translate-x-0.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-3.5 border-t border-divider pt-3">
        <SyncStatus cs={cs} pending={pending} failed={failed} />
      </div>
    </li>
  )
}

/** One company's sync line — the live run if there is one, else the standing
 *  position (what is waiting, and when the last push landed). */
function SyncStatus({ cs, pending, failed }: { cs: CompanySync; pending: number; failed: number }) {
  if (cs.phase === "syncing") {
    const pct = syncProgress(cs)
    const done = Math.round((pct / 100) * cs.run.total)
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-sig-ink">
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} />
            Syncing to Tally
          </span>
          <span className="font-mono text-[12px] tabular-nums text-muted-ink">
            {done} / {cs.run.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-brand-vivid transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  const waiting = pending + failed

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
        {failed > 0 ? (
          <>
            <AlertCircle className="size-3.5 flex-none text-danger" strokeWidth={2.2} />
            <span className="text-ink">
              {failed} failed{pending > 0 && ` · ${pending} pending`}
            </span>
          </>
        ) : waiting > 0 ? (
          <>
            <span className="size-[7px] flex-none rounded-full bg-warning-dot" />
            <span className="text-ink">
              {waiting} {waiting === 1 ? "voucher" : "vouchers"} waiting
            </span>
          </>
        ) : (
          <>
            <Check className="size-3.5 flex-none text-success" strokeWidth={2.4} />
            <span className="text-body">All synced</span>
          </>
        )}
      </span>
      <span className="flex-none text-[12px] text-faint">Last synced {cs.lastSync}</span>
    </div>
  )
}
