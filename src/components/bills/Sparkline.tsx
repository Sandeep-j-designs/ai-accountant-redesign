import { cn } from "@/lib/utils"

/**
 * A calm 12-point trend line. Faint (tertiary) non-scaling stroke, a single
 * accent dot marking the latest point. Hand-rolled SVG — no chart lib.
 */
export function Sparkline({
  data,
  className,
  height = 40,
}: {
  data: number[]
  className?: string
  height?: number
}) {
  const W = 220
  const H = height
  const pad = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
    const y = H - pad - ((d - min) / range) * (H - 2 * pad)
    return [x, y] as const
  })
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const [lastX, lastY] = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("block", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--faint)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* latest point — the single accent moment */}
      <circle cx={lastX} cy={lastY} r={3} fill="var(--accent-sig)" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
