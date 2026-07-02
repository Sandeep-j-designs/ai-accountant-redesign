import { Fragment } from "react"
import { Check } from "lucide-react"
import { useBill } from "@/state/store"
import { cn } from "@/lib/utils"

const STAGES = [
  { key: "upload", label: "Upload" },
  { key: "extract", label: "Extract" },
  { key: "verify", label: "Verify" },
] as const

const SCREEN_STAGE: Record<string, number> = { entry: 0, read: 1, cockpit: 2 }

type NodeState = "done" | "active" | "error" | "upcoming"

/** Persistent Upload → Extract → Verify stepper across the in-flow screens. */
export function FlowStepper() {
  const { state } = useBill()
  const current = SCREEN_STAGE[state.screen]
  if (current === undefined) return null // bills / out of flow

  const stateFor = (i: number): NodeState => {
    if (i === 1 && state.screen === "read" && state.readError) return "error"
    if (i < current) return "done"
    if (i === current) return "active"
    return "upcoming"
  }

  return (
    <div className="flex-none border-b border-line bg-background px-5 py-2.5">
      <div className="mx-auto flex max-w-[560px] items-center">
        {STAGES.map((stage, i) => {
          const ns = stateFor(i)
          return (
            <Fragment key={stage.key}>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-[20px] flex-none place-items-center rounded-full text-[11px] font-medium transition-colors",
                    ns === "done" && "bg-success text-white",
                    ns === "active" && "bg-accent-sig text-accent-sig-contrast",
                    ns === "error" && "bg-danger text-white",
                    ns === "upcoming" && "border border-line-2 text-faint",
                  )}
                  aria-current={ns === "active" ? "step" : undefined}
                >
                  {ns === "done" ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : ns === "error" ? (
                    "!"
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] transition-colors",
                    ns === "upcoming" ? "text-faint" : "font-medium text-ink",
                    ns === "error" && "text-danger",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span className="relative mx-3 h-px flex-1 overflow-hidden bg-line-2">
                  <span
                    className="absolute inset-0 origin-left bg-success/50 transition-transform duration-[var(--dur-med)] ease-[var(--ease-enter)]"
                    style={{ transform: i < current ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </span>
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
