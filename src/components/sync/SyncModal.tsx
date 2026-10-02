import { useEffect, useMemo, useState } from "react"
import {
  RefreshCw,
  Check,
  ArrowUpFromLine,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  approvedBillIds,
  useBill,
  activeSync,
  syncProgress,
  type FailGroup,
} from "@/state/store"
import { companyById } from "@/data/companies"
import { openIntake } from "@/data/patterns"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog"
import { openReviewItems, booksRows } from "@/data/review"
import type { BillRow } from "@/data/invoice"

/* ── contextual payloads ─────────────────────────────────────
   The sync pushes recorded vouchers to Tally. Everything the
   modal reports derives from the SAME booksRows/openReviewItems
   builders the Bills screen renders, so the two surfaces can
   never disagree. Bills confirmed in review land in All bills as
   PENDING — this sync run is what actually sends them to Tally.
   When rows are checked in All bills, the sync scopes to them.
   ───────────────────────────────────────────────────────────── */

function groupFailures(rows: BillRow[]): FailGroup[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const reason = r.syncNote ?? "Rejected by Tally"
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ n, label }))
}

/** How long a push should take. Scales with the voucher count so forty
 *  vouchers visibly outlast three — and so a run is still going when the
 *  operator lands on another company. Reduced motion collapses it. */
function runDuration(vouchers: number, reduced: boolean): number {
  if (reduced) return 700
  // the floor matters: a push has to outlast the few seconds it takes to switch
  // company and open the settings page, or the one thing this is meant to show
  // — a run continuing somewhere you are not — is over before you get there
  return Math.min(5000 + vouchers * 700, 20000)
}

export function SyncModal() {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  /** the result screen is dismissed locally — a landed run stays landed in the
   *  store (the settings page still reports it), but this modal returns to
   *  "ready" once the operator has read the outcome */
  const [dismissed, setDismissed] = useState(false)

  // THE RUN LIVES IN THE STORE, not here. That is what lets it survive this
  // component unmounting — which happens on every flow navigation and on every
  // company switch. See components/sync/SyncEngine.
  const company = companyById(state.activeCompanyId)
  const cs = activeSync(state)
  const syncing = cs.phase === "syncing"
  const phase: "ready" | "syncing" | "synced" | "failed" =
    syncing ? "syncing" : dismissed || cs.phase === "idle" ? "ready" : cs.phase
  const run = cs.run
  const lastSync = cs.lastSync

  // a live run animates by re-rendering on a local ticker — progress itself is
  // derived from the store's startedAt, so this never becomes a second source
  // of truth about how far along the push is (the RunStrip model)
  const [, force] = useState(0)
  useEffect(() => {
    if (!syncing || reduced) return
    const id = setInterval(() => force((n) => n + 1), 120)
    return () => clearInterval(id)
  }, [syncing, reduced])
  const progress = syncProgress(cs)

  // EVERY number derives from the same booksRows the All-bills table renders,
  // scoped to the checked rows when a selection is live — so the modal can
  // never disagree with the table.
  const rows = useMemo(
    () =>
      booksRows(
        state.postedReviewIds,
        state.voucher,
        state.ingestedIds,
        activeSync(state).syncedIds,
        [],
        {
          bills: [...approvedBillIds(state)],
          autoPatterns: state.autoPostPatterns,
          open: openIntake(state.readPiles),
        },
      ),
    [state],
  )
  const hasSelection = state.selectedBills.length > 0
  const selected = useMemo(() => new Set(state.selectedBills), [state.selectedBills])
  const scopeRows = useMemo(
    () => (hasSelection ? rows.filter((r) => selected.has(r.id)) : rows),
    [rows, hasSelection, selected],
  )
  const pendingRows = useMemo(
    () => scopeRows.filter((r) => (r.tallySync ?? "synced") === "pending"),
    [scopeRows],
  )
  const failedRows = useMemo(
    () => scopeRows.filter((r) => (r.tallySync ?? "synced") === "failed"),
    [scopeRows],
  )
  const unsynced = pendingRows.length + failedRows.length
  const failedBreakdown = useMemo(() => groupFailures(failedRows), [failedRows])

  // bills still held in the review queue — not recorded, so not syncable yet
  const reviewOpen = useMemo(
    () => openReviewItems(state.postedReviewIds, state.ingestedIds),
    [state.postedReviewIds, state.ingestedIds],
  )

  /** Push the un-synced rows to Tally. "sync" pushes pending (they succeed)
   *  and attempts failed (they get rejected again, with their real reason);
   *  "retry" re-attempts the failed rows and clears them. The outcome is
   *  derived from THIS data — never a scripted sequence.
   *
   *  This only ARMS the run. SyncEngine lands it, so the push completes whether
   *  or not this modal — or this company — is still on screen. */
  const runSync = (mode: "sync" | "retry") => {
    if (syncing) return
    const okRows = mode === "retry" ? failedRows : pendingRows
    const failRows = mode === "retry" ? [] : failedRows
    const attempt = okRows.length + failRows.length
    if (attempt === 0) return

    setDismissed(false)
    dispatch({
      type: "SYNC_START",
      companyId: state.activeCompanyId,
      okIds: okRows.map((r) => r.id),
      failed: groupFailures(failRows),
      scoped: hasSelection,
      durationMs: runDuration(attempt, reduced),
    })
  }

  const cancelSync = () => {
    dispatch({ type: "SYNC_CANCEL", companyId: state.activeCompanyId })
    setDismissed(true)
  }

  const openReview = () => {
    setOpen(false)
    dispatch({ type: "SET_BILLS_TAB", tab: "review" })
    dispatch({ type: "SHOW", screen: "bills" })
  }

  // opening the modal always re-derives from live state (no stale result screen)
  const onOpenChange = (v: boolean) => {
    setOpen(v)
    if (v && !syncing) setDismissed(true)
  }

  const failedCount = run.failed.reduce((s, i) => s + i.n, 0)

  return (
    <>
      {/* trigger — the TopBar Sync button, carrying live scope + state */}
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group flex h-9 flex-none items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium transition-colors duration-150",
          open ? "bg-sunken text-ink" : "bg-surface text-body hover:bg-sunken hover:text-ink",
        )}
      >
        <span className="relative flex-none">
          {/* navy accent — the sync signal */}
          <RefreshCw
            className={cn(
              "size-3.5 text-accent-sig transition-colors",
              syncing && "animate-spin",
            )}
            strokeWidth={1.75}
          />
          {/* outcome dot — driven by the live rows: red if any failed, else a
              quiet amber pull if bills still sit in the review queue */}
          {!open && !syncing && failedRows.length > 0 && (
            <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-danger-dot ring-2 ring-surface" />
          )}
          {!open && !syncing && failedRows.length === 0 && reviewOpen.length > 0 && (
            <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-warning-dot ring-2 ring-surface" />
          )}
        </span>
        <span>{syncing ? "Syncing…" : unsynced > 0 ? "To sync" : "Up to date"}</span>
        {/* count = what a sync would push right now: checked rows, else everything
            un-synced (pending + failed) */}
        {!syncing && unsynced > 0 && (
          <span
            className={cn(
              "inline-grid min-w-[18px] place-items-center rounded-full px-1 py-px text-[12px] font-semibold tabular-nums transition-colors",
              hasSelection
                ? "bg-accent-sig text-white" // a live selection is an armed scope
                : "bg-accent-subtle text-accent-sig-ink",
            )}
          >
            {unsynced}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[400px]" aria-describedby={undefined}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-[16px]">Sync to Tally</DialogTitle>
              {/* which books this push lands in — never a fixed name, or the
                  modal would misreport the target after a company switch */}
              <span className="flex items-center gap-1.5 rounded-md bg-panel px-2 py-px text-[12px] font-medium text-muted-ink">
                <span className="size-[6px] rounded-full bg-success-dot" />
                {company.name}
              </span>
            </div>
          </DialogHeader>

          <DialogBody className="px-6 pb-6 pt-5" aria-live="polite">
            {phase === "ready" && (
              <Body>
                <StatusRing tone={failedRows.length ? "err" : "accent"}>
                  {failedRows.length ? (
                    <AlertCircle className="size-6" strokeWidth={2.2} />
                  ) : (
                    <ArrowUpFromLine className="size-6" strokeWidth={2} />
                  )}
                </StatusRing>
                {unsynced > 0 ? (
                  <>
                    <Head>
                      {hasSelection
                        ? `${unsynced} selected ${unsynced === 1 ? "voucher" : "vouchers"} to sync`
                        : `${unsynced} ${unsynced === 1 ? "voucher" : "vouchers"} to sync`}
                    </Head>
                    <Sub>
                      {hasSelection
                        ? "Only the rows checked in All bills will be pushed."
                        : failedRows.length
                          ? `${pendingRows.length} pending · ${failedRows.length} failed earlier`
                          : "Recorded to the books, not yet in Tally."}
                    </Sub>
                    {failedRows.length > 0 && <Breakdown items={failedBreakdown} dot="bg-danger-dot" />}
                  </>
                ) : (
                  <>
                    <Head>Nothing waiting to sync</Head>
                    <Sub>Every recorded voucher is already in Tally.</Sub>
                  </>
                )}
                {reviewOpen.length > 0 && (
                  <button
                    onClick={openReview}
                    className="group/link mx-auto mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-sig-ink transition-colors hover:text-accent-hover"
                  >
                    {reviewOpen.length} {reviewOpen.length === 1 ? "bill" : "bills"} still in review
                    <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" strokeWidth={2.1} />
                  </button>
                )}
                <LastSynced at={lastSync} />
                <Footer>
                  <Button className="w-full" disabled={unsynced === 0} onClick={() => runSync("sync")}>
                    {unsynced === 0
                      ? "Nothing to sync"
                      : hasSelection
                        ? `Sync ${unsynced} selected`
                        : "Sync now"}
                  </Button>
                </Footer>
              </Body>
            )}

            {phase === "syncing" && (
              <Body>
                <div className="mx-auto size-[52px] animate-spin rounded-full border-4 border-panel-2 border-t-accent-sig" />
                <Head>Syncing…</Head>
                <Sub>
                  Pushing {reduced ? run.total : Math.round((progress / 100) * run.total)} of {run.total}{" "}
                  {run.scoped ? "selected " : ""}vouchers
                </Sub>
                {!reduced && (
                  <div className="mx-auto mt-4 h-1.5 w-[210px] overflow-hidden rounded-full bg-panel-2">
                    <div
                      className="h-full rounded-full bg-brand-vivid transition-[width] duration-150 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                <Footer>
                  <Button variant="ghost" className="w-full" onClick={cancelSync}>Cancel</Button>
                </Footer>
              </Body>
            )}

            {phase === "synced" && (
              <Body>
                <StatusRing tone="ok"><Check className="size-6" strokeWidth={2.4} /></StatusRing>
                <Head>{run.scoped ? "Selection synced" : "All synced"}</Head>
                <Sub>
                  {run.ok} {run.ok === 1 ? "voucher is" : "vouchers are"} in Tally now.
                </Sub>
                <LastSynced at={lastSync} />
                <Footer>
                  <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Done</Button>
                </Footer>
              </Body>
            )}

            {phase === "failed" && (
              <Body>
                <StatusRing tone="err"><AlertCircle className="size-6" strokeWidth={2.2} /></StatusRing>
                <Head>{failedCount} {failedCount === 1 ? "voucher" : "vouchers"} failed to sync</Head>
                <Sub>{run.ok} synced successfully · Tally rejected the rest</Sub>
                <Breakdown items={run.failed} dot="bg-danger-dot" />
                <Footer>
                  <Button className="w-full" onClick={() => runSync("retry")}>
                    Retry failed {failedCount === 1 ? "voucher" : "vouchers"}
                  </Button>
                </Footer>
              </Body>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── local layout kit — one grammar across all five states ── */

function Body({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise flex flex-col pt-2 text-center">{children}</div>
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3.5 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
      {children}
    </h2>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[12.5px] leading-relaxed text-muted-ink">{children}</p>
}

const RING_TONE = {
  accent: "border-accent-subtle text-accent-sig",
  ok: "border-success-line text-success",
  warn: "border-warning/30 text-warning",
  err: "border-danger-line text-danger",
} as const

function StatusRing({ tone, children }: { tone: keyof typeof RING_TONE; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "animate-expand mx-auto grid size-[52px] place-items-center rounded-full border-2 bg-surface",
        RING_TONE[tone],
      )}
    >
      {children}
    </div>
  )
}

/** the per-reason breakdown — count × plain-English cause */
function Breakdown({ items, dot }: { items: { n: number; label: string }[]; dot: string }) {
  return (
    <div className="mt-4 rounded-lg bg-sunken px-3.5 text-left">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "flex items-center gap-2.5 py-2 text-[12.5px]",
            i > 0 && "border-t border-divider",
          )}
        >
          <span className={cn("size-[7px] flex-none rounded-full", dot)} />
          <span className="min-w-[26px] font-mono font-medium tabular-nums text-ink">{it.n} ×</span>
          <span className="text-body">{it.label}</span>
        </div>
      ))}
    </div>
  )
}

function LastSynced({ at }: { at: string }) {
  return (
    <div className="mt-3.5 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-panel px-2.5 py-1 text-[12px] font-medium text-muted-ink">
        <span className="size-[6px] rounded-full bg-accent-sig" />
        Last synced {at}
      </span>
    </div>
  )
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-col gap-1.5">{children}</div>
}
