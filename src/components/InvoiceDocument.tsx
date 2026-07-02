import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { INVOICE, REGION_FACT, type DocRegion } from "@/data/invoice"

export type { DocRegion }

/**
 * The source document. A literal lit page — a crisp white sheet that keeps its
 * own palette in both light and dark (a document lit on the desk). Regions that
 * back a decision are clickable: clicking one jumps to (or challenges) that
 * decision. The evidence outline is the brand blue, tying a field to its source.
 */
export function InvoiceDocument({
  live,
  highlight,
  detected,
  grain,
  className,
  onRegionClick,
  onRegionHover,
}: {
  live?: DocRegion | null
  highlight?: string | null
  detected?: string[]
  grain?: boolean
  className?: string
  onRegionClick?: (r: DocRegion) => void
  onRegionHover?: (r: DocRegion | null) => void
}) {
  const ring = (key: DocRegion) => {
    const isLive = live === key
    const isHover = highlight === key
    return cn(
      "rounded-[3px] transition-[box-shadow,background-color] duration-200",
      isLive && "ev-live",
      !isLive && isHover && "ev-hover",
      !isLive && !isHover && detected?.includes(key) && "ev-detected",
    )
  }

  /** merges the evidence ring with click-to-decision affordances for a region */
  const region = (
    key: DocRegion,
    extra?: string,
  ): HTMLAttributes<HTMLElement> & { tabIndex?: number; "data-region-id": string } => {
    const linkable = !!onRegionClick && !!REGION_FACT[key]
    return {
      className: cn(extra, ring(key), linkable && "ev-linkable"),
      "data-region-id": key,
      // source-side hover drives the shared highlight (replaces the trace line)
      ...(onRegionHover && {
        onMouseEnter: () => onRegionHover(key),
        onMouseLeave: () => onRegionHover(null),
      }),
      ...(linkable && {
        role: "button",
        tabIndex: 0,
        "aria-label": `Open the ${key} decision`,
        onClick: () => onRegionClick!(key),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onRegionClick!(key)
          }
        },
      }),
    }
  }

  const Gstin = ({ value, hot }: { value: string; hot: boolean }) => (
    <span className="font-mono text-[10.5px] text-[#1a1d23]">
      <b className={cn(hot ? "font-medium text-[#0f1216] underline decoration-[1.5px] underline-offset-2" : "font-medium")}>
        {value.slice(0, 2)}
      </b>
      {value.slice(2)}
    </span>
  )

  return (
    <div
      className={cn(
        "relative w-full max-w-[540px] overflow-hidden rounded-lg border border-[#e6e9ef] bg-white text-[12px] text-[#2c3039]",
        grain
          ? "paper-grain p-[26px] pb-[22px] shadow-[inset_0_0_55px_rgba(40,44,60,0.05),0_18px_40px_-16px_rgba(15,18,26,0.35)]"
          : "p-[28px] pb-[22px] shadow-[0_1px_2px_rgba(15,18,26,0.06),0_22px_48px_-22px_rgba(15,18,26,0.4)]",
        className,
      )}
    >
      <div className="absolute right-0 top-0 rounded-bl-md border-b border-l border-[#eceef2] bg-[#f4f6f9] px-[9px] py-1 text-[9px] font-medium uppercase tracking-[0.06em] text-[#9aa1ac]">
        {INVOICE.tag}
      </div>

      <div className="mb-3.5 flex items-start justify-between">
        <div>
          <div className="text-[15px] font-medium tracking-[-0.01em] text-[#15171c]">
            {INVOICE.supplier.name}
          </div>
          <div className="mt-[3px] text-[9px] uppercase tracking-[0.09em] text-[#9aa1ac]">
            Original for Recipient
          </div>
        </div>
        <div {...region("voucher", "-mr-1 pl-1.5 pr-1 text-right")}>
          <div className="text-[8.5px] uppercase tracking-[0.07em] text-[#9aa1ac]">Invoice No.</div>
          <div className="font-mono text-[12px] font-medium tnum text-[#15171c]">{INVOICE.number}</div>
        </div>
      </div>

      <div {...region("states", "my-2 grid grid-cols-2 gap-3 border-y border-[#eceef2] py-3")}>
        <div {...region("supplier", "px-1.5")}>
          <div className="mb-[3px] text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Supplier</div>
          <div className="text-[12px] font-medium text-[#15171c]">{INVOICE.supplier.name}</div>
          <div className="text-[10px] leading-snug text-[#51565f]">
            {INVOICE.supplier.address.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
          <div className="mt-[3px]">
            <Gstin value={INVOICE.supplier.gstin} hot={live === "states"} />
          </div>
        </div>
        <div {...region("buyer", "px-1.5")}>
          <div className="mb-[3px] text-[8.5px] uppercase tracking-[0.09em] text-[#9aa1ac]">Recipient</div>
          <div className="text-[12px] font-medium text-[#15171c]">{INVOICE.recipient.name}</div>
          <div className="text-[10px] leading-snug text-[#51565f]">
            {INVOICE.recipient.address.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
          <div className="mt-[3px]">
            <Gstin value={INVOICE.recipient.gstin} hot={live === "states"} />
          </div>
        </div>
      </div>

      <div {...region("dates", "mb-2.5 flex gap-6 px-1.5 py-1 text-[10px] text-[#51565f]")}>
        <span>
          Invoice date <b className="font-mono font-medium text-[#15171c]">{INVOICE.invoiceDate}</b>
        </span>
        <span>
          Due date <b className="font-mono font-medium text-[#15171c]">{INVOICE.dueDate}</b>
        </span>
      </div>

      <table className="mb-2.5 w-full border-collapse text-[10.5px]">
        <thead>
          <tr>
            <th className="border-b border-[#eceef2] px-1.5 py-[5px] text-left text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">Description</th>
            <th className="border-b border-[#eceef2] px-1.5 py-[5px] text-left text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">HSN</th>
            <th className="border-b border-[#eceef2] px-1.5 py-[5px] text-right text-[8.5px] font-medium uppercase tracking-[0.05em] text-[#9aa1ac]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {INVOICE.lines.map((line) => (
            <tr key={line.key} {...region(line.key as DocRegion)}>
              <td className="border-b border-[#eceef2] px-1.5 py-[7px] align-top">{line.desc}</td>
              <td className="border-b border-[#eceef2] px-1.5 py-[7px] align-top font-mono text-[#51565f]">{line.hsn}</td>
              <td className="border-b border-[#eceef2] px-1.5 py-[7px] text-right align-top font-mono tnum">
                {line.amount.toLocaleString("en-IN")}.00
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div {...region("tax", "ml-auto w-[64%] px-1.5 py-1 text-[11px]")}>
        <div className="flex justify-between py-[3px]">
          <span>Taxable value</span>
          <span className="font-mono tnum">1,56,000.00</span>
        </div>
        {INVOICE.printedTax.map((t) => (
          <div key={t.label} className="flex justify-between py-[3px]">
            <span>{t.label}</span>
            <span className="font-mono tnum">{t.amount.toLocaleString("en-IN")}.00</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t-[1.5px] border-[#15171c] pt-1.5 text-[12.5px] font-medium text-[#15171c]">
          <span>Total</span>
          <span className="font-mono tnum">1,84,080.00</span>
        </div>
      </div>

      <div className="mt-3.5 flex justify-between border-t border-[#eceef2] pt-2.5 text-[9px] text-[#9aa1ac]">
        <span>Place of supply: {INVOICE.placeOfSupply}</span>
        <span>E. &amp; O.E.</span>
      </div>
    </div>
  )
}
