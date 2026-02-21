"use client"

import * as React from "react"
import { Flame } from "lucide-react"

import { StickyBanner } from "@/components/ui/sticky-banner"
import { getCachedUserInfo } from "@/lib/user-cache"

const USER_CACHE_UPDATED_EVENT = "user-info-cache-updated"

export function DashboardFreeBanner() {
  const [isFreePlan, setIsFreePlan] = React.useState(false)

  React.useEffect(() => {
    const syncPlan = () => {
      const cached = getCachedUserInfo()
      const plan = cached?.plan?.trim().toLowerCase() ?? ""
      setIsFreePlan(plan === "free")
    }

    syncPlan()

    const onUserCacheUpdated = () => syncPlan()
    window.addEventListener(USER_CACHE_UPDATED_EVENT, onUserCacheUpdated)
    window.addEventListener("focus", onUserCacheUpdated)

    return () => {
      window.removeEventListener(USER_CACHE_UPDATED_EVENT, onUserCacheUpdated)
      window.removeEventListener("focus", onUserCacheUpdated)
    }
  }, [])

  if (!isFreePlan) return null

  return (
    <StickyBanner className="!static !top-auto border-y border-slate-200 bg-white py-3 dark:border-white/20 dark:bg-black">
      <p className="mx-0 flex max-w-[95%] items-center gap-2 text-center text-sm font-normal text-slate-900 sm:text-base dark:text-white">
        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-600 dark:border-red-500/70 dark:bg-red-500/15 dark:text-red-300 sm:text-xs">
          <Flame className="size-3.5 shrink-0 text-red-500 dark:text-red-400 sm:size-4" aria-hidden="true" />
          Free Plan
        </span>
        <span>
          Limited Launch Offer: FREE testing access available.{" "}
          <a
            href="https://discord.com/invite/es6vcqA5zS"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline underline-offset-2 transition-colors hover:text-slate-700 dark:text-white dark:hover:text-white/80"
          >
            Join our Discord
          </a>{" "}
          to claim <span className="font-medium text-slate-900 dark:text-white">+ 40% OFF Pro Plan</span>
        </span>
      </p>
    </StickyBanner>
  )
}
