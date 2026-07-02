import { cn } from "@/lib/utils"

export type IllustrationName = "bills" | "vendors" | "payments" | "search" | "caughtup"

/**
 * Monoline empty-state illustrations. 1.5px stroke, currentColor (tertiary),
 * no fills, no colour — Linear/Ramp register. ~120px square.
 */
export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={120}
      height={120}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-faint", className)}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

const PATHS: Record<IllustrationName, React.ReactNode> = {
  // a stack of documents
  bills: (
    <>
      <rect x="30" y="34" width="46" height="58" rx="4" />
      <path d="M84 44v54a4 4 0 0 1-4 4H40" opacity={0.5} />
      <path d="M39 48h28M39 58h28M39 68h20" />
      <path d="M39 80h14" opacity={0.7} />
    </>
  ),
  // a storefront (vendors)
  vendors: (
    <>
      <path d="M30 52h60l-4-14H34l-4 14Z" />
      <path d="M30 52a8 8 0 0 0 15 0 8 8 0 0 0 15 0 8 8 0 0 0 15 0 8 8 0 0 0 15 0" />
      <path d="M36 58v30h48V58" />
      <path d="M52 88V68h16v20" />
    </>
  ),
  // a wallet with a card (payments)
  payments: (
    <>
      <rect x="28" y="42" width="64" height="42" rx="6" />
      <path d="M28 56h64" opacity={0.5} />
      <rect x="72" y="62" width="14" height="10" rx="2" />
      <path d="M40 42l30-12 14 12" opacity={0.6} />
    </>
  ),
  // a magnifier over faint lines (no results)
  search: (
    <>
      <circle cx="54" cy="54" r="22" />
      <path d="M70 70l16 16" />
      <path d="M46 50h16M46 58h10" opacity={0.6} />
    </>
  ),
  // a checkmark in a ring (all caught up)
  caughtup: (
    <>
      <circle cx="60" cy="60" r="30" />
      <path d="M48 60.5l8.5 8.5L74 51" />
      <path d="M60 34v4M86 60h-4M60 86v-4M34 60h4" opacity={0.45} />
    </>
  ),
}
