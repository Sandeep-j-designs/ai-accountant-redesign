import { useState, type ReactNode } from "react"
import { ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { LiveLabel, Amt } from "./kit"
import { Evidence, Confidence, useEvidence, useActiveRegion } from "./evidence"
import {
  GRAND_TOTAL,
  LEDGERS,
  LEDGER_FACTS,
  NEXT_VOUCHER,
  LAST_VOUCHER,
  STATES,
  TAXABLE,
  TAX_AMOUNT,
  TAX_HALF,
  VENDORS,
  INVOICE,
  type LedgerConfig,
} from "@/data/invoice"

/* shared chrome ----------------------------------------------------------- */

// inline card action — neutral secondary; the pinned dock holds the one blue
// primary CTA per the accent-restraint rule.
function Accept({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} className="px-4">
      {children}
    </Button>
  )
}

function Override({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="px-4 text-body">
      {children}
    </Button>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-2.5">{children}</div>
}

/* ════════════════════════════════════════════════════════════════════════
   TAX — the IGST moment. The product's thesis made visible. Most considered.
   ════════════════════════════════════════════════════════════════════════ */
export function TaxDecision({
  override,
  onAccept,
  onKeep,
}: {
  override: boolean
  onAccept: () => void
  onKeep: () => void
}) {
  const setRegion = useEvidence()
  const active = useActiveRegion()
  return (
    <div>
      <div className="flex items-center gap-2">
        <LiveLabel>GST treatment</LiveLabel>
        <Confidence field="tax" />
      </div>
      <h2 className="display mt-2.5 text-[22px] leading-[1.2] text-ink">
        Correct CGST&nbsp;+&nbsp;SGST to IGST.
      </h2>
      <p className="mt-2.5 max-w-[440px] text-[13.5px] leading-relaxed text-body">
        Payable is <Amt value={GRAND_TOTAL} className="font-medium text-ink" /> either
        way — the tax is identical (<Amt value={TAX_AMOUNT} className="font-medium text-ink" />).
        Only the input-credit head changes.
      </p>

      <Separator className="my-5" />

      {/* the reason it knows — two state codes, no pills */}
      <Eyebrow>Why — place of supply</Eyebrow>
      <div className="space-y-2.5">
        <CodeRow role="Supplier" gstin={INVOICE.supplier.gstin} state={STATES.supplier.name} delay={140} />
        <CodeRow role="Your branch" gstin={INVOICE.recipient.gstin} state={STATES.recipient.name} delay={220} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px] text-body">
        <span className="font-mono text-[15px] font-medium text-ink">29</span>
        <span className="text-faint">≠</span>
        <span className="font-mono text-[15px] font-medium text-ink">27</span>
        <ArrowRight className="mx-0.5 size-3.5 text-faint" strokeWidth={2.2} />
        <span>
          inter-state supply — <span className="font-medium text-ink">IGST</span> is the
          correct head.
        </span>
      </div>

      <Separator className="my-5" />

      {/* printed → corrected — weight & strike, not boxes.
         Hovering these rows lights the invoice's tax block (and vice-versa),
         the correspondence the old trace line used to draw. */}
      <Eyebrow>Printed → corrected</Eyebrow>
      <div
        onMouseEnter={() => setRegion("tax")}
        onMouseLeave={() => setRegion(null)}
        className={cn(
          "-mx-2 grid grid-cols-2 divide-x divide-line rounded-lg px-2 py-1.5 transition-colors duration-150",
          active === "tax" && "bg-panel",
        )}
      >
        <div className="pr-5">
          <div className="mb-1.5 text-[11px] text-faint">As printed</div>
          <PrintRow label="CGST @ 9%" value={TAX_HALF} struck />
          <PrintRow label="SGST @ 9%" value={TAX_HALF} struck />
        </div>
        <div className="pl-5">
          <div className="mb-1.5 text-[11px] font-medium text-accent-sig-ink">Corrected — posts</div>
          <PrintRow label="IGST @ 18%" value={TAX_AMOUNT} accent />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted-ink">
        Same <Amt value={TAX_AMOUNT} className="text-ink" /> payable — only the
        credit head differs.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Accept onClick={onAccept}>Correct to IGST</Accept>
        <Override onClick={onKeep}>Keep as printed</Override>
      </div>

      {override && (
        <p className="mt-3 max-w-[460px] text-[12px] leading-relaxed text-muted-ink">
          Keeping the split records the tax as the supplier billed it. The mismatch
          with GSTR-2B surfaces at filing — use only if you intend to raise it with
          the supplier.
        </p>
      )}
    </div>
  )
}

function CodeRow({
  role,
  gstin,
  state,
  delay,
}: {
  role: string
  gstin: string
  state: string
  delay: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[84px] flex-none text-[12px] text-muted-ink">{role}</span>
      <Evidence region="states" className="font-mono text-[12.5px] tnum">
        <span className="relative font-medium text-ink">
          {gstin.slice(0, 2)}
          <span
            className="absolute -bottom-[2px] left-0 h-[1.5px] w-full origin-left bg-line-strong"
            style={{ animation: `underline-draw 0.3s ease-out ${delay}ms both` }}
          />
        </span>
        <span className="text-faint">{gstin.slice(2)}</span>
      </Evidence>
      <span className="ml-auto text-[12.5px] text-body">{state}</span>
    </div>
  )
}

function PrintRow({
  label,
  value,
  struck,
  accent,
}: {
  label: string
  value: number
  struck?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between py-[3px] text-[12.5px]">
      <span className={struck ? "text-faint" : accent ? "text-accent-sig-ink" : "text-body"}>{label}</span>
      <Amt
        value={value}
        strike={struck}
        className={struck ? "" : accent ? "font-medium text-accent-sig-ink" : "font-medium text-ink"}
      />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   LEDGER — freight & loading share this. Routine pick with a recommendation.
   ════════════════════════════════════════════════════════════════════════ */
export function LedgerEditor({
  which,
  pick,
  setPick,
  override,
  onConfirm,
  onToggleOverride,
}: {
  which: "freight" | "loading"
  pick: string
  setPick: (v: string) => void
  override: boolean
  onConfirm: () => void
  onToggleOverride: () => void
}) {
  const cfg: LedgerConfig = LEDGER_FACTS[which]
  const [query, setQuery] = useState("")
  const named = cfg.options.map((o) => o.name)
  const more = LEDGERS.filter((l) => !named.includes(l))

  return (
    <div>
      <LiveLabel>{which === "freight" ? "Freight ledger" : "Expense ledger"}</LiveLabel>
      <h2 className="mt-2.5 text-[17px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
        Book {cfg.line.split(" — ")[0]}{" "}
        <Evidence region={which === "freight" ? "line1" : "line2"} className="inline-flex items-baseline gap-1">
          <Amt value={cfg.amount} className="text-ink" />
          <Confidence field={which} />
        </Evidence>{" "}
        to a ledger.
      </h2>
      <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-body">{cfg.why}</p>

      <div className="mt-4 space-y-1.5">
        {cfg.options.map((o) => {
          const sel = pick === o.name
          return (
            <button
              key={o.name}
              onClick={() => setPick(o.name)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                sel ? "bg-panel" : "hover:bg-panel/60",
              )}
            >
              <span
                className={cn(
                  "grid size-[16px] flex-none place-items-center rounded-full border transition-colors",
                  sel ? "border-accent-sig" : "border-line-strong",
                )}
              >
                <span
                  className={cn(
                    "size-[7px] rounded-full bg-accent-sig transition-transform duration-150 ease-[cubic-bezier(.34,1.56,.64,1)]",
                    sel ? "scale-100" : "scale-0",
                  )}
                />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-medium text-ink">{o.name}</span>
                <span className="block text-[11.5px] text-muted-ink">{o.note}</span>
              </span>
              {o.rec && (
                <span className="inline-flex items-center rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-body">
                  Most used
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Accept onClick={onConfirm}>Confirm {pick}</Accept>
        <Override onClick={onToggleOverride}>Other ledger</Override>
      </div>

      {override && (
        <Command className="mt-3 shadow-card">
          <CommandInput placeholder="Search all ledgers…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No ledger matches.</CommandEmpty>
            <CommandGroup>
              {more.map((l) => (
                <CommandItem key={l} value={l} onSelect={() => { setPick(l); onToggleOverride() }}>
                  {l}
                  {pick === l && <Check className="ml-auto size-4 text-ink" strokeWidth={2.4} />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SUPPLIER — re-opening the matched vendor.
   ════════════════════════════════════════════════════════════════════════ */
export function VendorEditor({
  pick,
  setPick,
  override,
  onConfirm,
  onToggleOverride,
}: {
  pick: string
  setPick: (v: string) => void
  override: boolean
  onConfirm: () => void
  onToggleOverride: () => void
}) {
  const [query, setQuery] = useState("")
  const matched = VENDORS.find((v) => v.name === pick) ?? VENDORS[0]
  return (
    <div>
      <LiveLabel>Supplier</LiveLabel>
      <h2 className="mt-2.5 text-[17px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
        Matched to {matched.name}.
      </h2>
      <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-body">
        Matched on GSTIN{" "}
        <Evidence region="supplier" className="inline-flex items-baseline gap-1">
          <span className="font-mono text-ink">{matched.gstin}</span>
          <Confidence field="supplierGstin" />
        </Evidence>{" "}
        against your vendor master.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Accept onClick={onConfirm}>Keep {matched.name.split(" ")[0]}…</Accept>
        <Override onClick={onToggleOverride}>Different vendor</Override>
      </div>

      {override && (
        <Command className="mt-3 shadow-card">
          <CommandInput placeholder="Search vendor master…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No vendor matches.</CommandEmpty>
            <CommandGroup>
              {VENDORS.map((v) => (
                <CommandItem key={v.name} value={v.name} onSelect={() => { setPick(v.name); onToggleOverride() }}>
                  <span className="flex-1">
                    <span className="block text-ink">{v.name}</span>
                    <span className="block font-mono text-[11px] text-faint">{v.gstin} · {v.note}</span>
                  </span>
                  {pick === v.name && <Check className="size-4 text-ink" strokeWidth={2.4} />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   TOTALS — reconciliation, re-opened read-only with a confirm.
   ════════════════════════════════════════════════════════════════════════ */
export function TotalsEditor({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div>
      <LiveLabel>Totals</LiveLabel>
      <h2 className="mt-2.5 text-[17px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
        Line items reconcile to the document total.
      </h2>

      <div className="mt-4 space-y-0">
        {INVOICE.lines.map((l) => (
          <Evidence
            key={l.key}
            region={l.key as "line1" | "line2"}
            className="flex items-baseline justify-between py-[5px] text-[13px]"
          >
            <span className="text-body">{l.desc}</span>
            <Amt value={l.amount} className="text-ink" />
          </Evidence>
        ))}
        <div className="flex items-baseline justify-between border-t border-line py-[5px] pt-2 text-[13px]">
          <span className="text-muted-ink">Taxable</span>
          <Amt value={TAXABLE} className="text-ink" />
        </div>
        <Evidence region="tax" className="flex items-baseline justify-between py-[5px] text-[13px]">
          <span className="text-muted-ink">Tax</span>
          <Amt value={TAX_AMOUNT} className="text-ink" />
        </Evidence>
        <div className="flex items-baseline justify-between border-t border-line py-[5px] pt-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-faint">Total</span>
          <span className="inline-flex items-baseline gap-1.5">
            <Amt value={GRAND_TOTAL} className="text-[15px] font-medium text-ink" />
            <Confidence field="total" />
          </span>
        </div>
      </div>

      <div className="mt-5">
        <Accept onClick={onConfirm}>Reconciled</Accept>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   VOUCHER — clerical. The next number, one keystroke.
   ════════════════════════════════════════════════════════════════════════ */
export function VoucherDecision({
  value,
  setValue,
  override,
  onConfirm,
  onToggleOverride,
}: {
  value: string
  setValue: (v: string) => void
  override: boolean
  onConfirm: () => void
  onToggleOverride: () => void
}) {
  return (
    <div>
      <LiveLabel>Voucher number</LiveLabel>
      <h2 className="mt-2.5 text-[17px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
        Assign the next AP voucher.
      </h2>

      <div className="mt-4 flex items-end gap-4">
        {!override ? (
          <div className="font-mono text-[26px] font-medium tracking-[-0.01em] text-ink tnum">
            {NEXT_VOUCHER}
          </div>
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-[210px] rounded-md border border-line-2 bg-card px-3 py-1.5 font-mono text-[20px] font-medium text-ink focus:border-accent-sig focus:outline-none focus:ring-2 focus:ring-accent-sig/20"
          />
        )}
        <div className="pb-1 text-[12px] text-muted-ink">
          next in series · last <span className="font-mono text-body">{LAST_VOUCHER}</span>
          <br />
          none printed on the document
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Accept onClick={onConfirm}>Use {override ? value || NEXT_VOUCHER : NEXT_VOUCHER}</Accept>
        <Override onClick={onToggleOverride}>Enter another</Override>
      </div>
    </div>
  )
}
