import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Illustration, type IllustrationName } from "./illustrations"

/** A reusable empty state: monoline illustration, title, one line, one CTA. */
export function EmptyState({
  illustration,
  title,
  description,
  cta,
  className,
}: {
  illustration: IllustrationName
  title: string
  description: ReactNode
  cta?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <Illustration name={illustration} />
      <h3 className="mt-5 text-[15px] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-body">{description}</p>
      {cta && (
        <Button className="mt-5" onClick={cta.onClick}>
          {cta.label}
        </Button>
      )}
    </div>
  )
}
