import { Check, FileText, ScanLine, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export const EXTRACTED_FIELDS = [
  { label: "Supplier", value: "Sundar Logistics Pvt Ltd", source: "Read from document" },
  { label: "Invoice number", value: "SLPL/2526/0489", source: "Read from document" },
  { label: "Line items", value: "2 items · ₹1,56,000", source: "Read from document" },
  { label: "Tax treatment", value: "CGST + SGST → IGST", source: "Suggested · needs review", inferred: true },
  { label: "Expense ledger", value: "Carriage Inward", source: "Suggested · needs review", inferred: true },
]

/** A code-drawn sample document: its highlighted regions share the extraction state. */
export function DocumentStage({ phase, revealed = 0, highlighted = null, filename }: {
  phase: "idle" | "drag" | "reading" | "done" | "error"
  revealed?: number; highlighted?: number | null; filename?: string
}) {
  const active = highlighted ?? (phase === "reading" ? Math.min(revealed, 4) : null)
  const current = EXTRACTED_FIELDS[active ?? Math.max(0, revealed - 1)]
  const processing = phase === "reading" || phase === "done"
  return <div className={cn("document-stage", `stage-${phase}`)} aria-hidden="true">
    <div className="stage-topline"><span><ScanLine size={15} /> DOCUMENT INTAKE</span><span className="stage-live">{phase === "done" ? "EXTRACTED" : phase === "reading" ? "READING" : "READY"}</span></div>
    <div className="stage-grid" />
    <div className="paper-composition">
      <div className="paper-underlay paper-underlay-back"><span>JPG</span></div>
      <div className="paper-underlay paper-underlay-front"><span>PDF</span></div>
      <div className={cn("invoice-paper", active !== null && active >= 3 && "paper-inference")}>
        <div className="paper-heading"><div className="paper-monogram">SL</div><span>TAX INVOICE<br/><small>ORIGINAL FOR RECIPIENT</small></span></div>
        <div className={cn("paper-region", active === 0 && "region-active")}><b>Sundar Logistics</b><span>Private Limited</span><small>Bengaluru, Karnataka · GST registered</small></div>
        <div className={cn("paper-region paper-meta", active === 1 && "region-active")}><span>Invoice no.<strong>SLPL/2526/0489</strong></span><span>Invoice date<strong>06 Jun 2026</strong></span></div>
        <div className="paper-rule" />
        <div className="paper-table-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>
        <div className={cn("paper-region paper-lines", (active === 2 || active === 4) && "region-active")}><div><span>Freight services</span><b>1,20,000</b></div><div><span>Loading & handling</span><b>36,000</b></div></div>
        <div className={cn("paper-region paper-tax", active === 3 && "region-active")}><div><span>CGST · 9%</span><span>14,040</span></div><div><span>SGST · 9%</span><span>14,040</span></div></div>
        <div className="paper-total"><span>Total payable</span><b>₹1,84,080<span>.00</span></b></div>
        <div className="paper-bottom"><span>SAMPLE DOCUMENT</span><div className="paper-barcode" /></div>
        {phase === "reading" && revealed < 3 && <div className="document-scan" style={{ top: `${[33, 47, 65][Math.min(revealed, 2)]}%` }}><span/><i/><span/></div>}
        {phase === "done" && <div className="paper-complete"><Check size={15} strokeWidth={2.5}/></div>}
      </div>
      <div className="stage-bracket bracket-tl"/><div className="stage-bracket bracket-br"/>
      <div className={cn("document-callout", processing && "callout-live")} key={processing ? revealed >= 3 ? "suggest" : revealed : phase}>
        <span className="callout-icon">{phase === "done" ? <Check size={17}/> : processing ? revealed >= 3 ? <Sparkles size={17}/> : <ScanLine size={17}/> : <FileText size={17}/>}</span>
        <span><b>{phase === "done" ? "Extraction complete" : phase === "reading" ? revealed >= 3 ? "Preparing suggestions" : current.label : phase === "drag" ? "Ready to receive" : "One file or a whole batch"}</b><small>{phase === "done" ? "Ready for your review" : phase === "reading" ? revealed >= 3 ? "Using source + accounting context" : current.source : phase === "drag" ? "Release your documents here" : "PDF, PNG and JPG"}</small></span>
      </div>
    </div>
    <div className="stage-bottomline"><span className="truncate">{processing ? filename : "DOCUMENT → STRUCTURED DATA"}</span>{processing ? <span>{revealed} / 5</span> : <Sparkles size={14}/>}</div>
  </div>
}

export function UploadSteps({ step }: { step: number }) {
  return <ol className="upload-steps" aria-label="Upload progress">{["Upload", "Extract", "Review"].map((label, i) => <li key={label} className={cn(i < step && "step-complete", i === step && "step-active")} aria-current={i === step ? "step" : undefined}><span>{i < step ? <Check size={13}/> : `0${i + 1}`}</span>{label}</li>)}</ol>
}
