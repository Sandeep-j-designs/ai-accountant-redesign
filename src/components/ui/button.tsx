import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/* The primary brand surface (enabled states) in ONE place, so the <Button>
   primary/default variant AND any hand-rolled primary control (the "Post to
   books" commit CTA, the CommitZone recover button, "Apply to N bills")
   share one look: the "lit edge" chip — a solid --brand fill wrapped in a
   1px border of the same hue one step lighter (--btn-primary-edge). Only
   the fill shifts per state (hover/active + 0.5px press); the edge holds.
   focus-visible zeroes Tailwind's base ring (ring-0/offset-0) so only our
   page-gap + 2px brand-vivid ring renders. */
export const primaryButtonSurface =
  "border border-[var(--btn-primary-edge)] bg-[var(--btn-primary-fill)] text-primary-foreground shadow-[var(--btn-primary-shadow)] transition-[background-color,box-shadow,transform,opacity] duration-150 hover:bg-[var(--btn-primary-fill-hover)] active:bg-[var(--btn-primary-fill-active)] active:translate-y-[0.5px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-[var(--btn-primary-shadow-focus)]"

const primaryVariant = `${primaryButtonSurface} disabled:shadow-none disabled:cursor-not-allowed`

/* Rounded-rectangle CTAs, never full pills. The primary (lit-edge petrol)
   is the voltage — used only on genuine primary actions. Secondaries stay
   neutral; semantic fills are muted tints, not loud solids. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium tracking-[0.002em] transition-[background-color,color,opacity,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  {
    variants: {
      variant: {
        // the lit-edge primary (also exposed as `primary` for the shared API)
        default: primaryVariant,
        primary: primaryVariant,
        solid: "bg-ink text-page hover:opacity-90", // neutral dark fill
        success: "bg-success-bg text-success hover:brightness-[0.97]", // quiet tinted fix — verified/settled only
        lilac: "border border-line-2 bg-transparent text-ink hover:bg-[rgba(21,26,38,0.04)] hover:border-line-strong",
        // "Apply to N bills" etc. — inherits the primary brand treatment.
        ai: primaryVariant,
        // SECONDARY — white surface, 1px border, micro-shadow (NOT a flat
        // transparent outline). Hover darkens the border.
        secondary:
          "bg-surface border border-line-2 text-ink shadow-[0_1px_2px_rgba(21,26,38,0.05)] hover:border-line-strong",
        outline:
          "bg-surface border border-line-2 text-ink shadow-[0_1px_2px_rgba(21,26,38,0.05)] hover:border-line-strong",
        // TERTIARY / ghost — no border, secondary ink, faint hover wash
        ghost: "text-body hover:bg-[rgba(21,26,38,0.04)] hover:text-ink",
        link: "text-brand underline-offset-[3px] hover:underline",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        default: "h-9 px-4", // 36px — standard controls
        sm: "h-7 px-3 text-[12.5px]", // 28px — compact chips
        lg: "h-9 px-5", // 36px — header CTA / prominent
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** shows a spinner in the leading-icon slot and disables the button */
    loading?: boolean
    /** leading icon (16px), e.g. icon={<Mail />} */
    icon?: React.ReactNode
    /** trailing icon (16px), e.g. iconRight={<ArrowRight />} */
    iconRight?: React.ReactNode
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  icon,
  iconRight,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  // Slot requires exactly one child — icon/loading slots only apply to the
  // plain-button form (no asChild consumers pass them today).
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 flex-none animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        icon && (
          <span aria-hidden className="flex-none [&>svg]:size-4">
            {icon}
          </span>
        )
      )}
      {children}
      {!loading && iconRight && (
        <span aria-hidden className="flex-none [&>svg]:size-4">
          {iconRight}
        </span>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
