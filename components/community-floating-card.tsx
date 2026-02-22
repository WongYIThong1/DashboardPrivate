"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const DISMISSED_KEY = "sqlbots.communityCard.dismissed.v1"
const COMMUNITY_URL = "https://discord.gg/es6vcqA5zS"
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function CommunityFloatingCard() {
  const [visible, setVisible] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISSED_KEY)
      if (!raw) {
        setVisible(true)
        return
      }

      const dismissedUntil = Number(raw)
      if (!Number.isFinite(dismissedUntil) || Date.now() >= dismissedUntil) {
        window.localStorage.removeItem(DISMISSED_KEY)
        setVisible(true)
        return
      }

      setVisible(false)
    } catch {
      setVisible(true)
    }
  }, [])

  const handleDismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_TTL_MS))
    } catch {
      // Ignore storage failures and still hide this session.
    }
    setIsClosing(true)
    window.setTimeout(() => {
      setVisible(false)
      setIsClosing(false)
    }, 220)
  }, [])

  if (!visible) return null

  return (
    <div
      className={[
        "pointer-events-none fixed inset-x-3 bottom-3 z-[70] transition-all duration-200 ease-out motion-reduce:transition-none md:inset-x-auto md:right-4 md:bottom-4 md:w-[360px]",
        isClosing
          ? "translate-y-2 opacity-0"
          : "translate-y-0 opacity-100 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
      ].join(" ")}
    >
      <Card className="pointer-events-auto relative w-full overflow-hidden pt-0 shadow-xl transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-40 size-8 text-white/90 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss community card"
          onClick={handleDismiss}
        >
          <X className="size-4" />
        </Button>
        <div className="absolute inset-0 z-30 aspect-video bg-black/35" />
        <div className="relative z-20 aspect-video w-full bg-black">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <img
              src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png"
              alt="Google logo"
              className="h-9 w-auto"
            />
            <span className="text-xs font-medium tracking-wide text-white/90">proxyless</span>
          </div>
        </div>
        <CardHeader className="relative z-40 gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="min-w-0 whitespace-nowrap text-sm leading-tight">
              Google Proxyless Scraper
            </CardTitle>
            <Badge variant="secondary" className="-mt-1 shrink-0">
              Coming Soon
            </Badge>
          </div>
          <CardDescription>
            High-performance proxyless Google scraping with live rank validation, powered by Lite, Fast, and Deep modes.
          </CardDescription>
        </CardHeader>
        <CardFooter className="relative z-40">
          <Button className="w-full" asChild>
            <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
              Join Discord
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

