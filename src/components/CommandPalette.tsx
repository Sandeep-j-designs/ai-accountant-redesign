import { useEffect, useMemo, useState, type ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  FilePlus2,
  LayoutList,
  ScanLine,
  SunMoon,
  History,
  ReceiptText,
  Truck,
  Clock,
} from "lucide-react"
import { useBill } from "@/state/store"
import { useTheme } from "@/hooks/useTheme"
import { useToast } from "@/components/common/toast"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { BILLS, VENDORS } from "@/data/invoice"

type Group = "Actions" | "Bills" | "Vendors"
interface Cmd {
  id: string
  group: Group
  label: string
  sub?: string
  keywords?: string
  icon: ReactNode
  run: () => void
}

export function CommandPalette() {
  const { state, dispatch } = useBill()
  const { toggle } = useTheme()
  const toast = useToast()
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<string[]>(["new-bill", "goto-bills"])

  const open = state.paletteOpen
  const setOpen = (o: boolean) => dispatch({ type: "TOGGLE_PALETTE", open: o })

  // global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        dispatch({ type: "TOGGLE_PALETTE" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dispatch])

  const commands: Cmd[] = useMemo(() => {
    const actions: Cmd[] = [
      { id: "new-bill", group: "Actions", label: "Create new bill", icon: <FilePlus2 />, run: () => dispatch({ type: "SHOW", screen: "entry" }) },
      { id: "goto-bills", group: "Actions", label: "Go to Bills", icon: <LayoutList />, run: () => dispatch({ type: "SHOW", screen: "bills" }) },
      { id: "verify", group: "Actions", label: "Verify current bill", sub: BILLS[0].number, icon: <ScanLine />, run: () => dispatch({ type: "ENTER_COCKPIT" }) },
      { id: "theme", group: "Actions", label: "Toggle theme", icon: <SunMoon />, run: () => toggle() },
    ]
    if (state.screen === "cockpit") {
      actions.push({ id: "activity", group: "Actions", label: "Open activity", icon: <History />, run: () => dispatch({ type: "TOGGLE_ACTIVITY", open: true }) })
    }
    const bills: Cmd[] = BILLS.map((b) => ({
      id: `bill-${b.id}`,
      group: "Bills",
      label: b.vendor,
      sub: b.number,
      keywords: `${b.number} ${b.status}`,
      icon: <ReceiptText />,
      run: () =>
        b.demo
          ? dispatch({ type: "ENTER_COCKPIT" })
          : toast({ message: <>Opening <b className="font-medium">{b.number}</b></> }),
    }))
    const vendors: Cmd[] = VENDORS.map((v, i) => ({
      id: `vendor-${i}`,
      group: "Vendors",
      label: v.name,
      sub: v.gstin,
      keywords: v.gstin,
      icon: <Truck />,
      run: () => toast({ message: <>Vendor <b className="font-medium">{v.name}</b></> }),
    }))
    return [...actions, ...bills, ...vendors]
  }, [dispatch, toggle, toast, state.screen])

  const exec = (c: Cmd) => {
    setOpen(false)
    setRecent((r) => [c.id, ...r.filter((x) => x !== c.id)].slice(0, 4))
    c.run()
  }

  const byGroup = (g: Group) => commands.filter((c) => c.group === g)
  const recentCmds = query === "" ? recent.map((id) => commands.find((c) => c.id === id)).filter(Boolean) as Cmd[] : []

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[75] bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-100" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[16%] z-[76] w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-line-2 bg-raised shadow-pop duration-100 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-1"
          aria-label="Command palette"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command className="border-0 bg-transparent" loop>
            <CommandInput placeholder="Search bills, vendors, actions…" value={query} onValueChange={setQuery} />
            <CommandList className="max-h-[340px]">
              <CommandEmpty>No matches.</CommandEmpty>

              {recentCmds.length > 0 && (
                <CommandGroup heading="Recent">
                  {recentCmds.map((c) => (
                    <Row key={`recent-${c.id}`} cmd={c} onSelect={() => exec(c)} recent />
                  ))}
                </CommandGroup>
              )}

              {(["Actions", "Bills", "Vendors"] as Group[]).map((g) => (
                <CommandGroup key={g} heading={g}>
                  {byGroup(g).map((c) => (
                    <Row key={c.id} cmd={c} onSelect={() => exec(c)} />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Row({ cmd, onSelect, recent }: { cmd: Cmd; onSelect: () => void; recent?: boolean }) {
  return (
    <CommandItem value={`${cmd.label} ${cmd.sub ?? ""} ${cmd.keywords ?? ""}`} onSelect={onSelect}>
      <span className="flex size-[26px] flex-none place-items-center justify-center rounded-md border border-line text-faint [&_svg]:size-[15px]">
        {recent ? <Clock /> : cmd.icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink">{cmd.label}</span>
      {cmd.sub && <span className="code flex-none text-[11px] text-faint">{cmd.sub}</span>}
    </CommandItem>
  )
}
