import { StoreProvider, useBill } from "@/state/store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { BillsScreen } from "@/components/screens/BillsScreen"
import { EntryScreen } from "@/components/screens/EntryScreen"
import { ReadScreen } from "@/components/screens/ReadScreen"
import { CockpitScreen } from "@/components/screens/CockpitScreen"
import { DialogHost } from "@/components/dialogs/DialogHost"
import { SimControls } from "@/components/SimControls"
import { ScreenFade } from "@/components/motion/ScreenFade"
import { ToastProvider } from "@/components/common/toast"
import { CommandPalette } from "@/components/CommandPalette"
import { ShortcutsDialog } from "@/components/ShortcutsDialog"

function screenFor(screen: string) {
  switch (screen) {
    case "entry":
      return <EntryScreen />
    case "read":
      return <ReadScreen />
    case "cockpit":
      return <CockpitScreen />
    default:
      return <BillsScreen />
  }
}

function Stage() {
  const { state } = useBill()
  // crossfade on route change (out 100ms → swap → in 150ms)
  return <ScreenFade screen={state.screen}>{screenFor(state.screen)}</ScreenFade>
}

export default function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <ToastProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="relative flex-1 overflow-auto">
                <Stage />
              </main>
            </div>
            <DialogHost />
            <SimControls />
            <CommandPalette />
            <ShortcutsDialog />
          </div>
        </ToastProvider>
      </TooltipProvider>
    </StoreProvider>
  )
}
