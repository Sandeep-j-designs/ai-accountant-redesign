import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Badges are quiet by default — a sans uppercase label (the shared label
   token), not a coloured pill. `signal` is the only accented variant. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "text-faint",
        outline: "border border-line-2 text-muted-ink",
        signal: "text-accent-sig-ink",
        danger: "text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
