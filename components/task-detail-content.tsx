"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconTrash,
  IconDownload,
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
  IconClock,
  IconDotsVertical,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconSettings,
  IconList,
  IconWorld,
  IconSparkles,
  IconShield,
  IconAdjustments,
  IconWaveSine,
  IconChartLine,
  IconBinaryTree,
  IconEye,
  IconBook,
  IconCpu,
  IconBolt,
  IconBrain,
  IconCoins,
  IconShieldCheck,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

// API Response Types
interface UrlItem {
  id: string
  domain: string
  status: string
}

interface TaskDetailResponse {
  id: string
  status: "pending" | "running_recon" | "running" | "paused" | "complete" | "failed"
  target: string | number
  progress?: {
    target: number
    current: number
  }
  urls: UrlItem[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

interface TaskSettings {
  id: string
  name: string
  file: string
  ai_mode: boolean
  auto_dumper: boolean
  preset: string | null
  union_based: boolean
  error_based: boolean
  time_based: boolean
  boolean_based: boolean
  parameter_risk_filter: "high" | "medium-high" | "all"
  ai_sensitivity_level: "low" | "medium" | "high"
  response_pattern_drift: boolean
  baseline_profiling: boolean
  structural_change_detection: boolean
  status: string
  created_at: string
  google_mode?: "google_lite" | "google_fast" | "google_deep"
}

interface TaskDetailContentProps {
  id: string
  displayName?: string
  basePath?: string
  enableExternal?: boolean
}

type DumpSortBy = "domain" | "country" | "category" | "rows" | "status"
type DumpRowsSortOrder = "asc" | "desc"
type DumpStatusSortPreference = "dumped_first" | "progress_first"
type InjectionSortBy = "domain" | "country" | "category"

interface StatsSSEPayload {
  type?: string
  websites_total?: number
  websites_done?: number
  remaining?: number
  success?: number
  failed?: number
  waf_detected?: number
  credits?: number
  rps?: number
  rps_history?: number[]
  wpm?: number
  wpm_history?: number[]
  category?: Record<string, number>
  eta_seconds?: number
  dump?: number
  dumped?: number
}

interface ResultsBatchSSEPayload {
  type?: string
  credits?: number
  items?: Array<{
    domain?: string
    country?: string
    category?: string
    waf?: boolean
    waftech?: string | null
    created_at?: string
  }>
}

interface DumperStatsSSEPayload {
  type?: string
  preset?: string
  dump?: number
  dumped?: number
  target?: number
  completed?: number
  running?: number
  queue?: number
  progress_percent?: number
  domains?: Array<{
    domain?: string
    country?: string
    category?: string
    long_task?: boolean
    rows?: string | number
    progress?: number
    total?: number
    status?: string
    success?: boolean
  }>
}

interface TaskDoneSSEPayload {
  type?: string
  taskid?: string
  status?: string
  credits?: number
  final?: {
    websites_total?: number
    websites_done?: number
    remaining?: number
    success?: number
    failed?: number
  }
}

interface DumpUploadStartResponse {
  success?: boolean
  request_id?: string
  upload_object_path?: string
  error?: string
  message?: string
}

interface SnapshotResponse {
  task_id: string
  status: string
  stats?: Partial<StatsSSEPayload>
  dump_snapshot?: Partial<DumperStatsSSEPayload> | Record<string, never>
  injection_items?: Array<{
    domain?: string
    country?: string
    category?: string
    created_at?: string
  }>
  last_event_id?: string
  next_cursor?: string
  has_more?: boolean
}

type InjectionCacheRow = {
  key: string
  domain: string
  country: string
  category: string
  waf?: boolean
}

type StreamStatsCacheRecord = {
  updatedAt: number
  lastEventId: string
  progress: {
    current: number
    target: number
  }
  success: number
  failed: number
  wafDetected: number
  creditsUsed: number
  rps: number
  wpm: number
  etaSeconds: number
  rpsHistory: number[]
  wpmHistory: number[]
  category: Record<string, number>
  dump: number
  dumped: number
}

type ResultsCacheRecord = {
  taskId: string
  updatedAt: number
  rows: InjectionCacheRow[]
}

const STREAM_RESULTS_DB_NAME = "task_stream_cache_v1"
const STREAM_RESULTS_STORE = "results_by_task"

function getJsonSizeBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"))
  })
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"))
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"))
  })
}

async function openStreamResultsDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null
  }

  try {
    const openReq = window.indexedDB.open(STREAM_RESULTS_DB_NAME, 1)
    openReq.onupgradeneeded = () => {
      const db = openReq.result
      if (!db.objectStoreNames.contains(STREAM_RESULTS_STORE)) {
        db.createObjectStore(STREAM_RESULTS_STORE, { keyPath: "taskId" })
      }
    }
    return await idbRequest(openReq)
  } catch (error) {
    console.error("[Cache] ❌ Failed to open IndexedDB:", error)
    return null
  }
}

async function loadResultsCacheForTask(taskId: string): Promise<ResultsCacheRecord | null> {
  const db = await openStreamResultsDb()
  if (!db) return null

  try {
    const tx = db.transaction(STREAM_RESULTS_STORE, "readonly")
    const store = tx.objectStore(STREAM_RESULTS_STORE)
    const record = (await idbRequest(store.get(taskId))) as ResultsCacheRecord | undefined
    await idbTxDone(tx)
    return record ?? null
  } catch (error) {
    console.error("[Cache] ❌ Failed to load results cache:", error)
    return null
  } finally {
    db.close()
  }
}

async function clearResultsCacheForTask(taskId: string): Promise<void> {
  const db = await openStreamResultsDb()
  if (!db) return

  try {
    const tx = db.transaction(STREAM_RESULTS_STORE, "readwrite")
    const store = tx.objectStore(STREAM_RESULTS_STORE)
    await idbRequest(store.delete(taskId))
    await idbTxDone(tx)
  } catch (error) {
    console.error("[Cache] ❌ Failed to clear results cache:", error)
  } finally {
    db.close()
  }
}

async function saveResultsCacheForTask(
  taskId: string,
  rows: InjectionCacheRow[],
  perTaskLimit: number,
  globalBytesLimit: number
): Promise<void> {
  const db = await openStreamResultsDb()
  if (!db) return

  try {
    const tx = db.transaction(STREAM_RESULTS_STORE, "readwrite")
    const store = tx.objectStore(STREAM_RESULTS_STORE)

    const trimmedRows = rows.slice(0, perTaskLimit)
    const currentRecord: ResultsCacheRecord = {
      taskId,
      updatedAt: Date.now(),
      rows: trimmedRows,
    }
    await idbRequest(store.put(currentRecord))

    const allRecords = (await idbRequest(store.getAll())) as ResultsCacheRecord[]
    const sorted = allRecords.sort((a, b) => b.updatedAt - a.updatedAt)

    let usedBytes = 0
    for (const record of sorted) {
      usedBytes += getJsonSizeBytes(record)
      if (usedBytes > globalBytesLimit) {
        await idbRequest(store.delete(record.taskId))
      }
    }

    await idbTxDone(tx)
  } catch (error) {
    console.error("[Cache] ❌ Failed to save results cache:", error)
  } finally {
    db.close()
  }
}

// Table row data (transformed from API)
interface TableRowData {
  id: string
  country: string
  domain: string
  type: string
  database: string
  rows: number
  status: "complete" | "dumping" | "failed" | "queue"
}

// Map API status to UI status
function mapUrlStatus(apiStatus: string): "complete" | "dumping" | "failed" | "queue" {
  if (apiStatus === "recon_complete") return "queue"
  if (apiStatus === "complete") return "complete"
  if (apiStatus === "dumping") return "dumping"
  if (apiStatus === "failed") return "failed"
  return "queue"
}

const isDev = process.env.NODE_ENV !== "production"
const SSE_DEBUG_LOGS = process.env.NEXT_PUBLIC_SSE_DEBUG === "1"
const PERF_MONITOR_ENABLED = process.env.NEXT_PUBLIC_PERF_MONITOR === "1"

function sseDebugLog(...args: unknown[]) {
  if (!SSE_DEBUG_LOGS) return
  console.log(...args)
}

function perfWarn(...args: unknown[]) {
  if (!PERF_MONITOR_ENABLED) return
  console.warn(...args)
}

// Format credits number to k/M format
function formatCredits(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return num.toString()
}

function toEngineLabel(mode: unknown): string {
  const raw = typeof mode === "string" ? mode : ""
  if (raw === "google_fast") return "Google Fast"
  if (raw === "google_deep") return "Google Deep"
  return "Google Lite"
}

function EngineLiteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path fill="none" d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1zM16 8L2 22m15.5-7H9" />
    </svg>
  )
}

const statusConfig = {
  complete: { 
    icon: IconCircleCheck, 
    label: "Complete", 
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    iconClass: "text-emerald-600 dark:text-emerald-400"
  },
  dumping: { 
    icon: IconLoader2, 
    label: "Dumping", 
    className: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    iconClass: "text-blue-600 dark:text-blue-400 animate-spin"
  },
  failed: { 
    icon: IconAlertTriangle, 
    label: "Failed", 
    className: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
    iconClass: "text-red-600 dark:text-red-400"
  },
  queue: { 
    icon: IconClock, 
    label: "Queue", 
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    iconClass: "text-yellow-600 dark:text-yellow-400"
  },
}

function getColumns(taskId: string): ColumnDef<TableRowData>[] {
  return [
    {
      accessorKey: "country",
      header: "Country",
      cell: ({ row }) => {
        const country = row.getValue("country") as string
        return <span className="font-medium">{country || "Unknown"}</span>
      },
    },
    {
      accessorKey: "domain",
      header: "Domains",
      cell: ({ row }) => {
        const domain = row.getValue("domain") as string
        return <span className="font-mono text-sm text-muted-foreground">{domain || "-"}</span>
      },
    },
    {
      accessorKey: "type",
      header: "Category",
      cell: ({ row }) => {
        const type = row.getValue("type") as string
        return type !== "-" ? (
          <Badge variant="secondary" className="font-mono text-xs">
            {type}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as keyof typeof statusConfig
        const config = statusConfig[status]
        const StatusIcon = config.icon
        return (
          <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
            <StatusIcon size={12} className={config.iconClass} />
            <span className="font-medium">{config.label}</span>
          </Badge>
        )
      },
    },
  ]
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return value.toString()
}

function sanitizeChartKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown"
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00m 00s"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
}

function getHttpErrorMessage(
  status: number,
  fallback: string,
  options?: { forbiddenMessage?: string }
): string {
  if (status === 400 || status === 422) return "Invalid request data"
  if (status === 401) return "Please login again"
  if (status === 403) return options?.forbiddenMessage || "Permission denied"
  if (status === 404) return "Resource not found"
  if (status === 409) return "Operation conflict. Please refresh and retry"
  if (status === 429) return "Too many requests. Please try again later"
  if (status >= 500) return "Server error. Please try again later"
  return fallback
}

export function TaskDetailContent({
  id,
  displayName = "Dumper",
  basePath = "/dumper",
  enableExternal = true,
}: TaskDetailContentProps) {
  const displayNameLower = displayName.toLowerCase()
  const isTasksMode = basePath === "/tasks"
  const taskApiBasePath = basePath === "/tasks" ? "/api/v1/tasks" : "/api/v1/dumper"
  type TaskStatus = "pending" | "running_recon" | "running" | "paused" | "complete" | "failed"
  const normalizeTaskStatus = React.useCallback((value: unknown): TaskStatus => {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
    if (raw === "running_recon" || raw === "recon_running") return "running_recon"
    if (raw === "running" || raw === "in_progress" || raw === "processing") return "running"
    if (raw === "paused") return "paused"
    if (raw === "complete" || raw === "completed" || raw === "done" || raw === "success") return "complete"
    if (raw === "failed" || raw === "error") return "failed"
    return "pending"
  }, [])

  const shortId = id.split("-")[0]
  const INJECTION_WINDOW_LIMIT = 1000
  const INJECTION_PREFETCH_LIMIT = 50
  const INJECTION_SNAPSHOT_PREFETCH_MAX = 400
  const STREAM_STATS_CACHE_KEY = `task_stream_state_${id}`
  const STREAM_STATS_TTL_MS = 60 * 60 * 1000
  const STREAM_STATS_MAX_BYTES = 200 * 1024
  const STREAM_STATS_WRITE_DEBOUNCE_MS = 800
  const RESULTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
  const RESULTS_CACHE_MAX_ROWS_PER_TASK = 200
  const RESULTS_CACHE_MAX_BYTES = 30 * 1024 * 1024
  const RESULTS_CACHE_WRITE_DEBOUNCE_MS = 600

  // Data state
  const [isLoadingData, setIsLoadingData] = React.useState(true)
  const [isCheckingTask, setIsCheckingTask] = React.useState(true)
  const [taskNotFound, setTaskNotFound] = React.useState(false)
  const [taskStatus, setTaskStatus] = React.useState<TaskStatus>("pending")
  const [progress, setProgress] = React.useState({ target: 0, current: 0 })
  const [creditsUsed, setCreditsUsed] = React.useState(0)
  const [fileId, setFileId] = React.useState<string>("")
  const [storagePath, setStoragePath] = React.useState<string>("")
  const [sseRps, setSseRps] = React.useState(0)
  const [sseWpm, setSseWpm] = React.useState(0)
  const [sseRpsHistory, setSseRpsHistory] = React.useState<number[]>([])
  const [sseWpmHistory, setSseWpmHistory] = React.useState<number[]>([])
  const [sseSuccess, setSseSuccess] = React.useState(0)
  const [sseFailed, setSseFailed] = React.useState(0)
  const [sseWafDetected, setSseWafDetected] = React.useState(0)
  const [sseEtaSeconds, setSseEtaSeconds] = React.useState(0)
  const [sseCategory, setSseCategory] = React.useState<Record<string, number>>({})
  const [sseDumpCount, setSseDumpCount] = React.useState(0)
  const [sseDumpedCount, setSseDumpedCount] = React.useState(0)
  const [sseDumpQueueCount, setSseDumpQueueCount] = React.useState<number | null>(null)
  const [sseDumpProgressPercent, setSseDumpProgressPercent] = React.useState<number | null>(null)
  const [sseInjectionRows, setSseInjectionRows] = React.useState<
    Array<{ key: string; domain: string; country: string; category: string; waf?: boolean }>
  >([])
  const [sseDumpRows, setSseDumpRows] = React.useState<
    Array<{
      key: string
      domain: string
      country: string
      category: string
      longTask: boolean
      rows: number
      statusKind: "dumped" | "progress"
      statusLabel: string
      percentDone: number
    }>
  >([])

  const normalizeDumpRowsFromDomains = React.useCallback(
    (domains: DumperStatsSSEPayload["domains"], keyPrefix: string) => {
      const safeDomains = Array.isArray(domains) ? domains : []
      return safeDomains
        .filter((item) => item.domain && item.domain.trim().length > 0)
        .map((item, idx) => {
          const domain = (item.domain || "-").trim()
          const country = (item.country || "-").trim() || "-"
          const category = (item.category || "-").trim() || "-"
          const longTask = item.long_task === true
          const totalRaw = typeof item.total === "number" && Number.isFinite(item.total) ? Math.max(0, Math.trunc(item.total)) : 0
          const progressRaw =
            typeof item.progress === "number" && Number.isFinite(item.progress) ? Math.max(0, Math.trunc(item.progress)) : 0
          const progress = totalRaw > 0 ? Math.min(progressRaw, totalRaw) : progressRaw
          const total = totalRaw

          const parsedRows =
            typeof item.rows === "number"
              ? Math.max(0, Math.trunc(item.rows))
              : Math.max(0, Math.trunc(Number(item.rows ?? 0)))
          const rows = Number.isFinite(parsedRows) ? parsedRows : 0

          const statusText = (item.status || "").trim()
          // Some backends only send `status: "x/y"` without explicit progress/total fields.
          // Parse it as a fallback so UI still updates.
          let effectiveProgress = progress
          let effectiveTotal = total
          if ((!Number.isFinite(effectiveTotal) || effectiveTotal <= 0) && statusText.includes("/")) {
            const match = statusText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/)
            if (match) {
              effectiveProgress = Math.max(0, Math.trunc(Number(match[1] || 0)))
              effectiveTotal = Math.max(0, Math.trunc(Number(match[2] || 0)))
            }
          }

          const statusLower = statusText.toLowerCase()
          const isDumped = statusLower === "dumped" || (effectiveTotal > 0 && effectiveProgress >= effectiveTotal)

          const rawPercent = effectiveTotal > 0 ? (effectiveProgress / effectiveTotal) * 100 : 0
          const percentDone = !isDumped
            ? Math.max(
                0,
                Math.min(
                  100,
                  // Avoid "stuck at 0%" when progress has started but is <0.5%.
                  effectiveProgress > 0 && rawPercent > 0 && rawPercent < 1 ? 1 : Math.round(rawPercent)
                )
              )
            : 100

          return {
            key: `${keyPrefix}-${idx}-${domain}`,
            domain,
            country,
            category,
            longTask,
            rows: rows > 0 ? rows : total,
            statusKind: isDumped ? ("dumped" as const) : ("progress" as const),
            statusLabel: isDumped
              ? "Dumped"
              : effectiveTotal > 0
                ? `${effectiveProgress.toLocaleString()}/${effectiveTotal.toLocaleString()}`
                : statusText,
            percentDone: isDumped ? 100 : percentDone,
          }
        })
    },
    []
  )

  const applyDumpSnapshot = React.useCallback(
    (dumpSnapshot?: SnapshotResponse["dump_snapshot"]) => {
      if (!dumpSnapshot || typeof dumpSnapshot !== "object") return

      const payload = dumpSnapshot as Partial<DumperStatsSSEPayload>
      const domains = Array.isArray(payload.domains) ? payload.domains : []
      if (process.env.NODE_ENV !== "production") {
        console.log("[Snapshot] 🧪 dump_snapshot payload:", {
          type: payload.type,
          preset: payload.preset,
          dump: payload.dump,
          dumped: payload.dumped,
          domains: domains.length,
          preview: domains.slice(0, 5).map((item) => ({
            domain: item.domain,
            country: item.country,
            category: item.category,
            rows: item.rows,
            progress: item.progress,
            total: item.total,
            status: item.status,
            success: item.success,
          })),
        })
      }

      if (typeof payload.dump === "number" && Number.isFinite(payload.dump)) {
        const nextDump = Math.max(0, Math.trunc(payload.dump))
        setSseDumpCount((prev) => (nextDump > prev ? nextDump : prev))
      }
      if (typeof payload.dumped === "number" && Number.isFinite(payload.dumped)) {
        const nextDumped = Math.max(0, Math.trunc(payload.dumped))
        setSseDumpedCount((prev) => (nextDumped > prev ? nextDumped : prev))
      }
      if (typeof payload.queue === "number" && Number.isFinite(payload.queue)) {
        setSseDumpQueueCount(Math.max(0, Math.trunc(payload.queue)))
      }
      if (typeof payload.progress_percent === "number" && Number.isFinite(payload.progress_percent)) {
        setSseDumpProgressPercent(Math.max(0, Math.min(100, Math.round(payload.progress_percent))))
      }

      if (domains.length > 0) {
        const incoming = normalizeDumpRowsFromDomains(domains, `snapshot-${Date.now()}`)
        if (incoming.length > 0) {
          setSseDumpRows((prev) => (prev.length > 0 ? prev : incoming))
          setDumpsHydrated(true)
        }
      }
    },
    [normalizeDumpRowsFromDomains]
  )

  // ETA countdown (UI-only). Synced from stats eta_seconds and ticks down locally.
  const [etaCountdownSeconds, setEtaCountdownSeconds] = React.useState<number | null>(null)
  const etaIntervalRef = React.useRef<number | null>(null)

  // Injection list pagination via snapshot cursor.
  const [injectionNextCursor, setInjectionNextCursor] = React.useState<string | null>(null)
  const [injectionHasMore, setInjectionHasMore] = React.useState(false)
  const [isLoadingInjectionMore, setIsLoadingInjectionMore] = React.useState(false)
  const injectionCursorRef = React.useRef<string | null>(null)
  const injectionHasMoreRef = React.useRef(false)

  // Hydration flags (cache/snapshot/SSE). Used for skeleton rendering.
  const [statsHydrated, setStatsHydrated] = React.useState(false)
  const [injectionHydrated, setInjectionHydrated] = React.useState(false)
  const [dumpsHydrated, setDumpsHydrated] = React.useState(false)
  
  // Client-side pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const pageSize = 50

  // Removed multi-step loader (was used for SSE)
  
  // Settings dialog state
  const [showSettings, setShowSettings] = React.useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const HIDDEN_DISCONNECT_AFTER_MS = 60_000
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [taskName, setTaskName] = React.useState("")
  const [selectedEngineLabel, setSelectedEngineLabel] = React.useState("Google Lite")
  const [listsFile, setListsFile] = React.useState("")
  const [aiMode, setAiMode] = React.useState(true)
  const [autoDumper, setAutoDumper] = React.useState(false)
  const [preset, setPreset] = React.useState("")
  const [unionBased, setUnionBased] = React.useState(true)
  const [errorBased, setErrorBased] = React.useState(true)
  const [booleanBased, setBooleanBased] = React.useState(false)
  const [timeBased, setTimeBased] = React.useState(false)
  
  // AI Settings
  const [parameterRiskFilter, setParameterRiskFilter] = React.useState<"high" | "medium-high" | "all">("medium-high")
  const [responsePatternDrift, setResponsePatternDrift] = React.useState(true)
  const [baselineProfiling, setBaselineProfiling] = React.useState(true)
  const [structuralChangeDetection, setStructuralChangeDetection] = React.useState(false)
  const [aiSensitivityLevel, setAiSensitivityLevel] = React.useState<"low" | "medium" | "high">("medium")
  const [antiBanEngine, setAntiBanEngine] = React.useState(false)
  const [payloadEngine, setPayloadEngine] = React.useState(false)
  const antiBanAvailable = false

  const [isStarting, setIsStarting] = React.useState(false)
  const [isDownloadingInjection, setIsDownloadingInjection] = React.useState(false)
  const [injectionSortBy, setInjectionSortBy] = React.useState<InjectionSortBy>("category")
  const [dumpSortBy, setDumpSortBy] = React.useState<DumpSortBy>("domain")
  const [dumpRowsSortOrder, setDumpRowsSortOrder] = React.useState<DumpRowsSortOrder>("desc")
  const [dumpStatusSortPreference, setDumpStatusSortPreference] = React.useState<DumpStatusSortPreference>("dumped_first")
  const [dumpUploadState, setDumpUploadState] = React.useState<"idle" | "uploading" | "done" | "failed">("idle")
  const [dumpUploadRequestId, setDumpUploadRequestId] = React.useState<string | null>(null)
  const [showStartLoader, setShowStartLoader] = React.useState(false)
  const [loaderStep, setLoaderStep] = React.useState(0)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [reconProgress, setReconProgress] = React.useState(0)
  const [reconStats, setReconStats] = React.useState({ current: 0, total: 0, timeRunning: '0s' })
  const [startTime, setStartTime] = React.useState<number>(0)
  const [baseElapsedMs, setBaseElapsedMs] = React.useState<number>(0)
  const [lastUpdateTime, setLastUpdateTime] = React.useState<number>(0)
  const [taskDoneReceived, setTaskDoneReceived] = React.useState(false)
  const [loaderIsDone, setLoaderIsDone] = React.useState(false)
  const hasFetched = React.useRef(false)
  const startRequestInFlightRef = React.useRef(false)
  const lastStartAttemptAtRef = React.useRef(0)
  const sseAbortController = React.useRef<AbortController | null>(null)
  const timeAnimationInterval = React.useRef<number | null>(null)
  const sseRetryCount = React.useRef<number>(0)
  const sseRetryTimer = React.useRef<number | null>(null)
  const sseConnectionState = React.useRef<'idle' | 'connecting' | 'connected'>('idle')
  const sseConnectionId = React.useRef<number>(0)
  const hiddenDisconnectTimerRef = React.useRef<number | null>(null)
  const autoDisconnectedByHiddenRef = React.useRef(false)
  const lastEventIdRef = React.useRef<string>("")
  const taskDoneToastShown = React.useRef<boolean>(false)
  const statsCacheTimerRef = React.useRef<number | null>(null)
  const pendingStatsCacheRef = React.useRef<StreamStatsCacheRecord | null>(null)
  const latestStatsSnapshotRef = React.useRef<StreamStatsCacheRecord | null>(null)
  const resultsCacheTimerRef = React.useRef<number | null>(null)
  const pendingResultsCacheRef = React.useRef<InjectionCacheRow[] | null>(null)
  const activeDumpRequestIdRef = React.useRef<string | null>(null)
  const pendingStatsPayloadRef = React.useRef<Partial<StatsSSEPayload> | null>(null)
  const statsFlushTimerRef = React.useRef<number | null>(null)

  // SSE UI state (ref is not reactive).
  const [sseUiStatus, setSseUiStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [lastStatsUpdatedAt, setLastStatsUpdatedAt] = React.useState<number | null>(null)
  
  // Cache key for localStorage
  const CACHE_KEY = `task_stats_${id}`
  const DUMP_SORT_PREF_KEY = `task_dump_sort_pref_${id}`
  
  // Data storage
  const [tableData, setTableData] = React.useState<TableRowData[]>([])

  React.useEffect(() => {
    setSseInjectionRows([])
    setSseDumpRows([])
    setSseDumpedCount(0)
    setSseDumpQueueCount(null)
    setSseDumpProgressPercent(null)
    setDumpUploadState("idle")
    setDumpUploadRequestId(null)
    activeDumpRequestIdRef.current = null
    lastEventIdRef.current = ""
    setStatsHydrated(false)
    setInjectionHydrated(false)
    setDumpsHydrated(false)
    setInjectionNextCursor(null)
    setInjectionHasMore(false)
    injectionCursorRef.current = null
    injectionHasMoreRef.current = false
    pendingStatsCacheRef.current = null
    pendingResultsCacheRef.current = null
    if (statsCacheTimerRef.current) {
      clearTimeout(statsCacheTimerRef.current)
      statsCacheTimerRef.current = null
    }
    if (resultsCacheTimerRef.current) {
      clearTimeout(resultsCacheTimerRef.current)
      resultsCacheTimerRef.current = null
    }
  }, [id])

  React.useEffect(() => {
    if (!isLoadingData) setDumpsHydrated(true)
  }, [isLoadingData])

  React.useEffect(() => {
    console.log("[State] sseSuccess updated:", {
      taskId: id,
      sseSuccess,
      statsHydrated,
      lastEventId: lastEventIdRef.current,
    })
  }, [id, sseSuccess, statsHydrated])

  const columns = React.useMemo(() => getColumns(id), [id])
  
  // Derived state for pagination
  const totalItems = tableData.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const pageData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return tableData.slice(start, start + pageSize)
  }, [tableData, currentPage, pageSize])

  // Keep currentPage in valid range when data changes
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  // Validate task id exists and belongs to user
  React.useEffect(() => {
    let isMounted = true
    const validateTask = async () => {
      setIsCheckingTask(true)
      setTaskNotFound(false) // 重置状态
      try {
        const response = await fetch(`${taskApiBasePath}/${id}?source=validate_task`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        const data = await response.json()

        if (!response.ok) {
          // 400 或 404 表示任务不存在或无效
          if (response.status === 400 || response.status === 404) {
            if (isMounted) setTaskNotFound(true)
          }
          return
        }

        // 响应成功，检查 data.success
        if (isMounted) {
          setTaskNotFound(!data?.success)
        }
      } catch (error) {
        console.error('Task validation error:', error)
        if (isMounted) setTaskNotFound(true)
      } finally {
        if (isMounted) setIsCheckingTask(false)
      }
    }

    validateTask()
    return () => {
      isMounted = false
    }
  }, [id])

  // Load cached task stats from localStorage
  const loadCachedStats = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        console.log('[Cache] 📦 Loaded cached stats:', data)
        
        // Restore progress
        if (data.progress !== undefined) {
          setReconProgress(data.progress)
        }
        
        // Restore recon stats
        if (data.reconStats) {
          setReconStats(data.reconStats)
          setBaseElapsedMs(data.baseElapsedMs || 0)
          setLastUpdateTime(Date.now())
        }
        
        // Restore credits
        if (data.creditsUsed !== undefined) {
          setCreditsUsed(data.creditsUsed)
        }
        
        return true
      }
    } catch (err) {
      console.error('[Cache] ❌ Failed to load cached stats:', err)
    }
    return false
  }
  
  // Save task stats to localStorage
  const saveCachedStats = (stats: {
    progress: number
    reconStats: { current: number; total: number; timeRunning: string }
    baseElapsedMs: number
    creditsUsed: number
  }) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(stats))
      console.log('[Cache] 💾 Saved stats to cache')
    } catch (err) {
      console.error('[Cache] ❌ Failed to save stats:', err)
    }
  }
  
  // Clear cached stats
  const clearCachedStats = () => {
    try {
      localStorage.removeItem(CACHE_KEY)
      console.log('[Cache] 🗑️ Cleared cached stats')
    } catch (err) {
      console.error('[Cache] ❌ Failed to clear cache:', err)
    }
  }

  // Cache key for task info
  const TASK_INFO_CACHE_KEY = `task_info_${id}`
  
  // Load cached task info
  const loadCachedTaskInfo = () => {
    try {
      const cached = localStorage.getItem(TASK_INFO_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        const cacheAge = Date.now() - (data.timestamp || 0)
        
        // Cache valid for 30 seconds
        if (cacheAge < 30000) {
          console.log('[Cache] 📦 Using cached task info, age:', Math.round(cacheAge / 1000) + 's')
          return data.task
        } else {
          console.log('[Cache] ⏰ Cache expired, age:', Math.round(cacheAge / 1000) + 's')
        }
      }
    } catch (err) {
      console.error('[Cache] ❌ Failed to load cached task info:', err)
    }
    return null
  }
  
  // Save task info to cache
  const saveCachedTaskInfo = (task: Record<string, unknown>) => {
    try {
      localStorage.setItem(TASK_INFO_CACHE_KEY, JSON.stringify({
        task,
        timestamp: Date.now()
      }))
      console.log('[Cache] 💾 Saved task info to cache')
    } catch (err) {
      console.error('[Cache] ❌ Failed to save task info:', err)
    }
  }
  
  // Clear task info cache
  const clearCachedTaskInfo = () => {
    try {
      localStorage.removeItem(TASK_INFO_CACHE_KEY)
      console.log('[Cache] 🗑️ Cleared task info cache')
    } catch (err) {
      console.error('[Cache] ❌ Failed to clear task info cache:', err)
    }
  }

  const flushStatsCacheNow = React.useCallback(() => {
    const payload = pendingStatsCacheRef.current
    if (!payload) return

    pendingStatsCacheRef.current = null
    try {
      const byteSize = getJsonSizeBytes(payload)
      if (byteSize <= STREAM_STATS_MAX_BYTES) {
        localStorage.setItem(STREAM_STATS_CACHE_KEY, JSON.stringify(payload))
      } else {
        const reducedPayload: StreamStatsCacheRecord = {
          ...payload,
          rpsHistory: payload.rpsHistory.slice(-16),
          wpmHistory: payload.wpmHistory.slice(-16),
        }
        localStorage.setItem(STREAM_STATS_CACHE_KEY, JSON.stringify(reducedPayload))
      }
    } catch (error) {
      console.error('[Cache] ❌ Failed to write stream stats cache:', error)
    }
  }, [STREAM_STATS_CACHE_KEY, STREAM_STATS_MAX_BYTES])

  const queueStatsCacheSave = React.useCallback(
    (snapshot: StreamStatsCacheRecord) => {
      pendingStatsCacheRef.current = snapshot
      latestStatsSnapshotRef.current = snapshot
      if (statsCacheTimerRef.current) return

      statsCacheTimerRef.current = window.setTimeout(() => {
        statsCacheTimerRef.current = null
        flushStatsCacheNow()
      }, STREAM_STATS_WRITE_DEBOUNCE_MS)
    },
    [STREAM_STATS_WRITE_DEBOUNCE_MS, flushStatsCacheNow]
  )

  const loadStreamStatsCache = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(STREAM_STATS_CACHE_KEY)
      if (!raw) return false

      const cached = JSON.parse(raw) as StreamStatsCacheRecord
      const cachedCreditsUsed = Math.max(0, Math.trunc(Number((cached as unknown as { creditsUsed?: unknown }).creditsUsed ?? 0)))
      const cachedDump = Math.max(0, Math.trunc(Number((cached as unknown as { dump?: unknown }).dump ?? 0)))
      const cachedDumped = Math.max(0, Math.trunc(Number((cached as unknown as { dumped?: unknown }).dumped ?? 0)))
      const normalizedCached: StreamStatsCacheRecord = {
        ...cached,
        creditsUsed: cachedCreditsUsed,
        dump: cachedDump,
        dumped: cachedDumped,
      }
      const age = Date.now() - (cached.updatedAt || 0)
      if (age > STREAM_STATS_TTL_MS) {
        localStorage.removeItem(STREAM_STATS_CACHE_KEY)
        return false
      }

      console.log("[Cache] ✅ Restoring stream stats cache:", {
        updatedAt: normalizedCached.updatedAt,
        ageMs: age,
        lastEventId: normalizedCached.lastEventId,
        success: normalizedCached.success,
        failed: normalizedCached.failed,
        wafDetected: normalizedCached.wafDetected,
        creditsUsed: normalizedCached.creditsUsed,
        dump: normalizedCached.dump,
        dumped: normalizedCached.dumped,
        progress: normalizedCached.progress,
        wpm: normalizedCached.wpm,
        rps: normalizedCached.rps,
      })

      setProgress({
        current: Math.max(0, Number(normalizedCached.progress?.current ?? 0)),
        target: Math.max(0, Number(normalizedCached.progress?.target ?? 0)),
      })
      setSseSuccess(Math.max(0, Number(normalizedCached.success ?? 0)))
      setSseFailed(Math.max(0, Number(normalizedCached.failed ?? 0)))
      setSseWafDetected(Math.max(0, Number(normalizedCached.wafDetected ?? 0)))
      setCreditsUsed(normalizedCached.creditsUsed)
      setSseRps(Math.max(0, Number(normalizedCached.rps ?? 0)))
      setSseWpm(Math.max(0, Number(normalizedCached.wpm ?? 0)))
      setSseEtaSeconds(Math.max(0, Number(normalizedCached.etaSeconds ?? 0)))
      setSseRpsHistory(Array.isArray(normalizedCached.rpsHistory) ? normalizedCached.rpsHistory.slice(-32) : [])
      setSseWpmHistory(Array.isArray(normalizedCached.wpmHistory) ? normalizedCached.wpmHistory.slice(-32) : [])
      setSseCategory(normalizedCached.category && typeof normalizedCached.category === "object" ? normalizedCached.category : {})
      setSseDumpCount(Math.max(0, Number(normalizedCached.dump ?? 0)))
      setSseDumpedCount(Math.max(0, Number(normalizedCached.dumped ?? 0)))

      if (typeof normalizedCached.lastEventId === "string" && normalizedCached.lastEventId.trim().length > 0) {
        lastEventIdRef.current = normalizedCached.lastEventId
      }
      latestStatsSnapshotRef.current = normalizedCached
      return true
    } catch (error) {
      console.error('[Cache] ❌ Failed to restore stream stats cache:', error)
      return false
    }
  }, [STREAM_STATS_CACHE_KEY, STREAM_STATS_TTL_MS])

  const clearStreamStatsCache = React.useCallback(() => {
    try {
      localStorage.removeItem(STREAM_STATS_CACHE_KEY)
      pendingStatsCacheRef.current = null
      latestStatsSnapshotRef.current = null
    } catch (error) {
      console.error('[Cache] ❌ Failed to clear stream stats cache:', error)
    }
  }, [STREAM_STATS_CACHE_KEY])

  const flushResultsCacheNow = React.useCallback(() => {
    const pendingRows = pendingResultsCacheRef.current
    if (!pendingRows) return

    pendingResultsCacheRef.current = null
    void saveResultsCacheForTask(
      id,
      pendingRows,
      RESULTS_CACHE_MAX_ROWS_PER_TASK,
      RESULTS_CACHE_MAX_BYTES
    )
  }, [id, RESULTS_CACHE_MAX_BYTES, RESULTS_CACHE_MAX_ROWS_PER_TASK])

  const queueResultsCacheSave = React.useCallback(
    (rows: InjectionCacheRow[]) => {
      pendingResultsCacheRef.current = rows
      if (resultsCacheTimerRef.current) return

      resultsCacheTimerRef.current = window.setTimeout(() => {
        resultsCacheTimerRef.current = null
        flushResultsCacheNow()
      }, RESULTS_CACHE_WRITE_DEBOUNCE_MS)
    },
    [RESULTS_CACHE_WRITE_DEBOUNCE_MS, flushResultsCacheNow]
  )

  const loadResultsCache = React.useCallback(async () => {
    const cached = await loadResultsCacheForTask(id)
    if (!cached) return false

    const age = Date.now() - (cached.updatedAt || 0)
    if (age > RESULTS_CACHE_TTL_MS) {
      await clearResultsCacheForTask(id)
      return false
    }

    if (!Array.isArray(cached.rows) || cached.rows.length === 0) return false

    setSseInjectionRows(cached.rows.slice(0, INJECTION_WINDOW_LIMIT))
    return true
  }, [id, RESULTS_CACHE_TTL_MS, INJECTION_WINDOW_LIMIT])

  const clearResultsCache = React.useCallback(async () => {
    pendingResultsCacheRef.current = null
    await clearResultsCacheForTask(id)
  }, [id])

	  // Fetch initial task data
		  const fetchTaskData = async (shouldConnectSSE: boolean = false) => {
		    setIsLoadingData(true)
		    const restoredStats = loadStreamStatsCache()
		    if (restoredStats) setStatsHydrated(true)

		    void loadResultsCache().then((restored) => {
		      if (restored) setInjectionHydrated(true)
		      return restored
		    })

		    // Fast path: hydrate stats immediately (no injection items).
		    // This gives instant Progress/WPM/RPS/ETA/Category before any list work.
		    void (async () => {
          if (!enableExternal) {
            if (shouldConnectSSE) setSseUiStatus("idle")
            return
          }
		      try {
		        const token = await getAccessToken()
		        if (!token) return
		        const snapshotUrl = new URL(`/api/external/task/${id}/snapshot`, window.location.origin)
		        snapshotUrl.searchParams.set("include_items", "0")
		        console.log("[Snapshot] ➡️ stats-only request:", snapshotUrl.toString())
		        const response = await fetch(snapshotUrl.toString(), {
		          method: "GET",
		          headers: {
		            Authorization: `Bearer ${token}`,
		            Accept: "application/json",
		          },
		        })
		        console.log("[Snapshot] ⬅️ stats-only response:", response.status)
		        if (!response.ok) return
		        const data = (await response.json()) as SnapshotResponse
		        console.log("[Snapshot] ✅ stats-only payload:", {
		          hasStats: !!data.stats,
		          hasDumpSnapshot: !!(data.dump_snapshot && typeof data.dump_snapshot === "object" && Object.keys(data.dump_snapshot).length > 0),
		          last_event_id: data.last_event_id,
		        })
		        if (data.stats) applyStatsPayload(data.stats)
		        applyDumpSnapshot(data.dump_snapshot)
		        if (data.last_event_id) lastEventIdRef.current = data.last_event_id
		      } catch (e) {
		        console.warn("[Snapshot] stats-only fetch failed:", e)
		      } finally {
		        if (shouldConnectSSE) connectSSE()
		      }
		    })()
	    
	    // Try to load from cache first
	    const cachedTask = loadCachedTaskInfo()
 	    if (cachedTask) {
	      console.log('[TaskDetail] 📦 Using cached task data')
      
      // Update UI with cached data
      setTaskName(cachedTask.name || '')
      setSelectedEngineLabel(toEngineLabel(cachedTask.google_mode))
      setListsFile(cachedTask.file_name || '')
      const cachedStatus = normalizeTaskStatus(cachedTask.status)
      setTaskStatus(cachedStatus)
      setProgress(prev => ({ ...prev, target: cachedTask.target || 0 }))
      setCreditsUsed(cachedTask.credits_used || 0)
      setFileId(cachedTask.file_id || '')
      
      setAiMode(cachedTask.ai_mode ?? true)
      setAutoDumper(cachedTask.auto_dumper ?? false)
      setPreset(cachedTask.preset || '')
      setParameterRiskFilter(cachedTask.parameter_risk_filter || 'medium-high')
      setAiSensitivityLevel(cachedTask.ai_sensitivity_level || 'medium')
      setResponsePatternDrift(cachedTask.response_pattern_drift ?? true)
      setBaselineProfiling(cachedTask.baseline_profiling ?? true)
      setStructuralChangeDetection(cachedTask.structural_change_detection ?? false)
      setAntiBanEngine(cachedTask.anti_ban_engine ?? false)
      setPayloadEngine(cachedTask.payload_engine ?? false)
      setUnionBased(cachedTask.union_based ?? true)
      setErrorBased(cachedTask.error_based ?? true)
      setBooleanBased(cachedTask.boolean_based ?? false)
      setTimeBased(cachedTask.time_based ?? false)
      
      setIsLoadingData(false)
      
      // Handle status-based actions
      if (cachedStatus === "running_recon") {
        const hasCachedData = loadCachedStats()
        if (!hasCachedData) {
          console.log('[TaskDetail] ℹ️ No cached stats data')
        }
        setShowStartLoader(true)
        setLoaderStep(3)
        if (shouldConnectSSE && enableExternal) {
          setTimeout(() => connectSSE(), 500)
        }
      } else if (cachedStatus === "running") {
        console.log('[TaskDetail] ▶️ Task is running (from cache), connecting SSE')
        if (shouldConnectSSE && enableExternal) {
          setTimeout(() => connectSSE(), 500)
        }
      }
      
      // Still fetch fresh data in background, but don't block UI
      fetchTaskDataFromAPI(shouldConnectSSE)
      return
    }
    
	    // No cache, fetch from API
	    await fetchTaskDataFromAPI(shouldConnectSSE)
	  }
  
  // Fetch task data from project API
  const fetchTaskDataFromAPI = async (shouldConnectSSE: boolean = false) => {
    try {
      await fetchFullTaskDataFromSupabase(shouldConnectSSE)
      // Don't block first paint on injection items. Stats snapshot runs early in fetchTaskData().
      if (enableExternal) {
        void fetchRealtimeSnapshot()
      }
    } catch (err) {
      console.error("[TaskDetail] Fetch error:", err)
      toast.error("Please Try Again")
    } finally {
      setIsLoadingData(false)
    }
  }
  
  // Fetch full task data from Supabase
  const fetchFullTaskDataFromSupabase = async (shouldConnectSSE: boolean = false) => {
    try {
      const response = await fetch(`${taskApiBasePath}/${id}?source=task_detail_load`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(getHttpErrorMessage(response.status, "Please Try Again"))
      }

      const task = data.data
      
      // Save to cache
      saveCachedTaskInfo(task)
      // 更新任务基本信息
      setTaskName(task.name || '')
      setSelectedEngineLabel(toEngineLabel(task.google_mode))
      setListsFile(task.file_name || '')
      const normalizedStatus = normalizeTaskStatus(task.status)
      setTaskStatus(normalizedStatus)
      setProgress(prev => ({ ...prev, target: task.target || 0 }))
      setCreditsUsed(task.credits_used || 0)
      setFileId(task.file_id || '')
      
      // 更新任务设置
      setAiMode(task.ai_mode ?? true)
      setAutoDumper(task.auto_dumper ?? false)
      setPreset(task.preset || '')
      setParameterRiskFilter(task.parameter_risk_filter || 'medium-high')
      setAiSensitivityLevel(task.ai_sensitivity_level || 'medium')
      setResponsePatternDrift(task.response_pattern_drift ?? true)
      setBaselineProfiling(task.baseline_profiling ?? true)
      setStructuralChangeDetection(task.structural_change_detection ?? false)
      setAntiBanEngine(task.anti_ban_engine ?? false)
      setPayloadEngine(task.payload_engine ?? false)
      setUnionBased(task.union_based ?? true)
      setErrorBased(task.error_based ?? true)
      setBooleanBased(task.boolean_based ?? false)
      setTimeBased(task.time_based ?? false)

      // 检查任务状态，如果是 running_recon，自动打开 loader 并连接 SSE
      if (normalizedStatus === "running_recon") {
        console.log('[TaskDetail] 🔄 Task is running_recon, auto-opening loader')
        
        // 先尝试从缓存加载数据
        const hasCachedData = loadCachedStats()
        
        if (!hasCachedData) {
          console.log('[TaskDetail] ℹ️ No cached data, starting fresh')
        }
        
        // 打开 multi-step loader，跳到 "Starting Recon" 步骤
        setShowStartLoader(true)
        setLoaderStep(3)
        
        // 自动连接 SSE
        if (shouldConnectSSE) {
          setTimeout(() => {
            connectSSE()
          }, 500)
        }
      } else if (normalizedStatus === "running") {
        // 如果是 running 状态，不打开 loader，只连接 SSE
        console.log('[TaskDetail] ▶️ Task is running, connecting SSE without loader')
        if (shouldConnectSSE) {
          setTimeout(() => {
            connectSSE()
          }, 500)
        }
      } else if (normalizedStatus === "complete" || normalizedStatus === "failed") {
        // 任务完成或失败，清除所有缓存
        clearCachedStats()
        clearCachedTaskInfo()
        clearStreamStatsCache()
        void clearResultsCache()
      }

      // Task data loaded successfully
    } catch (err) {
      console.error("[TaskDetail] Fetch error:", err)
      toast.error("Please Try Again")
    } finally {
      setIsLoadingData(false)
    }
  }

  // Format elapsed milliseconds to readable time string
  const formatElapsedTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  // Animate time continuously
  React.useEffect(() => {
    if (baseElapsedMs > 0 && lastUpdateTime > 0) {
      // Clear previous interval
      if (timeAnimationInterval.current) {
        clearInterval(timeAnimationInterval.current)
      }

      // Start new interval to update time every second
      timeAnimationInterval.current = window.setInterval(() => {
        const now = Date.now()
        const additionalMs = now - lastUpdateTime
        const totalElapsed = baseElapsedMs + additionalMs
        
        setReconStats(prev => ({
          ...prev,
          timeRunning: formatElapsedTime(totalElapsed)
        }))
      }, 1000)

      return () => {
        if (timeAnimationInterval.current) {
          clearInterval(timeAnimationInterval.current)
        }
      }
    }
  }, [baseElapsedMs, lastUpdateTime])

  // Initial fetch - run once after task validation passes
  React.useEffect(() => {
    if (!hasFetched.current && !isCheckingTask && !taskNotFound) {
      hasFetched.current = true
      fetchTaskData(true)
    }
  }, [isCheckingTask, taskNotFound])

  // Cleanup ONLY on unmount (when leaving the page)
  React.useEffect(() => {
    return () => {
      if (statsCacheTimerRef.current) {
        clearTimeout(statsCacheTimerRef.current)
        statsCacheTimerRef.current = null
      }
      if (resultsCacheTimerRef.current) {
        clearTimeout(resultsCacheTimerRef.current)
        resultsCacheTimerRef.current = null
      }
      flushStatsCacheNow()
      flushResultsCacheNow()
      sseConnectionState.current = 'idle'
      sseConnectionId.current += 1
      if (sseAbortController.current) {
        sseAbortController.current.abort()
        console.log('[SSE] Connection closed - user left the page')
      }
      if (sseRetryTimer.current) {
        clearTimeout(sseRetryTimer.current)
        sseRetryTimer.current = null
        console.log('[SSE] Retry timer cleared')
      }
      if (timeAnimationInterval.current) {
        clearInterval(timeAnimationInterval.current)
      }
      if (etaIntervalRef.current) {
        clearInterval(etaIntervalRef.current)
        etaIntervalRef.current = null
      }
      if (statsFlushTimerRef.current) {
        clearTimeout(statsFlushTimerRef.current)
        statsFlushTimerRef.current = null
      }
      if (hiddenDisconnectTimerRef.current) {
        clearTimeout(hiddenDisconnectTimerRef.current)
        hiddenDisconnectTimerRef.current = null
      }
    }
  }, [flushResultsCacheNow, flushStatsCacheNow])

  // Optional performance monitor for UI stutter diagnostics.
  // Enable with NEXT_PUBLIC_PERF_MONITOR=1.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!PERF_MONITOR_ENABLED) return
    if (typeof PerformanceObserver === "undefined") return

    const observers: PerformanceObserver[] = []
    const supports = PerformanceObserver.supportedEntryTypes || []

    let longTaskCount = 0
    let longTaskTotal = 0
    let longTaskMax = 0
    let longFrameCount = 0
    let longFrameMax = 0

    const summaryTimer = window.setInterval(() => {
      if (longTaskCount === 0 && longFrameCount === 0) return
      perfWarn("[PerfMonitor] 5s summary", {
        taskId: id,
        longTaskCount,
        longTaskTotalMs: Math.round(longTaskTotal),
        longTaskMaxMs: Math.round(longTaskMax),
        longFrameCount,
        longFrameMaxMs: Math.round(longFrameMax),
      })
      longTaskCount = 0
      longTaskTotal = 0
      longTaskMax = 0
      longFrameCount = 0
      longFrameMax = 0
    }, 5000)

    if (supports.includes("longtask")) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount += 1
          longTaskTotal += entry.duration
          if (entry.duration > longTaskMax) longTaskMax = entry.duration
        }
      })
      longTaskObserver.observe({ type: "longtask", buffered: true })
      observers.push(longTaskObserver)
    }

    // Chromium provides this for rendering jank diagnostics.
    if (supports.includes("long-animation-frame")) {
      const longFrameObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longFrameCount += 1
          if (entry.duration > longFrameMax) longFrameMax = entry.duration
        }
      })
      longFrameObserver.observe({ type: "long-animation-frame", buffered: true } as PerformanceObserverInit)
      observers.push(longFrameObserver)
    }

    if (supports.includes("event")) {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 120) {
            perfWarn("[PerfMonitor] slow interaction", {
              taskId: id,
              name: entry.name,
              durationMs: Math.round(entry.duration),
              startTimeMs: Math.round(entry.startTime),
            })
          }
        }
      })
      eventObserver.observe(
        { type: "event", buffered: true, durationThreshold: 120 } as PerformanceObserverInit & {
          durationThreshold: number
        }
      )
      observers.push(eventObserver)
    }

    perfWarn("[PerfMonitor] enabled", {
      taskId: id,
      supportedEntryTypes: supports,
    })

    return () => {
      window.clearInterval(summaryTimer)
      for (const observer of observers) observer.disconnect()
    }
  }, [id])

  // Local ETA countdown so the label keeps moving between stats updates.
  React.useEffect(() => {
    // Stop any previous timer.
    if (etaIntervalRef.current) {
      clearInterval(etaIntervalRef.current)
      etaIntervalRef.current = null
    }

    if (!Number.isFinite(sseEtaSeconds) || sseEtaSeconds <= 0) {
      setEtaCountdownSeconds(null)
      return
    }

    // Sync countdown from backend.
    setEtaCountdownSeconds(Math.max(0, Math.floor(sseEtaSeconds)))

    etaIntervalRef.current = window.setInterval(() => {
      setEtaCountdownSeconds((prev) => {
        if (prev === null) return null
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => {
      if (etaIntervalRef.current) {
        clearInterval(etaIntervalRef.current)
        etaIntervalRef.current = null
      }
    }
  }, [sseEtaSeconds])

  // If tab stays hidden > 60s, disconnect stream to reduce memory/cpu.
  // Reconnect and reload fresh data when user returns.
  React.useEffect(() => {
    const clearHiddenDisconnectTimer = () => {
      if (hiddenDisconnectTimerRef.current) {
        clearTimeout(hiddenDisconnectTimerRef.current)
        hiddenDisconnectTimerRef.current = null
      }
    }

    const disconnectForLongHidden = () => {
      if (!document.hidden) return
      autoDisconnectedByHiddenRef.current = true
      sseConnectionState.current = "idle"
      setSseUiStatus("idle")

      if (sseRetryTimer.current) {
        clearTimeout(sseRetryTimer.current)
        sseRetryTimer.current = null
      }

      if (sseAbortController.current) {
        sseAbortController.current.abort()
        sseAbortController.current = null
      }

      console.log("[SSE] ⏸️ Hidden for 60s, stream disconnected")
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHiddenDisconnectTimer()
        hiddenDisconnectTimerRef.current = window.setTimeout(() => {
          disconnectForLongHidden()
        }, HIDDEN_DISCONNECT_AFTER_MS)
        console.log("[SSE] Tab hidden, disconnect timer started")
      } else {
        clearHiddenDisconnectTimer()
        if (autoDisconnectedByHiddenRef.current) {
          autoDisconnectedByHiddenRef.current = false
          console.log("[SSE] 🔄 Tab resumed after long hidden, reloading task data")
          void fetchTaskData(true)
          return
        }

        console.log('[SSE] Tab visible - connection still active')
        if (sseConnectionState.current === 'idle') {
          console.log('[SSE] 🔄 Reconnecting on tab visible')
          connectSSE()
        }
      }
    }

    const handleOnline = () => {
      if (sseConnectionState.current === 'idle' && !document.hidden) {
        console.log('[SSE] 🌐 Network online, reconnecting SSE')
        connectSSE()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      clearHiddenDisconnectTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [HIDDEN_DISCONNECT_AFTER_MS])

  // SSE connection function with retry
	  const connectSSE = async () => {
	    const timestamp = new Date().toISOString()
      if (!enableExternal) {
        setSseUiStatus("idle")
        return
      }
	    if (sseConnectionState.current !== 'idle' && sseAbortController.current && !sseAbortController.current.signal.aborted) {
	      console.log(`[SSE] ⏭️ [${timestamp}] Connection already active, skipping new connect`)
	      return
	    }
	    console.log(`[SSE] 🚀 [${timestamp}] Starting SSE connection for task:`, id, 'Retry count:', sseRetryCount.current)
	    sseConnectionState.current = 'connecting'
	    setSseUiStatus('connecting')
	    const connectionId = ++sseConnectionId.current
    
    // Clear any existing retry timer
    if (sseRetryTimer.current) {
      console.log(`[SSE] ⏹️ [${timestamp}] Clearing existing retry timer`)
      clearTimeout(sseRetryTimer.current)
      sseRetryTimer.current = null
    }
    
    try {
      // Abort previous connection if exists
      if (sseAbortController.current) {
        console.log(`[SSE] ⚠️ [${timestamp}] Aborting previous connection`)
        sseAbortController.current.abort()
      }

      // Create new abort controller
      const localController = new AbortController()
      sseAbortController.current = localController
      console.log(`[SSE] 🆕 [${timestamp}] Created new abort controller`)
      console.log('[SSE] ✅ Created new AbortController')

      const accessToken = await getAccessToken()
      if (!accessToken) {
        console.error('[SSE] ❌ No access token available')
        // Retry after 3 seconds
        scheduleSSERetry()
        return
      }
      console.log('[SSE] ✅ Access token obtained')

      const sseUrlBuilder = new URL(`/api/external/sse/${id}`, window.location.origin)
      // Resume with query param for widest compatibility (no custom CORS header required).
      if (lastEventIdRef.current) sseUrlBuilder.searchParams.set("since", lastEventIdRef.current)
      const sseUrl = sseUrlBuilder.toString()
      
      console.log('[SSE] 🔗 Connecting to:', sseUrl)

      const response = await fetch(sseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/event-stream',
        },
        signal: localController.signal,
      })

      console.log('[SSE] 📡 Fetch response status:', response.status)

	      if (!response.ok) {
	        console.error('[SSE] ❌ Connection failed with status:', response.status)
	        // Retry after delay
	        if (connectionId === sseConnectionId.current) {
	          sseConnectionState.current = 'idle'
	          setSseUiStatus('error')
	          scheduleSSERetry(connectionId)
	        }
	        return
	      }

	      // Reset retry count on successful connection
	      sseRetryCount.current = 0
	      sseConnectionState.current = 'connected'
	      setSseUiStatus('connected')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        console.error('[SSE] ❌ No reader available')
        if (connectionId === sseConnectionId.current) {
          sseConnectionState.current = 'idle'
          scheduleSSERetry(connectionId)
        }
        return
      }

      sseDebugLog('[SSE] ✅ Connected successfully, starting to read stream...')

      // Read stream
      const readStream = async () => {
        sseDebugLog('[SSE] 📖 Starting stream reader loop')
        let currentEvent = ''
        let currentEventId = ''
        let currentDataLines: string[] = []
        let sseBuffer = ''
        let messageCount = 0
        let statsMessageCount = 0

        const dispatchSSEEvent = () => {
          const rawData = currentDataLines.join('\n').trim()
          const fallbackEvent = currentEvent || 'message'

          if (!rawData) {
            if (currentEvent) {
              sseDebugLog(`[SSE] ℹ️ Event "${fallbackEvent}" finished without data payload`)
            }
            currentEvent = ''
            currentEventId = ''
            currentDataLines = []
            return
          }

          messageCount += 1
          sseDebugLog(`[SSE] 📨 Dispatch #${messageCount}:`, {
            event: fallbackEvent,
            rawLength: rawData.length,
            rawData,
          })

          try {
            const parsed = JSON.parse(rawData)
            const eventType = parsed.type || currentEvent || 'message'
            if (currentEventId) {
              lastEventIdRef.current = currentEventId
              if (latestStatsSnapshotRef.current) {
                queueStatsCacheSave({
                  ...latestStatsSnapshotRef.current,
                  updatedAt: Date.now(),
                  lastEventId: currentEventId,
                })
              }
            }
            sseDebugLog(`[SSE] 📊 Parsed #${messageCount}:`, {
              type: eventType,
              taskid: parsed.taskid,
              eventId: currentEventId || parsed.event_id,
            })
            
            if (eventType === 'connected') {
              sseDebugLog('[SSE] 🔌 Connection confirmed:', parsed)
            } else if (eventType === 'stats') {
              statsMessageCount += 1
              const stats = parsed as StatsSSEPayload
              pendingStatsPayloadRef.current = stats
              if (statsFlushTimerRef.current === null) {
                statsFlushTimerRef.current = window.setTimeout(() => {
                  statsFlushTimerRef.current = null
                  const queuedPayload = pendingStatsPayloadRef.current
                  pendingStatsPayloadRef.current = null
                  if (queuedPayload) applyStatsPayload(queuedPayload)
                }, 120)
              }

              sseDebugLog(`[SSE] ✅ Stats queued (#${statsMessageCount})`, {
                progress: `${stats.websites_done ?? 0}/${stats.websites_total ?? 0}`,
                success: stats.success ?? 0,
                failed: stats.failed ?? 0,
                wafDetected: stats.waf_detected ?? 0,
                rps: stats.rps ?? 0,
                wpm: stats.wpm ?? 0,
                etaSeconds: stats.eta_seconds ?? 0,
                dump: stats.dump ?? 0,
                dumped: stats.dumped ?? 0,
                rpsHistoryPoints: stats.rps_history?.length ?? 0,
                wpmHistoryPoints: stats.wpm_history?.length ?? 0,
                categoryKeys: Object.keys(stats.category || {}),
              })
            } else if (eventType === 'results_batch') {
              const batch = parsed as ResultsBatchSSEPayload
              const items = Array.isArray(batch.items) ? batch.items : []
              if (typeof batch.credits === "number" && Number.isFinite(batch.credits)) {
                const nextCredits = Math.max(0, Math.trunc(batch.credits))
                setCreditsUsed((prev) => (nextCredits > prev ? nextCredits : prev))
                if (latestStatsSnapshotRef.current) {
                  queueStatsCacheSave({
                    ...latestStatsSnapshotRef.current,
                    updatedAt: Date.now(),
                    lastEventId: currentEventId || latestStatsSnapshotRef.current.lastEventId,
                    creditsUsed: nextCredits,
                  })
                }
              }
	              if (items.length > 0) {
                  React.startTransition(() => {
	                  setInjectionHydrated(true)
	                  setSseInjectionRows((prev) => {
	                    const incomingRows = items
	                      .filter((item) => item.domain && item.domain.trim().length > 0)
	                      .map((item, idx) => ({
	                        key: `${currentEventId || Date.now()}-${idx}-${item.domain}`,
	                        domain: (item.domain || "-").trim(),
	                        country: (item.country || "-").trim() || "-",
	                        category: (item.category || "-").trim() || "-",
	                        // WAF badge is driven by waftech presence.
	                        waf: typeof item.waftech === "string" && item.waftech.trim().length > 0,
	                      }))

	                    const merged = [...incomingRows, ...prev]
	                    const indexBySig = new Map<string, number>()
	                    const deduped: typeof merged = []
	                    for (const row of merged) {
	                      const sig = `${row.domain}|${row.country}|${row.category}`
	                      const existingIndex = indexBySig.get(sig)
	                      if (existingIndex !== undefined) {
	                        continue
	                      }
	                      indexBySig.set(sig, deduped.length)
	                      deduped.push(row)
	                      if (deduped.length >= INJECTION_WINDOW_LIMIT) break
	                    }
	                    const nextRows = deduped
	                    queueResultsCacheSave(nextRows)
	                    return nextRows
	                  })
                  })
	              }

	              sseDebugLog('[SSE] ✅ results_batch applied:', {
	                received: items.length,
                  credits: batch.credits,
	              })
            } else if (eventType === "dumper_stats") {
              const payload = parsed as DumperStatsSSEPayload
              const domains = Array.isArray(payload.domains) ? payload.domains : []
              if (typeof payload.dump === "number" && Number.isFinite(payload.dump)) {
                setSseDumpCount(Math.max(0, Math.trunc(payload.dump)))
              }
              if (typeof payload.dumped === "number" && Number.isFinite(payload.dumped)) {
                setSseDumpedCount(Math.max(0, Math.trunc(payload.dumped)))
              }
              if (typeof payload.queue === "number" && Number.isFinite(payload.queue)) {
                setSseDumpQueueCount(Math.max(0, Math.trunc(payload.queue)))
              }
              if (typeof payload.progress_percent === "number" && Number.isFinite(payload.progress_percent)) {
                setSseDumpProgressPercent(Math.max(0, Math.min(100, Math.round(payload.progress_percent))))
              }
              if (domains.length > 0) {
                React.startTransition(() => {
                  setDumpsHydrated(true)
                  setSseDumpRows((prev) => {
                    const nowKey = currentEventId || Date.now().toString()
                    const incoming = normalizeDumpRowsFromDomains(domains, nowKey)

                  if (process.env.NODE_ENV !== "production" && SSE_DEBUG_LOGS) {
                    sseDebugLog("[SSE][dumper_stats] rows computed:", {
                      eventId: currentEventId,
                      preset: payload.preset,
                      dumped: payload.dumped,
                      prevRows: prev.length,
                      incomingRows: incoming.length,
                      preview: incoming.slice(0, 5).map((r) => ({
                        domain: r.domain,
                        statusKind: r.statusKind,
                        percentDone: r.percentDone,
                        statusLabel: r.statusLabel,
                        rows: r.rows,
                      })),
                    })
                  }

                  const merged = [...incoming, ...prev]
                  const indexBySig = new Map<string, number>()
                  const deduped: typeof merged = []
                  for (const row of merged) {
                    const sig = `${row.domain}|${row.country}|${row.category}`
                    const existingIndex = indexBySig.get(sig)
                    if (existingIndex !== undefined) {
                      const existing = deduped[existingIndex]
                      // `merged` is `[incoming, ...prev]`, so the first occurrence is the newest.
                      // Keep the newest by default; only override if the older row is "Dumped"
                      // and the newer row is still in-progress.
                      if (row.statusKind === "dumped" && existing.statusKind !== "dumped") {
                        deduped[existingIndex] = row
                      }
                      continue
                    }
                    indexBySig.set(sig, deduped.length)
                    deduped.push(row)
                  }

                  // Keep the summary counter in sync even if backend doesn't send dumped reliably.
                  const dumpedFromRows = deduped.reduce((acc, row) => (row.statusKind === "dumped" ? acc + 1 : acc), 0)
                  if (!(typeof payload.dumped === "number" && Number.isFinite(payload.dumped))) {
                    setSseDumpedCount(dumpedFromRows)
                  }
                  if (!(typeof payload.dump === "number" && Number.isFinite(payload.dump))) {
                    setSseDumpCount(deduped.length)
                  }

                  if (process.env.NODE_ENV !== "production" && SSE_DEBUG_LOGS) {
                    sseDebugLog("[SSE][dumper_stats] state after merge:", {
                      eventId: currentEventId,
                      totalRows: deduped.length,
                      dumpedFromRows,
                      top: deduped.slice(0, 5).map((r) => ({
                        domain: r.domain,
                        statusKind: r.statusKind,
                        percentDone: r.percentDone,
                        statusLabel: r.statusLabel,
                      })),
                    })
                  }

                    return deduped
                  })
                })
              }

              sseDebugLog("[SSE] ✅ dumper_stats applied:", {
                dump: payload.dump,
                received: domains.length,
                dumped: payload.dumped,
                queue: payload.queue,
                progress_percent: payload.progress_percent,
                preset: payload.preset,
              })
            } else if (eventType === "dump_file_ready") {
              const payload = (parsed?.payload || parsed || {}) as Record<string, unknown>
              const eventRequestId =
                (typeof parsed?.request_id === "string" ? parsed.request_id : null) ||
                (typeof payload.request_id === "string" ? payload.request_id : null)
              const activeRequestId = activeDumpRequestIdRef.current

              if (activeRequestId && eventRequestId && eventRequestId !== activeRequestId) {
                console.log("[SSE] ℹ️ dump_file_ready ignored (request_id mismatch)", {
                  eventRequestId,
                  activeRequestId,
                })
              } else {
                const downloadUrl =
                  (typeof payload.downloadurl === "string" && payload.downloadurl) ||
                  (typeof payload.download_url === "string" && payload.download_url) ||
                  (typeof parsed?.downloadurl === "string" && parsed.downloadurl) ||
                  (typeof parsed?.download_url === "string" && parsed.download_url) ||
                  ""
                if (downloadUrl) {
                  const a = document.createElement("a")
                  a.href = downloadUrl
                  a.download = "dump.zip"
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  setDumpUploadState("done")
                  setDumpUploadRequestId(eventRequestId || activeRequestId || null)
                  activeDumpRequestIdRef.current = null
                  toast.success("Dump download started")
                  console.log("[SSE] ✅ dump_file_ready handled", { eventRequestId, activeRequestId })
                } else {
                  setDumpUploadState("failed")
                  toast.error("dump_file_ready missing downloadurl")
                  console.error("[SSE] ❌ dump_file_ready missing downloadurl", parsed)
                }
              }
            } else if (eventType === "dump_file_failed") {
              const payload = (parsed?.payload || parsed || {}) as Record<string, unknown>
              const eventRequestId =
                (typeof parsed?.request_id === "string" ? parsed.request_id : null) ||
                (typeof payload.request_id === "string" ? payload.request_id : null)
              const activeRequestId = activeDumpRequestIdRef.current

              if (activeRequestId && eventRequestId && eventRequestId !== activeRequestId) {
                console.log("[SSE] ℹ️ dump_file_failed ignored (request_id mismatch)", {
                  eventRequestId,
                  activeRequestId,
                })
              } else {
                const msg =
                  (typeof payload.error === "string" && payload.error) ||
                  (typeof parsed?.error === "string" && parsed.error) ||
                  "dump file upload failed"
                setDumpUploadState("failed")
                setDumpUploadRequestId(eventRequestId || activeRequestId || null)
                activeDumpRequestIdRef.current = null
                toast.error(msg)
                console.error("[SSE] ❌ dump_file_failed:", { eventRequestId, msg, payload, parsed })
              }
            } else if (eventType === "task_done") {
              const payload = parsed as TaskDoneSSEPayload
              const final = payload.final || {}
              const rawTaskDoneStatus = (payload.status || "").trim().toLowerCase()
              const normalizedTaskDoneStatus =
                rawTaskDoneStatus === "" || rawTaskDoneStatus === "done"
                  ? "done"
                  : rawTaskDoneStatus === "failed"
                    ? "failed"
                    : "failed"
              applyStatsPayload({
                websites_total:
                  typeof final.websites_total === "number"
                    ? final.websites_total
                    : Number(latestStatsSnapshotRef.current?.progress?.target ?? 0),
                websites_done:
                  typeof final.websites_done === "number"
                    ? final.websites_done
                    : Number(latestStatsSnapshotRef.current?.progress?.current ?? 0),
                remaining: typeof final.remaining === "number" ? final.remaining : 0,
                success:
                  typeof final.success === "number"
                    ? final.success
                    : Number(latestStatsSnapshotRef.current?.success ?? 0),
                failed:
                  typeof final.failed === "number"
                    ? final.failed
                    : Number(latestStatsSnapshotRef.current?.failed ?? 0),
                credits:
                  typeof payload.credits === "number"
                    ? payload.credits
                    : Number(latestStatsSnapshotRef.current?.creditsUsed ?? 0),
                eta_seconds: 0,
              })
              setTaskStatus(normalizedTaskDoneStatus === "failed" ? "failed" : "complete")
              setTaskDoneReceived(true)
              setLoaderIsDone(true)
              setShowStartLoader(false)
              sseDebugLog("[SSE] ✅ task_done applied:", {
                taskid: payload.taskid,
                status: payload.status,
                final,
              })
            } else {
              sseDebugLog('[SSE] 📴 Message ignored:', eventType)
            }
          } catch (e) {
            console.error('[SSE] ❌ JSON parse error:', e, {
              event: fallbackEvent,
              rawData,
            })
          } finally {
            currentEvent = ''
            currentEventId = ''
            currentDataLines = []
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              if (sseBuffer.trim().length > 0) {
                sseDebugLog('[SSE] ⚠️ Stream ended with partial buffer:', sseBuffer)
              }
              if (currentDataLines.length > 0 || currentEvent) {
                sseDebugLog('[SSE] ⚠️ Stream ended before blank line delimiter, forcing dispatch')
                dispatchSSEEvent()
              }
              sseDebugLog('[SSE] 🏁 Stream ended')
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            sseDebugLog('[SSE] 📦 Received chunk, length:', chunk.length)
            sseBuffer += chunk

            let lineBreakIndex = sseBuffer.indexOf('\n')
            while (lineBreakIndex !== -1) {
              const rawLine = sseBuffer.slice(0, lineBreakIndex)
              sseBuffer = sseBuffer.slice(lineBreakIndex + 1)
              const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine

              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim()
                sseDebugLog('[SSE] 🏷️ Event type:', currentEvent)
              } else if (line.startsWith('id:')) {
                currentEventId = line.slice(3).trim()
                sseDebugLog('[SSE] 🆔 Event id:', currentEventId)
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trimStart()
                currentDataLines.push(data)
                sseDebugLog('[SSE] 🧩 Data line captured:', data)
              } else if (line === '') {
                dispatchSSEEvent()
              } else if (line.startsWith(':')) {
                sseDebugLog('[SSE] 💓 Heartbeat/comment:', line)
              } else if (line.trim()) {
                sseDebugLog('[SSE] 📝 Unknown SSE line:', line)
              }

              lineBreakIndex = sseBuffer.indexOf('\n')
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            sseDebugLog('[SSE] 🛑 Connection aborted by user/system')
            if (connectionId === sseConnectionId.current) {
              sseConnectionState.current = 'idle'
            }
          } else {
            console.error('[SSE] ❌ Read error:', error)
            // Retry on read error
            if (connectionId === sseConnectionId.current) {
              sseConnectionState.current = 'idle'
              scheduleSSERetry(connectionId)
            }
          }
        } finally {
          sseDebugLog('[SSE] 🔒 Releasing reader lock')
          reader.releaseLock()
          
          // If stream ended normally (not aborted), try to reconnect
          if (connectionId === sseConnectionId.current && !localController.signal.aborted) {
            sseDebugLog('[SSE] 🔄 Stream ended, attempting reconnect')
            sseConnectionState.current = 'idle'
            scheduleSSERetry(connectionId)
          }
        }
      }

      readStream()
	    } catch (error) {
	      if (error instanceof Error && error.name === 'AbortError') {
	        sseDebugLog('[SSE] 🛑 Connection aborted during setup')
	        if (connectionId === sseConnectionId.current) {
	          sseConnectionState.current = 'idle'
	          setSseUiStatus('idle')
	        }
	      } else {
	        console.error('[SSE] ❌ Connection error:', error)
	        // Retry on error
	        if (connectionId === sseConnectionId.current) {
	          sseConnectionState.current = 'idle'
	          setSseUiStatus('error')
	          scheduleSSERetry(connectionId)
	        }
	      }
	    }
	  }
  
  // Schedule SSE retry with exponential backoff
  const scheduleSSERetry = (connectionId?: number) => {
    if (connectionId !== undefined && connectionId !== sseConnectionId.current) {
      return
    }
    if (sseConnectionState.current !== 'idle') {
      return
    }
    const timestamp = new Date().toISOString()
    const maxRetries = 10
    if (sseRetryCount.current >= maxRetries) {
      console.log(`[SSE] ❌ [${timestamp}] Max retries reached, stopping reconnection attempts`)
      return
    }
    
    sseRetryCount.current++
    // Exponential backoff: 3s, 6s, 12s, 24s, 48s, max 60s
    const delay = Math.min(3000 * Math.pow(2, sseRetryCount.current - 1), 60000)
    console.log(`[SSE] 🔄 [${timestamp}] Scheduling retry ${sseRetryCount.current}/${maxRetries} in ${delay}ms`)
    
    sseRetryTimer.current = window.setTimeout(() => {
      console.log(`[SSE] ⏰ [${new Date().toISOString()}] Retry timer fired, calling connectSSE()`)
      connectSSE()
    }, delay)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  // Fetch settings when dialog opens
  React.useEffect(() => {
    if (showSettings) {
      fetchSettings()
    }
  }, [showSettings])

  const fetchSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch(`${taskApiBasePath}/${id}?source=settings_dialog`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(getHttpErrorMessage(response.status, "Please Try Again"))
      }

      const task = data.data
      
      // 更新所有设置状态
      setTaskName(task.name || '')
      setSelectedEngineLabel(toEngineLabel(task.google_mode))
      setListsFile(task.file_name || '')
      setAiMode(task.ai_mode ?? true)
      setAutoDumper(task.auto_dumper ?? false)
      setPreset(task.preset || '')
      setParameterRiskFilter(task.parameter_risk_filter || 'medium-high')
      setAiSensitivityLevel(task.ai_sensitivity_level || 'medium')
      setResponsePatternDrift(task.response_pattern_drift ?? true)
      setBaselineProfiling(task.baseline_profiling ?? true)
      setStructuralChangeDetection(task.structural_change_detection ?? false)
      setAntiBanEngine(task.anti_ban_engine ?? false)
      setPayloadEngine(task.payload_engine ?? false)
      setUnionBased(task.union_based ?? true)
      setErrorBased(task.error_based ?? true)
      setBooleanBased(task.boolean_based ?? false)
      setTimeBased(task.time_based ?? false)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      toast.error("Please Try Again")
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleStart = async () => {
    const now = Date.now()
    if (startRequestInFlightRef.current) return
    if (now - lastStartAttemptAtRef.current < 1500) return

    startRequestInFlightRef.current = true
    lastStartAttemptAtRef.current = now
    setIsStarting(true)
    taskDoneToastShown.current = false

    try {
      let started = false
      let lastError: unknown = null

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch(`${taskApiBasePath}/${id}/start`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const data = await response.json().catch(() => null)
          if (response.ok && data?.success) {
            started = true
            break
          }

          const apiCode = typeof data?.code === "string" ? data.code : "UNKNOWN"
          const apiMessage =
            typeof data?.message === "string"
              ? data.message
              : typeof data?.error === "string"
                ? data.error
                : getHttpErrorMessage(response.status, "Failed to start task")
          lastError = new Error(apiMessage)
          console.error("[TaskDetail] start rejected", {
            taskId: id,
            attempt,
            status: response.status,
            code: apiCode,
            requestId: typeof data?.requestId === "string" ? data.requestId : null,
            message: apiMessage,
          })
        } catch (error) {
          lastError = error
          console.error("[TaskDetail] start request failed", {
            taskId: id,
            attempt,
            error,
          })
        }
      }

      if (!started) {
        console.error("[TaskDetail] start failed after retry", { taskId: id, error: lastError })
        toast.error("Please Try Again")
        return
      }

      setTaskStatus('running_recon')
      await fetchTaskData(false)
      void connectSSE()
    } catch (error) {
      console.error('Start task error:', error)
      toast.error('Please Try Again')
    } finally {
      startRequestInFlightRef.current = false
      setIsStarting(false)
    }
  }

		  const applyStatsPayload = React.useCallback((payload: Partial<StatsSSEPayload>) => {
		    setStatsHydrated(true)
        setLastStatsUpdatedAt(Date.now())
		    const total = Number(payload.websites_total ?? 0)
		    const done = Number(payload.websites_done ?? 0)
		    const success = Number(payload.success ?? 0)
		    const failed = Number(payload.failed ?? 0)
    const wafDetected = Number(payload.waf_detected ?? 0)
    const credits = payload.credits
    const rps = Number(payload.rps ?? 0)
    const wpm = Number(payload.wpm ?? 0)
    const etaSeconds = Number(payload.eta_seconds ?? 0)
    const dump = Number(payload.dump ?? Number(latestStatsSnapshotRef.current?.dump ?? 0))
    const dumped = Number(payload.dumped ?? Number(latestStatsSnapshotRef.current?.dumped ?? 0))
    const rpsHistory = Array.isArray(payload.rps_history)
      ? payload.rps_history.map((v) => Number(v) || 0).slice(-32)
      : []
    const wpmHistory = Array.isArray(payload.wpm_history)
      ? payload.wpm_history.map((v) => Number(v) || 0).slice(-32)
      : []
	    const categoryData =
	      payload.category && typeof payload.category === "object" ? payload.category : {}

	    sseDebugLog("[Stats] ✅ applyStatsPayload:", {
	      websites_total: payload.websites_total,
	      websites_done: payload.websites_done,
	      success: payload.success,
	      failed: payload.failed,
	      waf_detected: payload.waf_detected,
        credits: payload.credits,
        dump: payload.dump,
        dumped: payload.dumped,
	      wpm: payload.wpm,
	      rps: payload.rps,
	      eta_seconds: payload.eta_seconds,
	      lastEventId: lastEventIdRef.current,
	    })

      React.startTransition(() => {
	      setProgress({
	        current: Math.max(0, done),
	        target: Math.max(0, total),
	      })
      setSseSuccess(Math.max(0, success))
      setSseFailed(Math.max(0, failed))
      setSseWafDetected(Math.max(0, wafDetected))
      if (typeof credits === "number" && Number.isFinite(credits)) {
        const nextCredits = Math.max(0, Math.trunc(credits))
        setCreditsUsed((prev) => (nextCredits > prev ? nextCredits : prev))
      }
      setSseRps(Math.max(0, rps))
      setSseWpm(Math.max(0, wpm))
      setSseEtaSeconds(Math.max(0, etaSeconds))
      setSseRpsHistory(rpsHistory)
	      setSseWpmHistory(wpmHistory)
	      setSseCategory(categoryData)
      setSseDumpCount(Math.max(0, Math.trunc(Number.isFinite(dump) ? dump : 0)))
      setSseDumpedCount(Math.max(0, Math.trunc(Number.isFinite(dumped) ? dumped : 0)))
      })
      const creditsUsedForCache =
        typeof credits === "number" && Number.isFinite(credits)
          ? Math.max(0, Math.trunc(credits))
          : Math.max(0, Math.trunc(Number(latestStatsSnapshotRef.current?.creditsUsed ?? 0)))
    const dumpForCache = Math.max(0, Math.trunc(Number.isFinite(dump) ? dump : 0))
    const dumpedForCache = Math.max(0, Math.trunc(Number.isFinite(dumped) ? dumped : 0))
    queueStatsCacheSave({
      updatedAt: Date.now(),
      lastEventId: lastEventIdRef.current,
      progress: {
        current: Math.max(0, done),
        target: Math.max(0, total),
      },
      success: Math.max(0, success),
      failed: Math.max(0, failed),
      wafDetected: Math.max(0, wafDetected),
      creditsUsed: creditsUsedForCache,
      rps: Math.max(0, rps),
      wpm: Math.max(0, wpm),
      etaSeconds: Math.max(0, etaSeconds),
      rpsHistory,
      wpmHistory,
      category: categoryData,
      dump: dumpForCache,
      dumped: dumpedForCache,
    })
	  }, [queueStatsCacheSave])

  const getAccessToken = React.useCallback(async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const handleDownloadInjection = React.useCallback(async () => {
	    if (isDownloadingInjection) return

    setIsDownloadingInjection(true)
    try {
      const response = await fetch(`/api/download/injection/${encodeURIComponent(id)}`, {
	        method: "GET",
	        headers: {
	          Accept: "application/octet-stream",
	        },
	      })

	      if (!response.ok) {
	        throw new Error(getHttpErrorMessage(response.status, "Failed to download"))
	      }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${id}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("Download started")
    } catch (error) {
      console.error("[Download] Injection download failed:", error)
      const msg = error instanceof Error ? error.message : "Please Try Again"
      toast.error(msg)
    } finally {
      setIsDownloadingInjection(false)
    }
  }, [id, isDownloadingInjection])

  const handleUploadDump = React.useCallback(async () => {
    if (dumpUploadState === "uploading") return
    if (!enableExternal) {
      toast.error("Tasks mode does not connect to external server")
      return
    }

    try {
      const token = await getAccessToken()
      if (!token || token.length < 20) {
        toast.error("Please login again")
        return
      }

      setDumpUploadState("uploading")
      setDumpUploadRequestId(null)
      activeDumpRequestIdRef.current = null

      const response = await fetch(`/api/external/download/dump/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      const data = (await response.json().catch(() => null)) as DumpUploadStartResponse | null
      const requestId = data?.request_id || null

      if (response.status !== 202 || !requestId) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to start dump upload"))
      }

      activeDumpRequestIdRef.current = requestId
      setDumpUploadRequestId(requestId)
      toast.success("Dump upload started")
      console.log("[Dump] 🚀 upload started:", {
        requestId,
        uploadObjectPath: data?.upload_object_path,
      })
    } catch (error) {
      setDumpUploadState("failed")
      activeDumpRequestIdRef.current = null
      const msg = error instanceof Error ? error.message : "Failed to start dump upload"
      console.error("[Dump] ❌ start failed:", error)
      toast.error(msg)
    }
  }, [dumpUploadState, enableExternal, getAccessToken, id])

  const fetchRealtimeSnapshot = React.useCallback(async () => {
    if (!enableExternal) {
      setInjectionHydrated(true)
      return
    }
    try {
      const token = await getAccessToken()
      if (!token) {
        console.error('[Snapshot] ❌ No access token available')
        return
      }

      const snapshotUrl = new URL(`/api/external/task/${id}/snapshot`, window.location.origin)
      snapshotUrl.searchParams.set("include_items", "1")
      snapshotUrl.searchParams.set("limit", String(INJECTION_PREFETCH_LIMIT))

      const response = await fetch(snapshotUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        console.error('[Snapshot] ❌ HTTP error:', response.status)
        return
      }

      const data = (await response.json()) as SnapshotResponse
      console.log('[Snapshot] ✅ Received snapshot:', {
        status: data.status,
        hasStats: !!data.stats,
        hasDumpSnapshot: !!(data.dump_snapshot && typeof data.dump_snapshot === "object" && Object.keys(data.dump_snapshot).length > 0),
        itemCount: data.injection_items?.length || 0,
        lastEventId: data.last_event_id,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      })

      if (data.stats) applyStatsPayload(data.stats)
      applyDumpSnapshot(data.dump_snapshot)
      if (data.last_event_id) lastEventIdRef.current = data.last_event_id

      // Store cursor for later paging (scroll to load more).
      const nextCursor = typeof data.next_cursor === "string" && data.next_cursor.trim().length > 0 ? data.next_cursor : null
      const hasMore = !!data.has_more && !!nextCursor
      setInjectionNextCursor(nextCursor)
      setInjectionHasMore(hasMore)
      injectionCursorRef.current = nextCursor
      injectionHasMoreRef.current = hasMore

      const mergedItems: NonNullable<SnapshotResponse["injection_items"]> = Array.isArray(data.injection_items)
        ? data.injection_items
        : []

      if (mergedItems.length > 0) {
        const normalized = mergedItems
          .filter((item) => item.domain && item.domain.trim().length > 0)
          .map((item) => ({
            domain: (item.domain || "-").trim(),
            country: (item.country || "-").trim() || "-",
            category: (item.category || "-").trim() || "-",
            createdAt: item.created_at || "",
            waf: false,
          }))
          .slice(0, INJECTION_WINDOW_LIMIT)
          .map((item, idx) => ({
            key: `${item.domain}-${item.createdAt || "snapshot"}-${idx}`,
            domain: item.domain,
            country: item.country,
            category: item.category,
            waf: item.waf,
          }))

        setSseInjectionRows(normalized)
        queueResultsCacheSave(normalized)
      }
    } catch (error) {
      console.error('[Snapshot] ❌ Failed to fetch snapshot:', error)
    } finally {
      // Snapshot attempt finished (even if empty/error). Stop showing "waiting" skeletons forever.
      setInjectionHydrated(true)
    }
  }, [INJECTION_PREFETCH_LIMIT, INJECTION_WINDOW_LIMIT, applyDumpSnapshot, applyStatsPayload, enableExternal, getAccessToken, id, queueResultsCacheSave])

  const loadMoreInjectionFromSnapshot = React.useCallback(async () => {
    if (!enableExternal) return
    if (isLoadingInjectionMore) return
    if (!injectionHasMoreRef.current) return
    const cursor = injectionCursorRef.current
    if (!cursor) return

    setIsLoadingInjectionMore(true)
    try {
      console.log("[Snapshot] 📥 loadMore start:", {
        taskId: id,
        cursor,
        currentRows: sseInjectionRows.length,
        hasMore: injectionHasMoreRef.current,
      })

      const token = await getAccessToken()
      if (!token) return

      const snapshotUrl = new URL(`/api/external/task/${id}/snapshot`, window.location.origin)
      snapshotUrl.searchParams.set("include_items", "1")
      snapshotUrl.searchParams.set("limit", "100")
      snapshotUrl.searchParams.set("cursor", cursor)

      console.log("[Snapshot] ➡️ loadMore injection_items:", snapshotUrl.toString())
      const response = await fetch(snapshotUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      console.log("[Snapshot] ⬅️ loadMore response:", response.status)
      if (!response.ok) return

      const data = (await response.json()) as SnapshotResponse
      const nextCursor = typeof data.next_cursor === "string" && data.next_cursor.trim().length > 0 ? data.next_cursor : null
      const hasMore = !!data.has_more && !!nextCursor && nextCursor !== cursor
      setInjectionNextCursor(nextCursor)
      setInjectionHasMore(hasMore)
      injectionCursorRef.current = nextCursor
      injectionHasMoreRef.current = hasMore

      const items = Array.isArray(data.injection_items) ? data.injection_items : []
      console.log("[Snapshot] ✅ loadMore payload:", {
        itemCount: items.length,
        hasMore,
        nextCursor,
        sampleDomains: items.slice(0, 3).map((it) => it.domain),
      })

      if (items.length === 0) return

      const incoming = items
        .filter((item) => item.domain && item.domain.trim().length > 0)
        .map((item, idx) => ({
          key: `snap-${cursor}-${idx}-${item.domain}`,
          domain: (item.domain || "-").trim(),
          country: (item.country || "-").trim() || "-",
          category: (item.category || "-").trim() || "-",
          waf: false,
        }))

      setSseInjectionRows((prev) => {
        // Append older snapshot items to the end, keeping uniqueness by domain|country|category.
        const indexBySig = new Map<string, number>()
        const next: typeof prev = []

        for (const row of prev) {
          const sig = `${row.domain}|${row.country}|${row.category}`
          const existingIndex = indexBySig.get(sig)
          if (existingIndex !== undefined) {
            if (row.waf) next[existingIndex] = { ...next[existingIndex], waf: true }
            continue
          }
          indexBySig.set(sig, next.length)
          next.push(row)
          if (next.length >= INJECTION_WINDOW_LIMIT) return next
        }

        for (const row of incoming) {
          const sig = `${row.domain}|${row.country}|${row.category}`
          const existingIndex = indexBySig.get(sig)
          if (existingIndex !== undefined) {
            if (row.waf) next[existingIndex] = { ...next[existingIndex], waf: true }
            continue
          }
          indexBySig.set(sig, next.length)
          next.push(row)
          if (next.length >= INJECTION_WINDOW_LIMIT) break
        }

        queueResultsCacheSave(next)
        return next
      })
    } catch (e) {
      console.error("[Snapshot] ❌ loadMore failed:", e)
    } finally {
      setIsLoadingInjectionMore(false)
    }
  }, [INJECTION_WINDOW_LIMIT, enableExternal, getAccessToken, id, isLoadingInjectionMore, queueResultsCacheSave, sseInjectionRows.length])

  React.useEffect(() => {
    if (!injectionHydrated) return
    console.log("[State] injectionRows updated:", {
      taskId: id,
      rows: sseInjectionRows.length,
      hasMore: injectionHasMoreRef.current,
      nextCursor: injectionCursorRef.current,
    })
  }, [id, injectionHydrated, sseInjectionRows.length])

  // Background prefetch: when SSE isn't pushing items fast enough, keep paging snapshot until we have a reasonable local window.
  React.useEffect(() => {
    if (!injectionHydrated) return
    if (!injectionHasMore) return
    if (isLoadingInjectionMore) return
    if (sseInjectionRows.length === 0) return
    if (sseInjectionRows.length >= INJECTION_SNAPSHOT_PREFETCH_MAX) return
    if (taskStatus !== "running" && taskStatus !== "running_recon") return

    const timer = window.setTimeout(() => {
      void loadMoreInjectionFromSnapshot()
    }, 500)

    return () => window.clearTimeout(timer)
  }, [
    INJECTION_SNAPSHOT_PREFETCH_MAX,
    injectionHasMore,
    injectionHydrated,
    isLoadingInjectionMore,
    loadMoreInjectionFromSnapshot,
    sseInjectionRows.length,
    taskStatus,
  ])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`${taskApiBasePath}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          auto_dumper: autoDumper,
          preset: preset || null,
          ai_mode: aiMode,
          parameter_risk_filter: parameterRiskFilter,
          ai_sensitivity_level: aiSensitivityLevel,
          response_pattern_drift: responsePatternDrift,
          baseline_profiling: baselineProfiling,
          structural_change_detection: structuralChangeDetection,
          anti_ban_engine: antiBanAvailable ? antiBanEngine : false,
          payload_engine: payloadEngine,
          union_based: unionBased,
          error_based: errorBased,
          boolean_based: booleanBased,
          time_based: timeBased,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to save settings"))
      }

      toast.success("Settings saved successfully")
      setShowSettings(false)
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error("Please Try Again")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTask = async () => {
    setIsDeleting(true)
    
    try {
      const dbResponse = await fetch(`${taskApiBasePath}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const dbData = await dbResponse.json().catch(() => null)
      const deleteSucceeded =
        dbResponse.ok && (dbResponse.status === 204 || dbData?.success !== false)

      if (!deleteSucceeded) {
        throw new Error(getHttpErrorMessage(dbResponse.status, "Failed to delete task"))
      }
      
      toast.success("Task deleted successfully")
      setShowDeleteDialog(false)
      clearCachedStats()
      clearCachedTaskInfo()
      clearStreamStatsCache()
      void clearResultsCache()
      
      // 重定向到任务列表页面
      window.location.href = basePath
    } catch (error) {
      console.error('Task deletion failed:', error)
      toast.error("Please Try Again")
    } finally {
      setIsDeleting(false)
    }
  }

  const table = useReactTable({
    data: pageData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const progressPercent = progress?.target > 0 ? Math.round((progress.current / progress.target) * 100) : 0
  const websitesPerMinute = sseWpm
  const requestsPerMinute = sseRps
  const trendWebsite = sseWpmHistory
  const trendRequest = sseRpsHistory
  const fallbackTrend = React.useMemo(() => Array.from({ length: 16 }, () => 0), [])
  const websiteTrendSeries = trendWebsite.length > 0 ? trendWebsite : fallbackTrend
  const requestTrendSeries = trendRequest.length > 0 ? trendRequest : fallbackTrend
  const websiteLineChartConfig = React.useMemo(
    () =>
      ({
        websites: {
          label: "Websites",
          color: "#3b82f6",
        },
      }) satisfies ChartConfig,
    []
  )
  const requestLineChartConfig = React.useMemo(
    () =>
      ({
        requests: {
          label: "Requests",
          color: "#10b981",
        },
      }) satisfies ChartConfig,
    []
  )
  const websiteLineData = React.useMemo(
    () => websiteTrendSeries.map((value, idx) => ({ point: `${idx + 1}`, websites: value })),
    [websiteTrendSeries]
  )
  const requestLineData = React.useMemo(
    () => requestTrendSeries.map((value, idx) => ({ point: `${idx + 1}`, requests: value })),
    [requestTrendSeries]
  )
	  const injectionRows = React.useMemo(() => {
	    if (sseInjectionRows.length > 0) {
	      return sseInjectionRows
	    }
	    return tableData.map((row) => ({
	      key: row.id,
	      domain: row.domain || "-",
	      country: row.country || "-",
	      category: row.type && row.type !== "-" ? row.type : "-",
	      waf: false,
	    }))
	  }, [sseInjectionRows, tableData])
  const deferredInjectionRows = React.useDeferredValue(injectionRows)
  const sortedInjectionRows = React.useMemo(() => {
    const rows = [...deferredInjectionRows]
    rows.sort((a, b) => {
      if (injectionSortBy === "domain") {
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      if (injectionSortBy === "country") {
        const countryCmp = (a.country || "-").toLowerCase().localeCompare((b.country || "-").toLowerCase())
        if (countryCmp !== 0) return countryCmp
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      const categoryCmp = (a.category || "-").toLowerCase().localeCompare((b.category || "-").toLowerCase())
      if (categoryCmp !== 0) return categoryCmp
      return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
    })
    return rows
  }, [deferredInjectionRows, injectionSortBy])
	  const dumpRows = React.useMemo(() => {
      if (sseDumpRows.length > 0) return sseDumpRows
	    return tableData.map((row) => ({
	      key: row.id,
	      domain: row.domain || "-",
	      country: row.country || "-",
	      category: row.type && row.type !== "-" ? row.type : "-",
	      longTask: false,
	      rows: row.rows > 0 ? row.rows : 0,
	      statusKind: row.status === "complete" ? ("dumped" as const) : ("progress" as const),
	      statusLabel: row.status === "complete" ? "Dumped" : statusConfig[row.status].label,
	      percentDone: row.status === "complete" ? 100 : 0,
	    }))
	  }, [sseDumpRows, tableData])
  const deferredDumpRows = React.useDeferredValue(dumpRows)
  const sortedDumpRows = React.useMemo(() => {
    const rows = [...deferredDumpRows]
    rows.sort((a, b) => {
      if (dumpSortBy === "domain") {
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      if (dumpSortBy === "country") {
        const countryCmp = (a.country || "-").toLowerCase().localeCompare((b.country || "-").toLowerCase())
        if (countryCmp !== 0) return countryCmp
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      if (dumpSortBy === "category") {
        const categoryCmp = (a.category || "-").toLowerCase().localeCompare((b.category || "-").toLowerCase())
        if (categoryCmp !== 0) return categoryCmp
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      if (dumpSortBy === "rows") {
        if (a.rows !== b.rows) {
          return dumpRowsSortOrder === "asc" ? a.rows - b.rows : b.rows - a.rows
        }
        return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
      }

      const dumpedFirstRank = (status: "dumped" | "progress") => (status === "dumped" ? 0 : 1)
      const progressFirstRank = (status: "dumped" | "progress") => (status === "progress" ? 0 : 1)
      const rank = dumpStatusSortPreference === "dumped_first" ? dumpedFirstRank : progressFirstRank
      const statusCmp = rank(a.statusKind) - rank(b.statusKind)
      if (statusCmp !== 0) return statusCmp
      return (a.domain || "-").toLowerCase().localeCompare((b.domain || "-").toLowerCase())
    })
    return rows
  }, [deferredDumpRows, dumpRowsSortOrder, dumpSortBy, dumpStatusSortPreference])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(DUMP_SORT_PREF_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        by?: DumpSortBy
        rowsOrder?: DumpRowsSortOrder
        statusPreference?: DumpStatusSortPreference
      }
      if (parsed.by && ["domain", "country", "category", "rows", "status"].includes(parsed.by)) {
        setDumpSortBy(parsed.by)
      }
      if (parsed.rowsOrder === "asc" || parsed.rowsOrder === "desc") {
        setDumpRowsSortOrder(parsed.rowsOrder)
      }
      if (parsed.statusPreference === "dumped_first" || parsed.statusPreference === "progress_first") {
        setDumpStatusSortPreference(parsed.statusPreference)
      }
    } catch {
      // ignore invalid local cache
    }
  }, [DUMP_SORT_PREF_KEY])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        DUMP_SORT_PREF_KEY,
        JSON.stringify({
          by: dumpSortBy,
          rowsOrder: dumpRowsSortOrder,
          statusPreference: dumpStatusSortPreference,
        })
      )
    } catch {
      // ignore localStorage write failures
    }
  }, [DUMP_SORT_PREF_KEY, dumpRowsSortOrder, dumpSortBy, dumpStatusSortPreference])
  const injectionRenderLimit = taskStatus === "running" || taskStatus === "running_recon" ? 200 : 1000
  const dumpRenderLimit = taskStatus === "running" || taskStatus === "running_recon" ? 200 : 1000
  const renderedInjectionRows = React.useMemo(
    () => sortedInjectionRows.slice(0, injectionRenderLimit),
    [injectionRenderLimit, sortedInjectionRows]
  )
  const renderedDumpRows = React.useMemo(
    () => sortedDumpRows.slice(0, dumpRenderLimit),
    [dumpRenderLimit, sortedDumpRows]
  )
  const wafDetected = sseWafDetected
	  const categoryColorMap = React.useMemo(
	    () => ({
	      Shopping: "#3b82f6",
	      Gaming: "#8b5cf6",
	      Education: "#10b981",
	      Finance: "#0ea5e9",
	      SocialMedia: "#ec4899",
	      Streaming: "#14b8a6",
	      Blogs: "#f59e0b",
	      Forums: "#a855f7",
	      Gambling: "#f97316",
	      Adult: "#ef4444",
	      Services: "#06b6d4",
	      Failed: "#ef4444",
	    }),
	    []
	  )
  const categoryStats = React.useMemo(() => {
    const items = Object.entries(sseCategory)
      .filter(([, value]) => Number.isFinite(value) && value >= 0)
      .map(([label, value], index) => ({
        key: sanitizeChartKey(label),
        label,
        value: Number(value),
        color: categoryColorMap[label as keyof typeof categoryColorMap] || "#94a3b8",
      }))
    if (items.length > 0) return items
    return [{ key: "no_data", label: "No data", value: 100, color: "#374151" }]
  }, [categoryColorMap, sseCategory])
	  const categoryChartConfig = React.useMemo(() => {
	    return categoryStats.reduce((acc, item) => {
	      acc[item.key] = { label: item.label, color: item.color }
	      return acc
	    }, {} as ChartConfig)
	  }, [categoryStats])
	  const categoryTotal = categoryStats.reduce((acc, item) => acc + item.value, 0)
  const dumpCountFromRows = dumpRows.length
  const dumpedCountFromRows = dumpRows.filter((row) => row.statusKind === "dumped").length
  const dumpCountDisplay = Math.max(sseDumpCount, dumpCountFromRows)
  const dumpedCountDisplay = Math.max(sseDumpedCount, dumpedCountFromRows)
  const dumpsProgressPercentFromCount =
    dumpCountDisplay > 0 ? Math.min(100, Math.max(0, Math.round((dumpedCountDisplay / dumpCountDisplay) * 100))) : 0
  const dumpsProgressPercent = sseDumpProgressPercent ?? dumpsProgressPercentFromCount
  const queueDisplay =
    sseDumpQueueCount !== null ? sseDumpQueueCount : Math.max(0, dumpCountDisplay - dumpedCountDisplay)
  const countriesCount = React.useMemo(() => {
    const set = new Set<string>()
    for (const row of injectionRows) {
      const c = (row.country || "").trim()
      if (c && c !== "-") set.add(c.toUpperCase())
    }
    for (const row of dumpRows) {
      const c = (row.country || "").trim()
      if (c && c !== "-") set.add(c.toUpperCase())
    }
    return set.size
  }, [dumpRows, injectionRows])
  const pageRankRadarData = React.useMemo(() => {
    const buckets = [
      { bucket: "10K-50K", min: 10_001, max: 50_000, count: 0 },
      { bucket: "50K-100K", min: 50_001, max: 100_000, count: 0 },
      { bucket: "100K-170K", min: 100_001, max: 170_000, count: 0 },
      { bucket: "170K-260K", min: 170_001, max: 260_000, count: 0 },
      { bucket: "260K-400K", min: 260_001, max: 400_000, count: 0 },
      { bucket: "400K-650K", min: 400_001, max: 650_000, count: 0 },
      { bucket: "650K-1M", min: 650_001, max: 1_000_000, count: 0 },
    ]

    const domains = new Set<string>()
    for (const row of injectionRows) {
      const d = (row.domain || "").trim().toLowerCase()
      if (d) domains.add(d)
    }
    for (const row of dumpRows) {
      const d = (row.domain || "").trim().toLowerCase()
      if (d) domains.add(d)
    }

    const pseudoRank = (domain: string) => {
      let hash = 2166136261
      for (let i = 0; i < domain.length; i += 1) {
        hash ^= domain.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
      }
      return (Math.abs(hash) % 1_000_000) + 1
    }

    for (const domain of domains) {
      const rank = pseudoRank(domain)
      // Exclude top 1-10K ranks from radar completely.
      if (rank <= 10_000) continue
      const bucket = buckets.find((b) => rank >= b.min && rank <= b.max)
      if (bucket) bucket.count += 1
    }

    return buckets.map(({ bucket, count }) => ({ bucket, count }))
  }, [dumpRows, injectionRows])
  const pageRankRadarConfig = React.useMemo(
    () =>
      ({
        count: {
          label: "Domains",
          color: "var(--chart-1)",
        },
      }) satisfies ChartConfig,
    []
  )
  // Temporary preview numbers for the Tasks right-side overview.
  const tasksOverviewMock = isTasksMode
    ? { unfiltered: 128, filtered: 84, antipublic: 19, countries: 12 }
    : null
	  const etaSecondsForDisplay = etaCountdownSeconds !== null && etaCountdownSeconds > 0 ? etaCountdownSeconds : sseEtaSeconds
	  const etaLabel = etaSecondsForDisplay > 0 ? formatEta(etaSecondsForDisplay) : (progressPercent >= 100 ? "00m 00s" : `${Math.max(1, Math.round((100 - progressPercent) * 0.9))}m`)
	  const hasInjectionRows = injectionRows.length > 0
	  const hasDumpRows = dumpRows.length > 0
	  const showStatsSkeleton = !statsHydrated && (isLoadingData || taskStatus === "running" || taskStatus === "running_recon")
	  const showInjectionSkeleton = !injectionHydrated && (isLoadingData || taskStatus === "running" || taskStatus === "running_recon")
	  const showDumpsSkeleton = !dumpsHydrated && (isLoadingData || taskStatus === "running" || taskStatus === "running_recon")
	  const isStartDisabled =
	    isStarting || taskStatus === "running" || taskStatus === "running_recon" || taskStatus === "complete"
	  const skeletonRowKeys = React.useMemo(() => Array.from({ length: 5 }, (_, idx) => `sk-${idx}`), [])

	  if (isCheckingTask) {
	    return (
	      <div className="flex flex-1 items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading</span>
        </div>
      </div>
    )
  }

  if (taskNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div className="text-lg font-semibold">Invalid task</div>
        <div className="text-sm text-muted-foreground mt-2">
          The task ID is invalid or you do not have access to it.
        </div>
        <Link href={basePath} className="mt-4">
          <Button variant="outline">{`Back to ${displayNameLower}`}</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden p-6 font-[family-name:var(--font-inter)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-col gap-4 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={basePath}>
                  <Button variant="ghost" size="icon" className="size-8">
                    <IconArrowLeft className="size-4" />
                  </Button>
                </Link>
                <h1 className="truncate text-xl font-semibold tracking-tight">{displayName}-{shortId}</h1>
                {isLoadingData && currentPage === 1 ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconLoader2 size={12} className="animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Loading...</span>
                  </Badge>
                ) : taskStatus === "pending" ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconClock size={12} className="text-yellow-500" />
                    <span className="text-foreground">Pending</span>
                  </Badge>
                ) : taskStatus === "running_recon" ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconLoader2 size={12} className="animate-spin text-blue-500" />
                    <span className="text-foreground">Running recon</span>
                  </Badge>
                ) : taskStatus === "running" ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconLoader2 size={12} className="animate-spin text-blue-500" />
                    <span className="text-foreground">In progress</span>
                  </Badge>
                ) : taskStatus === "paused" ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconClock size={12} className="text-orange-500" />
                    <span className="text-foreground">Paused</span>
                  </Badge>
                ) : taskStatus === "failed" ? (
                  <Badge variant="outline" className="bg-transparent">
                    <IconAlertTriangle size={12} className="text-red-500" />
                    <span className="text-foreground">Failed</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-transparent">
                    <IconCircleCheck size={12} className="text-emerald-500" />
                    <span className="text-foreground">Complete</span>
                  </Badge>
                )}

                {!isTasksMode && (
                  <Badge variant="outline" className="bg-transparent text-xs text-muted-foreground">
                    <IconCoins size={12} className="text-muted-foreground" />
                    <span>Credits used</span>
                    {isLoadingData && currentPage === 1 ? (
                      <Skeleton className="h-3 w-10" />
                    ) : (
                      <span className="font-mono text-foreground">{creditsUsed.toLocaleString()}</span>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isTasksMode && (
                <div
                  className={[
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs",
                    selectedEngineLabel === "Google Deep"
                      ? "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-300"
                      : selectedEngineLabel === "Google Fast"
                        ? "border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-700/70 dark:bg-blue-950/30 dark:text-blue-300"
                        : "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-300",
                  ].join(" ")}
                >
                  {selectedEngineLabel === "Google Deep" ? (
                    <IconBrain size={13} />
                  ) : selectedEngineLabel === "Google Fast" ? (
                    <IconBolt size={13} />
                  ) : (
                    <EngineLiteIcon className="size-[13px]" />
                  )}
                  <span className="font-medium">{selectedEngineLabel}</span>
                </div>
              )}
              {!isTasksMode && (
                <Badge
                  variant="outline"
                  className="h-8 cursor-default rounded-md border bg-background px-2 text-xs font-semibold text-foreground shadow-xs dark:border-input dark:bg-input/30"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      fill="none"
                      d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"
                    />
                  </svg>
                  <span>SmartClean</span>
                  <span className="rounded-sm border border-emerald-800/40 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-300">
                    ON
                  </span>
                </Badge>
              )}
              <Button
                variant="outline"
                size="icon"
                type="button"
                className="size-8"
                onClick={handleStart}
                disabled={isStartDisabled}
                title={isStartDisabled ? "Task is running or completed" : "Start task"}
              >
                {isStarting ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlayerPlay size={14} />}
              </Button>
              {!isTasksMode && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setShowSettings(true)}
                >
                  <IconSettings size={14} />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? <IconLoader2 size={14} className="animate-spin" /> : <IconTrash size={14} />}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 overflow-auto border-y lg:grid-cols-[2fr_1fr] lg:overflow-hidden">
              <div className="flex min-h-0 flex-col lg:border-r">
                <div className="grid border-b sm:grid-cols-2 sm:divide-x">
	                  <div className="space-y-3 p-5">
	                    <div className="flex items-start justify-between gap-4">
	                      <div>
	                        <p className="text-sm font-medium">Dork per minute</p>
	                        <p className="text-sm text-muted-foreground">Discovered per minute</p>
	                      </div>
	                      {showStatsSkeleton ? (
	                        <Skeleton className="h-9 w-20" />
	                      ) : (
	                        <p className="text-3xl font-semibold tracking-tight">{formatCompact(Math.round(websitesPerMinute))}</p>
	                      )}
	                    </div>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="h-24 w-full" />
	                    ) : (
	                      <ChartContainer config={websiteLineChartConfig} className="h-24 w-full">
	                        <LineChart
	                          accessibilityLayer
	                          data={websiteLineData}
	                          margin={{ left: 4, right: 4, top: 10, bottom: 6 }}
	                        >
	                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
	                          <XAxis dataKey="point" tickLine={false} axisLine={false} hide />
	                          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
	                          <Line
	                            dataKey="websites"
	                            type="natural"
	                            stroke="var(--color-websites)"
	                            strokeWidth={2}
	                            dot={false}
	                          />
	                        </LineChart>
	                      </ChartContainer>
	                    )}
	                  </div>
	                  <div className="space-y-3 p-5">
	                    <div className="flex items-start justify-between gap-4">
	                      <div>
	                        <p className="text-sm font-medium">Requests per minute</p>
	                        <p className="text-sm text-muted-foreground">Processed per minute</p>
	                      </div>
	                      {showStatsSkeleton ? (
	                        <Skeleton className="h-9 w-20" />
	                      ) : (
	                        <p className="text-3xl font-semibold tracking-tight">{formatCompact(Math.round(requestsPerMinute))}</p>
	                      )}
	                    </div>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="h-24 w-full" />
	                    ) : (
	                      <ChartContainer config={requestLineChartConfig} className="h-24 w-full">
	                        <LineChart
	                          accessibilityLayer
	                          data={requestLineData}
	                          margin={{ left: 4, right: 4, top: 10, bottom: 6 }}
	                        >
	                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
	                          <XAxis dataKey="point" tickLine={false} axisLine={false} hide />
	                          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
	                          <Line
	                            dataKey="requests"
	                            type="natural"
	                            stroke="var(--color-requests)"
	                            strokeWidth={2}
	                            dot={false}
	                          />
	                        </LineChart>
	                      </ChartContainer>
	                    )}
	                  </div>
	                </div>
	
	                <div className="grid border-b sm:grid-cols-2 sm:divide-x">
	                  <div className="space-y-2 p-5">
	                    <p className="text-sm font-medium">Filetered</p>
	                    <p className="text-sm text-muted-foreground">Filetered links</p>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="mt-4 h-10 w-28" />
	                    ) : (
	                      <p className="pt-4 text-4xl font-semibold tracking-tight">{sseSuccess.toLocaleString()}</p>
	                    )}
	                  </div>
	                  <div className="space-y-2 p-5">
	                    <p className="text-sm font-medium">Unfiltered</p>
	                    <p className="text-sm text-muted-foreground">Unfiltered links</p>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="mt-4 h-10 w-28" />
	                    ) : (
	                      <p className="pt-4 text-4xl font-semibold tracking-tight">
	                        {dumpedCountDisplay.toLocaleString()}
	                      </p>
	                    )}
	                  </div>
	                </div>
	
	                <div className="grid border-b sm:grid-cols-2 sm:divide-x">
	                  <div className="space-y-2 p-5">
	                    <p className="text-sm font-medium">Antipublic</p>
	                    <p className="text-sm text-muted-foreground">Antipublic detected</p>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="mt-4 h-10 w-28" />
	                    ) : (
	                      <p className="pt-4 text-4xl font-semibold tracking-tight">{wafDetected.toLocaleString()}</p>
	                    )}
	                  </div>
	                  <div className="space-y-3 p-5">
	                    <p className="text-sm font-medium">Country</p>
	                    <div className="flex items-center gap-5">
	                      {showStatsSkeleton ? (
	                        <>
	                          <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
	                          <div className="space-y-2">
	                            {skeletonRowKeys.slice(0, 4).map((key) => (
	                              <div key={key} className="flex items-center gap-2">
	                                <Skeleton className="h-2 w-2 rounded-full" />
	                                <Skeleton className="h-3 w-24" />
	                                <Skeleton className="h-3 w-14" />
	                              </div>
	                            ))}
	                          </div>
	                        </>
	                      ) : (
	                        <>
	                          <ChartContainer
	                            config={categoryChartConfig}
	                            className="h-24 w-24 shrink-0 !aspect-square"
	                          >
	                            <PieChart>
	                              <ChartTooltip
	                                cursor={false}
	                                content={<ChartTooltipContent hideLabel nameKey="key" />}
	                              />
	                              <Pie
	                                data={categoryStats}
	                                dataKey="value"
	                                nameKey="label"
	                                innerRadius={24}
	                                outerRadius={44}
	                                strokeWidth={1}
	                              >
	                                {categoryStats.map((item) => (
	                                  <Cell key={item.key} fill={`var(--color-${item.key})`} />
	                                ))}
	                              </Pie>
	                            </PieChart>
	                          </ChartContainer>
	                          <div className="space-y-2">
	                            {categoryStats.map((item) => (
	                              <div key={item.key} className="flex items-center gap-2 text-xs text-muted-foreground">
	                                <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
	                                <span>{item.label}</span>
	                                <span className="font-mono">
	                                  {Math.trunc(item.value)}
	                                  {categoryTotal > 0 ? ` (${Math.round((item.value / categoryTotal) * 100)}%)` : ""}
	                                </span>
	                              </div>
	                            ))}
	                          </div>
	                        </>
	                      )}
	                    </div>
	                  </div>
	                </div>
	
	                <div className="my-auto space-y-3 p-5">
	                  <div className="flex items-center justify-between text-sm">
	                    <p className="font-medium">Progress</p>
	                    {showStatsSkeleton ? (
	                      <Skeleton className="h-4 w-40" />
	                    ) : (
	                      <p className="font-mono text-muted-foreground">
	                        {(progress?.current ?? 0).toLocaleString()} / {(progress?.target ?? 0).toLocaleString()}
	                      </p>
	                    )}
	                  </div>
	                  {showStatsSkeleton ? (
	                    <Skeleton className="mt-2 h-2 w-full" />
	                  ) : (
	                    <Progress value={progressPercent} className="mt-2 h-2" />
	                  )}
	                  <div className="flex items-center justify-between text-xs text-muted-foreground">
	                    {showStatsSkeleton ? (
	                      <>
	                        <Skeleton className="h-3 w-10" />
	                        <Skeleton className="h-3 w-20" />
	                      </>
	                    ) : (
	                      <>
	                        <span>{progressPercent}%</span>
	                        <span>ETA: {etaLabel}</span>
	                      </>
	                    )}
	                  </div>
	                </div>
	              </div>

              {!isTasksMode ? (
              <div className="grid min-h-0 h-[clamp(360px,60vh,720px)] grid-rows-2 divide-y border-l lg:h-full">
                <section className="flex min-h-0 flex-col">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
	                          <IconAdjustments className="size-4 text-muted-foreground" />
		                          <p className="text-base font-semibold tracking-tight">Injection</p>
		                          <Badge variant="outline" className="bg-transparent text-[10px] font-mono text-muted-foreground">
		                            {sseSuccess.toLocaleString()}
		                          </Badge>
		                          <span className="text-[10px] font-mono text-muted-foreground">
		                            {sseUiStatus === "connected"
		                              ? "Live"
	                                : sseUiStatus === "error"
	                                  ? "Offline"
	                                  : "Idle"}
	                          </span>
	                        </div>
	                      </div>
	                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Sort injection"
                            >
                              <IconArrowsSort size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuCheckboxItem
                              checked={injectionSortBy === "domain"}
                              onCheckedChange={(checked) => {
                                if (checked) setInjectionSortBy("domain")
                              }}
                            >
                              Domains (A-Z)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={injectionSortBy === "country"}
                              onCheckedChange={(checked) => {
                                if (checked) setInjectionSortBy("country")
                              }}
                            >
                              Country (A-Z)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={injectionSortBy === "category"}
                              onCheckedChange={(checked) => {
                                if (checked) setInjectionSortBy("category")
                              }}
                            >
                              Category (A-Z)
                            </DropdownMenuCheckboxItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={handleDownloadInjection}
                          disabled={isDownloadingInjection}
                        >
                          {isDownloadingInjection ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}
                        </Button>
                      </div>
                    </div>
                  </div>
	                  <div
	                    className={
	                      hasInjectionRows || showInjectionSkeleton
	                        ? "dashboard-scroll min-h-0 flex-1 overflow-auto"
	                        : "min-h-0 flex-1 overflow-hidden"
	                    }
	                    onScroll={(e) => {
	                      if (showInjectionSkeleton) return
	                      if (isLoadingInjectionMore) return
	                      if (!injectionHasMore) return
	                      const el = e.currentTarget
	                      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
	                      if (distanceToBottom < 80) {
	                        void loadMoreInjectionFromSnapshot()
	                      }
	                    }}
	                  >
	                    <Table>
	                      <TableHeader>
	                        <TableRow className="bg-transparent hover:bg-transparent">
	                          <TableHead>Domains</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-[40px]" />
                        </TableRow>
	                      </TableHeader>
	                      <TableBody>
	                        {showInjectionSkeleton ? (
	                          skeletonRowKeys.map((key) => (
	                            <TableRow key={key} className="hover:bg-transparent">
	                              <TableCell className="truncate font-medium">
	                                <Skeleton className="h-4 w-44" />
	                              </TableCell>
	                              <TableCell className="text-muted-foreground">
	                                <Skeleton className="h-4 w-10" />
	                              </TableCell>
	                              <TableCell className="text-muted-foreground">
	                                <Skeleton className="h-4 w-16" />
	                              </TableCell>
	                              <TableCell>
	                                <Skeleton className="h-6 w-6 rounded-md" />
	                              </TableCell>
	                            </TableRow>
	                          ))
	                        ) : hasInjectionRows ? (
	                          renderedInjectionRows.map((item) => (
		                            <TableRow key={item.key} className="hover:bg-transparent">
		                              <TableCell className="font-medium">
		                                <div className="flex min-w-0 items-center gap-2">
	                                  <span className="block min-w-0 max-w-[220px] flex-1 truncate" title={item.domain}>
	                                    {item.domain}
	                                  </span>
	                                  {item.waf ? (
	                                    <Badge
	                                      variant="outline"
	                                      className="ml-auto shrink-0 border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-mono text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300"
	                                    >
	                                      WAF
	                                    </Badge>
	                                  ) : null}
	                                </div>
	                              </TableCell>
	                              <TableCell className="text-muted-foreground">{item.country}</TableCell>
	                              <TableCell className="text-muted-foreground">{item.category}</TableCell>
	                              <TableCell>
	                                <DropdownMenu>
	                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="size-7">
                                      <IconDotsVertical size={14} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Open domain</DropdownMenuItem>
                                    <DropdownMenuItem>Copy domain</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
		                              </TableCell>
		                            </TableRow>
		                          ))
		                        ) : null}

		                        {!showInjectionSkeleton && hasInjectionRows ? (
		                          <TableRow>
		                            <TableCell colSpan={4} className="py-3">
		                              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
		                                {isLoadingInjectionMore ? (
		                                  <>
		                                    <IconLoader2 className="size-4 animate-spin" />
		                                    <span>Loading more…</span>
		                                  </>
		                                ) : injectionHasMore ? (
		                                  <span>Scroll to load more…</span>
		                                ) : (
		                                  <span>All history loaded</span>
		                                )}
		                                <span className="font-mono">
                                      {renderedInjectionRows.length.toLocaleString()} / {sortedInjectionRows.length.toLocaleString()} shown
                                    </span>
		                              </div>
		                            </TableCell>
		                          </TableRow>
		                        ) : injectionHasMore || isLoadingInjectionMore ? (
		                          <TableRow>
		                            <TableCell colSpan={4} className="h-[120px]">
		                              <div className="flex flex-col items-center justify-center text-center py-4">
	                                <IconLoader2 className="mb-2 size-5 animate-spin text-muted-foreground" />
	                                <p className="text-xs text-muted-foreground">
	                                  {isLoadingInjectionMore ? "Loading more…" : "Waiting for results…"}
	                                </p>
	                              </div>
	                            </TableCell>
	                          </TableRow>
	                        ) : (
	                          <TableRow>
	                            <TableCell colSpan={4} className="h-[120px]">
	                              <div className="h-[120px]" />
                            </TableCell>
	                          </TableRow>
	                        )}
	                      </TableBody>
	                    </Table>
	                  </div>
	                </section>

                <section className="flex min-h-0 flex-col">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2.5">
                          <IconBinaryTree className="size-4 text-muted-foreground" />
                          <p className="text-base font-semibold tracking-tight">Dumps</p>
                          <Badge variant="outline" className="bg-transparent text-[10px] font-mono text-muted-foreground">
                            {dumpCountDisplay}
                          </Badge>
                          <Badge variant="outline" className="bg-transparent text-[10px] font-mono text-muted-foreground">
                            Queue {queueDisplay}
                          </Badge>
                          {showDumpsSkeleton ? (
                            <Skeleton className="h-1 w-10 rounded-full" />
                          ) : (
                            <div className="ml-1 flex items-center gap-1.5">
                              <div className="w-20">
                              <Progress value={dumpsProgressPercent} className="h-1" />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {dumpsProgressPercent}%
                              </span>
                            </div>
                          )}
                          {dumpUploadState === "uploading" ? (
                            <span className="text-[10px] font-mono text-muted-foreground">Uploading…</span>
                          ) : dumpUploadState === "failed" ? (
                            <span className="text-[10px] font-mono text-red-500">Failed</span>
                          ) : dumpUploadState === "done" ? (
                            <span className="text-[10px] font-mono text-emerald-500">Done</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="Sort dumps"
                            >
                              <IconArrowsSort size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "domain"}
                              onCheckedChange={(checked) => {
                                if (checked) setDumpSortBy("domain")
                              }}
                            >
                              Domains (A-Z)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "country"}
                              onCheckedChange={(checked) => {
                                if (checked) setDumpSortBy("country")
                              }}
                            >
                              Country (A-Z)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "category"}
                              onCheckedChange={(checked) => {
                                if (checked) setDumpSortBy("category")
                              }}
                            >
                              Category (A-Z)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "rows" && dumpRowsSortOrder === "desc"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDumpSortBy("rows")
                                  setDumpRowsSortOrder("desc")
                                }
                              }}
                            >
                              Rows (High-Low)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "rows" && dumpRowsSortOrder === "asc"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDumpSortBy("rows")
                                  setDumpRowsSortOrder("asc")
                                }
                              }}
                            >
                              Rows (Low-High)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "status" && dumpStatusSortPreference === "dumped_first"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDumpSortBy("status")
                                  setDumpStatusSortPreference("dumped_first")
                                }
                              }}
                            >
                              Status (Dumped first)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={dumpSortBy === "status" && dumpStatusSortPreference === "progress_first"}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDumpSortBy("status")
                                  setDumpStatusSortPreference("progress_first")
                                }
                              }}
                            >
                              Status (Progress first)
                            </DropdownMenuCheckboxItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={handleUploadDump}
                          disabled={dumpUploadState === "uploading"}
                          title={dumpUploadState === "failed" ? "Retry upload" : "Upload and download dump"}
                        >
                          {dumpUploadState === "uploading" ? (
                            <IconLoader2 size={14} className="animate-spin" />
                          ) : (
                            <IconDownload size={14} />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
	                  <div
	                    className={
	                      hasDumpRows || showDumpsSkeleton
	                        ? "dashboard-scroll min-h-0 flex-1 overflow-auto"
	                        : "min-h-0 flex-1 overflow-hidden"
	                    }
	                  >
	                    <Table>
	                      <TableHeader>
	                        <TableRow className="bg-transparent hover:bg-transparent">
	                          <TableHead>Domains</TableHead>
	                          <TableHead>Country</TableHead>
	                          <TableHead>Category</TableHead>
	                          <TableHead>Rows</TableHead>
	                          <TableHead>Status</TableHead>
	                        </TableRow>
	                      </TableHeader>
	                      <TableBody>
	                        {showDumpsSkeleton ? (
	                          skeletonRowKeys.map((key) => (
	                            <TableRow key={key} className="hover:bg-transparent">
	                              <TableCell className="truncate font-medium">
	                                <Skeleton className="h-4 w-44" />
	                              </TableCell>
	                              <TableCell className="text-muted-foreground">
	                                <Skeleton className="h-4 w-10" />
	                              </TableCell>
	                              <TableCell>
	                                <Skeleton className="h-5 w-20 rounded-full" />
	                              </TableCell>
	                              <TableCell className="font-mono text-muted-foreground">
	                                <Skeleton className="h-4 w-12" />
	                              </TableCell>
	                              <TableCell>
	                                <Skeleton className="h-5 w-16 rounded-full" />
	                              </TableCell>
	                            </TableRow>
	                          ))
	                        ) : hasDumpRows ? (
	                          renderedDumpRows.map((item) => (
	                            <TableRow key={item.key} className="hover:bg-transparent">
	                              <TableCell className="font-medium">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="block min-w-0 max-w-[220px] flex-1 truncate" title={item.domain}>
                                      {item.domain}
                                    </span>
                                    {item.longTask ? (
                                      <Badge
                                        variant="outline"
                                        className="ml-auto shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-mono text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300"
                                      >
                                        Long Task
                                      </Badge>
                                    ) : null}
                                  </div>
                                </TableCell>
	                              <TableCell className="text-muted-foreground">{item.country}</TableCell>
	                              <TableCell>
	                                <span className="text-muted-foreground">{item.category || "-"}</span>
	                              </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
	                                {formatCompact(item.rows)}
	                              </TableCell>
	                              <TableCell>
	                                {item.statusKind === "dumped" ? (
	                                  <Badge
	                                    variant="outline"
	                                    className="gap-1.5 border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
	                                  >
	                                    <IconCircleCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
	                                    <span className="font-medium">Dumped</span>
	                                  </Badge>
	                                ) : (
	                                  <div className="flex items-center gap-2">
	                                    <Badge
	                                      variant="outline"
	                                      className="gap-1.5 border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
	                                    >
	                                      <IconLoader2
	                                        size={12}
	                                        className="animate-spin text-blue-600 dark:text-blue-400"
	                                      />
	                                      <span className="font-medium">{item.percentDone}% progress</span>
	                                    </Badge>
	                                  </div>
	                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
	                          <TableRow>
	                            <TableCell colSpan={5} className="h-[120px]">
	                              <div className="h-[120px]" />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </div>
              ) : (
                <div className="min-h-0 overflow-y-auto border-l p-5 lg:h-full">
                  <div className="flex h-full flex-col space-y-4">
                    <p className="text-xl font-semibold tracking-tight">Live Overview</p>
                    <div className="divide-y">
                      <div className="flex items-center justify-between gap-3 py-3">
                        <p className="inline-flex items-center gap-2 text-base font-medium text-foreground">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-5 text-muted-foreground"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="m15 9l-6 6m0-6l6 6" />
                          </svg>
                          <span>Unfiltered</span>
                        </p>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {formatCompact(tasksOverviewMock?.unfiltered ?? dumpedCountDisplay)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <p className="inline-flex items-center gap-2 text-base font-medium text-foreground">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-5 text-muted-foreground"
                          >
                            <path fill="none" d="M22 3H2l8 9.46V19l4 2v-8.54z" />
                          </svg>
                          <span>Filtered</span>
                        </p>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {formatCompact(tasksOverviewMock?.filtered ?? sseSuccess)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <p className="inline-flex items-center gap-2 text-base font-medium text-foreground">
                          <IconShield className="size-5 text-muted-foreground" />
                          <span>Antipublic</span>
                        </p>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {formatCompact(tasksOverviewMock?.antipublic ?? wafDetected)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <p className="inline-flex items-center gap-2 text-base font-medium text-foreground">
                          <IconWorld className="size-5 text-muted-foreground" />
                          <span>Countries</span>
                        </p>
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {formatCompact(tasksOverviewMock?.countries ?? countriesCount)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-4">
                      <p className="pb-2 text-sm font-medium text-foreground">Page Rank (Top 1M)</p>
                      <ChartContainer config={pageRankRadarConfig} className="mx-auto h-[290px] w-full overflow-visible">
                        <RadarChart data={pageRankRadarData}>
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <PolarAngleAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                          <PolarGrid />
                          <Radar dataKey="count" fill="var(--color-count)" fillOpacity={0.2} stroke="var(--color-count)" />
                        </RadarChart>
                      </ChartContainer>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto scrollbar-hide data-[state=open]:duration-200">
          <DialogHeader className="flex-row items-start justify-between motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none">
            <div className="space-y-1 text-left">
              <DialogTitle>Task settings</DialogTitle>
              <DialogDescription>{`Configure task options for ${displayName}-${shortId}.`}</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => window.open('https://docs.example.com', '_blank')}
            >
              <IconBook className="size-4" />
              Docs
            </Button>
          </DialogHeader>

          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-name">Task name</Label>
                  <Input
                    id="task-name"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lists">Lists</Label>
                  <div className="relative">
                    <IconList className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="lists" value={listsFile} className="bg-muted pl-10" disabled />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="auto-dumper" className="cursor-pointer">Auto dumper</Label>
                    <div className="text-xs text-muted-foreground">Automatically dump found data.</div>
                  </div>
                  <Switch id="auto-dumper" checked={autoDumper} onCheckedChange={setAutoDumper} disabled={isSaving} />
                </div>

                {autoDumper && (
                  <div className="space-y-2">
                    <Label htmlFor="preset">Preset format</Label>
                    <Select value={preset} onValueChange={setPreset} disabled={isSaving}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="email:password"><span className="font-mono text-sm">email:password</span></SelectItem>
                        <SelectItem value="username:password"><span className="font-mono text-sm">username:password</span></SelectItem>
                        <SelectItem value="phone:password"><span className="font-mono text-sm">phone:password</span></SelectItem>
                        <SelectItem value="email"><span className="font-mono text-sm">email</span></SelectItem>
                        <SelectItem value="username"><span className="font-mono text-sm">username</span></SelectItem>
                        <SelectItem value="phone"><span className="font-mono text-sm">phone</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="text-sm font-medium">Injection settings</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="union-based" checked={unionBased} onCheckedChange={(checked) => setUnionBased(checked === true)} disabled={isSaving} />
                    <Label htmlFor="union-based" className="cursor-pointer text-sm font-normal">Union-based</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="error-based" checked={errorBased} onCheckedChange={(checked) => setErrorBased(checked === true)} disabled={isSaving} />
                    <Label htmlFor="error-based" className="cursor-pointer text-sm font-normal">Error-based</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="boolean-based" checked={booleanBased} onCheckedChange={(checked) => setBooleanBased(checked === true)} disabled={isSaving} />
                    <Label htmlFor="boolean-based" className="cursor-pointer text-sm font-normal inline-flex items-center gap-2">
                      Boolean-based
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="time-based" checked={timeBased} onCheckedChange={(checked) => setTimeBased(checked === true)} disabled={isSaving} />
                    <Label htmlFor="time-based" className="cursor-pointer text-sm font-normal inline-flex items-center gap-2">
                      Time-based
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                    </Label>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconSparkles className="size-4 text-muted-foreground" />
                    <div className="text-sm font-medium">AI settings</div>
                    <Badge variant="outline" className="bg-transparent text-[10px] font-mono">enabled</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Configure AI sensitivity and core engines.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-sensitivity" className="flex items-center gap-2">
                    <IconAdjustments className="size-4 text-muted-foreground" />
                    AI sensitivity
                  </Label>
                  <Select value={aiSensitivityLevel} onValueChange={(v) => setAiSensitivityLevel(v as "low" | "medium" | "high")} disabled={isSaving}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Higher sensitivity can increase findings but may cost more credits.
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="response-drift" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                        <IconCpu className="size-4 text-muted-foreground" />
                        Detector engine
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">Recommended</Badge>
                      </Label>
                      <div className="text-xs text-muted-foreground">Detects response behavior patterns and adjusts logic.</div>
                    </div>
                    <Switch id="response-drift" checked={responsePatternDrift} onCheckedChange={setResponsePatternDrift} disabled={isSaving} />
                  </div>

                  <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="structural-change" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                        <IconShieldCheck className="size-4 text-muted-foreground" />
                        Evasion engine
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">Recommended</Badge>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                      </Label>
                      <div className="text-xs text-muted-foreground">Smarter WAF bypass with stronger evasion capability.</div>
                    </div>
                    <Switch id="structural-change" checked={structuralChangeDetection} onCheckedChange={setStructuralChangeDetection} disabled={isSaving} />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="anti-ban-engine" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                        <IconShield className="size-4 text-muted-foreground" />
                        AntiBan engine
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Currently unavailable</Badge>
                      </Label>
                      <div className="text-xs text-muted-foreground">Temporarily unavailable in current version.</div>
                    </div>
                    <Switch
                      id="anti-ban-engine"
                      checked={antiBanEngine}
                      onCheckedChange={setAntiBanEngine}
                      disabled
                    />
                  </div>

                  <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="payload-engine" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                        <IconSparkles className="size-4 text-muted-foreground" />
                        Payload engine
                      </Label>
                      <div className="text-xs text-muted-foreground">Expands payload generation depth and variation. No credits cost.</div>
                    </div>
                    <Switch
                      id="payload-engine"
                      checked={payloadEngine}
                      onCheckedChange={setPayloadEngine}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowSettings(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
              <IconAlertTriangle className="size-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone and will permanently delete:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">&middot;</div>
              <div>
                <span className="font-medium">Task: </span>
                <span className="text-muted-foreground">{taskName || 'Unnamed Task'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <IconTrash className="size-4 mr-2" />
                  Delete Task
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

