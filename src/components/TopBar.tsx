import { useEffect, useMemo, useState } from "react"
import {
  History,
  Bell,
  Search,
  ChevronsUpDown,
  ChevronDown,
  Check,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Settings,
  Sun,
  Moon,
  RefreshCw,
} from "lucide-react"
import { useBill, companySync, REGISTER_SCREENS } from "@/state/store"
import { COMPANIES, companyById } from "@/data/companies"
import { useToast } from "@/components/common/toast"
import { useTheme } from "@/hooks/useTheme"
import { SyncModal } from "@/components/sync/SyncModal"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { CURRENT_USER } from "@/data/invoice"
import { REVIEW_ITEMS, bulkReviewItems, COCKPIT_REVIEW_ID } from "@/data/review"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { state, dispatch } = useBill()
  const toast = useToast()
  // "in a flow" means mid-document: the escape hatches show and the Sync button
  // hides. Settings is a destination, not a flow — it keeps the full chrome, and
  // must keep the Sync button so a run can be started from either surface.
  const inFlow =
    state.screen !== "billDetail" && !REGISTER_SCREENS.includes(state.screen)

  return (
    <header className="app-topbar sticky top-0 z-20 flex h-14 flex-none items-center border-b border-line bg-surface px-5">
      {/* route-driven page title — leftmost */}
      <PageTitle />

      {/* flex spacer — left-anchors the title, right-anchors everything else */}
      <div className="min-w-4 flex-1" />

      {/* global search → command palette, with a per-module scope selector */}
      <SearchBar />

      {/* org / branch selector — a proper workspace switcher: indigo-gradient
          monogram, stacked org + branch, firmer edge with a micro-shadow */}
      <CompanySwitcher />

      {/* vertical divider — 1px × 20px */}
      <div className="mx-3 h-5 w-px flex-none bg-line" />

      {/* right cluster */}
      <div className="flex flex-none items-center gap-3">
        {inFlow && (
          <>
            {/* destructive flow controls live behind an overflow, each gated
                by a confirmation dialog — never one accidental click away */}
            <FlowMenu />
            <span className="mx-1 h-5 w-px bg-line-2" />
          </>
        )}

        {/* icon buttons — 4px gap */}
        <div className="flex items-center gap-1">
          {state.screen === "cockpit" && (
            <IconButton label="Activity" onClick={() => dispatch({ type: "TOGGLE_ACTIVITY" })}>
              <History className="size-[18px]" strokeWidth={1.75} />
            </IconButton>
          )}

          <IconButton label="Notifications" onClick={() => toast({ message: "No new notifications" })} dot>
            <Bell className="size-[18px]" strokeWidth={1.75} />
          </IconButton>
        </div>

        {!inFlow && <SyncModal />}

        {/* settings · appearance · profile — moved here from the sidebar
            footer; always visible regardless of flow state, anchored as the
            rightmost cluster */}
        <div className="ml-1 flex items-center gap-1">
          <details className="preferences-menu relative" onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus() } }}>
            <summary aria-label="Preferences" title="Preferences" className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-faint hover:bg-panel"><Settings className="size-[18px]" strokeWidth={1.75} /></summary>
            <div className="absolute right-0 top-11 z-40 w-56 rounded-lg border border-line bg-surface p-2 shadow-overlay">
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[14px] text-body hover:bg-panel" onClick={e => { e.currentTarget.closest("details")?.removeAttribute("open"); dispatch({ type: "SHOW", screen: "settings" }) }}><Settings size={16} /> Workspace settings</button>
              <div className="flex items-center justify-between px-3 text-[14px] text-body">Appearance <ThemeToggleButton /></div>
            </div>
          </details>
          <ProfileButton />
        </div>
      </div>
    </header>
  )
}

/** Title driven by the current route. Simple pages show a single word;
 *  nested flow screens show a "Bills › context" breadcrumb, the "Bills"
 *  part linking back to the list. */
function PageTitle() {
  const { state, dispatch } = useBill()
  // the detail screen's Prev/Next can land on any bill in the Needs-review
  // list, not just the Sundar walkthrough — look its vendor up by id rather
  // than assuming the global fact state (which only Sundar's bill uses).
  const cockpitVendor = useMemo(() => {
    const id = state.reviewBillId ?? COCKPIT_REVIEW_ID
    if (id === COCKPIT_REVIEW_ID) return state.vendor
    const all = [...REVIEW_ITEMS, ...bulkReviewItems(state.ingestedIds)]
    return all.find((i) => i.billId === id)?.vendor ?? state.vendor
  }, [state.reviewBillId, state.vendor, state.ingestedIds])
  const nested: Record<string, string> = {
    entry: "New bill",
    read: "Reading document",
    cockpit: cockpitVendor,
    billDetail: "Bill details",
  }
  const context = nested[state.screen]

  // settings is its own root, not a leaf under Payables
  if (state.screen === "settings") {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
        <span className="min-w-0 truncate font-semibold text-ink">Settings</span>
      </div>
    )
  }

  if (!context) {
    // register roots read "Section / Page"
    const [section, page] =
      state.screen === "coa"
        ? ["Accounting", "Chart of Accounts"]
        : state.screen === "inventory"
          ? ["Inventory", "Stock items"]
          : ["Payables", "Bills"]
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
        <span className="flex-none text-body">{section}</span>
        <span className="flex-none text-faint">/</span>
        <span className="min-w-0 truncate font-semibold text-ink">{page}</span>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        onClick={() => dispatch({ type: "SHOW", screen: "bills" })}
        className="flex-none text-[15px] font-medium text-faint transition-colors hover:text-body"
      >
        Bills
      </button>
      <span className="flex-none text-[18px] text-faint">/</span>
      <span className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
        {context}
      </span>
    </div>
  )
}

/** The company switcher. Picking a company re-points the sync at that set of
 *  books — and nothing else: the documents are shared (data/companies.ts).
 *
 *  A run already in flight in the company being LEFT is not cancelled; it is
 *  held in the store and driven by SyncEngine, so it keeps counting down while
 *  the operator works elsewhere. The rows here say so, and the trigger carries
 *  a dot when a company you are not looking at is mid-push — otherwise leaving
 *  a sync would feel like abandoning it. */
function CompanySwitcher() {
  const { state, dispatch } = useBill()
  const [open, setOpen] = useState(false)
  const active = companyById(state.activeCompanyId)

  // Esc closes the menu. A picker you can only dismiss with the mouse is a trap
  // for anyone driving this from the keyboard — and this one sits in front of
  // the sync button, so being stuck in it blocks the primary action.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // a run in some OTHER book — the thing the operator cannot see from here
  const elsewhere = COMPANIES.some(
    (c) => c.id !== state.activeCompanyId && companySync(state, c.id).phase === "syncing",
  )

  return (
    <div className="relative ml-3 flex-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Switch company — currently ${active.name}`}
        className="group flex h-9 flex-none items-center gap-2.5 rounded-lg border border-line-2 bg-surface py-1 pl-1.5 pr-2 text-left shadow-[0_1px_2px_rgba(21,26,38,0.05)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className="relative flex-none">
          <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-[#3146B0] to-[#6478D2] text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            {active.short}
          </span>
          {elsewhere && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-sig ring-2 ring-surface" />
          )}
        </span>
        <span className="hidden min-w-0 sm:flex">
          <span className="truncate text-[13px] font-semibold text-ink">{active.name}</span>
        </span>
        <ChevronsUpDown className="ml-0.5 size-3.5 flex-none text-faint transition-colors group-hover:text-body" strokeWidth={1.75} />
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-[42px] z-40 w-[292px] overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-overlay"
          >
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
              Companies
            </p>
            {COMPANIES.map((c) => {
              const cs = companySync(state, c.id)
              const isActive = c.id === state.activeCompanyId
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    dispatch({ type: "SET_COMPANY", companyId: c.id })
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-panel"
                >
                  <span className="grid size-6 flex-none place-items-center rounded-md bg-gradient-to-br from-[#3146B0] to-[#6478D2] text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                    {c.short}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{c.name}</span>
                    {/* a live push outranks the standing identity — it is the
                        one thing that changes while you are not looking */}
                    {cs.phase === "syncing" ? (
                      <span className="flex items-center gap-1 text-[11.5px] font-medium text-accent-sig-ink">
                        <RefreshCw className="size-3 animate-spin" strokeWidth={2} />
                        Syncing…
                      </span>
                    ) : (
                      <span className="block truncate font-mono text-[11px] text-faint">{c.gstin}</span>
                    )}
                  </span>
                  {isActive && <Check className="size-3.5 flex-none text-brand" strokeWidth={2} />}
                </button>
              )
            })}
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                dispatch({ type: "SHOW", screen: "settings" })
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
            >
              <Settings className="size-3.5 flex-none" strokeWidth={1.75} />
              Sync settings
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** modules the scope selector can point search at — "Bills" is the default
 *  and the only one actually wired to data; the rest are presentational,
 *  same as their (also unwired) sidebar entries. */
const SEARCH_SCOPES = ["Bills", "Vendors", "Payments", "Ledgers", "Reports"]

/** Global search trigger with an in-input scope selector. The scope chip and
 *  the rest of the bar are separate click targets: the chip opens a module
 *  picker, everything else opens the command palette (unchanged behaviour). */
function SearchBar() {
  const { dispatch } = useBill()
  const toast = useToast()
  const [scope, setScope] = useState("Bills")
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        "relative flex h-9 w-[280px] flex-none items-center gap-2 rounded-md border border-line-2 bg-surface px-3 text-[13px] text-faint outline-none transition-colors duration-150 hover:border-line-strong focus-within:border-brand-vivid focus-within:ring-2 focus-within:ring-brand-vivid focus-within:ring-offset-2 focus-within:ring-offset-surface",
        open && "border-brand-vivid ring-2 ring-brand-vivid ring-offset-2 ring-offset-surface",
      )}
    >
      <Search className="size-4 flex-none" strokeWidth={1.75} />

      {/* scope selector — its own click target, separate from the palette trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex flex-none items-center gap-0.5 text-[13px] font-medium text-ink outline-none transition-colors hover:text-brand"
      >
        {scope}
        <ChevronDown className="size-3" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => dispatch({ type: "TOGGLE_PALETTE" })}
        className="flex min-w-0 flex-1 items-center text-left outline-none"
      >
        <span className="flex-1 truncate">Search…</span>
      </button>

      {/* ⌘K styled as a real keycap — 1px border, 4px radius, inset bottom edge */}
      <kbd className="flex-none rounded-xs border border-line bg-surface px-1 py-0.5 font-sans text-[11px] font-medium text-faint shadow-[inset_0_-1px_var(--line)]">
        ⌘K
      </kbd>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="menu"
            className="animate-rise absolute left-0 top-[42px] z-40 w-56 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-overlay"
          >
            {SEARCH_SCOPES.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={scope === m}
                onClick={() => {
                  setScope(m)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
              >
                {m}
                {scope === m && <Check className="size-3.5 flex-none text-brand" strokeWidth={2} />}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                toast({ message: "Advanced search — coming soon" })
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-body transition-colors hover:bg-panel hover:text-ink"
            >
              Advanced search
              <kbd className="flex-none rounded-xs border border-line bg-surface px-1 py-0.5 font-sans text-[11px] font-medium text-faint">
                ⌘⇧K
              </kbd>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Overflow for the in-flow escape hatches — Start over / Discard, both
 *  confirmed via dialog before anything is lost. */
function FlowMenu() {
  const { dispatch } = useBill()
  const [open, setOpen] = useState(false)
  const item =
    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-panel"
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-9 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-vivid/40",
          open ? "bg-panel text-ink" : "text-faint hover:bg-panel hover:text-body",
        )}
      >
        <MoreHorizontal className="size-[18px]" strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-[42px] z-40 w-44 overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-overlay"
          >
            <button
              type="button"
              role="menuitem"
              className={cn(item, "text-body hover:text-ink")}
              onClick={() => {
                setOpen(false)
                dispatch({ type: "OPEN_DIALOG", dialog: { kind: "restart" } })
              }}
            >
              <RotateCcw className="size-3.5 flex-none text-faint" strokeWidth={1.9} />
              Start over…
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(item, "text-danger hover:bg-danger-bg/60")}
              onClick={() => {
                setOpen(false)
                dispatch({ type: "OPEN_DIALOG", dialog: { kind: "discard" } })
              }}
            >
              <Trash2 className="size-3.5 flex-none" strokeWidth={1.9} />
              Discard bill…
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  dot,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  dot?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dot ? `${label} — unread` : label}
      className="relative grid size-9 place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-panel hover:text-body"
    >
      {children}
      {dot && (
        <>
          <span className="absolute right-[8px] top-[8px] size-1.5 rounded-full bg-accent-sig ring-2 ring-background" />
          <span className="sr-only">unread</span>
        </>
      )}
    </button>
  )
}

/** Appearance toggle — moved here from the sidebar footer, same behaviour. */
function ThemeToggleButton() {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggle}
          aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          className="grid size-9 place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-panel hover:text-body"
        >
          {dark ? (
            <Moon className="size-[18px]" strokeWidth={1.75} />
          ) : (
            <Sun className="size-[18px]" strokeWidth={1.75} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Appearance · {theme}</TooltipContent>
    </Tooltip>
  )
}

/** User identity — moved here from the sidebar footer as an icon-only avatar. */
function ProfileButton() {
  const toast = useToast()
  const initials = CURRENT_USER.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => toast({ message: "Profile & account settings — coming soon" })}
          aria-label={`${CURRENT_USER.name} · ${CURRENT_USER.role}`}
          className="grid size-9 place-items-center rounded-full transition-colors hover:bg-panel"
        >
          <span className="grid size-7 place-items-center rounded-full bg-panel-2 text-[11px] font-medium text-muted-ink">
            {initials}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{CURRENT_USER.name} · {CURRENT_USER.role}</TooltipContent>
    </Tooltip>
  )
}
