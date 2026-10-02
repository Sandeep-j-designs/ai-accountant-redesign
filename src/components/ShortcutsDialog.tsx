import { useEffect, type ReactNode } from "react"
import { useBill } from "@/state/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog"
import { Kbd } from "@/components/cockpit/kit"

const GROUPS: { heading: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    heading: "Global",
    rows: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this cheatsheet" },
    ],
  },
  {
    heading: "Verify",
    rows: [
      { keys: ["↑", "↓"], label: "Move between open decisions" },
      { keys: ["↵"], label: "Accept the decision · advance the chain" },
      { keys: ["E"], label: "Override" },
      { keys: ["F"], label: "Flag for review" },
      { keys: ["R"], label: "Challenge a settled field (Tab to it first)" },
      { keys: ["A"], label: "Expand / collapse additional details" },
      { keys: ["Esc"], label: "Close an open override or menu" },
    ],
  },
  {
    heading: "Post to Tally",
    rows: [
      { keys: ["↵"], label: "From a clean board, review the posting" },
      { keys: ["⌘", "↵"], label: "Jump straight to the posting preview" },
      { keys: ["↵"], label: "In the preview, post to Tally" },
      { keys: ["Esc"], label: "In the preview, step back to the board" },
    ],
  },
]

export function ShortcutsDialog() {
  const { state, dispatch } = useBill()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return
      const el = e.target as HTMLElement
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable ||
        !!el?.closest?.("[cmdk-root]")
      if (typing) return
      e.preventDefault()
      dispatch({ type: "TOGGLE_HELP" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dispatch])

  return (
    <Dialog open={state.helpOpen} onOpenChange={(o) => dispatch({ type: "TOGGLE_HELP", open: o })}>
      <DialogContent className="w-[440px]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="eyebrow mb-2">{g.heading}</div>
              <div className="flex flex-col">
                {g.rows.map((r, i) => (
                  <Row key={r.label} first={i === 0} keys={r.keys} label={r.label} />
                ))}
              </div>
            </div>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function Row({ keys, label, first }: { keys: string[]; label: ReactNode; first: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-between gap-4 py-2" + (first ? "" : " border-t border-line/60")
      }
    >
      <span className="text-[13px] text-body">{label}</span>
      <span className="flex flex-none items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
    </div>
  )
}
