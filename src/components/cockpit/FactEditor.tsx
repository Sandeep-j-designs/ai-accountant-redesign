import { createContext, useContext, type ReactNode } from "react"
import type { TaxMode } from "@/state/store"
import type { FactKey } from "@/data/invoice"
import {
  TaxDecision,
  VoucherDecision,
  LedgerEditor,
  VendorEditor,
  TotalsEditor,
} from "./decisions"
import { FlagButton } from "./FlagButton"

export type PickKey = "supplier" | "freight" | "loading" | "voucher"

interface EditorApi {
  picks: Record<PickKey, string>
  setPick: (key: PickKey, v: string) => void
  /** which fact currently has its override panel open (per-key, so stacked
   *  cards don't share a single override flag) */
  overrideKey: FactKey | null
  setOverride: (key: FactKey, on?: boolean) => void
  onConfirm: (key: FactKey) => void
  onTax: (mode: TaxMode) => void
  onFlag: (key: FactKey, to: string) => void
}

const EditorContext = createContext<EditorApi | null>(null)

export function EditorProvider({ value, children }: { value: EditorApi; children: ReactNode }) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("FactEditor must be used within EditorProvider")
  return ctx
}

function decisionBody(factKey: FactKey, e: EditorApi): ReactNode {
  const override = e.overrideKey === factKey
  const toggle = () => e.setOverride(factKey)
  switch (factKey) {
    case "tax":
      return <TaxDecision override={override} onAccept={() => e.onTax("IGST")} onKeep={() => e.onTax("SPLIT")} />
    case "freight":
    case "loading":
      return (
        <LedgerEditor
          which={factKey}
          pick={e.picks[factKey]}
          setPick={(v) => e.setPick(factKey, v)}
          override={override}
          onConfirm={() => e.onConfirm(factKey)}
          onToggleOverride={toggle}
        />
      )
    case "supplier":
      return (
        <VendorEditor
          pick={e.picks.supplier}
          setPick={(v) => e.setPick("supplier", v)}
          override={override}
          onConfirm={() => e.onConfirm("supplier")}
          onToggleOverride={toggle}
        />
      )
    case "voucher":
      return (
        <VoucherDecision
          value={e.picks.voucher}
          setValue={(v) => e.setPick("voucher", v)}
          override={override}
          onConfirm={() => e.onConfirm("voucher")}
          onToggleOverride={toggle}
        />
      )
    case "totals":
      return <TotalsEditor onConfirm={() => e.onConfirm("totals")} />
  }
}

/** Renders a single fact as a live decision — identical whether it sits in the
 *  top queue or is re-opened inline in the settled stack. The third path (flag
 *  for review) sits below the accept/override actions on every decision. */
export function FactEditor({ factKey }: { factKey: FactKey }) {
  const e = useEditor()
  return (
    <div>
      {decisionBody(factKey, e)}
      <div className="mt-4 border-t border-line/70 pt-3">
        <FlagButton onPick={(to) => e.onFlag(factKey, to)} />
      </div>
    </div>
  )
}
