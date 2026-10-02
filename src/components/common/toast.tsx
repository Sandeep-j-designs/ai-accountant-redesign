import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Check, TriangleAlert, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastKind = "success" | "error" | "info"
interface ToastItem {
  id: number
  kind: ToastKind
  message: ReactNode
  undo?: () => void
}
type ToastInput = { kind?: ToastKind; message: ReactNode; undo?: () => void }

const ToastContext = createContext<(t: ToastInput) => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current
      setToasts((ts) => [...ts, { id, kind: t.kind ?? "info", message: t.message, undo: t.undo }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ICON: Record<ToastKind, { Icon: typeof Check; className: string }> = {
  success: { Icon: Check, className: "text-success" },
  error: { Icon: TriangleAlert, className: "text-danger" },
  info: { Icon: Info, className: "text-accent-sig-ink" },
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { Icon, className } = ICON[toast.kind]
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-raised px-3.5 py-3 shadow-lift animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* accent lives on the icon only, never the background */}
      <Icon className={cn("size-4 flex-none", className)} strokeWidth={2.4} />
      <span className="min-w-0 flex-1 text-[12.5px] text-ink">{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo!()
            onDismiss()
          }}
          className="flex-none rounded-md px-2 py-1 text-[12px] font-medium text-accent-sig-ink transition-colors hover:bg-panel"
        >
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-6 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-panel hover:text-ink"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
