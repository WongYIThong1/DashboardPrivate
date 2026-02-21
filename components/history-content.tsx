"use client"

import * as React from "react"
import {
  IconCircleCheck,
  IconAlertTriangle,
  IconClock,
  IconDotsVertical,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconDownload,
  IconCalendar,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type HistoryStatus = "completed" | "failed" | "deleted"

type HistoryItem = {
  taskid: string
  taskname: string
  status: HistoryStatus
  success: number
  dumped: number
  duration_ms: number
  completed_time: string
}

type HistoryTotals = {
  totaltasks: number
  completed: number
  failed: number
  totaldumped: number
}

type HistoryPagination = {
  page: number
  page_size: number
  total_items: number
  total_pages: number
  has_more: boolean
}

type HistorySnapshot = {
  type: string
  items: HistoryItem[]
  totals: HistoryTotals
  pagination: HistoryPagination
  ts: number
}

const EMPTY_SNAPSHOT: HistorySnapshot = {
  type: "history_snapshot",
  items: [],
  totals: {
    totaltasks: 0,
    completed: 0,
    failed: 0,
    totaldumped: 0,
  },
  pagination: {
    page: 1,
    page_size: 10,
    total_items: 0,
    total_pages: 1,
    has_more: false,
  },
  ts: Date.now(),
}

const HISTORY_LIMIT_DEFAULT = 100
const HISTORY_LIMIT_MAX = 1000

function clampHistoryLimit(value: number): number {
  const safe = Number.isFinite(value) ? Math.trunc(value) : HISTORY_LIMIT_DEFAULT
  return Math.max(1, Math.min(HISTORY_LIMIT_MAX, safe))
}

const statusConfig: Record<HistoryStatus, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
  completed: { icon: IconCircleCheck, label: "Completed", color: "text-emerald-500" },
  failed: { icon: IconAlertTriangle, label: "Failed", color: "text-red-500" },
  deleted: { icon: IconClock, label: "Deleted", color: "text-muted-foreground" },
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

function toStatus(value: unknown): HistoryStatus {
  const v = toText(value).toLowerCase()
  if (v === "completed" || v === "failed" || v === "deleted") return v
  return "failed"
}

function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.trunc(ms))
  if (safe < 1000) return "0s"
  const totalSeconds = Math.floor(safe / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours}h ${remMinutes}m`
}

function formatCompletedTime(value: string): string {
  const ts = Date.parse(value)
  if (!Number.isFinite(ts)) return "-"
  return new Date(ts).toLocaleString()
}

function normalizeItems(input: unknown): HistoryItem[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    const row = isRecord(item) ? item : {}
    return {
      taskid: toText(row.taskid),
      taskname: toText(row.taskname, "Untitled Task"),
      status: toStatus(row.status),
      success: toInteger(row.success),
      dumped: toInteger(row.dumped),
      duration_ms: toInteger(row.duration_ms),
      completed_time: toText(row.completed_time),
    }
  })
}

function normalizeTotals(input: unknown): HistoryTotals {
  const row = isRecord(input) ? input : {}
  return {
    totaltasks: toInteger(row.totaltasks),
    completed: toInteger(row.completed),
    failed: toInteger(row.failed),
    totaldumped: toInteger(row.totaldumped),
  }
}

function normalizePagination(input: unknown, fallbackPage: number): HistoryPagination {
  const row = isRecord(input) ? input : {}
  const totalPages = Math.max(1, toInteger(row.total_pages, 1))
  const page = Math.min(totalPages, Math.max(1, toInteger(row.page, fallbackPage)))
  return {
    page,
    page_size: Math.max(1, toInteger(row.page_size, 10)),
    total_items: toInteger(row.total_items),
    total_pages: totalPages,
    has_more: Boolean(row.has_more),
  }
}

function normalizeSnapshot(input: unknown, fallbackPage: number): HistorySnapshot {
  const row = isRecord(input) ? input : {}
  return {
    type: toText(row.type, "history_snapshot"),
    items: normalizeItems(row.items),
    totals: normalizeTotals(row.totals),
    pagination: normalizePagination(row.pagination, fallbackPage),
    ts: toInteger(row.ts, Date.now()),
  }
}

const columns: ColumnDef<HistoryItem>[] = [
  {
    accessorKey: "taskname",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Task
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium font-[family-name:var(--font-inter)]">{row.getValue("taskname")}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Status
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as HistoryStatus
      const config = statusConfig[status] ?? statusConfig.failed
      const StatusIcon = config.icon
      return (
        <Badge variant="outline" className="border-border bg-transparent">
          <StatusIcon size={12} className={config.color} />
          <span className="text-foreground">{config.label}</span>
        </Badge>
      )
    },
  },
  {
    accessorKey: "success",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Success
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-jetbrains-mono)]">
        {(row.getValue("success") as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "dumped",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Dumped
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-jetbrains-mono)]">
        {(row.getValue("dumped") as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "duration_ms",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Duration
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-muted-foreground">
        {formatDuration(row.getValue("duration_ms") as number)}
      </span>
    ),
  },
  {
    accessorKey: "completed_time",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Completed
        {column.getIsSorted() === "asc" ? (
          <IconSortAscending size={14} className="ml-1" />
        ) : column.getIsSorted() === "desc" ? (
          <IconSortDescending size={14} className="ml-1" />
        ) : (
          <IconArrowsSort size={14} className="ml-1 opacity-50" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
        {formatCompletedTime(row.getValue("completed_time"))}
      </span>
    ),
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <IconDotsVertical size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled
            className="cursor-not-allowed text-muted-foreground focus:text-muted-foreground"
          >
            <IconDownload size={14} className="mr-2" />
            Export (Unavailable now)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export function HistoryContent() {
  const [snapshot, setSnapshot] = React.useState<HistorySnapshot>(EMPTY_SNAPSHOT)
  const [isLoading, setIsLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "completed_time", desc: true },
  ])
  const [page, setPage] = React.useState(1)

  const getAccessToken = React.useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const fetchHistory = React.useCallback(async (nextPage: number) => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error("No access token")
    }

    const url = new URL("/api/external/history", window.location.origin)
    url.searchParams.set("page", String(Math.max(1, nextPage)))
    url.searchParams.set("limit", String(clampHistoryLimit(HISTORY_LIMIT_DEFAULT)))

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`History request failed (HTTP ${response.status})`)
    }

    const normalized = normalizeSnapshot(await response.json(), nextPage)
    setSnapshot(normalized)
    if (normalized.pagination.page !== nextPage) {
      setPage(normalized.pagination.page)
    }
  }, [getAccessToken])

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      try {
        await fetchHistory(page)
      } catch (error) {
        console.error("[History] fetch failed:", error)
        if (!cancelled) {
          toast.error("Failed to load history")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [fetchHistory, page])

  const table = useReactTable({
    data: snapshot.items,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const totals = snapshot.totals
  const paging = snapshot.pagination

  return (
    <div className="flex min-w-0 flex-1 flex-col p-6 font-[family-name:var(--font-inter)]">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold">
                  {totals.totaltasks.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <IconCalendar className="size-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold">
                  {totals.completed.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <IconCircleCheck className="size-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold">
                  {totals.failed.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2">
                <IconAlertTriangle className="size-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Dumped</p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold">
                  {totals.totaldumped.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2">
                <IconDownload className="size-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading history...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No history found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page {paging.page} of {paging.total_pages}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={isLoading || paging.page <= 1}
          >
            <IconChevronLeft className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={isLoading || !paging.has_more}
          >
            <IconChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
