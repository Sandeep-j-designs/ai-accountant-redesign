import { Check } from "lucide-react"
/** Two concentric tracks distinguish transferred documents from extracted ones. */
export function ProgressDial({ uploaded, read, total, done = false }: { uploaded: number; read: number; total: number; done?: boolean }) {
  const transfer = Math.min(1, uploaded / Math.max(total, 1))
  const extraction = Math.min(1, read / Math.max(total, 1))
  return <div className="progress-dial" role="img" aria-label={`${uploaded} of ${total} uploaded, ${read} extracted`}>
    <svg viewBox="0 0 180 180" aria-hidden="true"><circle className="dial-track" cx="90" cy="90" r="77"/><circle className="dial-transfer" cx="90" cy="90" r="77" pathLength="100" strokeDasharray={`${transfer * 100} 100`}/><circle className="dial-track dial-inner" cx="90" cy="90" r="64"/><circle className="dial-extraction" cx="90" cy="90" r="64" pathLength="100" strokeDasharray={`${extraction * 100} 100`}/></svg>
    <div>{done ? <Check size={32} strokeWidth={1.5}/> : <b>{Math.round((transfer + extraction) * 50)}<small>%</small></b>}<span>{done ? "COMPLETE" : read ? "EXTRACTING" : "UPLOADING"}</span></div>
  </div>
}
