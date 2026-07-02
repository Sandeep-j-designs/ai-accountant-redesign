import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Mercury register: rounded-rectangle CTAs (8px radius), never full pills.
   The default (indigo) is the voltage — used only on genuine primary actions.
   Secondaries stay neutral; semantic fills are muted tints, not loud solids. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium tracking-[0.002em] transition-[background-color,color,opacity,border-color] duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] hover:bg-primary-hover",
        solid: "bg-ink text-page hover:opacity-90", // neutral dark fill
        success: "bg-success-bg text-success hover:brightness-[0.97]", // quiet tinted fix — verified/settled only
        // AI auto-fix — a GHOST teal pill (tint fill + hairline border), not a
        // solid band, so a column of them never reads as one stripe
        lilac: "border border-lilac-line bg-lilac-bg text-lilac hover:bg-primary-tint hover:brightness-[0.98] dark:hover:brightness-110",
        secondary: "bg-panel-2 text-ink hover:bg-line-2",
        outline: "border border-line-2 bg-transparent text-body hover:bg-panel hover:border-line-strong",
        ghost: "text-muted-ink hover:bg-panel hover:text-ink",
        link: "text-accent-sig-ink underline-offset-[3px] hover:underline",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3.5 text-[12.5px]",
        lg: "h-11 px-5 text-[13.5px]", // ≥44px — the min. comfortable touch target for real row actions
        icon: "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
