import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-line-2 bg-card px-3 py-2 text-[13px] text-ink transition-colors outline-none",
        "placeholder:text-faint",
        "focus-visible:border-accent-sig focus-visible:ring-2 focus-visible:ring-accent-sig/20",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
