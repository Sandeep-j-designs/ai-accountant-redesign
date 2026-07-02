import { useEffect, useState, type ReactNode } from "react"
import { Check, AlertCircle, FileText, TriangleAlert, RefreshCw } from "lucide-react"
import { useBill, type ReadError } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/common/Skeleton"
import { InvoiceDocument } from "@/components/InvoiceDocument"
import { READ_CHIPS, READ_STEPS } from "@/data/invoice"

// regions lit up by the OCR pass, in the order the beam reaches them
const DETECT_SEQUENCE: [string, number][] = [
  ["supplier", 450],
  ["voucher", 800],
  ["line1", 1300],
  ["line2", 1750],
  ["tax", 2200],
]

export function ReadScreen() {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [scanning, setScanning] = useState(true)
  const [detected, setDetected] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [doneText, setDoneText] = useState<null | [string, string]>(null)
  const [eta, setEta] = useState(3)
  const [failed, setFailed] = useState(false)

  const err = state.readError

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let iv: ReturnType<typeof setInterval> | undefined

    // ── failure paths: read a little, then surface an explicit state ──
    if (err) {
      if (reduced) {
        setScanning(false)
        setFailed(true)
        return
      }
      const failAt = err === "unreadable" ? 900 : err === "faint" ? 1300 : 2200
      if (err !== "unreadable") {
        const upto = err === "vendor" ? READ_CHIPS.length : 3
        DETECT_SEQUENCE.forEach(([key, t]) => {
          if (t < failAt) timers.push(setTimeout(() => setDetected((d) => (d.includes(key) ? d : [...d, key])), t))
        })
        for (let i = 0; i < upto; i++) {
          timers.push(setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 600 + i * 280))
        }
      }
      timers.push(
        setTimeout(() => {
          setScanning(false)
          setActive(null)
          setFailed(true)
        }, failAt),
      )
      return () => timers.forEach(clearTimeout)
    }

    // ── reduced-motion: jump straight to the cockpit ──
    if (reduced) {
      setRevealed(READ_CHIPS.length)
      setDetected(DETECT_SEQUENCE.map(([k]) => k))
      setScanning(false)
      timers.push(setTimeout(() => dispatch({ type: "ENTER_COCKPIT" }), 350))
      return () => timers.forEach(clearTimeout)
    }

    // ── success path ──
    for (let i = 1; i < READ_STEPS.length; i++) {
      timers.push(setTimeout(() => setStep(i), i * 700))
    }
    DETECT_SEQUENCE.forEach(([key, t]) => {
      timers.push(
        setTimeout(() => {
          setDetected((d) => (d.includes(key) ? d : [...d, key]))
          setActive(key)
        }, t),
      )
    })
    READ_CHIPS.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 600 + i * 300))
    })
    iv = setInterval(() => setEta((e) => Math.max(0, e - 1)), 850)
    timers.push(
      setTimeout(() => {
        setScanning(false)
        setActive(null)
        if (iv) clearInterval(iv)
        setDoneText([
          "Read complete",
          "Supplier, line items and totals matched · 3 decisions owed.",
        ])
      }, 2700),
    )
    timers.push(setTimeout(() => dispatch({ type: "ENTER_COCKPIT" }), 3300))

    return () => {
      timers.forEach(clearTimeout)
      if (iv) clearInterval(iv)
    }
  }, [err, reduced, dispatch])

  const [title, sub] = doneText ?? READ_STEPS[step]

  return (
    <div className="grid min-h-full grid-cols-[44%_1fr]">
      {/* left: a real uploaded document under an OCR pass */}
      <div className="flex items-start justify-center border-r border-line bg-surface p-8 pt-10">
        <div className="w-full max-w-[460px]">
          <div className="flex items-center justify-between rounded-t-lg border border-line-2 bg-card px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="size-4 flex-none text-faint" strokeWidth={1.8} />
              <span className="truncate text-[12px] font-medium text-body">
                Sundar-Logistics-invoice.pdf
              </span>
            </div>
            <span className="flex flex-none items-center gap-1.5 font-mono text-[10.5px] text-faint">
              {scanning ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-accent-sig" />
                  reading
                </>
              ) : failed ? (
                <span className={err === "vendor" ? "text-warning" : "text-danger"}>halted</span>
              ) : (
                "1 / 1"
              )}
            </span>
          </div>

          <div className="rounded-b-lg border-x border-b border-line-2 bg-panel-2 px-6 py-7 shadow-lift">
            <div className={cn("relative mx-auto rotate-[-0.4deg]", failed && err !== "vendor" && "opacity-60 grayscale")}>
              <InvoiceDocument grain detected={detected} highlight={active} />

              {scanning && !reduced && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[5px] bg-ink/[0.04]"
                    style={{ animation: "scan-reveal 2.6s linear forwards" }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{ animation: "scan-beam 2.6s linear forwards" }}
                  >
                    <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-ink/10" />
                    <div className="h-px bg-ink/60 shadow-[0_0_10px_1px_rgba(20,20,16,0.35)]" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* right: fields read off the page — or an explicit failure state */}
      <div className="flex flex-col justify-center px-14 py-12">
        {failed && err ? (
          <ReadErrorPanel kind={err} />
        ) : (
          <>
            <div className="text-[17px] font-medium tracking-[-0.01em] text-ink">{title}</div>
            <p className="mb-2 mt-1 text-[13px] text-faint">{sub}</p>

            {!doneText && !reduced && (
              <p className="mb-6 flex items-center gap-1.5 text-[11.5px] text-muted-ink">
                <span className="size-1.5 rounded-full bg-accent-sig" />
                Extracting · {eta > 0 ? `~${eta}s remaining` : "almost done"}
              </p>
            )}
            {(doneText || reduced) && <div className="mb-6" />}

            <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint">
              {doneText ? "Read from the document" : "Reading into fields…"}
            </div>

            <div className="flex max-w-[440px] flex-col gap-2">
              {READ_CHIPS.map((chip, i) => {
                const shown = i < revealed
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-card px-3.5 py-2.5 text-[13px] transition-all duration-300",
                      chip.mk === "q" ? "border-line-2" : "border-line",
                      shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-[17px] flex-none place-items-center rounded-full text-white",
                        chip.mk === "ok" ? "bg-ink/70" : "bg-warning",
                      )}
                    >
                      {chip.mk === "ok" ? (
                        <Check className="size-2.5" strokeWidth={3} />
                      ) : (
                        <AlertCircle className="size-2.5" strokeWidth={2.6} />
                      )}
                    </span>
                    <span className="text-body" dangerouslySetInnerHTML={{ __html: chip.html }} />
                  </div>
                )
              })}
            </div>

            {/* skeleton preview — shaped like the decision cards that follow */}
            {!doneText && (
              <div className="mt-6 max-w-[440px]">
                <div className="eyebrow mb-2">Up next in Verify · 3 decisions</div>
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border border-line bg-card px-4 py-3.5">
                      <Skeleton className="h-2 w-16" />
                      <Skeleton className="mt-2.5 h-3 w-3/4" />
                      <Skeleton className="mt-2 h-2.5 w-1/2 bg-panel/70" />
                      <div className="mt-3.5 flex gap-2">
                        <Skeleton className="h-7 w-24 rounded-full" />
                        <Skeleton className="h-7 w-20 rounded-full bg-panel/70" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ERR_CONFIG: Record<
  Exclude<ReadError, null>,
  { tag: string; tone: "danger" | "warning"; title: string; body: string }
> = {
  unreadable: {
    tag: "Can't read file",
    tone: "danger",
    title: "Couldn't open this document.",
    body: "The file may be corrupt or password-protected. Try another file, or capture the essentials by hand.",
  },
  faint: {
    tag: "Read failed",
    tone: "danger",
    title: "Amounts were too faint to read.",
    body: "The scan didn't return the figures with confidence. Re-scan the document, or enter the essentials by hand.",
  },
  vendor: {
    tag: "Vendor not found",
    tone: "warning",
    title: "Supplier isn't in your vendor master.",
    body: "The bill read cleanly, but Sundar Logistics Pvt Ltd didn't match a vendor on file. Add it or match an existing one — you can finish either way.",
  },
}

function ReadErrorPanel({ kind }: { kind: Exclude<ReadError, null> }) {
  const { dispatch } = useBill()
  const c = ERR_CONFIG[kind]

  const actions: { label: ReactNode; primary?: boolean; onClick: () => void }[] =
    kind === "vendor"
      ? [
          { label: "Add & continue", primary: true, onClick: () => dispatch({ type: "ENTER_COCKPIT" }) },
          { label: "Match manually", onClick: () => dispatch({ type: "ENTER_COCKPIT" }) },
        ]
      : kind === "faint"
        ? [
            { label: (<><RefreshCw className="size-3.5" strokeWidth={2} /> Try again</>), primary: true, onClick: () => dispatch({ type: "START_READ" }) },
            { label: "Enter manually", onClick: () => dispatch({ type: "START_MANUAL" }) },
          ]
        : [
            { label: "Choose another file", primary: true, onClick: () => dispatch({ type: "SHOW", screen: "entry" }) },
            { label: "Enter manually", onClick: () => dispatch({ type: "START_MANUAL" }) },
          ]

  return (
    <div className="max-w-[440px]">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
          c.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning",
        )}
      >
        <TriangleAlert className="size-3.5" strokeWidth={2} />
        {c.tag}
      </span>
      <h2 className="mt-3 text-[19px] font-medium tracking-[-0.01em] text-ink">{c.title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-body">{c.body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {actions.map((a, i) =>
          a.primary ? (
            <Button key={i} onClick={a.onClick} className="gap-2">
              {a.label}
            </Button>
          ) : (
            <Button key={i} variant="outline" onClick={a.onClick} className="gap-2 text-body">
              {a.label}
            </Button>
          ),
        )}
      </div>
    </div>
  )
}
