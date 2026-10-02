import { useLayoutEffect } from "react"
import { StoreProvider, useBill } from "@/state/store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { BillsScreen } from "@/components/screens/BillsScreen"
import { EntryScreen } from "@/components/screens/EntryScreen"
import { ReadScreen } from "@/components/screens/ReadScreen"
import { CockpitScreen } from "@/components/screens/CockpitScreen"
import { BillDetailScreen } from "@/components/screens/BillDetailScreen"
import { SettingsScreen } from "@/components/screens/SettingsScreen"
import { ChartOfAccountsScreen } from "@/components/screens/ChartOfAccountsScreen"
import { InventoryScreen } from "@/components/screens/InventoryScreen"
import { SyncEngine } from "@/components/sync/SyncEngine"
import { DialogHost } from "@/components/dialogs/DialogHost"
import { SimControls } from "@/components/SimControls"
import { InstrumentationPanel } from "@/components/InstrumentationPanel"
import { ScreenFade } from "@/components/motion/ScreenFade"
import { ToastProvider } from "@/components/common/toast"
import { CommandPalette } from "@/components/CommandPalette"
import { ShortcutsDialog } from "@/components/ShortcutsDialog"
import { ButtonDemo } from "@/components/ButtonDemo"
import { RunWatcher } from "@/components/bills/RunStrip"

function screenFor(screen: string) {
  switch (screen) {
    case "entry":
      return <EntryScreen />
    case "read":
      return <ReadScreen />
    case "cockpit":
      return <CockpitScreen />
    case "billDetail":
      return <BillDetailScreen />
    case "settings":
      return <SettingsScreen />
    case "coa":
      return <ChartOfAccountsScreen />
    case "inventory":
      return <InventoryScreen />
    default:
      return <BillsScreen />
  }
}

function Stage() {
  const { state } = useBill()
  useLayoutEffect(() => { document.getElementById("workspace-main")?.scrollTo(0, 0) }, [state.screen])
  // crossfade on route change (out 100ms → swap → in 150ms). RunWatcher and
  // SyncEngine sit OUTSIDE the fade so an in-flight upload — or an in-flight
  // push to Tally — survives every route change AND every company switch. A run
  // that only finishes while you watch it is not a background run.
  return (
    <>
      <RunWatcher />
      <SyncEngine />
      <ScreenFade screen={state.screen}>{screenFor(state.screen)}</ScreenFade>
    </>
  )
}

export default function App() {
  // gated preview of the primary inset-ring button: /?demo=button
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "button"
  ) {
    return <ButtonDemo />
  }

  return (
    <StoreProvider>
      <TooltipProvider>
        <ToastProvider>
          <div className="accountant-app flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar />
              <main id="workspace-main" className="relative flex-1 overflow-auto">
                <Stage />
              </main>
            </div>
            <DialogHost />
            <SimControls />
            <InstrumentationPanel />
            <CommandPalette />
            <ShortcutsDialog />
          </div>
        </ToastProvider>
      </TooltipProvider>
    </StoreProvider>
  )
}
