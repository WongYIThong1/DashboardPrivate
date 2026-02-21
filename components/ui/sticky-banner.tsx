import * as React from "react"

import { cn } from "@/lib/utils"

type StickyBannerProps = React.ComponentProps<"div">

export const StickyBanner = React.forwardRef<HTMLDivElement, StickyBannerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 z-20 flex w-full items-center justify-center border-b border-white/20 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
          className
        )}
        {...props}
      />
    )
  }
)

StickyBanner.displayName = "StickyBanner"
