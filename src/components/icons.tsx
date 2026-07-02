import type { SVGProps } from "react"

/** App mark — stacked ledger bars. Uses currentColor so it inverts with theme. */
export function BrandMark({
  className,
  size = 15,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="3" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="6.2" width="7" height="1.6" rx="0.8" fill="currentColor" opacity="0.8" />
      <rect x="2" y="9.4" width="4" height="1.6" rx="0.8" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
