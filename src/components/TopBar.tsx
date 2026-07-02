import { useState } from "react"
import { History, Bell, Search, ChevronsUpDown, Plus, RefreshCw, Check } from "lucide-react"
import { useBill } from "@/state/store"
import { useToast } from "@/components/common/toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { state, dispatch } = useBill()
  const toast = useToast()
  const inFlow = state.screen !== "bills"

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-none items-center border-b border-line bg-surface px-5">
      {/* route-driven page title — leftmost */}
      <PageTitle />

      {/* flex spacer — left-anchors the title, right-anchors everything else */}
      <div className="min-w-4 flex-1" />

      {/* global search → command palette (compressed, fixed width) */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_PALETTE" })}
        className="flex h-9 w-[280px] flex-none items-center gap-2.5 rounded-lg border border-line bg-page px-3 text-[13px] text-faint transition-colors duration-150 hover:bg-sunken"
      >
        <Search className="size-4 flex-none" strokeWidth={1.75} />
        <span className="flex-1 truncate text-left font-mono">Search bills, vendors…</span>
        <kbd className="rounded border border-line bg-surface px-1 py-0.5 font-sans text-[11px] font-medium text-faint">
          ⌘K
        </kbd>
      </button>

      {/* org / branch selector — contained workspace switcher */}
      <button
        onClick={() => toast({ message: "Organisation switching — coming soon" })}
        aria-label="Switch organisation"
        className="group ml-3 flex h-9 flex-none items-center gap-2 rounded-lg border border-line bg-surface py-1 pl-1 pr-2 text-left transition-colors duration-150 hover:bg-sunken"
      >
        <span className="grid size-6 flex-none place-items-center rounded-md bg-ink text-[11px] font-semibold text-page">
          A
        </span>
        <span className="hidden min-w-0 items-baseline gap-1.5 sm:flex">
          <span className="truncate text-[13px] font-semibold text-ink">Acme Industries</span>
          <span className="flex-none text-faint">·</span>
          <span className="truncate text-[12px] text-faint">Maharashtra</span>
        </span>
        <ChevronsUpDown className="ml-1 size-3.5 flex-none text-faint transition-colors group-hover:text-body" strokeWidth={1.75} />
      </button>

      {/* vertical divider — 1px × 20px */}
      <div className="mx-3 h-5 w-px flex-none bg-line" />

      {/* right cluster */}
      <div className="flex flex-none items-center gap-2">
        {inFlow && (
          <>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "RESET" })}>
              Start over
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-danger"
              onClick={() => dispatch({ type: "OPEN_DIALOG", dialog: { kind: "discard" } })}
            >
              Discard
            </Button>
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

        {!inFlow && (
          <>
            <SyncButton />
            <Button
              variant="default"
              size="default"
              className="ml-1 h-9 gap-1.5 px-4"
              onClick={() => dispatch({ type: "SHOW", screen: "entry" })}
            >
              <Plus className="size-4" strokeWidth={2} />
              New bill
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

/** Title driven by the current route. Simple pages show a single word;
 *  nested flow screens show a "Bills › context" breadcrumb, the "Bills"
 *  part linking back to the list. */
function PageTitle() {
  const { state, dispatch } = useBill()
  const nested: Record<string, string> = {
    entry: "New bill",
    read: "Reading document",
    cockpit: state.vendor,
  }
  const context = nested[state.screen]

  if (!context) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
        <span className="flex-none text-body">Payables</span>
        <span className="flex-none text-faint">/</span>
        <span className="min-w-0 truncate font-semibold text-ink">Bills</span>
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
      <span className="flex-none text-[18px] text-faint">›</span>
      <span className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
        {context}
      </span>
    </div>
  )
}

/** Secondary "Sync" action: idle → spinning "Syncing…" → brief "Synced". */
function SyncButton() {
  const [phase, setPhase] = useState<"idle" | "syncing" | "done">("idle")
  const syncing = phase === "syncing"
  const done = phase === "done"

  const run = () => {
    if (phase !== "idle") return
    setPhase("syncing")
    window.setTimeout(() => {
      setPhase("done")
      window.setTimeout(() => setPhase("idle"), 2000)
    }, 1400)
  }

  return (
    <button
      onClick={run}
      disabled={syncing}
      className={cn(
        "group flex h-9 flex-none items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium transition-colors duration-150",
        done ? "text-success" : "text-body",
        !syncing && !done && "hover:bg-sunken hover:text-ink",
        syncing && "cursor-default",
      )}
    >
      {done ? (
        <Check className="size-3.5 flex-none text-success" strokeWidth={2} />
      ) : (
        <RefreshCw
          className={cn(
            "size-3.5 flex-none transition-colors",
            // the sync promise glows in bright teal at rest + while spinning;
            // completion hands off to the sage "Synced" check
            syncing ? "animate-spin text-primary-bright" : "text-primary-bright",
          )}
          strokeWidth={1.75}
        />
      )}
      <span>{syncing ? "Syncing…" : done ? "Synced" : "Sync"}</span>
    </button>
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
      aria-label={label}
      className="relative grid size-9 place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-panel hover:text-body"
    >
      {children}
      {dot && <span className="absolute right-[8px] top-[8px] size-1.5 rounded-full bg-accent-sig ring-2 ring-background" />}
    </button>
  )
}
