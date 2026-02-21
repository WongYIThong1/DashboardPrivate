"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconPlus,
  IconCircleCheck,
  IconClock,
  IconAlertCircle,
  IconDotsVertical,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconList,
  IconBook,
  IconX,
  IconShield,
  IconSparkles,
  IconAdjustments,
  IconCpu,
  IconShieldCheck,
  IconBolt,
  IconBrain,
  IconLock,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

type TaskStatus = "pending" | "running_recon" | "running" | "paused" | "complete" | "failed"
type UiStatus = "pending" | "running" | "complete"
type GoogleMode = "google_lite" | "google_fast" | "google_deep"

type UrlsFile = { id: string; name: string; type?: string }

interface Task {
  id: string
  name: string
  status: TaskStatus
  found: number
  etaSeconds: number
  targetTotal: number | null
  remaining: number | null
  progressPercent: number
  target: string | null
  file: string
  started: string
  startedTime: string
  isRunning: boolean
}

interface ApiTask {
  id: string
  name: string
  status: string
  found: number
  target: string | null
  file: string
  started_time: string | null
}

interface UserTaskSummary {
  type?: string
  taskid?: string
  taskname?: string
  status?: string
  success?: number
  websites_done?: number
  websites_total?: number
  eta_seconds?: number
  progress?: string
  progress_ratio?: number
  remaining?: number
  remainng?: number
  updated_at?: string
}

interface UserSnapshotEvent {
  type?: string
  tasks?: UserTaskSummary[]
  count?: number
  limit?: number
  ts?: number
}

interface UserTaskUpdateEvent {
  type?: string
  task?: UserTaskSummary
  reason?: "start" | "stats" | "task_done" | "delete" | string
  ts?: number
}

interface TasksCachePayload {
  ts: number
  tasks: Task[]
}

interface FilesMinimalCachePayload {
  ts: number
  files: UrlsFile[]
}

interface GlobalTaskSettings {
  module: "scraper" | "keyword_scraper" | "vulnerability_scanner"
  file_id: string | null
  google_mode?: GoogleMode
  country_target_enabled?: boolean
  countries: string[]
  engines: string[]
  filter_redirect_links: boolean
  filter_blacklist_domains: boolean
  antipublic: boolean
}

const SCRAPER_ENGINES = [
  { id: "google_lite", label: "Google Lite", icon: FeatherMcIcon },
  { id: "google_fast", label: "Google Fast", icon: IconBolt },
  { id: "google_deep", label: "Google Deep", icon: IconBrain },
] as const

function FeatherMcIcon({ className }: { className?: string }) {
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
  pending: { icon: IconClock, label: "Pending", dotClass: "bg-yellow-500" },
  running: { icon: IconLoader2, label: "Running", dotClass: "bg-blue-500" },
  complete: { icon: IconCircleCheck, label: "Completed", dotClass: "bg-emerald-500" },
}

const SCRAPER_COUNTRIES = [
  "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Bulgaria", "Canada", "Chile", "China",
  "Colombia", "Croatia", "Czech Republic", "Denmark", "Egypt", "Estonia", "Finland", "France", "Germany", "Greece",
  "Hong Kong", "Hungary", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya", "Latvia",
  "Lithuania", "Luxembourg", "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Serbia", "Singapore",
  "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand",
  "Turkey", "UAE", "Ukraine", "United Kingdom", "United States", "Uruguay", "Vietnam",
]

const COUNTRY_ISO2: Record<string, string> = {
  "Argentina": "AR",
  "Australia": "AU",
  "Austria": "AT",
  "Bangladesh": "BD",
  "Belgium": "BE",
  "Brazil": "BR",
  "Bulgaria": "BG",
  "Canada": "CA",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Croatia": "HR",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Egypt": "EG",
  "Estonia": "EE",
  "Finland": "FI",
  "France": "FR",
  "Germany": "DE",
  "Greece": "GR",
  "Hong Kong": "HK",
  "Hungary": "HU",
  "India": "IN",
  "Indonesia": "ID",
  "Ireland": "IE",
  "Israel": "IL",
  "Italy": "IT",
  "Japan": "JP",
  "Kenya": "KE",
  "Latvia": "LV",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Malaysia": "MY",
  "Mexico": "MX",
  "Morocco": "MA",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Nigeria": "NG",
  "Norway": "NO",
  "Pakistan": "PK",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Romania": "RO",
  "Russia": "RU",
  "Saudi Arabia": "SA",
  "Serbia": "RS",
  "Singapore": "SG",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "South Africa": "ZA",
  "South Korea": "KR",
  "Spain": "ES",
  "Sri Lanka": "LK",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Taiwan": "TW",
  "Thailand": "TH",
  "Turkey": "TR",
  "UAE": "AE",
  "Ukraine": "UA",
  "United Kingdom": "GB",
  "United States": "US",
  "Uruguay": "UY",
  "Vietnam": "VN",
}

function countryTld(iso2: string): string {
  const upper = iso2.toUpperCase()
  if (upper === "GB") return ".uk"
  return `.${upper.toLowerCase()}`
}

function normalizeTaskStatus(value: string | undefined): TaskStatus | "deleted" {
  const raw = (value || "").trim().toLowerCase()
  if (raw === "deleted" || raw === "delete") return "deleted"
  if (raw === "completed" || raw === "complete") return "complete"
  if (raw === "failed") return "failed"
  if (raw === "paused") return "paused"
  if (raw === "running_recon") return "running_recon"
  if (raw === "running") return "running"
  return "pending"
}

function toUiStatus(status: TaskStatus): UiStatus {
  if (status === "running" || status === "running_recon") return "running"
  if (status === "complete") return "complete"
  return "pending"
}

function formatEtaLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}h ${remMins}m`
  }
  return `${mins}m ${secs}s`
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

async function fetchJsonWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ response: Response; data: unknown; durationMs: number }> {
  const controller = new AbortController()
  const start = Date.now()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    return { response, data, durationMs: Date.now() - start }
  } finally {
    window.clearTimeout(timer)
  }
}

function EtaCountdown({ etaSeconds, status }: { etaSeconds: number; status: TaskStatus }) {
  const [displaySeconds, setDisplaySeconds] = React.useState(Math.max(0, Math.trunc(etaSeconds || 0)))

  React.useEffect(() => {
    setDisplaySeconds(Math.max(0, Math.trunc(etaSeconds || 0)))
  }, [etaSeconds])

  React.useEffect(() => {
    if (status !== "running" && status !== "running_recon") return
    if (!Number.isFinite(displaySeconds) || displaySeconds <= 0) return

    const timer = window.setInterval(() => {
      setDisplaySeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [displaySeconds, status])

  if (!Number.isFinite(displaySeconds) || displaySeconds <= 0) {
    return <span className="font-mono text-xs text-muted-foreground">--</span>
  }

  return <span className="font-mono text-xs text-muted-foreground">{formatEtaLabel(displaySeconds)}</span>
}

const getColumns = (
  onDeleteTask: (task: Task) => void,
  basePath: string
): ColumnDef<Task>[] => [
  {
    accessorKey: "name",
    header: "Task",
    cell: ({ row }) => (
      <a
        href={`${basePath}/${row.original.id}`}
        className="block max-w-[220px] truncate text-sm font-medium hover:underline"
        title={String(row.getValue("name"))}
      >
        {row.getValue("name")}
      </a>
    ),
  },
  {
    id: "modules",
    header: "Modules",
    cell: () => <span className="text-xs text-muted-foreground">Default</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const rawStatus = row.getValue("status") as TaskStatus
      const uiStatus = toUiStatus(rawStatus)
      const config = statusConfig[uiStatus]
      const StatusIcon = config.icon
      return (
        <Badge variant="outline" className="h-5 gap-1 bg-transparent px-1.5 py-0 text-[11px]">
          <span className={`size-1.5 rounded-full ${config.dotClass}`} />
          <span className="text-foreground">{config.label}</span>
          {uiStatus === "running" && (
            <StatusIcon size={12} className="text-muted-foreground animate-spin" />
          )}
        </Badge>
      )
    },
  },
  {
    id: "progress",
    header: "Progress",
    cell: ({ row }) => {
      const progressPercent = row.original.progressPercent
      return (
        <div className="flex min-w-[130px] items-center gap-1.5">
          <Progress value={progressPercent} className="h-1 w-[90px]" />
          <span className="text-[11px] font-mono text-muted-foreground">{progressPercent}%</span>
        </div>
      )
    },
  },
  {
    accessorKey: "remaining",
    header: "Remaining",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.remaining === null ? "-" : row.original.remaining}
      </span>
    ),
  },
  {
    id: "eta",
    header: "ETA",
    cell: ({ row }) => <EtaCountdown etaSeconds={row.original.etaSeconds} status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <IconDotsVertical className="size-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`${basePath}/${row.original.id}`}>View</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={(event) => {
              event.preventDefault()
              onDeleteTask(row.original)
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

type TasksContentProps = {
  displayName?: string
  basePath?: string
  apiBasePath?: string
  enableExternalSse?: boolean
}

export function TasksContent({
  displayName = "Dumper",
  basePath = "/dumper",
  apiBasePath = "/api/v1/dumper",
  enableExternalSse = true,
}: TasksContentProps = {}) {
  const router = useRouter()
  const TASKS_CACHE_KEY = "tasks_list_cache_v1"
  const FILES_MINIMAL_CACHE_KEY = "files_minimal_cache_v1"
  const SLOW_SERVER_THRESHOLD_MS = 1800
  const TASKS_SNAPSHOT_TIMEOUT_MS = 8000
  const POLLING_INTERVAL_MS = 60000
  const HIDDEN_DISCONNECT_AFTER_MS = 60_000
  const [isLoading, setIsLoading] = React.useState(true)
  const [tasksData, setTasksData] = React.useState<Task[]>([])
  const [isStaleCache, setIsStaleCache] = React.useState(false)
  const [lastSyncAt, setLastSyncAt] = React.useState<number | null>(null)
  const [slowServer, setSlowServer] = React.useState(false)
  const [streamMode, setStreamMode] = React.useState<"connecting" | "live" | "retrying" | "polling">(
    enableExternalSse ? "connecting" : "polling"
  )
  const [maxTasks, setMaxTasks] = React.useState(0)
  const [userPlan, setUserPlan] = React.useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [autoDumper, setAutoDumper] = React.useState(false)
  const [availableFiles, setAvailableFiles] = React.useState<UrlsFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [taskName, setTaskName] = React.useState("")
  const [selectedFileId, setSelectedFileId] = React.useState("")
  const [selectedModule, setSelectedModule] = React.useState<"scraper" | "keyword_scraper" | "vulnerability_scanner">("scraper")
  const [scraperFilterRedirectLinks, setScraperFilterRedirectLinks] = React.useState(true)
  const [scraperFilterBlacklistDomains, setScraperFilterBlacklistDomains] = React.useState(true)
  const [scraperAntipublic] = React.useState(false)
  const [selectedEngine, setSelectedEngine] = React.useState<GoogleMode>(SCRAPER_ENGINES[0].id)
  const [countryTargetEnabled, setCountryTargetEnabled] = React.useState(false)
  const [selectedCountries, setSelectedCountries] = React.useState<string[]>([])
  const [countryQuery, setCountryQuery] = React.useState("")
  const [preset, setPreset] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | UiStatus>("all")
  const [createAdvanced, setCreateAdvanced] = React.useState<string[]>([])
  const [deleteTargetTask, setDeleteTargetTask] = React.useState<Task | null>(null)
  const displayNameLower = displayName.toLowerCase()
  const isTasksMode = basePath === "/tasks"
  const isTasksStarterPlan = isTasksMode && userPlan === "Starter"
  const isTasksProPlan = isTasksMode && userPlan === "Pro"
  const isStarterPlan = !isTasksMode && userPlan === "Starter"
  const [userSseReconnectNonce, setUserSseReconnectNonce] = React.useState(0)

  React.useEffect(() => {
    if (!showCreateDialog) setCreateAdvanced([])
  }, [showCreateDialog])

  React.useEffect(() => {
    if (!isTasksMode || !showCreateDialog) return
    // Always default to OFF whenever the Tasks create dialog is opened.
    setCountryTargetEnabled(false)
  }, [isTasksMode, showCreateDialog])

  React.useEffect(() => {
    if (!isTasksStarterPlan) return
    setCountryTargetEnabled(false)
    setSelectedCountries([])
  }, [isTasksStarterPlan])

  React.useEffect(() => {
    if (!isStarterPlan) return
    setAiSensitivityLevel("low")
    setResponsePatternDrift(false)
  }, [isStarterPlan])

  // AI Settings (Dumper-only)
  const [responsePatternDrift, setResponsePatternDrift] = React.useState(true)
  const [structuralChangeDetection, setStructuralChangeDetection] = React.useState(false)
  const [aiSensitivityLevel, setAiSensitivityLevel] = React.useState<"low" | "medium" | "high">("medium")
  const [antiBanEngine, setAntiBanEngine] = React.useState(false)
  const [payloadEngine, setPayloadEngine] = React.useState(false)
  const antiBanAvailable = false
  const payloadEngineAvailable = false

  // Injection Settings (Dumper-only)
  const [injectionUnion, setInjectionUnion] = React.useState(true)
  const [injectionError, setInjectionError] = React.useState(true)
  const [injectionBoolean, setInjectionBoolean] = React.useState(false)
  const [injectionTimebased, setInjectionTimebased] = React.useState(false)
  const hasLoadedFilesRef = React.useRef(false)
  const userSseAbortRef = React.useRef<AbortController | null>(null)
  const userSseRetryTimerRef = React.useRef<number | null>(null)
  const userSseRetryCountRef = React.useRef(0)
  const userLastEventIdRef = React.useRef("")
  const pollingTimerRef = React.useRef<number | null>(null)
  const hiddenDisconnectTimerRef = React.useRef<number | null>(null)
  const autoDisconnectedByHiddenRef = React.useRef(false)
  const bootstrapLoadedRef = React.useRef(false)

  const toggleCountry = React.useCallback((country: string) => {
    setSelectedCountries((prev) => {
      if (prev.includes(country)) return prev.filter((c) => c !== country)
      if (prev.length >= 3) {
        toast.error("You can select up to 3 countries")
        return prev
      }
      return [...prev, country]
    })
  }, [])

  const filteredCountries = React.useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    if (!q) return SCRAPER_COUNTRIES
    return SCRAPER_COUNTRIES.filter((country) => country.toLowerCase().includes(q))
  }, [countryQuery])

  const loadGlobalTaskSettings = React.useCallback(async () => {
    if (!isTasksMode) return
    try {
      const response = await fetch("/api/v1/tasks/settings", { method: "GET", credentials: "include" })
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; settings?: GlobalTaskSettings }
        | null
      if (!response.ok || !data?.success || !data.settings) return

      const settings = data.settings
      setSelectedModule("scraper")
      if (settings.file_id) {
        setSelectedFileId(settings.file_id)
      }
      setCountryTargetEnabled(settings.country_target_enabled === true)
      const validEngineIds = new Set<string>(SCRAPER_ENGINES.map((engine) => engine.id))
      const engine =
        settings.google_mode === "google_fast" || settings.google_mode === "google_deep"
          ? settings.google_mode
          : Array.isArray(settings.engines) && settings.engines.length > 0
          ? settings.engines.find((item): item is string => typeof item === "string" && validEngineIds.has(item))
          : undefined
      setSelectedEngine((engine as GoogleMode) || SCRAPER_ENGINES[0].id)
      setSelectedCountries(Array.isArray(settings.countries) ? settings.countries.slice(0, 3) : [])
      setScraperFilterRedirectLinks(settings.filter_redirect_links !== false)
      setScraperFilterBlacklistDomains(settings.filter_blacklist_domains !== false)
    } catch (error) {
      console.error("Failed to load global task settings:", error)
    }
  }, [isTasksMode])

  const saveGlobalTaskSettings = React.useCallback(async () => {
    if (!isTasksMode) return true
    try {
      const response = await fetch("/api/v1/tasks/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "scraper",
          file_id: selectedFileId || null,
          google_mode: selectedEngine,
          country_target_enabled: isTasksStarterPlan ? false : countryTargetEnabled,
          engines: [selectedEngine],
          countries: !isTasksStarterPlan && countryTargetEnabled ? selectedCountries : [],
          filter_redirect_links: scraperFilterRedirectLinks,
          filter_blacklist_domains: scraperFilterBlacklistDomains,
        }),
      })
      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to save global settings"))
      }
      return true
    } catch (error) {
      console.error("Failed to save global task settings:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save global settings")
      return false
    }
  }, [
    isTasksMode,
    selectedEngine,
    countryTargetEnabled,
    isTasksStarterPlan,
    scraperFilterBlacklistDomains,
    scraperFilterRedirectLinks,
    selectedCountries,
    selectedModule,
  ])

  const mapUserSummaryToTask = React.useCallback(
    (summary: UserTaskSummary, existing?: Task): Task | null => {
      const id = (summary.taskid || "").trim()
      if (!id) return null

      const normalizedStatus = normalizeTaskStatus(summary.status)
      if (normalizedStatus === "deleted") return null

      const doneRaw = Number(summary.websites_done ?? 0)
      const done = Number.isFinite(doneRaw) ? Math.max(0, Math.trunc(doneRaw)) : 0
      const totalRaw = Number(summary.websites_total ?? NaN)
      const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? Math.trunc(totalRaw) : null
      const ratioRaw = Number(summary.progress_ratio ?? NaN)
      const ratio =
        Number.isFinite(ratioRaw) && ratioRaw >= 0 ? Math.max(0, Math.min(1, ratioRaw)) : (total && total > 0 ? done / total : 0)
      const progressPercent = Math.max(0, Math.min(100, Math.round(ratio * 100)))

      const remainingFromPayload =
        typeof summary.remaining === "number"
          ? summary.remaining
          : typeof summary.remainng === "number"
            ? summary.remainng
            : null
      const remaining =
        remainingFromPayload !== null && Number.isFinite(remainingFromPayload)
          ? Math.max(0, Math.trunc(remainingFromPayload))
          : total !== null
            ? Math.max(0, total - done)
            : existing?.remaining ?? null

      const successRaw = Number(summary.success ?? NaN)
      const found = Number.isFinite(successRaw) ? Math.max(0, Math.trunc(successRaw)) : existing?.found ?? 0
      const etaRaw = Number(summary.eta_seconds ?? NaN)
      const etaSeconds = Number.isFinite(etaRaw) ? Math.max(0, Math.trunc(etaRaw)) : existing?.etaSeconds ?? 0

      return {
        id,
        name: (summary.taskname || existing?.name || "Untitled Task").trim(),
        status: normalizedStatus,
        found,
        etaSeconds,
        targetTotal: total ?? existing?.targetTotal ?? null,
        remaining,
        progressPercent,
        target: existing?.target ?? (total !== null ? String(total) : null),
        file: existing?.file || "-",
        started: existing?.started || "-",
        startedTime: existing?.startedTime || "-",
        isRunning: normalizedStatus === "running" || normalizedStatus === "running_recon",
      }
    },
    []
  )

  const mapApiTaskToTask = React.useCallback((task: ApiTask, existing?: Task): Task | null => {
    const id = (task.id || "").trim()
    if (!id) return null

    const normalizedStatus = normalizeTaskStatus(task.status)
    if (normalizedStatus === "deleted") return null

    const found = Number.isFinite(Number(task.found)) ? Math.max(0, Math.trunc(Number(task.found))) : (existing?.found ?? 0)
    const targetRaw = Number(task.target ?? NaN)
    const targetTotal =
      Number.isFinite(targetRaw) && targetRaw >= 0 ? Math.trunc(targetRaw) : (existing?.targetTotal ?? null)
    const progressPercent =
      targetTotal && targetTotal > 0
        ? Math.max(0, Math.min(100, Math.round((found / targetTotal) * 100)))
        : (existing?.progressPercent ?? 0)

    return {
      id,
      name: (task.name || existing?.name || "Untitled Task").trim(),
      status: normalizedStatus,
      found,
      etaSeconds: existing?.etaSeconds ?? 0,
      targetTotal,
      remaining: targetTotal !== null ? Math.max(0, targetTotal - found) : (existing?.remaining ?? null),
      progressPercent,
      target: task.target ?? existing?.target ?? null,
      file: task.file || existing?.file || "-",
      started: existing?.started || "-",
      startedTime: task.started_time || existing?.startedTime || "-",
      isRunning: normalizedStatus === "running" || normalizedStatus === "running_recon",
    }
  }, [])

  const refreshTasksInBackground = React.useCallback(async () => {
    try {
      const { response, data, durationMs } = await fetchJsonWithTimeout(
        apiBasePath,
        {
          method: "GET",
          credentials: "include",
        },
        TASKS_SNAPSHOT_TIMEOUT_MS
      )
      const payload = data as { success?: boolean; tasks?: ApiTask[] } | null
      if (!response.ok || !payload?.success || !Array.isArray(payload.tasks)) return
      const nextTasks = payload.tasks

      setTasksData((prev) => {
        const byId = new Map(prev.map((item) => [item.id, item]))
        return nextTasks
          .map((task) => mapApiTaskToTask(task, byId.get(task.id)))
          .filter((item): item is Task => !!item)
      })
      setIsLoading(false)
      setLastSyncAt(Date.now())
      setIsStaleCache(false)
      setSlowServer(durationMs >= SLOW_SERVER_THRESHOLD_MS)
    } catch (error) {
      console.error("Background refresh after delete failed:", error)
    }
  }, [apiBasePath, mapApiTaskToTask, SLOW_SERVER_THRESHOLD_MS, TASKS_SNAPSHOT_TIMEOUT_MS])

  const loadTasksSnapshot = React.useCallback(
    async (options?: { silent?: boolean; reason?: "bootstrap" | "polling" | "manual" }) => {
      const silent = options?.silent === true
      try {
        const { response, data, durationMs } = await fetchJsonWithTimeout(
          apiBasePath,
          {
            method: "GET",
            credentials: "include",
          },
          TASKS_SNAPSHOT_TIMEOUT_MS
        )
        if (!response.ok || !data || typeof data !== "object" || !(data as { success?: boolean }).success) {
          throw new Error(getHttpErrorMessage(response.status, "Failed to fetch tasks"))
        }
        const tasks = Array.isArray((data as { tasks?: ApiTask[] }).tasks)
          ? ((data as { tasks?: ApiTask[] }).tasks as ApiTask[])
          : []
        setTasksData((prev) => {
          const byId = new Map(prev.map((item) => [item.id, item]))
          return tasks
            .map((task) => mapApiTaskToTask(task, byId.get(task.id)))
            .filter((item): item is Task => !!item)
        })
        setIsLoading(false)
        setLastSyncAt(Date.now())
        setIsStaleCache(false)
        setSlowServer(durationMs >= SLOW_SERVER_THRESHOLD_MS)
        return true
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Failed to load tasks")
        }
        return false
      }
    },
    [apiBasePath, SLOW_SERVER_THRESHOLD_MS, TASKS_SNAPSHOT_TIMEOUT_MS, mapApiTaskToTask]
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(TASKS_CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as TasksCachePayload
      if (!parsed || !Array.isArray(parsed.tasks)) return
      setTasksData(parsed.tasks)
      setIsLoading(false)
      setIsStaleCache(true)
      setLastSyncAt(typeof parsed.ts === "number" ? parsed.ts : Date.now())
    } catch (error) {
      console.warn("Failed to restore tasks cache:", error)
    }
  }, [TASKS_CACHE_KEY])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (isLoading) return
    try {
      const payload: TasksCachePayload = {
        ts: Date.now(),
        tasks: tasksData,
      }
      window.localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn("Failed to persist tasks cache:", error)
    }
  }, [TASKS_CACHE_KEY, isLoading, tasksData])

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings", { method: "GET" })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(getHttpErrorMessage(response.status, "Failed to fetch user info"))
        }
        setUserPlan(data.plan || "Free")
        const quota = isTasksMode ? data.global_tasks : data.max_tasks
        setMaxTasks(Number.isFinite(Number(quota)) ? Math.max(0, Number(quota)) : 0)
      } catch (error) {
        console.error("Failed to load settings:", error)
        setUserPlan("Free")
        setMaxTasks(0)
      }
    }
    void fetchSettings()
  }, [isTasksMode])

  // Fetch files when dialog opens
  React.useEffect(() => {
    if (showCreateDialog) {
      if (!hasLoadedFilesRef.current) {
        void fetchFiles()
      }
      void loadGlobalTaskSettings()
    }
  }, [loadGlobalTaskSettings, showCreateDialog])

  const filterFilesForMode = React.useCallback(
    (rawFiles: UrlsFile[]) => {
      if (isTasksMode) {
        return rawFiles.filter((file) => {
          const isTxt = (file.name || "").toLowerCase().endsWith(".txt")
          return isTxt && file.type !== "urls"
        })
      }
      return rawFiles.filter((file) => file.type === "urls")
    },
    [isTasksMode]
  )

  const fetchFiles = async () => {
    if (typeof window !== "undefined") {
      try {
        const cachedRaw = window.localStorage.getItem(FILES_MINIMAL_CACHE_KEY)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as FilesMinimalCachePayload
          if (cached && Array.isArray(cached.files)) {
            const fromCache = filterFilesForMode(cached.files).map((file) => ({
              id: file.id,
              name: file.name,
              type: file.type,
            }))
            setAvailableFiles(fromCache)
            hasLoadedFilesRef.current = true
            return
          }
        }
      } catch (error) {
        console.warn("Failed to read files cache:", error)
      }
    }

    setIsLoadingFiles(true)
    try {
      const response = await fetch('/api/files?minimal=1', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to fetch files"))
      }

      const data = await response.json()

      const rawFiles = (data.files || []) as UrlsFile[]
      const filteredFiles = filterFilesForMode(rawFiles)
      const urlsFiles = filteredFiles.map((file) => ({ id: file.id, name: file.name, type: file.type }))
      if (typeof window !== "undefined") {
        const cachePayload: FilesMinimalCachePayload = {
          ts: Date.now(),
          files: rawFiles,
        }
        window.localStorage.setItem(FILES_MINIMAL_CACHE_KEY, JSON.stringify(cachePayload))
      }
      
      setAvailableFiles(urlsFiles)
      hasLoadedFilesRef.current = true
    } catch (error) {
      console.error('Failed to load files:', error)
      toast.error("Please Try Again")
      setAvailableFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const getAccessToken = React.useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  React.useEffect(() => {
    if (!enableExternalSse) {
      if (userSseRetryTimerRef.current) {
        window.clearTimeout(userSseRetryTimerRef.current)
        userSseRetryTimerRef.current = null
      }
      userSseAbortRef.current?.abort()
      userSseAbortRef.current = null
      setStreamMode("polling")
      return
    }

    let cancelled = false

    const cleanupRetryTimer = () => {
      if (userSseRetryTimerRef.current) {
        window.clearTimeout(userSseRetryTimerRef.current)
        userSseRetryTimerRef.current = null
      }
    }

    const cleanupHiddenDisconnectTimer = () => {
      if (hiddenDisconnectTimerRef.current) {
        window.clearTimeout(hiddenDisconnectTimerRef.current)
        hiddenDisconnectTimerRef.current = null
      }
    }

    const disconnectUserSSE = () => {
      cleanupRetryTimer()
      if (userSseAbortRef.current) {
        userSseAbortRef.current.abort()
        userSseAbortRef.current = null
      }
      setStreamMode("polling")
    }

    const scheduleReconnect = () => {
      if (cancelled || document.hidden) return
      cleanupRetryTimer()
      const retry = userSseRetryCountRef.current + 1
      userSseRetryCountRef.current = retry
      const delay = Math.min(30000, 1000 * 2 ** Math.min(retry, 5))
      setStreamMode(retry >= 3 ? "polling" : "retrying")
      userSseRetryTimerRef.current = window.setTimeout(() => {
        void connectUserSSE()
      }, delay)
    }

    const dispatchSSEEvent = (raw: string, eventName: string) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        const type = parsed?.type || eventName
        if (type === "user_snapshot") {
          const event = parsed as UserSnapshotEvent
          const tasks = Array.isArray(event.tasks) ? event.tasks : []
          setTasksData((prev) => {
            const byId = new Map(prev.map((item) => [item.id, item]))
            return tasks
              .map((summary) => mapUserSummaryToTask(summary, byId.get((summary.taskid || "").trim())))
              .filter((item): item is Task => !!item)
          })
          setIsLoading(false)
          setStreamMode("live")
          setIsStaleCache(false)
          setSlowServer(false)
          setLastSyncAt(Date.now())
        } else if (type === "task_update") {
          const event = parsed as UserTaskUpdateEvent
          const summary = event.task
          if (!summary?.taskid) return
          const taskId = summary.taskid.trim()
          setTasksData((prev) => {
            if ((event.reason || "").toLowerCase() === "delete" || normalizeTaskStatus(summary.status) === "deleted") {
              return prev.filter((item) => item.id !== taskId)
            }
            const idx = prev.findIndex((item) => item.id === taskId)
            const mapped = mapUserSummaryToTask(summary, idx >= 0 ? prev[idx] : undefined)
            if (!mapped) return prev.filter((item) => item.id !== taskId)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...next[idx], ...mapped }
              return next
            }
            return [mapped, ...prev]
          })
          setIsLoading(false)
          setStreamMode("live")
          setIsStaleCache(false)
          setSlowServer(false)
          setLastSyncAt(Date.now())
        }
      } catch (error) {
        console.error("[User SSE] parse error:", error, raw)
      }
    }

    const connectUserSSE = async () => {
      if (cancelled) return
      if (document.hidden) {
        setStreamMode("polling")
        return
      }
      setStreamMode("connecting")
      try {
        userSseAbortRef.current?.abort()
        const controller = new AbortController()
        userSseAbortRef.current = controller

        const token = await getAccessToken()
        if (!token) {
          scheduleReconnect()
          return
        }

        const url = new URL("/api/external/sse/user", window.location.origin)
        if (userLastEventIdRef.current) {
          url.searchParams.set("since", userLastEventIdRef.current)
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          scheduleReconnect()
          return
        }

        userSseRetryCountRef.current = 0
        setStreamMode("live")
        setIsLoading(false)
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
              if (currentId) userLastEventIdRef.current = currentId
              if (payload) dispatchSSEEvent(payload, currentEvent || "message")
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

        if (!cancelled) scheduleReconnect()
      } catch (error) {
        if (!cancelled) {
          console.error("[User SSE] connection error:", error)
          scheduleReconnect()
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cleanupHiddenDisconnectTimer()
        hiddenDisconnectTimerRef.current = window.setTimeout(() => {
          if (document.hidden) {
            autoDisconnectedByHiddenRef.current = true
            disconnectUserSSE()
          }
        }, HIDDEN_DISCONNECT_AFTER_MS)
        return
      }

      cleanupHiddenDisconnectTimer()
      if (autoDisconnectedByHiddenRef.current) {
        autoDisconnectedByHiddenRef.current = false
        void loadTasksSnapshot({ silent: true, reason: "manual" })
      }
      if (!userSseAbortRef.current) {
        void connectUserSSE()
      }
    }

    const handleOnline = () => {
      if (document.hidden) return
      if (!userSseAbortRef.current) {
        void connectUserSSE()
      }
    }

    void connectUserSSE()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("online", handleOnline)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
      cleanupHiddenDisconnectTimer()
      cleanupRetryTimer()
      userSseAbortRef.current?.abort()
      userSseAbortRef.current = null
    }
  }, [
    HIDDEN_DISCONNECT_AFTER_MS,
    enableExternalSse,
    getAccessToken,
    loadTasksSnapshot,
    mapUserSummaryToTask,
    userSseReconnectNonce,
  ])

  React.useEffect(() => {
    if (bootstrapLoadedRef.current) return
    bootstrapLoadedRef.current = true
    let cancelled = false
    ;(async () => {
      const ok = await loadTasksSnapshot({ silent: true, reason: "bootstrap" })
      if (cancelled) return
      if (!ok && tasksData.length === 0) {
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadTasksSnapshot, tasksData.length])

  React.useEffect(() => {
    if (streamMode === "live") {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
      return
    }

    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }

    pollingTimerRef.current = window.setInterval(() => {
      void loadTasksSnapshot({ silent: true, reason: "polling" })
    }, POLLING_INTERVAL_MS)

    return () => {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }
  }, [POLLING_INTERVAL_MS, loadTasksSnapshot, streamMode])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!taskName.trim()) {
      toast.error("Please enter a task name")
      return
    }

    if (!selectedFileId) {
      toast.error("Please select a file")
      return
    }
    if (isTasksStarterPlan && selectedEngine !== "google_lite") {
      toast.error("Starter plan only supports Google Lite")
      return
    }
    if (isTasksProPlan && selectedEngine === "google_deep") {
      toast.error("Google Deep requires Pro+ plan")
      return
    }

    setIsCreating(true)
    try {
      const settingsSaved = await saveGlobalTaskSettings()
      if (isTasksMode && !settingsSaved) {
        return
      }

      const response = await fetch(apiBasePath, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: taskName.trim(),
          file_id: selectedFileId,
          ai_mode: true,
          ...(isTasksMode
            ? {
                module: selectedModule,
                google_mode: selectedEngine,
                ...(selectedModule === "scraper"
                  ? {
                      scraper_settings: {
                        engines: [selectedEngine],
                        filter_redirect_links: scraperFilterRedirectLinks,
                        filter_blacklist_domains: scraperFilterBlacklistDomains,
                        antipublic: scraperAntipublic,
                        country_target_enabled: isTasksStarterPlan ? false : countryTargetEnabled,
                        countries: !isTasksStarterPlan && countryTargetEnabled ? selectedCountries : [],
                      },
                    }
                  : {}),
              }
            : {
                auto_dumper: autoDumper,
                preset: preset || null,
                ai_sensitivity_level: isStarterPlan ? "low" : aiSensitivityLevel,
                response_pattern_drift: isStarterPlan ? false : responsePatternDrift,
                structural_change_detection: structuralChangeDetection,
                anti_ban_engine: antiBanAvailable ? antiBanEngine : false,
                payload_engine: payloadEngineAvailable ? payloadEngine : false,
                injection_union: injectionUnion,
                injection_error: injectionError,
                injection_boolean: injectionBoolean,
                injection_timebased: injectionTimebased,
              }),
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(
          getHttpErrorMessage(response.status, "Failed to create task", {
            forbiddenMessage: "Task creation is blocked by plan or usage limit",
          })
        )
      }

      toast.success('Task created successfully')
      setShowCreateDialog(false)
      setTaskName("")
      setSelectedFileId("")
      setSelectedModule("scraper")
      setScraperFilterRedirectLinks(true)
      setScraperFilterBlacklistDomains(true)
      setSelectedEngine(SCRAPER_ENGINES[0].id)
      setCountryTargetEnabled(false)
      setSelectedCountries([])
      setCountryQuery("")
      setAutoDumper(false)
      setPreset("")
      setResponsePatternDrift(isStarterPlan ? false : true)
      setStructuralChangeDetection(false)
      setAiSensitivityLevel(isStarterPlan ? "low" : "medium")
      setAntiBanEngine(false)
      setPayloadEngine(false)
      setInjectionUnion(true)
      setInjectionError(true)
      setInjectionBoolean(false)
      setInjectionTimebased(false)
      // Some backends close user SSE after task creation; force a clean reconnect.
      setUserSseReconnectNonce((prev) => prev + 1)
      void refreshTasksInBackground()
    } catch (error) {
      console.error('Create task error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteTask = (task: Task) => {
    setDeleteTargetTask(task)
  }

  const confirmDeleteTask = async () => {
    if (!deleteTargetTask) return

    const targetTaskId = deleteTargetTask.id
    setIsDeleting(true)
    try {
      const response = await fetch(`${apiBasePath}/${targetTaskId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await response.json().catch(() => null)
      const deleteSucceeded =
        response.ok && (response.status === 204 || data?.success !== false)

      if (!deleteSucceeded) {
        throw new Error(getHttpErrorMessage(response.status, "Failed to delete task"))
      }

      toast.success("Task deleted")
      setTasksData((prev) => prev.filter((item) => item.id !== targetTaskId))
      setDeleteTargetTask(null)
      setUserSseReconnectNonce((prev) => prev + 1)
      void refreshTasksInBackground()
      router.refresh()
    } catch (error) {
      console.error("Delete task error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete task")
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredTasks = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasksData.filter((t) => {
      if (statusFilter !== "all" && toUiStatus(t.status) !== statusFilter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.target || "").toLowerCase().includes(q) ||
        (t.file || "").toLowerCase().includes(q)
      )
    })
  }, [tasksData, query, statusFilter])

  const usagePercent =
    maxTasks > 0 ? Math.min(100, Math.round((tasksData.length / maxTasks) * 100)) : 0

  const columns = getColumns(handleDeleteTask, basePath)
  const connectionLabel =
    streamMode === "live"
      ? "Live updates connected"
      : streamMode === "polling"
        ? "Realtime unavailable, using fallback polling"
        : streamMode === "retrying"
          ? "Reconnecting to realtime stream"
          : "Connecting to realtime stream"
  const lastSyncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "--"

  const table = useReactTable({
    data: filteredTasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Quiet header row (outer breadcrumb header already exists) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">{displayName}</div>
              <div className="text-sm text-muted-foreground">
                {maxTasks > 0 ? (
                  <>
                    <span className="font-mono text-foreground">
                      {tasksData.length}/{maxTasks}
                    </span>{" "}
                    used
                    <span className="mx-2 text-muted-foreground/60">&middot;</span>
                    <span className="font-mono">{Math.max(0, maxTasks - tasksData.length)}</span>{" "}
                    remaining
                  </>
                ) : (
                  <>{tasksData.length} {displayNameLower} jobs</>
                )}
              </div>
              {maxTasks > 0 && (
                <div className="pt-2 max-w-[320px]">
                  <Progress value={usagePercent} className="h-1" />
                </div>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => {
                if (userPlan === "Free") {
                  toast.error(`Free plan users cannot create ${displayNameLower} jobs. Please upgrade to Starter, Pro, or Pro+.`)
                  return
                }
                if (tasksData.length >= maxTasks) {
                  toast.error(
                    `${displayName} limit reached. You have ${tasksData.length} of ${maxTasks} ${displayNameLower} jobs. Please delete some jobs or upgrade your plan.`
                  )
                  return
                }
                setShowCreateDialog(true)
              }}
              disabled={userPlan === "Free" || (maxTasks > 0 && tasksData.length >= maxTasks)}
            >
              <IconPlus className="size-4" />
              Create task
            </Button>
          </div>

      {/* Table Section */}
          <div className="space-y-3">
            {/* Toolbar (not inside a card) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    table.setPageIndex(0)
                  }}
                  placeholder="Search task name, target, file..."
                  className="h-9 max-w-[420px]"
                />
                <div className="text-sm text-muted-foreground">
                  {table.getPrePaginationRowModel().rows.length} results
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as typeof statusFilter)
                    table.setPageIndex(0)
                  }}
                >
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="complete">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{connectionLabel}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Last sync: {lastSyncLabel}</span>
              {isStaleCache ? (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Showing cached data</span>
                </>
              ) : null}
              {slowServer ? (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Server is slow, auto-retrying in background</span>
                </>
              ) : null}
            </div>

            {/* Table (integrated, minimal chrome) */}
            <div className="border-y">
              {isLoading && tasksData.length === 0 ? (
                <div className="h-64 p-3">
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <div key={`task-skeleton-${idx}`} className="grid grid-cols-6 gap-3">
                        <div className="h-4 rounded bg-muted animate-pulse col-span-2" />
                        <div className="h-4 rounded bg-muted animate-pulse col-span-1" />
                        <div className="h-4 rounded bg-muted animate-pulse col-span-1" />
                        <div className="h-4 rounded bg-muted animate-pulse col-span-1" />
                        <div className="h-4 rounded bg-muted animate-pulse col-span-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Table className="table-fixed">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className="bg-muted/30 hover:bg-muted/30"
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={[
                              "h-8 px-2 py-1 text-[11px] font-medium text-muted-foreground",
                              header.column.id === "name" ? "w-[32%]" : "",
                              header.column.id === "modules" ? "w-[12%]" : "",
                              header.column.id === "status" ? "w-[16%]" : "",
                              header.column.id === "progress" ? "w-[16%]" : "",
                              header.column.id === "remaining" ? "w-[10%]" : "",
                              header.column.id === "eta" ? "w-[8%]" : "",
                              header.column.id === "actions" ? "w-[6%]" : "",
                              header.column.id === "modules" ? "pl-1 pr-1 text-left" : "",
                            ].join(" ")}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className={[
                                "px-2 py-2 align-middle",
                                cell.column.id === "name" ? "pr-3" : "",
                                cell.column.id === "modules" ? "pl-1 pr-1" : "",
                              ].join(" ")}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={columns.length} className="h-[400px]">
                          <div className="flex flex-col items-center justify-center text-center py-12">
                            <div className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 mb-4">
                              <IconList className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-lg font-semibold tracking-tight mb-2">{`No ${displayNameLower} jobs yet`}</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-[420px]">
                              Create your first task to start scanning
                            </p>
                            {(userPlan === "Pro" || userPlan === "Pro+") &&
                              tasksData.length < maxTasks && (
                                <Button onClick={() => setShowCreateDialog(true)} size="sm">
                                  <IconPlus className="size-4" />
                                  Create task
                                </Button>
                              )}
                            {userPlan === "Free" && (
                              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                                <IconShield className="size-4" />
                                <span>{`Upgrade to Starter, Pro, or Pro+ to create ${displayNameLower} jobs`}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {table.getRowModel().rows?.length > 0 && (
              <div className="flex items-center justify-between py-1">
                <div className="text-sm text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <IconChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <IconChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto scrollbar-hide data-[state=open]:duration-200">
          <DialogHeader className="flex-row items-start justify-between motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none">
            <div className="space-y-1 text-left">
              <DialogTitle>Create new task</DialogTitle>
              <DialogDescription>Configure settings and start scanning.</DialogDescription>
            </div>
            {!isTasksMode && (
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
            )}
          </DialogHeader>
          
          <form
            onSubmit={handleCreateTask}
            className="space-y-6 py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-name">Task name</Label>
                <Input
                  id="task-name"
                  placeholder="e.g. My first scan"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Lists</Label>
                <Select value={selectedFileId} onValueChange={setSelectedFileId} disabled={isCreating}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoadingFiles ? "Loading..." : "Select a file"} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    className="w-[var(--radix-select-trigger-width)] max-h-[260px] overflow-y-auto"
                  >
                    {availableFiles.length > 0 ? (
                      availableFiles.map((file) => (
                        <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-2 text-sm text-muted-foreground">No lists found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isTasksMode && (
              <div className="space-y-2">
                <Label htmlFor="module">Modules</Label>
                <Select
                  value={selectedModule}
                  onValueChange={(v) => setSelectedModule(v as "scraper" | "keyword_scraper" | "vulnerability_scanner")}
                  disabled={isCreating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="scraper">
                      <span className="inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21 21l-4.34-4.34"/>
                          <circle cx="11" cy="11" r="8"/>
                        </svg>
                        <span>Scraper</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="keyword_scraper" disabled>
                      <span className="inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 5H3m7 7H3m7 7H3"/>
                          <circle cx="17" cy="15" r="3"/>
                          <path d="m21 19l-1.9-1.9"/>
                        </svg>
                        <span>Keyword Scraper</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Coming soon</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="vulnerability_scanner" disabled>
                      <span className="inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20v-9m2-4a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4zm.12-3.12L16 2"/>
                          <path d="M21 21a4 4 0 0 0-3.81-4M21 5a4 4 0 0 1-3.55 3.97M22 13h-4M3 21a4 4 0 0 1 3.81-4M3 5a4 4 0 0 0 3.55 3.97M6 13H2M8 2l1.88 1.88M9 7.13V6a3 3 0 1 1 6 0v1.13"/>
                        </svg>
                        <span>Vulnerability Scanner</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Coming soon</Badge>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isTasksMode && selectedModule === "scraper" && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="text-sm font-medium">Settings</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 px-3 py-2 sm:col-span-2">
                    <Label htmlFor="scraper-engine" className="mb-2 block text-sm">Engine</Label>
                    <Select value={selectedEngine} onValueChange={(v) => setSelectedEngine(v as GoogleMode)} disabled={isCreating}>
                    <SelectTrigger id="scraper-engine" className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {SCRAPER_ENGINES.map((engine) => {
                        const EngineIcon = engine.icon
                        const disabled =
                          engine.id === "google_fast"
                            ? isTasksStarterPlan
                            : engine.id === "google_deep"
                              ? isTasksStarterPlan || isTasksProPlan
                              : false
                        return (
                          <SelectItem key={engine.id} value={engine.id} disabled={disabled}>
                            <span className="inline-flex items-center gap-2">
                              <EngineIcon className="size-4" />
                              <span>{engine.label}</span>
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {isTasksStarterPlan
                        ? "Starter: Google Lite only"
                        : isTasksProPlan
                          ? "Pro: Google Lite and Google Fast"
                      : "Pro+: Google Lite, Google Fast, Google Deep"}
                </div>
              </div>

                  <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 5h18l-7 8v5l-4 2v-7z" />
                      </svg>
                      <span>Filtere redirect links</span>
                    </div>
                    <Switch
                      checked={scraperFilterRedirectLinks}
                      onCheckedChange={setScraperFilterRedirectLinks}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path fill="none" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                      </svg>
                      <span>Filtere Blacklist Domains</span>
                    </div>
                    <Switch
                      checked={scraperFilterBlacklistDomains}
                      onCheckedChange={setScraperFilterBlacklistDomains}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 sm:col-span-2">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4.929 4.929L19.07 19.071" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        <span>Antipublic</span>
                      </span>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Coming soon</Badge>
                    </div>
                    <Switch checked={scraperAntipublic} disabled />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <div className="text-sm font-medium">Country Target Settings</div>
                      {isTasksStarterPlan && (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] border-red-300/80 bg-red-50 text-red-700 dark:border-red-700/70 dark:bg-red-950/30 dark:text-red-300"
                        >
                          <IconLock className="size-3" />
                          Unavailable on Starter
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={countryTargetEnabled}
                      onCheckedChange={setCountryTargetEnabled}
                      disabled={isCreating || isTasksStarterPlan}
                    />
                  </div>
                  {countryTargetEnabled && (
                    <div className="rounded-md border p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Search countries..."
                          value={countryQuery}
                          onChange={(e) => setCountryQuery(e.target.value)}
                          className="h-8"
                          disabled={isCreating}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setSelectedCountries([])}
                          disabled={isCreating || selectedCountries.length === 0}
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="max-h-[220px] overflow-y-auto rounded-md border p-2">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {filteredCountries.map((country) => {
                            const selected = selectedCountries.includes(country)
                            const iso2 = COUNTRY_ISO2[country] || "UN"
                            const tld = countryTld(iso2)
                            return (
                              <button
                                key={country}
                                type="button"
                                onClick={() => toggleCountry(country)}
                                disabled={isCreating}
                                className={[
                                  "flex items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors",
                                  selected
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-border bg-background hover:bg-muted/40",
                                ].join(" ")}
                              >
                                <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                                  <img
                                    src={`https://flagcdn.com/w20/${iso2.toLowerCase()}.png`}
                                    alt={`${country} flag`}
                                    className="h-3.5 w-5 rounded-[2px] object-cover"
                                    loading="lazy"
                                  />
                                  <span className="truncate">{country}</span>
                                  <span className="text-[10px] text-muted-foreground">{tld}</span>
                                </span>
                                <span className={selected ? "text-primary" : "text-muted-foreground"}>{selected ? "On" : "Off"}</span>
                              </button>
                            )
                          })}
                        </div>
                        {filteredCountries.length === 0 && (
                          <div className="py-4 text-center text-xs text-muted-foreground">No countries found</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Selected: {countryTargetEnabled ? selectedCountries.length : 0}/3</span>
                    <span>Available: {countryTargetEnabled ? filteredCountries.length : 0}</span>
                  </div>
                </div>
              </div>
            )}

            {!isTasksMode && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconSparkles className="size-4 text-muted-foreground" />
                    <div className="text-sm font-medium">AI settings</div>
                    <Badge variant="outline" className="bg-transparent text-[10px] font-mono">enabled</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    SQLBot AI is always on. Strategy + Evasion are the core engines, then use AI tuning for extra power.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-sensitivity" className="flex items-center gap-2">
                    <IconAdjustments className="size-4 text-muted-foreground" />
                    AI sensitivity
                  </Label>
                  <Select
                    value={aiSensitivityLevel}
                    onValueChange={(v) => setAiSensitivityLevel(v as "low" | "medium" | "high")}
                    disabled={isCreating || isStarterPlan}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium" disabled={isStarterPlan}>Medium</SelectItem>
                      <SelectItem value="high" disabled={isStarterPlan}>High</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {isStarterPlan
                      ? "Starter plan is limited to Low sensitivity."
                      : "Higher sensitivity can increase findings but may cost more credits."}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Engines</Label>
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="response-drift" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                          <IconCpu className="size-4 text-muted-foreground" />
                          <span className="whitespace-nowrap">Strategy Engine</span>
                          {isStarterPlan ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Starter locked</Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">Recommended</Badge>
                          )}
                        </Label>
                        <div className="text-xs text-muted-foreground">Adapts strategy based on responses.</div>
                      </div>
                      <Switch
                        id="response-drift"
                        checked={isStarterPlan ? false : responsePatternDrift}
                        onCheckedChange={setResponsePatternDrift}
                        disabled={isCreating || isStarterPlan}
                      />
                    </div>

                    <div className="flex items-start justify-between rounded-lg border bg-background p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="structural-change" className="cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                          <IconShieldCheck className="size-4 text-muted-foreground" />
                          <span className="whitespace-nowrap">Evasion Engine</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">Recommended</Badge>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                        </Label>
                        <div className="text-xs text-muted-foreground">Smarter WAF bypass with stronger evasion capability. This engine consumes credits when enabled.</div>
                      </div>
                      <Switch
                        id="structural-change"
                        checked={structuralChangeDetection}
                        onCheckedChange={setStructuralChangeDetection}
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {!isTasksMode && (
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="auto-dumper" className="cursor-pointer">Auto dumper</Label>
                  <div className="text-xs text-muted-foreground">Automatically dump found data.</div>
                </div>
                <Switch id="auto-dumper" checked={autoDumper} onCheckedChange={setAutoDumper} disabled={isCreating} />
              </div>

              {autoDumper && (
                <div className="space-y-2">
                  <Label htmlFor="preset">Preset format</Label>
                  <Select value={preset} onValueChange={setPreset} disabled={isCreating}>
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
            )}

            {!isTasksMode && (
            <Accordion
              type="multiple"
              value={createAdvanced}
              onValueChange={(v) => setCreateAdvanced(v as string[])}
              className="rounded-lg border px-4"
            >
              <AccordionItem value="ai-tuning">
                <AccordionTrigger>Advanced: AI tuning</AccordionTrigger>
                <AccordionContent>
                  {createAdvanced.includes("ai-tuning") && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-start justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="anti-ban-engine" className="cursor-pointer text-sm flex items-center gap-2">
                            <IconShield className="size-4 text-muted-foreground" />
                            AntiBan engine
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Currently unavailable</Badge>
                          </Label>
                          <div className="text-xs text-muted-foreground">Temporarily unavailable in current version.</div>
                        </div>
                        <Switch id="anti-ban-engine" checked={antiBanEngine} onCheckedChange={setAntiBanEngine} disabled />
                      </div>

                      <div className="flex items-start justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="payload-engine" className="cursor-pointer text-sm flex items-center gap-2">
                            <IconSparkles className="size-4 text-muted-foreground" />
                            Payload engine
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Currently unavailable</Badge>
                          </Label>
                          <div className="text-xs text-muted-foreground">Temporarily unavailable in current version.</div>
                        </div>
                        <Switch
                          id="payload-engine"
                          checked={payloadEngineAvailable ? payloadEngine : false}
                          onCheckedChange={setPayloadEngine}
                          disabled
                        />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="injection">
                <AccordionTrigger>Advanced: injection settings</AccordionTrigger>
                <AccordionContent>
                  {createAdvanced.includes("injection") && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="injection-union" checked={injectionUnion} onCheckedChange={(checked) => setInjectionUnion(checked === true)} disabled={isCreating} />
                          <Label htmlFor="injection-union" className="cursor-pointer text-sm font-normal">Union-based</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="injection-error" checked={injectionError} onCheckedChange={(checked) => setInjectionError(checked === true)} disabled={isCreating} />
                          <Label htmlFor="injection-error" className="cursor-pointer text-sm font-normal">Error-based</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="injection-boolean" checked={injectionBoolean} onCheckedChange={(checked) => setInjectionBoolean(checked === true)} disabled={isCreating} />
                          <Label htmlFor="injection-boolean" className="cursor-pointer text-sm font-normal inline-flex items-center gap-2">
                            Boolean-based
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="injection-timebased" checked={injectionTimebased} onCheckedChange={(checked) => setInjectionTimebased(checked === true)} disabled={isCreating} />
                          <Label htmlFor="injection-timebased" className="cursor-pointer text-sm font-normal inline-flex items-center gap-2">
                            Time-based
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600 border-amber-300/70">Costs credits</Badge>
                          </Label>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Boolean-based and Time-based checks consume extra credits when enabled.</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
                <IconX className="size-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <IconLoader2 className="size-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <IconPlus className="size-4" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTargetTask}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTargetTask(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-500">Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm">
            <span className="font-medium">Task: </span>
            <span className="text-muted-foreground">{deleteTargetTask?.name || "Unnamed Task"}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTargetTask(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteTask} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Task"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
