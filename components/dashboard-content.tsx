"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconTrophy,
  IconDatabase,
  IconBell,
  IconCrown,
  IconFlame,
  IconTarget,
  IconTrendingUp,
  IconRefresh,
} from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { getCachedUserInfo, setCachedUserInfo } from "@/lib/user-cache"
import { getCachedDashboardSnapshot, setCachedDashboardSnapshot } from "@/lib/dashboard-cache"
import { toast } from "sonner"

type DashboardUser = {
  user_name: string
  plan: string
  rank: number | null
  injected_total: number
  dumped_total: number
  score: number
  last_week_rank: number | null
  last_week_injected: number
  last_week_dumped: number
}

type LeaderboardItem = {
  rank: number | null
  user_name: string
  score: number
  injected_total: number
  dumped_total: number
}

type RecentActivityItem = {
  taskid: string
  domain: string
  country: string
  category: string
  ts: number
  event_id: string
}

type AnnouncementItem = {
  id: string
  main: string
  subtext: string
  created_at: string
}

type DashboardSnapshot = {
  type: string
  user: DashboardUser
  leaderboard: LeaderboardItem[]
  recent_activity: RecentActivityItem[]
  announcements: AnnouncementItem[]
  ts: number
}

const ACTIVITY_LIMIT = 3
const ANNOUNCEMENT_LIMIT = 3
const DASHBOARD_TOP_DEFAULT = 100
const DASHBOARD_TOP_MAX = 200

function clampTop(value: number): number {
  const safe = Number.isFinite(value) ? Math.trunc(value) : DASHBOARD_TOP_DEFAULT
  return Math.max(1, Math.min(DASHBOARD_TOP_MAX, safe))
}

const DEFAULT_USER: DashboardUser = {
  user_name: "User",
  plan: "Free",
  rank: null,
  injected_total: 0,
  dumped_total: 0,
  score: 0,
  last_week_rank: null,
  last_week_injected: 0,
  last_week_dumped: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  return fallback
}

function toInteger(value: unknown, fallback = 0): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.trunc(n))
}

function toRank(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const rank = Math.trunc(n)
  return rank > 0 ? rank : null
}

function formatRank(rank: number | null): string {
  return rank === null ? "-" : `#${rank}`
}

function formatCount(value: number): string {
  return value.toLocaleString()
}

function formatTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "-"
  return new Date(ts).toLocaleString()
}

type TextPart = {
  type: "text" | "link"
  content: string
  href?: string
}

function parseAnnouncementText(input: string): TextPart[] {
  const text = input ?? ""
  const parts: TextPart[] = []
  const tokenRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    const start = match.index
    if (start > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, start) })
    }

    if (match[1] && match[2]) {
      parts.push({ type: "link", content: match[1], href: match[2] })
    } else if (match[3]) {
      parts.push({ type: "link", content: match[3], href: match[3] })
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }]
}

function renderAnnouncementText(input: string): React.ReactNode {
  const parts = parseAnnouncementText(input)
  return parts.map((part, index) => {
    if (part.type === "link" && part.href) {
      return (
        <a
          key={`${part.href}-${index}`}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-blue-600 hover:text-blue-500"
        >
          {part.content}
        </a>
      )
    }
    return <React.Fragment key={`text-${index}`}>{part.content}</React.Fragment>
  })
}

function useFastCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = React.useState(0)

  React.useEffect(() => {
    const safeTarget = Math.max(0, Math.trunc(target))
    if (safeTarget === 0) {
      setValue(0)
      return
    }

    let rafId = 0
    const startAt = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startAt
      const progress = Math.min(1, elapsed / durationMs)
      setValue(Math.floor(safeTarget * progress))
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick)
      }
    }

    setValue(0)
    rafId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [durationMs, target])

  return value
}

function normalizeUser(input: unknown): DashboardUser {
  if (!isRecord(input)) return { ...DEFAULT_USER }

  const injectedTotal = toInteger(input.injected_total)
  const dumpedTotal = toInteger(input.dumped_total)
  const providedScore = Number(input.score)

  return {
    user_name: toText(input.user_name, DEFAULT_USER.user_name),
    plan: toText(input.plan, DEFAULT_USER.plan),
    rank: toRank(input.rank),
    injected_total: injectedTotal,
    dumped_total: dumpedTotal,
    score: Number.isFinite(providedScore)
      ? Math.max(0, Math.trunc(providedScore))
      : injectedTotal + dumpedTotal * 3,
    last_week_rank: toRank(input.last_week_rank),
    last_week_injected: toInteger(input.last_week_injected, 0),
    last_week_dumped: toInteger(input.last_week_dumped, 0),
  }
}

function normalizeLeaderboard(input: unknown): LeaderboardItem[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    const row = isRecord(item) ? item : {}
    const injectedTotal = toInteger(row.injected_total)
    const dumpedTotal = toInteger(row.dumped_total)
    const providedScore = Number(row.score)

    return {
      rank: toRank(row.rank),
      user_name: toText(row.user_name, "Unknown"),
      score: Number.isFinite(providedScore)
        ? Math.max(0, Math.trunc(providedScore))
        : injectedTotal + dumpedTotal * 3,
      injected_total: injectedTotal,
      dumped_total: dumpedTotal,
    }
  })
}

function normalizeRecentActivity(input: unknown): RecentActivityItem[] {
  if (!Array.isArray(input)) return []
  return dedupeRecentActivity(
    input
    .map((item) => {
      const row = isRecord(item) ? item : {}
      return {
        taskid: toText(row.taskid),
        domain: toText(row.domain, "-"),
        country: toText(row.country, "-"),
        category: toText(row.category, "-"),
        ts: toInteger(row.ts),
        event_id: toText(row.event_id),
      }
    })
  )
}

function getRecentActivityKey(item: RecentActivityItem): string {
  if (item.event_id) return `event:${item.event_id}`

  const parts = [
    item.taskid || "task",
    String(item.ts || 0),
    item.domain || "-",
    item.country || "-",
    item.category || "-",
  ]
  return `fallback:${parts.join("|")}`
}

function dedupeRecentActivity(items: RecentActivityItem[]): RecentActivityItem[] {
  const seen = new Set<string>()
  return items
    .filter((item) => {
      const key = getRecentActivityKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, ACTIVITY_LIMIT)
}

function mergeRecentActivity(prev: RecentActivityItem[], incoming: unknown): RecentActivityItem[] {
  if (Array.isArray(incoming)) {
    return normalizeRecentActivity(incoming)
  }

  if (!isRecord(incoming)) {
    return prev.slice(0, ACTIVITY_LIMIT)
  }

  const next = normalizeRecentActivity([incoming])
  if (next.length === 0) return prev.slice(0, ACTIVITY_LIMIT)

  return dedupeRecentActivity([...next, ...prev])
}

function dedupeAnnouncements(items: AnnouncementItem[]): AnnouncementItem[] {
  const seen = new Set<string>()
  const merged: AnnouncementItem[] = []
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
    if (merged.length >= ANNOUNCEMENT_LIMIT) break
  }
  return merged
}

function normalizeAnnouncements(input: unknown): AnnouncementItem[] {
  if (!Array.isArray(input)) return []
  const mapped = input.map((item, idx) => {
    const row = isRecord(item) ? item : {}
    const id = toText(row.id, `ann_${idx}`)
    return {
      id,
      main: toText(row.main, "Announcement"),
      subtext: toText(row.subtext),
      created_at: toText(row.created_at),
    }
  })
  return dedupeAnnouncements(mapped)
}

function extractAnnouncements(input: unknown): AnnouncementItem[] {
  if (Array.isArray(input)) {
    return normalizeAnnouncements(input)
  }

  if (!isRecord(input)) return []

  const list = normalizeAnnouncements(input.announcements ?? input.items ?? input.data)
  if (list.length > 0) return list

  const single = normalizeAnnouncements([input.announcement ?? input.item])
  if (single.length > 0) return single

  return []
}

function normalizeSnapshot(input: unknown): DashboardSnapshot {
  const row = isRecord(input) ? input : {}
  return {
    type: toText(row.type, "dashboard_snapshot"),
    user: normalizeUser(row.user),
    leaderboard: normalizeLeaderboard(row.leaderboard),
    recent_activity: normalizeRecentActivity(row.recent_activity),
    announcements: normalizeAnnouncements(row.announcements),
    ts: toInteger(row.ts, Date.now()),
  }
}

export function DashboardContent() {
  const router = useRouter()
  const DASHBOARD_POLLING_INTERVAL_MS = 60_000
  const HIDDEN_DISCONNECT_AFTER_MS = 60_000
  const ENABLE_DASHBOARD_SSE = false
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshingAnnouncements, setIsRefreshingAnnouncements] = React.useState(false)

  const lastEventIdRef = React.useRef<string>("")
  const sseAbortRef = React.useRef<AbortController | null>(null)
  const sseRetryTimerRef = React.useRef<number | null>(null)
  const sseRetryCountRef = React.useRef<number>(0)
  const hiddenDisconnectTimerRef = React.useRef<number | null>(null)
  const cachedUserRef = React.useRef<DashboardUser | null>(null)

  const getAccessToken = React.useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const cacheUsernameToBrowser = React.useCallback((username: string, plan?: string) => {
    const cached = getCachedUserInfo()
    const safeUsername = toText(username, DEFAULT_USER.user_name)
    setCachedUserInfo({
      id: cached?.id,
      email: cached?.email || "user@example.com",
      username: safeUsername,
      plan: plan ?? cached?.plan,
      avatarUrl: cached?.avatarUrl,
      avatarHash: cached?.avatarHash,
    })
  }, [])

  const applySnapshot = React.useCallback((next: DashboardSnapshot) => {
    setSnapshot(next)
    cacheUsernameToBrowser(next.user.user_name, next.user.plan)
  }, [cacheUsernameToBrowser])

  React.useEffect(() => {
    cachedUserRef.current = snapshot?.user ?? null
  }, [snapshot])

  React.useEffect(() => {
    if (!snapshot) return
    setCachedDashboardSnapshot(snapshot)
  }, [snapshot])

  const fetchDashboard = React.useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error("No access token")
    }

    const url = new URL("/api/external/dashboard", window.location.origin)
    url.searchParams.set("top", String(clampTop(DASHBOARD_TOP_DEFAULT)))
    url.searchParams.set("activity_limit", String(ACTIVITY_LIMIT))
    url.searchParams.set("ann_limit", String(ANNOUNCEMENT_LIMIT))

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Dashboard request failed (HTTP ${response.status})`)
    }

    const payload = normalizeSnapshot(await response.json())
    applySnapshot(payload)
  }, [applySnapshot, getAccessToken])

  const fetchAnnouncements = React.useCallback(async (): Promise<boolean> => {
    const token = await getAccessToken()
    if (!token) return false

    const response = await fetch("/api/external/announcement", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) return false

    const payload = extractAnnouncements(await response.json())
    if (payload.length === 0) return false

    setSnapshot((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        announcements: payload,
        ts: Date.now(),
      }
    })
    return true
  }, [getAccessToken])

  const handleRefreshAnnouncements = React.useCallback(async () => {
    const startedAt = Date.now()
    setIsRefreshingAnnouncements(true)
    try {
      const ok = await fetchAnnouncements()
      if (!ok) {
        toast("No announcements available")
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("[Dashboard] announcements refresh failed:", error)
      toast.error("Failed to refresh announcements")
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < 500) {
        await new Promise((resolve) => window.setTimeout(resolve, 500 - elapsed))
      }
      setIsRefreshingAnnouncements(false)
    }
  }, [fetchAnnouncements, router])

  const handleDashboardEvent = React.useCallback((raw: string, eventName: string) => {
    if (!raw) return

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (parseError) {
      console.error("[Dashboard SSE] parse error:", parseError)
      return
    }

    const packet = isRecord(parsed) ? parsed : {}
    const packetType = toText(packet.type)
    const eventType = packetType || eventName

    if (eventType === "dashboard_snapshot") {
      applySnapshot(normalizeSnapshot(packet))
      return
    }

    if (eventType === "dashboard_update") {
      const nextUser = normalizeUser(packet.user)
      setSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          user: packet.user === undefined ? prev.user : nextUser,
          recent_activity: mergeRecentActivity(prev.recent_activity, packet.recent_activity ?? packet.recent),
          ts: Date.now(),
        }
      })
      if (packet.user !== undefined) {
        cacheUsernameToBrowser(nextUser.user_name, nextUser.plan)
      }
      return
    }

    if (eventType === "leaderboard_update") {
      setSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          leaderboard: normalizeLeaderboard(packet.leaderboard),
          ts: Date.now(),
        }
      })
      return
    }

    if (eventType === "announcement_update") {
      const incomingList = normalizeAnnouncements(packet.announcements)
      const incoming = incomingList.length > 0
        ? incomingList
        : normalizeAnnouncements([packet.announcement ?? packet])

      if (incoming.length === 0) return

      setSnapshot((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          announcements: dedupeAnnouncements([...incoming, ...prev.announcements]),
          ts: Date.now(),
        }
      })
      void fetchAnnouncements()
      return
    }
  }, [applySnapshot, cacheUsernameToBrowser, fetchAnnouncements])

  React.useEffect(() => {
    let cancelled = false
    let pollingTimer: number | null = null

    const clearRetryTimer = () => {
      if (sseRetryTimerRef.current !== null) {
        window.clearTimeout(sseRetryTimerRef.current)
        sseRetryTimerRef.current = null
      }
    }

    const clearHiddenDisconnectTimer = () => {
      if (hiddenDisconnectTimerRef.current !== null) {
        window.clearTimeout(hiddenDisconnectTimerRef.current)
        hiddenDisconnectTimerRef.current = null
      }
    }

    const disconnectSSE = () => {
      clearRetryTimer()
      sseAbortRef.current?.abort()
      sseAbortRef.current = null
    }

    const refreshDashboard = async () => {
      try {
        await fetchDashboard()
      } catch (fetchError) {
        console.error("[Dashboard] refresh failed:", fetchError)
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || !ENABLE_DASHBOARD_SSE || document.hidden) return
      clearRetryTimer()
      const retry = sseRetryCountRef.current + 1
      sseRetryCountRef.current = retry
      const delay = Math.min(30000, 1000 * 2 ** Math.min(retry, 5))
      sseRetryTimerRef.current = window.setTimeout(() => {
        void connectSSE()
      }, delay)
    }

    const connectSSE = async () => {
      if (cancelled || !ENABLE_DASHBOARD_SSE || document.hidden) return

      try {
        sseAbortRef.current?.abort()
        const controller = new AbortController()
        sseAbortRef.current = controller

        const token = await getAccessToken()
        if (!token) {
          scheduleReconnect()
          return
        }

        const url = new URL("/api/external/sse/dashboard", window.location.origin)
        if (lastEventIdRef.current) {
          url.searchParams.set("since", lastEventIdRef.current)
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
            ...(lastEventIdRef.current ? { "Last-Event-ID": lastEventIdRef.current } : {}),
          },
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          scheduleReconnect()
          return
        }

        sseRetryCountRef.current = 0
        if (cachedUserRef.current) {
          cacheUsernameToBrowser(cachedUserRef.current.user_name, cachedUserRef.current.plan)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let currentEvent = ""
        let currentId = ""
        let dataLines: string[] = []

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line === "") {
              const payload = dataLines.join("\n").trim()
              if (currentId) {
                lastEventIdRef.current = currentId
              }
              if (payload) {
                handleDashboardEvent(payload, currentEvent || "message")
              }
              currentEvent = ""
              currentId = ""
              dataLines = []
              continue
            }
            if (line.startsWith(":")) continue
            if (line.startsWith("id:")) {
              currentId = line.slice(3).trim()
              continue
            }
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim()
              continue
            }
            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart())
            }
          }
        }

        if (!controller.signal.aborted) {
          scheduleReconnect()
        }
      } catch (sseError) {
        if (!cancelled) {
          console.error("[Dashboard SSE] connection error:", sseError)
          scheduleReconnect()
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHiddenDisconnectTimer()
        hiddenDisconnectTimerRef.current = window.setTimeout(() => {
          if (document.hidden) {
            disconnectSSE()
          }
        }, HIDDEN_DISCONNECT_AFTER_MS)
        return
      }

      clearHiddenDisconnectTimer()
      void refreshDashboard()
      if (ENABLE_DASHBOARD_SSE && !sseAbortRef.current) {
        void connectSSE()
      }
    }

    const handleOnline = () => {
      if (document.hidden) return
      void refreshDashboard()
      if (ENABLE_DASHBOARD_SSE && !sseAbortRef.current) {
        void connectSSE()
      }
    }

    const bootstrap = async () => {
      setIsLoading(true)
      const cached = getCachedDashboardSnapshot()
      if (cached) {
        applySnapshot(normalizeSnapshot(cached))
        setIsLoading(false)
      }

      try {
        await fetchDashboard()
      } catch (fetchError) {
        console.error("[Dashboard] initial fetch failed:", fetchError)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          if (ENABLE_DASHBOARD_SSE && !document.hidden) {
            void connectSSE()
          }
        }
      }
    }

    void bootstrap()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("online", handleOnline)

    if (!ENABLE_DASHBOARD_SSE) {
      pollingTimer = window.setInterval(() => {
        if (!document.hidden) {
          void refreshDashboard()
        }
      }, DASHBOARD_POLLING_INTERVAL_MS)
    }

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
      clearHiddenDisconnectTimer()
      disconnectSSE()
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer)
      }
    }
  }, [
    DASHBOARD_POLLING_INTERVAL_MS,
    ENABLE_DASHBOARD_SSE,
    HIDDEN_DISCONNECT_AFTER_MS,
    applySnapshot,
    cacheUsernameToBrowser,
    fetchDashboard,
    getAccessToken,
    handleDashboardEvent,
  ])

  const user = snapshot?.user ?? DEFAULT_USER
  const leaderboard = snapshot?.leaderboard ?? []
  const announcements = snapshot?.announcements ?? []
  const recentActivity = snapshot?.recent_activity ?? []
  const animatedRank = useFastCountUp(user.rank ?? 0, 550)
  const animatedInjected = useFastCountUp(user.injected_total, 550)
  const animatedDumped = useFastCountUp(user.dumped_total, 550)

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-hide p-4 font-[family-name:var(--font-inter)]">
      <div className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Welcome back, {user.user_name}</h1>
            <p className="text-muted-foreground text-sm">{"Here's what's happening with your account today."}</p>
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rank</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">
                  {user.rank === null ? "-" : `#${animatedRank}`}
                </p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <IconTrophy className="size-5 text-yellow-500" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <IconTrendingUp className="size-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Last week {formatRank(user.last_week_rank)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Injected</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">{formatCount(animatedInjected)}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <IconTarget className="size-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <IconTrendingUp className="size-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Last week {formatCount(user.last_week_injected)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dumped</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">{formatCount(animatedDumped)}</p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2">
                <IconDatabase className="size-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <IconTrendingUp className="size-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Last week {formatCount(user.last_week_dumped)}</span>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="h-[460px] rounded-xl lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconFlame className="size-4 text-orange-500" />
                <CardTitle className="text-base">Leaderboard</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">{leaderboard.length} users</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((item, index) => (
                    <TableRow key={`${item.user_name}_${item.rank ?? index}`}>
                      <TableCell>
                        {item.rank === 1 ? (
                          <div className="flex size-7 items-center justify-center rounded-full bg-yellow-500/10">
                            <IconCrown className="size-4 text-yellow-500" />
                          </div>
                        ) : (
                          <span className="pl-2 font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground">
                            {formatRank(item.rank)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{item.user_name}</span>
                      </TableCell>
                      <TableCell className="text-right font-[family-name:var(--font-jetbrains-mono)]">
                        {formatCount(item.score)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {leaderboard.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        No leaderboard data
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="h-[230px] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconBell className="size-4 text-blue-500" />
                  <CardTitle className="text-base">Announcements</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleRefreshAnnouncements()}
                  disabled={isRefreshingAnnouncements}
                >
                  <IconRefresh className={`size-3.5 ${isRefreshingAnnouncements ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto scrollbar-hide space-y-3">
              {announcements.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="mt-1.5 size-2 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words whitespace-pre-wrap">{renderAnnouncementText(item.main)}</p>
                    <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">{renderAnnouncementText(item.subtext)}</p>
                  </div>
                </div>
              ))}
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No announcements</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-[240px] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <IconDatabase className="size-4 text-purple-500" />
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto scrollbar-hide space-y-3">
              {recentActivity.map((item) => (
                <div key={getRecentActivityKey(item)} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.domain}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.country} | {item.category}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground">
                    {formatTime(item.ts)}
                  </span>
                </div>
              ))}
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent injected activity</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
