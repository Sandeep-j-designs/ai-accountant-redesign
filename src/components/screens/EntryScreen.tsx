import { useState } from "react"
import { Upload } from "lucide-react"
import { useBill } from "@/state/store"
import { cn } from "@/lib/utils"
import { LAST_VOUCHER } from "@/data/invoice"

export function EntryScreen() {
  const { dispatch } = useBill()
  const [drag, setDrag] = useState(false)

  const start = () => dispatch({ type: "START_READ" })

  return (
    <div className="flex min-h-full items-center justify-center p-10">
      <div className="w-full max-w-[520px]">
        <h1 className="masthead text-[24px] text-ink">New bill</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-ink">
          Drop a document. It is read into a draft voucher — supplier, line
          items, GST and ledgers — and you confirm only what needs judgment.
        </p>

        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a bill or browse to upload"
          onClick={start}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              start()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            start()
          }}
          className={cn(
            "mt-6 cursor-pointer rounded-xl border-[1.5px] border-dashed bg-card px-9 py-[48px] text-center transition-all",
            "outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
            drag
              ? "-translate-y-px border-ink bg-panel"
              : "border-line-strong hover:-translate-y-px hover:border-ink",
          )}
        >
          <div className="mx-auto mb-3.5 grid size-12 place-items-center rounded-lg bg-panel-2 text-ink">
            <Upload className="size-[22px]" strokeWidth={1.8} />
          </div>
          <div className="text-[16px] font-medium tracking-[-0.01em] text-ink">
            Drop a bill, or browse
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-faint">
            PDF · PNG · JPG
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-[12.5px] text-faint">
          <button
            className="font-medium text-ink underline underline-offset-2 hover:text-black"
            onClick={() => dispatch({ type: "START_MANUAL" })}
          >
            Enter manually instead
          </button>
          <span>
            Last voucher{" "}
            <span className="font-mono text-body">{LAST_VOUCHER}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
