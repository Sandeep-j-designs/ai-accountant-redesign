import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Upload, Check, Sparkles, FileText, Layers, AlertCircle, X } from "lucide-react"
import { useBill } from "@/state/store"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BulkQueue } from "./BulkQueue"
import { ExtractionRun } from "./ExtractionRun"
import { DocumentStage, UploadSteps, EXTRACTED_FIELDS } from "@/components/upload/DocumentStage"
import { COCKPIT_REVIEW_ID } from "@/data/review"

type Phase = "idle" | "drag" | "reading" | "done" | "error"
const ACCEPT = /\.(pdf|png|jpe?g)$/i

export function EntryScreen() {
  const { state, dispatch } = useBill()
  const reduced = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search)
  const forced = ["drag", "reading", "done", "error"].includes(params?.get("state") ?? "") ? params!.get("state") as Phase : null
  const [phase, setPhase] = useState<Phase>(forced ?? "idle")
  const [errorMessage, setErrorMessage] = useState("Choose a PDF, PNG or JPG to continue.")
  const [filename, setFilename] = useState("sundar-logistics-bill.pdf")
  const [bulk, setBulk] = useState<string[] | null>(params?.get("bulk") || state.run ? [] : null)
  const [batchDemo, setBatchDemo] = useState(params?.get("bulk") !== "1")
  const [revealed, setRevealed] = useState(forced === "done" ? 5 : forced === "reading" ? 2 : 0)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const reading = phase === "reading" || phase === "done"
  const done = phase === "done"
  const pick = () => inputRef.current?.click()
  const beginRead = (name: string) => { setFilename(name); setRevealed(0); setHighlighted(null); setPhase(ACCEPT.test(name) ? "reading" : "error") }
  const receive = (names: string[]) => {
    dragDepth.current = 0
    if (!names.length) { setPhase("idle"); return }
    const invalid = names.find(name => !ACCEPT.test(name))
    if (invalid) { setErrorMessage("Choose a PDF, PNG or JPG to continue."); setFilename(invalid); setPhase("error"); return }
    if (names.length > 8) { setErrorMessage("This prototype previews up to 8 selected files. Try the sample batch for a larger run."); setFilename(`${names.length} files selected`); setPhase("error"); return }
    if (names.length > 1) { setBatchDemo(false); setBulk(names); setPhase("idle") }
    else beginRead(names[0])
  }
  useEffect(() => {
    if (phase !== "reading" || forced) return
    const timers = EXTRACTED_FIELDS.map((_, i) => setTimeout(() => setRevealed(i + 1), reduced ? 0 : [600, 1100, 1900, 2800, 3500][i]))
    timers.push(setTimeout(() => setPhase("done"), reduced ? 20 : 4100))
    return () => timers.forEach(clearTimeout)
  }, [phase, forced, reduced])
  useEffect(() => {
    if (params?.get("demo") !== "1") return
    const timer = setTimeout(() => beginRead("sundar-logistics-bill.pdf"), 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const reset = () => { setBulk(null); setPhase("idle"); setRevealed(0); setHighlighted(null) }

  return <div className={cn("upload-workspace", bulk && "upload-workspace-batch", reading && "upload-workspace-reading")}>
    <div className="upload-page-heading"><div><button className="upload-back" onClick={() => dispatch({ type: "SHOW", screen: "bills" })}><ArrowLeft size={14}/> Bills</button><h1>Add bills</h1></div><UploadSteps step={bulk || reading ? done ? 2 : 1 : 0}/></div>
    <input ref={inputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { receive([...e.target.files ?? []].map(f => f.name)); e.target.value = "" }}/>
    {bulk ? <div className="batch-upload-wrap"><div className="batch-context"><span><Layers size={15}/> {batchDemo ? "Sample batch · simulated processing" : "Selected files · sample extraction results"}</span></div>{batchDemo ? <ExtractionRun onReset={reset} onComplete={() => setPhase("done")}/> : <BulkQueue filenames={bulk.length ? bulk : undefined} onReset={reset} onComplete={() => setPhase("done")}/>}</div> : <>
      <section className={cn("upload-studio", `upload-${phase}`)} aria-label="Bill upload"
        onDragEnter={e => { e.preventDefault(); if (!reading && e.dataTransfer.types.includes("Files")) { dragDepth.current++; setPhase("drag") } }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = reading ? "none" : "copy" }}
        onDragLeave={e => { e.preventDefault(); if (!reading && --dragDepth.current <= 0) { dragDepth.current = 0; setPhase(p => p === "drag" ? "idle" : p) } }}
        onDrop={e => { e.preventDefault(); if (!reading) receive([...e.dataTransfer.files].map(f => f.name)) }}>
        <DocumentStage phase={phase} revealed={revealed} highlighted={highlighted} filename={filename}/>
        <div className="upload-control-panel">
          {!reading ? <>
            <div className="upload-panel-kicker"><span/> {phase === "drag" ? "DOCUMENTS DETECTED" : "YOUR NEXT VOUCHER STARTS HERE"}</div>
            <h2>{phase === "drag" ? <>Let go.<br/>We’ll take it from here.</> : <>Bring your bills.<br/>We’ll prepare the details.</>}</h2>
            <p className="upload-description">Drop one bill or a batch. Review the extracted details before recording.</p>
            <div className="upload-target"><div className="upload-target-icon"><Upload size={22} strokeWidth={1.6}/></div><b>{phase === "drag" ? "Release to add your bills" : "Drag your bills here"}</b><span>PDF, PNG or JPG · up to 8 files in this preview</span><Button size="lg" onClick={pick} icon={<Upload size={16}/>}>Choose files</Button></div>
            {phase === "error" && <div className="upload-error" role="alert"><AlertCircle size={18}/><span><b>Couldn’t add these files</b><span className="block break-all">{filename}</span>{errorMessage}</span><button aria-label="Dismiss file error" onClick={reset}><X size={15}/></button></div>}
            <div className="upload-sample-actions"><span>Explore with a sample</span><div><button onClick={() => beginRead("sundar-logistics-bill.pdf")}><FileText size={15}/> Single bill <ArrowRight size={14}/></button><button onClick={() => { setBatchDemo(true); setBulk([]) }}><Layers size={15}/> Batch upload <ArrowRight size={14}/></button></div></div>
          </> : <>
            <div className="upload-panel-kicker"><span className={done ? "kicker-complete" : ""}/>{done ? "READY FOR YOUR REVIEW" : "EXTRACTING BILL DETAILS"}</div>
            <h2>{done ? "Ready for your review." : "Reading your bill."}</h2>
            <p className="upload-description">{done ? "Two suggestions need your attention." : revealed < 2 ? "Identifying the supplier and invoice." : revealed < 3 ? "Reading line items from the source." : "Preparing tax and ledger suggestions."}</p>
            <div className="extraction-stages" aria-label="Extraction stages">{["Identify", "Read", "Suggest"].map((label, i) => { const current = done ? 3 : revealed < 2 ? 0 : revealed < 3 ? 1 : 2; return <span key={label} className={cn(i < current && "extraction-stage-complete", i === current && "extraction-stage-current")}><i/>{label}</span> })}</div>
            <div className="extraction-fields">{EXTRACTED_FIELDS.map((field, i) => {
              const landed = i < revealed
              return <button key={field.label} disabled={!landed} onMouseEnter={() => landed && setHighlighted(i)} onMouseLeave={() => setHighlighted(null)} onFocus={() => setHighlighted(i)} onBlur={() => setHighlighted(null)} onClick={() => setHighlighted(i)} className={cn("extraction-field", landed && "field-landed", i === revealed && !done && "field-reading", highlighted === i && "field-highlighted")}>
                <span className="extraction-field-icon">{landed ? field.inferred ? <Sparkles size={15}/> : <Check size={15}/> : <span className="field-placeholder-dot"/>}</span>
                <span className="extraction-field-content"><span className="field-label">{field.label}</span>{landed ? <b>{field.value}</b> : <i className="extraction-skeleton"/>}</span>
                {landed && <span className={cn("field-origin", field.inferred && "origin-suggested")}>{field.inferred ? "Suggested" : "Read"}</span>}
              </button>
            })}</div>
            <div className="extraction-footer"><div className="extraction-meter" role="progressbar" aria-label="Fields extracted" aria-valuemin={0} aria-valuemax={5} aria-valuenow={revealed}><span style={{ width: `${revealed * 20}%` }}/></div><div className="extraction-count" aria-live="polite">{done ? "3 fields read · 2 suggestions" : `${revealed} of 5 fields extracted`}<span>{done ? <Check size={14}/> : "Sample extraction"}</span></div></div>
            <div className="extraction-handoff"><Button disabled={!done} size="lg" onClick={() => dispatch({ type: "ENTER_COCKPIT", billId: COCKPIT_REVIEW_ID })}>{done ? "Review draft" : "Preparing draft…"} <ArrowRight size={16}/></Button>{done && <button onClick={reset}>Add another bill</button>}</div>
          </>}
        </div>
      </section>
      <div className="upload-underbar"><span>{reading ? "Prototype preview · extracted values come from the sample bill." : "Your review comes before recording."}</span><button onClick={() => dispatch({ type: "START_MANUAL" })}>Enter a bill manually <ArrowRight size={14}/></button></div>

    </>}
  </div>
}
